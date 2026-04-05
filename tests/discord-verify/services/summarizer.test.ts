import { assertEquals } from "jsr:@std/assert";
import { stub } from "jsr:@std/testing/mock";
import {
  parseMetaContent,
  fetchOGSummary,
  callGemini,
} from "../../../supabase/functions/discord-verify/services/summarizer.ts";

Deno.env.set("GEMINI_API_KEY", "test-key");

// ── parseMetaContent ───────────────────────────────────────────────────────

Deno.test("parseMetaContent: property 앞에 content 있는 패턴", () => {
  const html = `<meta property="og:title" content="테스트 제목">`;
  assertEquals(parseMetaContent(html, "og:title"), "테스트 제목");
});

Deno.test("parseMetaContent: content 앞에 property 있는 패턴", () => {
  const html = `<meta content="테스트 제목" property="og:title">`;
  assertEquals(parseMetaContent(html, "og:title"), "테스트 제목");
});

Deno.test("parseMetaContent: HTML 엔티티 디코딩", () => {
  const html = `<meta property="og:title" content="A &amp; B &lt;C&gt;">`;
  assertEquals(parseMetaContent(html, "og:title"), "A & B <C>");
});

Deno.test("parseMetaContent: 16진수 숫자 엔티티 디코딩 (Instagram 한글)", () => {
  const html = `<meta property="og:title" content="&#xbd84;&#xc694;&#xb9ac;&#xc655;">`;
  assertEquals(parseMetaContent(html, "og:title"), "분요리왕");
});

Deno.test("parseMetaContent: 10진수 숫자 엔티티 디코딩", () => {
  const html = `<meta property="og:title" content="&#48516;&#50836;">`;
  assertEquals(parseMetaContent(html, "og:title"), "분요");
});

Deno.test("parseMetaContent: 매칭 없으면 null 반환", () => {
  assertEquals(parseMetaContent("<html></html>", "og:title"), null);
});

// ── fetchOGSummary ─────────────────────────────────────────────────────────

Deno.test("fetchOGSummary: og:title 파싱 성공", async () => {
  const html = `<html><head><meta property="og:title" content="마케팅 인사이트 정리"></head></html>`;
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(html, { status: 200 }))
  );
  try {
    const result = await fetchOGSummary("https://example.com");
    assertEquals(result, "마케팅 인사이트 정리");
  } finally {
    fetchStub.restore();
  }
});

Deno.test("fetchOGSummary: og:title 없으면 twitter:title fallback", async () => {
  const html = `<html><head><meta property="twitter:title" content="트위터 제목"></head></html>`;
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(html, { status: 200 }))
  );
  try {
    const result = await fetchOGSummary("https://example.com");
    assertEquals(result, "트위터 제목");
  } finally {
    fetchStub.restore();
  }
});

Deno.test("fetchOGSummary: title 태그 fallback", async () => {
  const html = `<html><head><title>페이지 제목</title></head></html>`;
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(html, { status: 200 }))
  );
  try {
    const result = await fetchOGSummary("https://example.com");
    assertEquals(result, "페이지 제목");
  } finally {
    fetchStub.restore();
  }
});

Deno.test("fetchOGSummary: fetch 실패 → null 반환", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response("Not Found", { status: 404 }))
  );
  try {
    const result = await fetchOGSummary("https://example.com");
    assertEquals(result, null);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("fetchOGSummary: 40자 초과 제목은 잘림", async () => {
  const longTitle = "가".repeat(50);
  const html = `<html><head><meta property="og:title" content="${longTitle}"></head></html>`;
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(html, { status: 200 }))
  );
  try {
    const result = await fetchOGSummary("https://example.com");
    assertEquals(result?.length, 40);
  } finally {
    fetchStub.restore();
  }
});

// ── callGemini ─────────────────────────────────────────────────────────────

Deno.test("callGemini: 정상 요약 반환", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "마케팅 전략 정리" }] } }],
    }), { status: 200 }))
  );
  try {
    const result = await callGemini("https://example.com", "LinkedIn");
    assertEquals(result, "마케팅 전략 정리");
  } finally {
    fetchStub.restore();
  }
});

Deno.test("callGemini: API 오류 → platform 콘텐츠 fallback", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response("error", { status: 500 }))
  );
  try {
    const result = await callGemini("https://example.com", "YouTube");
    assertEquals(result, "YouTube 콘텐츠");
  } finally {
    fetchStub.restore();
  }
});

Deno.test("callGemini: GEMINI_MODEL env 적용", async () => {
  Deno.env.set("GEMINI_MODEL", "gemini-custom-model");
  let calledUrl = "";
  const fetchStub = stub(globalThis, "fetch", (url) => {
    calledUrl = url.toString();
    return Promise.resolve(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "테스트" }] } }],
    }), { status: 200 }));
  });
  try {
    await callGemini("https://example.com", "Blog");
    assertEquals(calledUrl.includes("gemini-custom-model"), true);
  } finally {
    fetchStub.restore();
    Deno.env.delete("GEMINI_MODEL");
  }
});
