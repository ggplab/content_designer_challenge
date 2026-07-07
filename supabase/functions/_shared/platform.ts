export function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("linkedin.com")) return "LinkedIn";
  if (u.includes("instagram.com")) return "Instagram";
  if (u.includes("threads.net") || u.includes("threads.com")) return "Threads";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "YouTube";
  if (u.includes("tiktok.com")) return "TikTok";
  if (u.includes("brunch.co.kr")) return "Brunch";
  return "Blog";
}

// ── 시즌2 URL 정책: YouTube 롱폼만 인정 ─────────────────────────────────────
// 판정 기준(docs/youtube-challenge-plan.md §2): youtube.com/shorts/ URL은 거부,
// 일반 watch / youtu.be URL만 인정. 영상 길이 API 검사는 MVP에서 제외.

/** youtube.com/shorts/ 형태의 쇼츠 URL 여부 (m.youtube.com 등 서브도메인 포함) */
export function isShortsUrl(url: string): boolean {
  return url.toLowerCase().includes("youtube.com/shorts/");
}

export type ChallengeUrlCheck =
  | { ok: true; platform: "YouTube" }
  | { ok: false; reason: "shorts" | "not_youtube"; platform: string };

/** 시즌2 인증 URL 판정 — 거부 시 안내 메시지용 reason 반환 */
export function checkChallengeUrl(url: string): ChallengeUrlCheck {
  const platform = detectPlatform(url);
  if (platform !== "YouTube") return { ok: false, reason: "not_youtube", platform };
  if (isShortsUrl(url)) return { ok: false, reason: "shorts", platform };
  return { ok: true, platform: "YouTube" };
}
