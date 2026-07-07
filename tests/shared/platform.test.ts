import { assertEquals } from "jsr:@std/assert";
import { detectPlatform, isShortsUrl, checkChallengeUrl } from "../../supabase/functions/_shared/platform.ts";

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

// ── isShortsUrl (시즌2) ─────────────────────────────────────────────────────

Deno.test("isShortsUrl: shorts URL은 true", () => {
  assertEquals(isShortsUrl("https://www.youtube.com/shorts/abc123"), true);
});

Deno.test("isShortsUrl: 모바일 서브도메인 shorts도 true", () => {
  assertEquals(isShortsUrl("https://m.youtube.com/shorts/abc123"), true);
});

Deno.test("isShortsUrl: 대소문자 무관", () => {
  assertEquals(isShortsUrl("https://www.YouTube.com/Shorts/abc"), true);
});

Deno.test("isShortsUrl: watch URL은 false", () => {
  assertEquals(isShortsUrl("https://www.youtube.com/watch?v=abc"), false);
});

Deno.test("isShortsUrl: youtu.be URL은 false", () => {
  assertEquals(isShortsUrl("https://youtu.be/abc123"), false);
});

// ── checkChallengeUrl (시즌2: YouTube 롱폼만 인정) ──────────────────────────

Deno.test("checkChallengeUrl: watch URL 인정", () => {
  assertEquals(checkChallengeUrl("https://www.youtube.com/watch?v=abc"), {
    ok: true,
    platform: "YouTube",
  });
});

Deno.test("checkChallengeUrl: youtu.be URL 인정", () => {
  assertEquals(checkChallengeUrl("https://youtu.be/abc123"), {
    ok: true,
    platform: "YouTube",
  });
});

Deno.test("checkChallengeUrl: shorts URL 거부 (reason=shorts)", () => {
  assertEquals(checkChallengeUrl("https://www.youtube.com/shorts/abc123"), {
    ok: false,
    reason: "shorts",
    platform: "YouTube",
  });
});

Deno.test("checkChallengeUrl: Instagram 거부 (reason=not_youtube)", () => {
  assertEquals(checkChallengeUrl("https://www.instagram.com/p/abc"), {
    ok: false,
    reason: "not_youtube",
    platform: "Instagram",
  });
});

Deno.test("checkChallengeUrl: 블로그 등 기타 URL 거부", () => {
  assertEquals(checkChallengeUrl("https://velog.io/@user/post"), {
    ok: false,
    reason: "not_youtube",
    platform: "Blog",
  });
});
