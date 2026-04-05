import { getWeekLabel, getTodayKST } from "../_shared/week.ts";
import { detectPlatform, getMedal } from "../_shared/platform.ts";
import { getGoogleAccessToken } from "../_shared/google-auth.ts";
import { shortenUrl } from "../_shared/url.ts";
import { fetchOGSummary, callGemini } from "./services/summarizer.ts";
import { appendToSheets, getWeekCounts } from "./services/sheets.ts";
import { sendFollowup } from "./services/discord.ts";

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

  const { userCount, totalCount } = await getWeekCounts(accessToken, displayName, weekLabel);
  let existingCount = userCount;
  let weekTotal = totalCount;

  const results: { platform: string; url: string; shortUrl: string; summary: string; medal: string }[] = [];

  for (const url of links) {
    const platform = detectPlatform(url);
    const UNSUMMARIZABLE = ["Instagram", "Threads"];
    const summary = isPublic && !UNSUMMARIZABLE.includes(platform)
      ? (await fetchOGSummary(url) ?? await callGemini(url, platform))
      : isPublic ? `${platform}콘텐츠` : "";
    existingCount++;
    weekTotal++;
    const numberLabel = `${weekLabel}-${existingCount}회`;
    const medal = getMedal(weekTotal);
    const shortUrl = isPublic && platform !== "Instagram" && platform !== "Threads"
      ? await shortenUrl(url)
      : url;

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
      results.push({ platform, url, shortUrl, summary, medal });
      console.log(`✅ Sheets 저장: ${platform} — ${url}`);
    } catch (e) {
      console.error(`Sheets 저장 실패 (${url}):`, e);
    }
  }

  if (results.length === 0) {
    await sendFollowup(token, "❌ 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    return;
  }

  const mention = userId ? `<@${userId}>` : displayName;
  let msg = `✅ ${mention}님, ${weekLabel} 인증 완료! 🎉\n\n`;
  if (!isPublic) {
    msg += "🔒 비공개로 인증했습니다.\n";
    for (const { platform } of results) {
      msg += `• ${platform}\n`;
    }
  } else if (results.length === 1) {
    msg += `📌 ${results[0].platform} · "${results[0].summary}"${results[0].medal}\n${results[0].shortUrl}`;
  } else {
    for (const { platform, shortUrl, summary, medal } of results) {
      msg += `• ${platform} · "${summary}"${medal}\n  ${shortUrl}\n`;
    }
  }

  await sendFollowup(token, msg.trim());
}
