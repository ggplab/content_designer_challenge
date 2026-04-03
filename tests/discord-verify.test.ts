import { assertEquals } from "jsr:@std/assert";

// ── URL 필터 ───────────────────────────────────────────────────────────────
// processVerification 내 링크 유효성 검사 로직

Deno.test("URL 필터: http로 시작하지 않으면 제외", () => {
  const rawLinks = ["https://valid.com", "not-a-url", "ftp://skip.me", "http://also-valid.com"];
  const filtered = rawLinks.map(l => l.trim()).filter(l => l.startsWith("http"));
  assertEquals(filtered, ["https://valid.com", "http://also-valid.com"]);
});

Deno.test("URL 필터: 공백 trim 후 검사", () => {
  const rawLinks = ["  https://valid.com  ", "  not-a-url  "];
  const filtered = rawLinks.map(l => l.trim()).filter(l => l.startsWith("http"));
  assertEquals(filtered, ["https://valid.com"]);
});

Deno.test("URL 필터: 빈 문자열 제외", () => {
  const rawLinks = ["", "https://valid.com", ""];
  const filtered = rawLinks.map(l => l.trim()).filter(l => l.startsWith("http"));
  assertEquals(filtered, ["https://valid.com"]);
});
