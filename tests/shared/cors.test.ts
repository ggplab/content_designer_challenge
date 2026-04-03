import { assertEquals, assertNotEquals } from "jsr:@std/assert";
import {
  buildCorsHeaders,
  isOriginAllowed,
  jsonResponse,
} from "../../supabase/functions/_shared/cors.ts";

// ── isOriginAllowed ────────────────────────────────────────────────────────

Deno.test("isOriginAllowed: null origin → true (허용)", () => {
  assertEquals(isOriginAllowed(null), true);
});

Deno.test("isOriginAllowed: 기본 허용 origin → true", () => {
  assertEquals(isOriginAllowed("https://ggplab.github.io"), true);
});

Deno.test("isOriginAllowed: localhost → true", () => {
  assertEquals(isOriginAllowed("http://localhost:4173"), true);
});

Deno.test("isOriginAllowed: 허용 목록 외 origin → false", () => {
  assertEquals(isOriginAllowed("https://evil.com"), false);
});

Deno.test("isOriginAllowed: env로 허용 목록 override", () => {
  Deno.env.set("WEB_VERIFY_ALLOWED_ORIGINS", "https://custom.example.com");
  assertEquals(isOriginAllowed("https://custom.example.com"), true);
  assertEquals(isOriginAllowed("https://ggplab.github.io"), false);
  Deno.env.delete("WEB_VERIFY_ALLOWED_ORIGINS");
});

// ── buildCorsHeaders ───────────────────────────────────────────────────────

Deno.test("buildCorsHeaders: 허용된 origin → Access-Control-Allow-Origin 포함", () => {
  const headers = buildCorsHeaders("https://ggplab.github.io");
  assertEquals(headers["Access-Control-Allow-Origin"], "https://ggplab.github.io");
});

Deno.test("buildCorsHeaders: 허용되지 않은 origin → Access-Control-Allow-Origin 없음", () => {
  const headers = buildCorsHeaders("https://evil.com");
  assertEquals("Access-Control-Allow-Origin" in headers, false);
});

Deno.test("buildCorsHeaders: null origin → Access-Control-Allow-Origin 없음", () => {
  const headers = buildCorsHeaders(null);
  assertEquals("Access-Control-Allow-Origin" in headers, false);
});

Deno.test("buildCorsHeaders: 공통 헤더 항상 포함", () => {
  const headers = buildCorsHeaders(null);
  assertNotEquals(headers["Access-Control-Allow-Methods"], undefined);
  assertNotEquals(headers["Access-Control-Allow-Headers"], undefined);
  assertEquals(headers["Vary"], "Origin");
});

// ── jsonResponse ───────────────────────────────────────────────────────────

Deno.test("jsonResponse: 기본 status 200", async () => {
  const res = jsonResponse(null, { ok: true });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body, { ok: true });
});

Deno.test("jsonResponse: 커스텀 status 반영", async () => {
  const res = jsonResponse(null, { error: "not found" }, 404);
  assertEquals(res.status, 404);
});

Deno.test("jsonResponse: Content-Type 헤더 포함", () => {
  const res = jsonResponse(null, {});
  assertEquals(res.headers.get("Content-Type"), "application/json");
});

Deno.test("jsonResponse: extraHeaders 반영", () => {
  const res = jsonResponse(null, {}, 200, { "X-Custom": "value" });
  assertEquals(res.headers.get("X-Custom"), "value");
});
