import { assertEquals } from "jsr:@std/assert";
import { stub } from "jsr:@std/testing/mock";
import { shortenUrl } from "../../../supabase/functions/weekly-summary/services/url.ts";

// ── shortenUrl ─────────────────────────────────────────────────────────────

Deno.test("shortenUrl: 정상 단축 URL 반환", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response("https://is.gd/abc123", { status: 200 }))
  );
  try {
    const result = await shortenUrl("https://very-long-url.example.com/path/to/content");
    assertEquals(result, "https://is.gd/abc123");
  } finally {
    fetchStub.restore();
  }
});

Deno.test("shortenUrl: API 오류 → 원본 URL 반환", async () => {
  const original = "https://example.com/post";
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response("Error", { status: 500 }))
  );
  try {
    const result = await shortenUrl(original);
    assertEquals(result, original);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("shortenUrl: is.gd 접두사 아닌 응답 → 원본 URL 반환", async () => {
  const original = "https://example.com/post";
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response("Error: rate limit exceeded", { status: 200 }))
  );
  try {
    const result = await shortenUrl(original);
    assertEquals(result, original);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("shortenUrl: 네트워크 오류 → 원본 URL 반환", async () => {
  const original = "https://example.com/post";
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.reject(new Error("network error"))
  );
  try {
    const result = await shortenUrl(original);
    assertEquals(result, original);
  } finally {
    fetchStub.restore();
  }
});
