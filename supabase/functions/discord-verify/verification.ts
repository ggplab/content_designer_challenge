import {
  getWeekLabel,
  getTodayKST,
  parseWeekNumber,
  calcStreak,
  formatStreakBadge,
} from "../_shared/week.ts";
import { checkChallengeUrl } from "../_shared/platform.ts";
import { getGoogleAccessToken } from "../_shared/google-auth.ts";
import { createShortLink } from "../_shared/short-links.ts";
import { fetchOGSummary, callGemini } from "./services/summarizer.ts";
import { appendToSheets, getWeekCounts } from "./services/sheets.ts";
import { sendFollowup } from "./services/discord.ts";

const SEASON2_GUIDE =
  "시즌2는 YouTube 롱폼 영상만 인정됩니다. youtube.com/watch 또는 youtu.be 링크로 제출해주세요.";

function rejectLine(url: string, reason: "shorts" | "not_youtube", platform: string): string {
  return reason === "shorts"
    ? `• 쇼츠는 인정되지 않아요 (롱폼만): ${url}`
    : `• YouTube 링크가 아니에요 (${platform}): ${url}`;
}

export async function processVerification(
  displayName: string,
  userId: string,
  rawLinks: string[],
  token: string,
  isPublic: boolean
): Promise<void> {
  const links = rawLinks.map((l) => l.trim()).filter((l) => l.startsWith("http"));

  if (links.length === 0) {
    await sendFollowup(token, "❌ 유효한 URL이 없습니다. http 또는 https로 시작하는 링크를 입력해주세요.");
    return;
  }

  // ── 시즌2 URL 정책: YouTube 롱폼만 인정, 쇼츠·타 플랫폼 거부 ──
  const accepted: string[] = [];
  const rejectedLines: string[] = [];
  for (const url of links) {
    const check = checkChallengeUrl(url);
    if (check.ok) accepted.push(url);
    else rejectedLines.push(rejectLine(url, check.reason, check.platform));
  }

  if (accepted.length === 0) {
    await sendFollowup(
      token,
      `❌ 인증할 수 없는 링크입니다.\n${rejectedLines.join("\n")}\n\n${SEASON2_GUIDE}`
    );
    return;
  }

  const today = getTodayKST();
  const weekLabel = getWeekLabel();

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken();
  } catch (e) {
    console.error("Google 인증 실패:", e);
    await sendFollowup(token, "❌ Google 인증 오류가 발생했습니다. 관리자에게 문의해주세요.");
    return;
  }

  const { userCount, userWeeks } = await getWeekCounts(accessToken, displayName, weekLabel);
  const alreadyVerifiedThisWeek = userCount >= 1;
  let existingCount = userCount;

  const results: { platform: string; url: string; shortUrl: string; summary: string }[] = [];

  for (const url of accepted) {
    const platform = "YouTube"; // 시즌2: checkChallengeUrl 통과 = YouTube 롱폼
    const summary = isPublic
      ? (await fetchOGSummary(url) ?? await callGemini(url, platform))
      : "";
    existingCount++;
    const numberLabel = `${weekLabel}-${existingCount}회`;
    const baseUrl = Deno.env.get("REDIRECT_BASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";

    try {
      await appendToSheets(accessToken, [
        today,
        displayName,
        platform,
        url,
        numberLabel,
        summary,
        isPublic ? "public" : "private",
      ]);
      let shortUrl = url;
      if (isPublic) {
        try {
          const shortCode = await createShortLink(url);
          shortUrl = `${baseUrl}/functions/v1/r/${shortCode}`;
        } catch (e) {
          console.error(`URL 단축 실패, 원본 URL 사용 (${url}):`, e);
        }
      }
      results.push({ platform, url, shortUrl, summary });
      console.log(`✅ 저장 완료: ${platform} — ${url}`);
    } catch (e) {
      console.error(`저장 실패 (${url}):`, e);
    }
  }

  if (results.length === 0) {
    await sendFollowup(token, "❌ 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    return;
  }

  // ── 스트릭 계산 (메달 대체): 이번 주 포함 연속 인증 주 수 ──
  const currentWeek = parseWeekNumber(weekLabel);
  const streakBadge = currentWeek !== null
    ? formatStreakBadge(calcStreak([...userWeeks, currentWeek], currentWeek))
    : "";

  const mention = userId ? `<@${userId}>` : displayName;
  let msg = `✅ ${mention}님, ${weekLabel} 인증 완료! 🎉${streakBadge ? ` ${streakBadge}` : ""}\n\n`;
  if (alreadyVerifiedThisWeek) {
    msg += "ℹ️ 이번 주는 이미 인증을 완료한 상태예요 — 주간 인정은 1회입니다 (기록은 저장돼요).\n\n";
  }
  if (!isPublic) {
    msg += "🔒 비공개로 인증했습니다.\n";
    for (const { platform } of results) {
      msg += `• ${platform}\n`;
    }
  } else if (results.length === 1) {
    msg += `📌 ${results[0].platform} · "${results[0].summary}"\n${results[0].shortUrl}`;
  } else {
    for (const { platform, shortUrl, summary } of results) {
      msg += `• ${platform} · "${summary}"\n  ${shortUrl}\n`;
    }
  }

  if (rejectedLines.length > 0) {
    msg += `\n\n⚠️ 인정되지 않은 링크:\n${rejectedLines.join("\n")}\n${SEASON2_GUIDE}`;
  }

  await sendFollowup(token, msg.trim());
}
