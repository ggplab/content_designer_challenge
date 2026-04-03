export function parseMetaContent(html: string, property: string): string | null {
  const attr = `(?:property|name)`;
  const patterns = [
    new RegExp(`<meta[^>]+${attr}=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${property}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      return m[1].trim()
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
        .split("\n")[0].trim();
    }
  }
  return null;
}

export async function fetchOGSummary(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      console.log(`[og] fetch 실패 (${resp.status}): ${url}`);
      return null;
    }

    const reader = resp.body?.getReader();
    if (!reader) return null;
    let html = "";
    while (html.length < 50000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
      if (html.includes("</head>")) break;
    }
    reader.cancel().catch(() => {});

    const title =
      parseMetaContent(html, "og:title") ||
      parseMetaContent(html, "twitter:title") ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ||
      null;

    if (title) {
      console.log(`[og] 파싱 성공: "${title}" (${url})`);
      return title.slice(0, 40);
    }
    return null;
  } catch (e) {
    console.log(`[og] fetch 오류 (${url}):`, e);
    return null;
  }
}

export async function callGemini(url: string, platform: string): Promise<string> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
  const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";

  const prompt = `다음 ${platform} URL을 보고 어떤 주제의 콘텐츠인지 한국어로 15자 이내로 요약해주세요.\nURL: ${url}`;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 50,
          },
        }),
      }
    );

    if (!resp.ok) {
      console.error("Gemini HTTP error:", resp.status, await resp.text());
      return `${platform} 콘텐츠`;
    }

    const data = await resp.json();
    const text = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
    return text.slice(0, 20) || `${platform} 콘텐츠`;
  } catch (e) {
    console.error("Gemini error:", e);
    return `${platform} 콘텐츠`;
  }
}
