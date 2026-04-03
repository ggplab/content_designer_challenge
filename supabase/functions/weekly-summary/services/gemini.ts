export type ContentItem = { user: string; platform: string; summary: string; url: string };
export type GeminiPick = { index: number; reason: string };
export type GeminiRecommendation = {
  educational: GeminiPick | null;
  challenge: GeminiPick | null;
  hooking: GeminiPick | null;
};

export async function pickRecommendedContents(items: ContentItem[]): Promise<GeminiRecommendation> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
  const list = items
    .map((item, i) => `${i}. [${item.platform}] ${item.user}: "${item.summary}" (${item.url})`)
    .join("\n");

  const prompt = `[${Math.random().toString(36).slice(2)}] 너만알맡은 콘텐츠 크리에이터들이 12주간 꾸준히 콘텐츠를 발행하는 챌린지입니다.
아래는 이번 주 참가자들이 제출한 콘텐츠 목록입니다.

${list}

다음 세 가지 기준으로 각각 하나씩 추천해주세요:
1. educational: 다른 참가자가 읽으면 실질적으로 배울 게 많은 콘텐츠
2. challenge: 콘텐츠 제작, 개인 브랜딩, 홍보 및 마케팅 등 챌린지 취지에 가장 잘 맞는 콘텐츠
3. hooking: 제목이나 썸네일, 첫 문장 등 후킹 요소가 뛰어나 클릭하고 싶어지는 콘텐츠

가능하면 서로 다른 콘텐츠와 다른 플랫폼에서 선정해주세요. 후보가 적으면 같은 콘텐츠를 여러 기준에 골라도 됩니다.
reason은 한국어로 15자 이내로 작성해주세요.

출력 예시 (이 형식 그대로):
{"educational":{"index":2,"reason":"실전 팁이 많음"},"challenge":{"index":5,"reason":"브랜딩 전략 담김"},"hooking":{"index":1,"reason":"제목이 너무 궁금함"}}`;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 1000 },
        }),
      }
    );
    if (!resp.ok) {
      console.error("[summary] Gemini HTTP 오류:", resp.status, await resp.text());
      return { educational: null, challenge: null, hooking: null };
    }
    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    console.log("[summary] Gemini 응답:", text.slice(0, 300));
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonText = codeBlockMatch ? codeBlockMatch[1] : text;
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[summary] JSON 추출 실패, 전체 응답:", text);
      return { educational: null, challenge: null, hooking: null };
    }
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("[summary] Gemini 추천 실패:", e);
    return { educational: null, challenge: null, hooking: null };
  }
}
