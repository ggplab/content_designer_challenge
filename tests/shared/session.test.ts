import { assertEquals } from "jsr:@std/assert";
import { getBearerToken } from "../../supabase/functions/_shared/session.ts";

// ── getBearerToken ─────────────────────────────────────────────────────────
// getSessionUser는 Supabase 네트워크 호출이 필요해 유닛 테스트 제외

Deno.test("getBearerToken: Authorization 헤더 없음 → null", () => {
  const req = new Request("https://example.com");
  assertEquals(getBearerToken(req), null);
});

Deno.test("getBearerToken: Bearer 토큰 추출", () => {
  const req = new Request("https://example.com", {
    headers: { Authorization: "Bearer mytoken123" },
  });
  assertEquals(getBearerToken(req), "mytoken123");
});

Deno.test("getBearerToken: Bearer 접두사 없는 Authorization → 값 그대로 반환", () => {
  const req = new Request("https://example.com", {
    headers: { Authorization: "rawtoken" },
  });
  assertEquals(getBearerToken(req), "rawtoken");
});

Deno.test("getBearerToken: x-api-key 헤더로도 추출", () => {
  const req = new Request("https://example.com", {
    headers: { "x-api-key": "apikey-abc" },
  });
  assertEquals(getBearerToken(req), "apikey-abc");
});

Deno.test("getBearerToken: x-api-key Bearer 형식", () => {
  const req = new Request("https://example.com", {
    headers: { "x-api-key": "Bearer sometoken" },
  });
  assertEquals(getBearerToken(req), "sometoken");
});
