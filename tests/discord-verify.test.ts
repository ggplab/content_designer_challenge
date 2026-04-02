import { assertEquals } from "jsr:@std/assert";

// ── getWeekLabel ───────────────────────────────────────────────────────────
function getWeekLabel(now: Date): string {
  const KST_OFFSET = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + KST_OFFSET);
  const start = new Date("2026-03-02T00:00:00Z");
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

// ── getMedal ───────────────────────────────────────────────────────────────
function getMedal(weekTotal: number): string {
  return weekTotal === 1 ? " 🥇" : weekTotal === 2 ? " 🥈" : weekTotal === 3 ? " 🥉" : "";
}

// ── Tests ──────────────────────────────────────────────────────────────────

Deno.test("getWeekLabel: 발행 시작일 = 1주차", () => {
  assertEquals(getWeekLabel(new Date("2026-03-02T00:00:00+09:00")), "1주차");
});
Deno.test("getWeekLabel: 1주차 마지막날", () => {
  assertEquals(getWeekLabel(new Date("2026-03-08T23:59:59+09:00")), "1주차");
});
Deno.test("getWeekLabel: 2주차 시작일", () => {
  assertEquals(getWeekLabel(new Date("2026-03-09T00:00:00+09:00")), "2주차");
});
Deno.test("getWeekLabel: 준비기간", () => {
  assertEquals(getWeekLabel(new Date("2026-03-01T23:59:59+09:00")), "준비기간");
});

Deno.test("detectPlatform: LinkedIn", () => {
  assertEquals(detectPlatform("https://www.linkedin.com/posts/abc"), "LinkedIn");
});
Deno.test("detectPlatform: Instagram", () => {
  assertEquals(detectPlatform("https://www.instagram.com/p/abc"), "Instagram");
});
Deno.test("detectPlatform: Threads", () => {
  assertEquals(detectPlatform("https://www.threads.net/@user/post/abc"), "Threads");
});
Deno.test("detectPlatform: YouTube", () => {
  assertEquals(detectPlatform("https://youtu.be/abc123"), "YouTube");
});
Deno.test("detectPlatform: Brunch", () => {
  assertEquals(detectPlatform("https://brunch.co.kr/@someone/1"), "Brunch");
});
Deno.test("detectPlatform: 기타 = Blog", () => {
  assertEquals(detectPlatform("https://velog.io/@user/post"), "Blog");
});

Deno.test("getMedal: 1등 = 🥇", () => { assertEquals(getMedal(1), " 🥇"); });
Deno.test("getMedal: 2등 = 🥈", () => { assertEquals(getMedal(2), " 🥈"); });
Deno.test("getMedal: 3등 = 🥉", () => { assertEquals(getMedal(3), " 🥉"); });
Deno.test("getMedal: 4등 이상 = 없음", () => {
  assertEquals(getMedal(4), "");
  assertEquals(getMedal(10), "");
});

Deno.test("URL 필터: http로 시작하지 않으면 제외", () => {
  const rawLinks = ["https://valid.com", "not-a-url", "ftp://skip.me", "http://also-valid.com"];
  const filtered = rawLinks.map(l => l.trim()).filter(l => l.startsWith("http"));
  assertEquals(filtered, ["https://valid.com", "http://also-valid.com"]);
});
