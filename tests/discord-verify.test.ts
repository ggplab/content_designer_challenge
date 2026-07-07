import { assertEquals } from "jsr:@std/assert";
import { getWeekLabel } from "../supabase/functions/_shared/week.ts";
import { detectPlatform, checkChallengeUrl } from "../supabase/functions/_shared/platform.ts";

// discord-verify 파이프라인 스모크 테스트 — 세부 케이스는 tests/shared/*.test.ts 참고

// ── getWeekLabel (시즌2: 2026-07-13 시작) ───────────────────────────────────

Deno.test("getWeekLabel: 발행 시작일 = 1주차", () => {
  assertEquals(getWeekLabel(new Date("2026-07-13T00:00:00+09:00")), "1주차");
});

Deno.test("getWeekLabel: 발행 시작 전 = 준비기간", () => {
  assertEquals(getWeekLabel(new Date("2026-07-12T23:59:59+09:00")), "준비기간");
});

// ── 시즌2 URL 정책 ──────────────────────────────────────────────────────────

Deno.test("시즌2: YouTube watch URL 인정", () => {
  assertEquals(checkChallengeUrl("https://www.youtube.com/watch?v=abc").ok, true);
});

Deno.test("시즌2: youtu.be URL 인정", () => {
  assertEquals(checkChallengeUrl("https://youtu.be/abc123").ok, true);
});

Deno.test("시즌2: shorts URL 거부", () => {
  const result = checkChallengeUrl("https://www.youtube.com/shorts/abc123");
  assertEquals(result.ok, false);
  assertEquals(!result.ok && result.reason, "shorts");
});

Deno.test("시즌2: 타 플랫폼 URL 거부", () => {
  const result = checkChallengeUrl("https://www.linkedin.com/posts/abc");
  assertEquals(result.ok, false);
  assertEquals(!result.ok && result.reason, "not_youtube");
});

Deno.test("detectPlatform: YouTube 분류 유지", () => {
  assertEquals(detectPlatform("https://youtu.be/abc123"), "YouTube");
});

// ── URL 필터 (verification.ts 입력 정제 로직) ───────────────────────────────

Deno.test("URL 필터: http로 시작하지 않으면 제외", () => {
  const rawLinks = ["https://valid.com", "not-a-url", "ftp://skip.me", "http://also-valid.com"];
  const filtered = rawLinks.map((l) => l.trim()).filter((l) => l.startsWith("http"));
  assertEquals(filtered, ["https://valid.com", "http://also-valid.com"]);
});
