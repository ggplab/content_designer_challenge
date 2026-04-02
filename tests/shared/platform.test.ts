import { assertEquals } from "jsr:@std/assert";
import { detectPlatform, getMedal } from "../../supabase/functions/_shared/platform.ts";

// ── detectPlatform ─────────────────────────────────────────────────────────

Deno.test("detectPlatform: LinkedIn", () => {
  assertEquals(detectPlatform("https://www.linkedin.com/posts/abc"), "LinkedIn");
});

Deno.test("detectPlatform: Instagram", () => {
  assertEquals(detectPlatform("https://www.instagram.com/p/abc"), "Instagram");
});

Deno.test("detectPlatform: Threads", () => {
  assertEquals(detectPlatform("https://www.threads.net/@user/post/abc"), "Threads");
});

Deno.test("detectPlatform: YouTube 전체 URL", () => {
  assertEquals(detectPlatform("https://www.youtube.com/watch?v=abc"), "YouTube");
});

Deno.test("detectPlatform: YouTube 단축 URL", () => {
  assertEquals(detectPlatform("https://youtu.be/abc123"), "YouTube");
});

Deno.test("detectPlatform: TikTok", () => {
  assertEquals(detectPlatform("https://www.tiktok.com/@user/video/123"), "TikTok");
});

Deno.test("detectPlatform: Brunch", () => {
  assertEquals(detectPlatform("https://brunch.co.kr/@someone/1"), "Brunch");
});

Deno.test("detectPlatform: 기타 → Blog", () => {
  assertEquals(detectPlatform("https://velog.io/@user/post"), "Blog");
});

Deno.test("detectPlatform: 대소문자 무관", () => {
  assertEquals(detectPlatform("https://LINKEDIN.COM/posts/abc"), "LinkedIn");
});

// ── getMedal ───────────────────────────────────────────────────────────────

Deno.test("getMedal: 1등 = 🥇", () => {
  assertEquals(getMedal(1), " 🥇");
});

Deno.test("getMedal: 2등 = 🥈", () => {
  assertEquals(getMedal(2), " 🥈");
});

Deno.test("getMedal: 3등 = 🥉", () => {
  assertEquals(getMedal(3), " 🥉");
});

Deno.test("getMedal: 4등 이상 = 없음", () => {
  assertEquals(getMedal(4), "");
  assertEquals(getMedal(10), "");
});
