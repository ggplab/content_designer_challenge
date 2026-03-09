import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GOOGLE_SHEET_ID = Deno.env.get("GOOGLE_SHEET_ID")!;
const GCP_SERVICE_ACCOUNT_JSON = Deno.env.get("GCP_SERVICE_ACCOUNT_JSON")!;

// ── 유틸 ──────────────────────────────────────────────────────────────────────

function toBase64Url(input: string | Uint8Array): string {
  const str =
    typeof input === "string"
      ? input
      : String.fromCharCode(...input);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ── 주차 계산 ─────────────────────────────────────────────────────────────────

function getWeekLabel(): string {
  const KST_OFFSET = 9 * 60 * 60 * 1000;
  const now = new Date(Date.now() + KST_OFFSET);
  const start = new Date("2026-03-02T00:00:00Z");
  if (now < start) return "준비기간";
  const days = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return `${Math.max(1, Math.ceil((days + 1) / 7))}주차`;
}

function getTodayKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

// ── 플랫폼 감지 ───────────────────────────────────────────────────────────────

function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("linkedin.com")) return "LinkedIn";
  if (u.includes("instagram.com")) return "Instagram";
  if (u.includes("threads.net") || u.includes("threads.com")) return "Threads";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "YouTube";
  if (u.includes("tiktok.com")) return "TikTok";
  if (u.includes("brunch.co.kr")) return "Brunch";
  return "Blog";
}

// ── OG 태그 파싱 ──────────────────────────────────────────────────────────────

function parseMetaContent(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"'\\r\\n]+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"'\\r\\n]+)["'][^>]+property=["']${property}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      return m[1].trim()
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
    }
  }
  return null;
}

async function fetchOGSummary(url: string): Promise<string | null> {
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
    if (!resp.ok) return null;

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
    return title ? title.slice(0, 40) : null;
  } catch {
    return null;
  }
}

// ── Gemini 요약 ───────────────────────────────────────────────────────────────

async function callGemini(url: string, platform: string): Promise<string> {
  const prompt = `다음 ${platform} URL을 보고 어떤 주제의 콘텐츠인지 한국어로 15자 이내로 요약해주세요.\nURL: ${url}`;
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 50,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: { summary: { type: "STRING" } },
              required: ["summary"],
            },
          },
        }),
      }
    );
    if (!resp.ok) return `${platform} 콘텐츠`;
    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(text);
    return (parsed.summary as string)?.slice(0, 20) || `${platform} 콘텐츠`;
  } catch {
    return `${platform} 콘텐츠`;
  }
}

// ── Google Service Account → Access Token ────────────────────────────────────

async function getGoogleAccessToken(): Promise<string> {
  const fixedJson = GCP_SERVICE_ACCOUNT_JSON.replace(/\r?\n/g, "\\n");
  const sa = JSON.parse(fixedJson);
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = toBase64Url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );
  const signingInput = `${header}.${payload}`;
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binaryKey, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${toBase64Url(new Uint8Array(sig))}`;
  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenResp.json();
  if (!tokenData.access_token) throw new Error(`OAuth 토큰 발급 실패: ${JSON.stringify(tokenData)}`);
  return tokenData.access_token;
}

// ── Google Sheets 행 추가 ─────────────────────────────────────────────────────

async function appendToSheets(accessToken: string, row: string[]): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/%EC%8B%9C%ED%8A%B81!A:G:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: [row] }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Sheets 저장 실패 (${resp.status}): ${err}`);
  }
}

// ── 주차별 제출 횟수 조회 ─────────────────────────────────────────────────────

async function countWeekSubmissions(accessToken: string, nickname: string, weekLabel: string): Promise<number> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/%EC%8B%9C%ED%8A%B81!B:E`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) return 0;
  const data = await resp.json();
  const rows: string[][] = data.values ?? [];
  return rows.filter((row) => row[0] === nickname && (row[3] ?? "").startsWith(weekLabel)).length;
}

// ── CORS 헤더 ─────────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ── 메인 ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let name: string, links: string[], isPublic: boolean;
  try {
    const body = await req.json();
    name = (body.name ?? body.nickname ?? "").trim(); // nickname은 하위 호환
    links = (body.links ?? []).map((l: string) => l.trim()).filter((l: string) => l.startsWith("http"));
    isPublic = body.isPublic !== false;
  } catch {
    return new Response(JSON.stringify({ error: "잘못된 요청 형식입니다." }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  if (!name) {
    return new Response(JSON.stringify({ error: "이름을 입력해주세요." }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }
  if (links.length === 0) {
    return new Response(JSON.stringify({ error: "유효한 URL이 없습니다. http로 시작하는 링크를 입력해주세요." }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const today = getTodayKST();
  const weekLabel = getWeekLabel();

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken();
  } catch (e) {
    console.error("Google 인증 실패:", e);
    return new Response(JSON.stringify({ error: "Google 인증 오류가 발생했습니다." }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  let existingCount = await countWeekSubmissions(accessToken, name, weekLabel);
  const results: { platform: string; url: string; summary: string }[] = [];

  for (const url of links) {
    const platform = detectPlatform(url);
    const ogSummary = await fetchOGSummary(url);
    const summary = ogSummary ?? await callGemini(url, platform);
    existingCount++;
    const numberLabel = `${weekLabel}-${existingCount}회`;
    try {
      await appendToSheets(accessToken, [today, name, platform, url, numberLabel, summary, isPublic ? "public" : "private"]);
      results.push({ platform, url, summary });
    } catch (e) {
      console.error(`Sheets 저장 실패 (${url}):`, e);
    }
  }

  if (results.length === 0) {
    return new Response(JSON.stringify({ error: "저장 중 오류가 발생했습니다." }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ ok: true, weekLabel, results }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
