// 레거시 단독 실행용 스모크 테스트 — 실제 스위트는 run.sh(deno test tests/)가 실행한다.
// _shared/ 로직이 바뀌면 이 파일의 복제 로직도 함께 갱신할 것 (시즌2 기준, 2026-07-07).
import { assertEquals } from "jsr:@std/assert";

// ── getWeekLabel (시즌2: 2026-07-13 시작) ──────────────────────────────────
function getWeekLabel(now: Date): string {
  const KST_OFFSET = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + KST_OFFSET);
  const start = new Date("2026-07-13T00:00:00Z"); // SSOT: _shared/week.ts PUBLISH_START_DATE
  if (kstNow < start) return "준비기간";
  const days = Math.floor((kstNow.getTime() - start.getTime()) / 86400000);
  return `${Math.max(1, Math.ceil((days + 1) / 7))}주차`;
}

// ── detectPlatform ─────────────────────────────────────────────────────────
function detectPlatform(url: string): string {
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
function isShortsUrl(url: string): boolean {
  return url.toLowerCase().includes("youtube.com/shorts/");
}

// ── calcStreak (시즌2: 메달 🥇🥈🥉 대체) ────────────────────────────────────
function calcStreak(verifiedWeeks: Iterable<number>, fromWeek: number): number {
  const weeks = new Set(verifiedWeeks);
  let streak = 0;
  let w = fromWeek;
  while (w >= 1 && weeks.has(w)) {
    streak++;
    w--;
  }
  return streak;
}

// ── Tests ──────────────────────────────────────────────────────────────────

Deno.test("getWeekLabel: 발행 시작일 = 1주차", () => {
  assertEquals(getWeekLabel(new Date("2026-07-13T00:00:00+09:00")), "1주차");
});
Deno.test("getWeekLabel: 1주차 마지막날", () => {
  assertEquals(getWeekLabel(new Date("2026-07-19T23:59:59+09:00")), "1주차");
});
Deno.test("getWeekLabel: 2주차 시작일", () => {
  assertEquals(getWeekLabel(new Date("2026-07-20T00:00:00+09:00")), "2주차");
});
Deno.test("getWeekLabel: 준비기간", () => {
  assertEquals(getWeekLabel(new Date("2026-07-12T23:59:59+09:00")), "준비기간");
});

Deno.test("detectPlatform: YouTube", () => {
  assertEquals(detectPlatform("https://www.youtube.com/watch?v=abc"), "YouTube");
});
Deno.test("detectPlatform: YouTube 단축 URL", () => {
  assertEquals(detectPlatform("https://youtu.be/abc123"), "YouTube");
});
Deno.test("detectPlatform: 기타 = Blog", () => {
  assertEquals(detectPlatform("https://velog.io/@user/post"), "Blog");
});

Deno.test("isShortsUrl: 쇼츠 URL = true", () => {
  assertEquals(isShortsUrl("https://www.youtube.com/shorts/abc123"), true);
});
Deno.test("isShortsUrl: watch URL = false", () => {
  assertEquals(isShortsUrl("https://www.youtube.com/watch?v=abc"), false);
});

Deno.test("calcStreak: 3주 연속 = 3", () => {
  assertEquals(calcStreak([1, 2, 3], 3), 3);
});
Deno.test("calcStreak: 기준 주 미인증 = 0", () => {
  assertEquals(calcStreak([1, 2], 3), 0);
});

Deno.test("URL 필터: http로 시작하지 않으면 제외", () => {
  const rawLinks = ["https://valid.com", "not-a-url", "ftp://skip.me", "http://also-valid.com"];
  const filtered = rawLinks.map(l => l.trim()).filter(l => l.startsWith("http"));
  assertEquals(filtered, ["https://valid.com", "http://also-valid.com"]);
});
