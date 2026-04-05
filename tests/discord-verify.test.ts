import { assertEquals } from "jsr:@std/assert";

// ── Summary 선택 로직 ─────────────────────────────────────────────────────
// verification.ts 내 platform별 요약 분기 로직

const UNSUMMARIZABLE = ["Instagram", "Threads"];

function resolveSummary(platform: string, isPublic: boolean, fetched: string | null): string {
  if (!isPublic) return "";
  if (UNSUMMARIZABLE.includes(platform)) return `${platform}콘텐츠`;
  return fetched ?? `${platform} 콘텐츠`;
}

Deno.test("summary: Instagram은 isPublic=true여도 고정 문자열 반환", () => {
  assertEquals(resolveSummary("Instagram", true, "실제 제목"), "Instagram콘텐츠");
});

Deno.test("summary: Threads는 isPublic=true여도 고정 문자열 반환", () => {
  assertEquals(resolveSummary("Threads", true, "실제 제목"), "Threads콘텐츠");
});

Deno.test("summary: isPublic=false이면 platform 무관하게 빈 문자열", () => {
  assertEquals(resolveSummary("Instagram", false, "실제 제목"), "");
  assertEquals(resolveSummary("LinkedIn", false, "실제 제목"), "");
});

Deno.test("summary: LinkedIn은 OG 파싱 결과 그대로 반환", () => {
  assertEquals(resolveSummary("LinkedIn", true, "브랜딩 전략 정리"), "브랜딩 전략 정리");
});

Deno.test("summary: Blog는 OG 파싱 실패 시 fallback 반환", () => {
  assertEquals(resolveSummary("Blog", true, null), "Blog 콘텐츠");
});

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
