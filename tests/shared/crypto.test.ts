import { assertEquals, assertMatch } from "jsr:@std/assert";
import { createApiKeyPlaintext, sha256Hex } from "../../supabase/functions/_shared/crypto.ts";

// ── sha256Hex ──────────────────────────────────────────────────────────────

Deno.test("sha256Hex: 알려진 해시값 검증", async () => {
  const result = await sha256Hex("hello");
  assertEquals(result, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
});

Deno.test("sha256Hex: 빈 문자열", async () => {
  const result = await sha256Hex("");
  assertEquals(result, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});

Deno.test("sha256Hex: 동일 입력 → 동일 출력", async () => {
  const a = await sha256Hex("test-key-123");
  const b = await sha256Hex("test-key-123");
  assertEquals(a, b);
});

Deno.test("sha256Hex: 다른 입력 → 다른 출력", async () => {
  const a = await sha256Hex("key-a");
  const b = await sha256Hex("key-b");
  assertEquals(a === b, false);
});

// ── createApiKeyPlaintext ──────────────────────────────────────────────────

Deno.test("createApiKeyPlaintext: ggplab_ 접두사", () => {
  const key = createApiKeyPlaintext();
  assertMatch(key, /^ggplab_/);
});

Deno.test("createApiKeyPlaintext: 형식 — ggplab_ + 64자리 hex", () => {
  const key = createApiKeyPlaintext();
  assertMatch(key, /^ggplab_[0-9a-f]{64}$/);
});

Deno.test("createApiKeyPlaintext: 호출마다 다른 값 생성", () => {
  const a = createApiKeyPlaintext();
  const b = createApiKeyPlaintext();
  assertEquals(a === b, false);
});
