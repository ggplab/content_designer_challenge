import { assertEquals, assertMatch } from "jsr:@std/assert";
import { generateShortCode } from "../../supabase/functions/_shared/url.ts";

// ── generateShortCode ──────────────────────────────────────────────────────

Deno.test("generateShortCode: 기본 길이 6자리 반환", () => {
  const code = generateShortCode();
  assertEquals(code.length, 6);
});

Deno.test("generateShortCode: 소문자+숫자만 포함", () => {
  const code = generateShortCode();
  assertMatch(code, /^[a-z0-9]+$/);
});

Deno.test("generateShortCode: 지정 길이 반환", () => {
  assertEquals(generateShortCode(8).length, 8);
  assertEquals(generateShortCode(4).length, 4);
});

Deno.test("generateShortCode: 호출마다 다른 코드 생성", () => {
  const codes = new Set(Array.from({ length: 20 }, () => generateShortCode()));
  // 20번 중 최소 10개 이상 유니크 (충돌 가능성 극히 낮음)
  assertEquals(codes.size > 10, true);
});
