import { assertEquals } from "jsr:@std/assert";
import { stub } from "jsr:@std/testing/mock";
import { pickRecommendedContents, type ContentItem } from "../../../supabase/functions/weekly-summary/services/gemini.ts";

Deno.env.set("GEMINI_API_KEY", "test-key");

const sampleItems: ContentItem[] = [
  { user: "Alice", platform: "LinkedIn", summary: "마케팅 전략 정리", url: "https://a.com" },
  { user: "Bob", platform: "YouTube", summary: "영상 편집 팁", url: "https://b.com" },
  { user: "Carol", platform: "Blog", summary: "브랜딩 인사이트", url: "https://c.com" },
];

function mockGeminiResponse(text: string) {
  return stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
    }), { status: 200 }))
  );
}

// ── pickRecommendedContents ────────────────────────────────────────────────

Deno.test("pickRecommendedContents: JSON 평문 응답 파싱", async () => {
  const json = '{"educational":{"index":0,"reason":"실전 팁 많음"},"challenge":{"index":1,"reason":"챌린지 취지"},"hooking":{"index":2,"reason":"제목 후킹"}}';
  const fetchStub = mockGeminiResponse(json);
  try {
    const result = await pickRecommendedContents(sampleItems);
    assertEquals(result.educational?.index, 0);
    assertEquals(result.challenge?.index, 1);
    assertEquals(result.hooking?.index, 2);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("pickRecommendedContents: 코드블록으로 감싼 응답 파싱", async () => {
  const json = '```json\n{"educational":{"index":0,"reason":"좋음"},"challenge":{"index":1,"reason":"딱"},"hooking":{"index":2,"reason":"궁금"}}\n```';
  const fetchStub = mockGeminiResponse(json);
  try {
    const result = await pickRecommendedContents(sampleItems);
    assertEquals(result.educational?.index, 0);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("pickRecommendedContents: API 오류 → null 반환", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response("Internal Server Error", { status: 500 }))
  );
  try {
    const result = await pickRecommendedContents(sampleItems);
    assertEquals(result, { educational: null, challenge: null, hooking: null });
  } finally {
    fetchStub.restore();
  }
});

Deno.test("pickRecommendedContents: JSON 파싱 불가 응답 → null 반환", async () => {
  const fetchStub = mockGeminiResponse("추천 결과를 찾을 수 없습니다.");
  try {
    const result = await pickRecommendedContents(sampleItems);
    assertEquals(result, { educational: null, challenge: null, hooking: null });
  } finally {
    fetchStub.restore();
  }
});
