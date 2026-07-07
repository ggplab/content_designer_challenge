import { getGoogleAccessToken } from "../_shared/google-auth.ts";
import { calcStreak, parseWeekNumber } from "../_shared/week.ts";
import { fetchGuildMemberIds, sendDiscordEmbed } from "./services/discord.ts";
import { fetchSheetRows } from "./services/sheets.ts";
import { pickRecommendedContents, type ContentItem } from "./services/gemini.ts";

const DASHBOARD_URL = "https://ggplab.github.io/content_designer_challenge/";

// ── 참가자 명단 (SSOT: web/members.json, GitHub Pages로 서빙) ────────────────

export type Roster = { names: string[]; nicknameMap: Record<string, string> };

export async function fetchRoster(): Promise<Roster> {
  const url = Deno.env.get("MEMBERS_JSON_URL") ?? `${DASHBOARD_URL}members.json`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return {
      names: (data.participants ?? []).map((p: { name: string }) => p.name),
      nicknameMap: data.nickname_map ?? {},
    };
  } catch (e) {
    console.error("[summary] members.json 로드 실패 — 시트 기록 기반으로 대체:", e);
    return { names: [], nicknameMap: {} };
  }
}

// ── 순수 집계 로직 (유닛 테스트 대상) ────────────────────────────────────────

/** 시트 데이터 행 → 유저별 인증 주차 집합 (닉네임은 표기명으로 정규화) */
export function buildUserWeeks(
  dataRows: string[][],
  toRealName: (name: string) => string
): Map<string, Set<number>> {
  const userWeeks = new Map<string, Set<number>>();
  for (const row of dataRows) {
    const week = parseWeekNumber(row[4] ?? "");
    if (week === null) continue;
    const user = toRealName(row[1] ?? "Unknown");
    if (!userWeeks.has(user)) userWeeks.set(user, new Set());
    userWeeks.get(user)!.add(week);
  }
  return userWeeks;
}

export type Achievement = { name: string; achieved: boolean; streak: number };

/** 정산 주차 기준 멤버별 달성/미달성 + 스트릭(정산 주차 포함 연속 인증 주 수) */
export function computeAchievements(
  roster: string[],
  userWeeks: Map<string, Set<number>>,
  settledWeek: number
): Achievement[] {
  return roster.map((name) => {
    const weeks = userWeeks.get(name) ?? new Set<number>();
    return {
      name,
      achieved: weeks.has(settledWeek),
      streak: calcStreak(weeks, settledWeek),
    };
  });
}

/** Gemini 추천 후보 필터 — 요약이 있고 fallback 패턴("~ 콘텐츠")이 아닌 행 */
export function filterCandidates(weekRows: string[][]): string[][] {
  return weekRows.filter((row) => {
    const summary = row[5] ?? "";
    return summary.length > 5 && !/^.+\s콘텐츠$/.test(summary);
  });
}

// ── 정산 실행 ────────────────────────────────────────────────────────────────

export async function runSummary(weekLabel: string): Promise<void> {
  const settledWeek = parseWeekNumber(weekLabel);
  if (settledWeek === null) {
    await sendDiscordEmbed({
      title: "📊 주간 정산",
      description: "아직 준비기간이에요 — 발행 1주차부터 정산을 시작합니다.",
      color: 0x95a5a6,
    });
    return;
  }

  const [accessToken, memberIds, roster] = await Promise.all([
    getGoogleAccessToken(),
    fetchGuildMemberIds(),
    fetchRoster(),
  ]);

  const toRealName = (name: string) => roster.nicknameMap[name] ?? name;
  // Discord 멘션: 길드 닉네임 → 표기명으로 정규화해 매핑
  const realNameToId = new Map<string, string>();
  for (const [nick, id] of memberIds) realNameToId.set(toRealName(nick), id);
  const mention = (name: string) =>
    realNameToId.has(name) ? `<@${realNameToId.get(name)}>` : name;

  const rows = await fetchSheetRows(accessToken);
  const dataRows = rows.slice(1);
  const userWeeks = buildUserWeeks(dataRows, toRealName);

  // members.json 로드 실패 시 시트에 기록된 유저를 명단으로 대체
  const rosterNames = roster.names.length > 0 ? roster.names : [...userWeeks.keys()];
  const achievements = computeAchievements(rosterNames, userWeeks, settledWeek);

  const resultLines = achievements.length > 0
    ? achievements.map((a) =>
      a.achieved
        ? `✅ ${mention(a.name)} — 달성 · 🔥 ${a.streak}주 연속`
        : `❌ ${mention(a.name)} — 미달성`
    )
    : ["지난주 인증 기록이 없어요."];

  const sections: string[] = [
    `**${weekLabel} 결과 — 매주 유튜브 롱폼 1개**\n${resultLines.join("\n")}`,
  ];

  // 지난주 추천 콘텐츠 (Gemini 선정 — 후보가 있을 때만)
  const weekRows = dataRows.filter((row) => (row[4] ?? "").startsWith(weekLabel));
  const candidates: ContentItem[] = filterCandidates(weekRows).map((row) => ({
    user: toRealName(row[1] ?? "Unknown"),
    platform: row[2] ?? "기타",
    summary: row[5],
    url: row[3] ?? "",
  }));

  console.log(`[summary] 추천 후보 수: ${candidates.length}`);
  if (candidates.length >= 1) {
    const picks = await pickRecommendedContents(candidates);
    const recLines: string[] = ["**지난주 추천 콘텐츠**"];
    const eduItem = picks.educational !== null ? candidates[picks.educational.index] : null;
    const chalItem = picks.challenge !== null ? candidates[picks.challenge.index] : null;
    const hookItem = picks.hooking !== null ? candidates[picks.hooking.index] : null;

    if (eduItem) {
      recLines.push(`📚 인사이트 얻어요 — ${picks.educational!.reason}`);
      recLines.push(`${mention(eduItem.user)} · ${eduItem.url}`);
    }
    if (chalItem && chalItem !== eduItem) {
      recLines.push(`🎯 챌린지 취지에 딱! — ${picks.challenge!.reason}`);
      recLines.push(`${mention(chalItem.user)} · ${chalItem.url}`);
    }
    if (hookItem && hookItem !== eduItem && hookItem !== chalItem) {
      recLines.push(`🪝 이건 클릭 안 할 수 없어 — ${picks.hooking!.reason}`);
      recLines.push(`${mention(hookItem.user)} · ${hookItem.url}`);
    }
    if (recLines.length > 1) sections.push(recLines.join("\n"));
  }

  sections.push(
    `**이번 주도 딱 1개, 알고리즘에 맡겨요 💪**\n제출 현황이 궁금하다면? [대시보드 바로가기](${DASHBOARD_URL})`
  );

  await sendDiscordEmbed({
    title: `📊 ${weekLabel} 주간 정산`,
    color: 0x5865f2,
    description: sections.join("\n\n\n"),
  });
}
