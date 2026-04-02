import { getGoogleAccessToken } from "../_shared/google-auth.ts";
import { fetchGuildMemberIds, sendDiscordEmbed } from "./services/discord.ts";
import { fetchSheetRows } from "./services/sheets.ts";
import { pickRecommendedContents, type ContentItem } from "./services/gemini.ts";
import { shortenUrl } from "./services/url.ts";

export async function runSummary(weekLabel: string): Promise<void> {
  const [accessToken, memberIds] = await Promise.all([
    getGoogleAccessToken(),
    fetchGuildMemberIds(),
  ]);
  const mention = (nick: string) => memberIds.has(nick) ? `<@${memberIds.get(nick)}>` : nick;

  const rows = await fetchSheetRows(accessToken);
  const weekRows = rows.slice(1).filter((row) => (row[4] ?? "").startsWith(weekLabel));

  if (weekRows.length === 0) {
    await sendDiscordEmbed({
      title: `📊 ${weekLabel} 주간 정산`,
      description: "지난주 인증 없음.",
      color: 0x95a5a6,
    });
    return;
  }

  // 유저별 집계
  const userMap = new Map<string, { count: number; platforms: string[] }>();
  for (const row of weekRows) {
    const user = row[1] ?? "Unknown";
    const platform = row[2] ?? "기타";
    const existing = userMap.get(user);
    if (existing) {
      existing.count++;
      existing.platforms.push(platform);
    } else {
      userMap.set(user, { count: 1, platforms: [platform] });
    }
  }

  const sorted = [...userMap.entries()].sort((a, b) => b[1].count - a[1].count);
  const names = sorted.map(([user]) => user).join(", ");
  const medals = ["🥇", "🥈", "🥉"];
  const top3 = sorted.slice(0, 3)
    .map(([user, { count }], i) => `${medals[i]} ${mention(user)} (${count}회)`)
    .join("\n");

  // Gemini 추천 후보 (요약이 있고 fallback 패턴 아닌 것)
  const candidates: ContentItem[] = weekRows
    .filter((row) => {
      const summary = row[5] ?? "";
      console.log(`[summary] candidate check: "${summary}" length=${summary.length} pattern=${/^.+\s콘텐츠$/.test(summary)}`);
      return summary.length > 5 && !/^.+\s콘텐츠$/.test(summary);
    })
    .map((row) => ({
      user: row[1] ?? "Unknown",
      platform: row[2] ?? "기타",
      summary: row[5],
      url: row[3] ?? "",
    }));

  const sections: string[] = [
    `**지난주 인증한 멤버 ${userMap.size}명**\n${names}`,
    `**제출 횟수 Top 3**\n${top3}`,
  ];

  console.log(`[summary] 추천 후보 수: ${candidates.length}`);
  if (candidates.length >= 1) {
    const recLines: string[] = ["**지난주 추천 콘텐츠**"];
    const picks = await pickRecommendedContents(candidates);
    const eduItem = picks.educational !== null ? candidates[picks.educational.index] : null;
    const chalItem = picks.challenge !== null ? candidates[picks.challenge.index] : null;
    const hookItem = picks.hooking !== null ? candidates[picks.hooking.index] : null;

    if (eduItem) {
      recLines.push(`📚 인사이트 얻어요 — ${picks.educational!.reason}`);
      recLines.push(`${mention(eduItem.user)} · ${eduItem.platform} · ${await shortenUrl(eduItem.url)}`);
    }
    if (chalItem) {
      recLines.push(`🎯 챌린지 취지에 딱! — ${picks.challenge!.reason}`);
      recLines.push(`${mention(chalItem.user)} · ${chalItem.platform} · ${await shortenUrl(chalItem.url)}`);
    }
    if (hookItem) {
      recLines.push(`🪝 이건 클릭 안 할 수 없어 — ${picks.hooking!.reason}`);
      recLines.push(`${mention(hookItem.user)} · ${hookItem.platform} · ${await shortenUrl(hookItem.url)}`);
    }
    sections.push(recLines.join("\n"));
  } else {
    sections.push("**지난주 추천 콘텐츠**\n추천을 건너뛰어요 — 이번주엔 더 풍성하게! 😊");
  }

  sections.push("**이번 주도 함께 성장해요 💪**\n제출 현황이 궁금하다면? [대시보드 바로가기](https://ggplab.github.io/content_designer_challenge/)");

  await sendDiscordEmbed({
    title: `📊 ${weekLabel} 주간 정산`,
    color: 0x5865f2,
    description: sections.join("\n\n\n"),
  });
}
