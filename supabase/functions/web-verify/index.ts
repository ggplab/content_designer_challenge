import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  createAdminClient,
  getBearerToken,
  getSessionUser,
  sha256Hex,
} from "../_shared/auth.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GOOGLE_SHEET_ID = Deno.env.get("GOOGLE_SHEET_ID")!;
const GCP_SERVICE_ACCOUNT_JSON = Deno.env.get("GCP_SERVICE_ACCOUNT_JSON")!;
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;
const DISCORD_CHANNEL_ID = "1473868708261658695"; // #챌린지-인증
const DEFAULT_ALLOWED_ORIGINS = [
  "https://content.ggplab.xyz",
  "https://ggplab.github.io",
  "http://localhost:4173",
];
const ALLOWED_ORIGINS = new Set(
  (Deno.env.get("WEB_VERIFY_ALLOWED_ORIGINS") ?? DEFAULT_ALLOWED_ORIGINS.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);
const RATE_LIMIT_WINDOW_MS = Number(
  Deno.env.get("WEB_VERIFY_RATE_LIMIT_WINDOW_MS") ?? "600000"
);
const RATE_LIMIT_MAX = Number(
  Deno.env.get("WEB_VERIFY_RATE_LIMIT_MAX") ?? "20"
);
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const ALLOWED_HOST_SUFFIXES = [
  "linkedin.com",
  "instagram.com",
  "threads.net",
  "threads.com",
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "brunch.co.kr",
  "medium.com",
  "substack.com",
  "tistory.com",
  "velog.io",
  "blog.naver.com",
  "github.io",
];

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

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true;
  return ALLOWED_ORIGINS.has(origin);
}

function buildCorsHeaders(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
    "Vary": "Origin",
  };
  if (origin && isOriginAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function jsonResponse(
  origin: string | null,
  body: Record<string, unknown>,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(origin),
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

function isPrivateIpv4(hostname: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return false;
  const parts = hostname.split(".").map(Number);
  if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return true;
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa") ||
    host === "::1" ||
    isPrivateIpv4(host)
  );
}

function isAllowedContentUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    if (isBlockedHostname(host)) return false;
    return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

function checkRateLimit(clientIp: string): { limited: boolean; retryAfter: number } {
  const now = Date.now();
  const existing = rateLimitStore.get(clientIp);
  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { limited: false, retryAfter: 0 };
  }
  existing.count += 1;
  if (existing.count > RATE_LIMIT_MAX) {
    return {
      limited: true,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { limited: false, retryAfter: 0 };
}

type AuthContext = {
  authType: "session" | "api_key";
  userId: string;
  challengeName: string;
  isActive: boolean;
  apiKeyId: string | null;
};

async function resolveAuthContext(req: Request): Promise<AuthContext | null> {
  const admin = createAdminClient();
  const sessionUser = await getSessionUser(req);

  if (sessionUser) {
    const { data: profile, error } = await admin
      .from("member_profiles")
      .select("user_id, challenge_name, is_active")
      .eq("user_id", sessionUser.id)
      .maybeSingle();

    if (error) {
      console.error("member_profiles lookup failed:", error);
      return null;
    }
    if (!profile) return null;

    return {
      authType: "session",
      userId: sessionUser.id,
      challengeName: profile.challenge_name,
      isActive: profile.is_active,
      apiKeyId: null,
    };
  }

  const token = getBearerToken(req);
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const { data: apiKey, error: apiKeyError } = await admin
    .from("api_keys")
    .select("id, user_id, expires_at, revoked_at")
    .eq("key_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (apiKeyError) {
    console.error("api_keys lookup failed:", apiKeyError);
    return null;
  }
  if (!apiKey) return null;
  if (apiKey.expires_at && new Date(apiKey.expires_at).getTime() <= Date.now()) {
    return null;
  }

  const { data: profile, error: profileError } = await admin
    .from("member_profiles")
    .select("challenge_name, is_active")
    .eq("user_id", apiKey.user_id)
    .maybeSingle();

  if (profileError) {
    console.error("member_profiles lookup failed:", profileError);
    return null;
  }
  if (!profile) return null;

  return {
    authType: "api_key",
    userId: apiKey.user_id,
    challengeName: profile.challenge_name,
    isActive: profile.is_active,
    apiKeyId: apiKey.id,
  };
}

async function insertAuditLog(
  req: Request,
  statusCode: number,
  errorCode: string | null,
  requestName: string | null,
  authContext: AuthContext | null
): Promise<void> {
  try {
    const admin = createAdminClient();
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip")
      || null;
    await admin.from("api_audit_logs").insert({
      user_id: authContext?.userId ?? null,
      api_key_id: authContext?.apiKeyId ?? null,
      request_name: requestName,
      ip_address: ipAddress,
      origin: req.headers.get("Origin"),
      user_agent: req.headers.get("User-Agent"),
      status_code: statusCode,
      error_code: errorCode,
    });
  } catch (error) {
    console.error("api_audit_logs insert failed:", error);
  }
}

async function touchApiKey(apiKeyId: string | null): Promise<void> {
  if (!apiKeyId) return;
  try {
    const admin = createAdminClient();
    await admin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", apiKeyId);
  } catch (error) {
    console.error("api_keys last_used_at update failed:", error);
  }
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

async function getWeekCounts(
  accessToken: string,
  name: string,
  weekLabel: string
): Promise<{ userCount: number; totalCount: number }> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/%EC%8B%9C%ED%8A%B81!B:E`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) return { userCount: 0, totalCount: 0 };
  const data = await resp.json();
  const rows: string[][] = data.values ?? [];
  let userCount = 0;
  let totalCount = 0;
  for (const row of rows) {
    if ((row[3] ?? "").startsWith(weekLabel)) {
      totalCount++;
      if (row[0] === name) userCount++;
    }
  }
  return { userCount, totalCount };
}

// ── Discord 채널 메시지 전송 ───────────────────────────────────────────────────

async function sendDiscordMessage(content: string): Promise<void> {
  const resp = await fetch(
    `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    }
  );
  if (!resp.ok) {
    console.error("Discord 메시지 전송 실패:", resp.status, await resp.text());
  }
}

// ── CORS 헤더 ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (!isOriginAllowed(origin)) {
    return jsonResponse(origin, { error: "허용되지 않은 Origin입니다." }, 403);
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: buildCorsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(`ip:${clientIp}`);
  if (rateLimit.limited) {
    await insertAuditLog(req, 429, "rate_limited_ip", null, null);
    return jsonResponse(
      origin,
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      429,
      { "Retry-After": String(rateLimit.retryAfter) }
    );
  }

  let name: string, links: string[], isPublic: boolean;
  try {
    const body = await req.json();
    name = (body.name ?? body.nickname ?? "").trim(); // nickname은 하위 호환
    links = (body.links ?? [])
      .map((l: string) => l.trim())
      .filter((l: string) => isAllowedContentUrl(l))
      .slice(0, 5);
    isPublic = body.isPublic !== false;
  } catch {
    await insertAuditLog(req, 400, "invalid_json", null, null);
    return jsonResponse(origin, { error: "잘못된 요청 형식입니다." }, 400);
  }

  const authContext = await resolveAuthContext(req);
  if (!authContext) {
    await insertAuditLog(req, 401, "auth_required", name || null, null);
    return jsonResponse(origin, { error: "로그인 세션 또는 사용자별 API 키가 필요합니다." }, 401);
  }
  if (!authContext.isActive) {
    await insertAuditLog(req, 403, "inactive_member", name || null, authContext);
    return jsonResponse(origin, { error: "활성 참가자 계정만 인증할 수 있습니다." }, 403);
  }

  const userRateLimit = checkRateLimit(`user:${authContext.userId}`);
  if (userRateLimit.limited) {
    await insertAuditLog(req, 429, "rate_limited_user", name || null, authContext);
    return jsonResponse(
      origin,
      { error: "해당 계정의 요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      429,
      { "Retry-After": String(userRateLimit.retryAfter) }
    );
  }

  if (name && name !== authContext.challengeName) {
    await insertAuditLog(req, 403, "name_mismatch", name, authContext);
    return jsonResponse(
      origin,
      { error: `본인 이름으로만 인증할 수 있습니다: ${authContext.challengeName}` },
      403
    );
  }

  name = authContext.challengeName;

  if (links.length === 0) {
    await insertAuditLog(req, 400, "invalid_link", name, authContext);
    return jsonResponse(
      origin,
      {
        error: "허용된 플랫폼 URL이 없습니다. LinkedIn, Instagram, Threads, YouTube, TikTok, Brunch 및 등록된 블로그 도메인만 지원합니다.",
      },
      400
    );
  }

  const today = getTodayKST();
  const weekLabel = getWeekLabel();

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken();
  } catch (e) {
    console.error("Google 인증 실패:", e);
    await insertAuditLog(req, 500, "google_auth_failed", name, authContext);
    return jsonResponse(origin, { error: "Google 인증 오류가 발생했습니다." }, 500);
  }

  const { userCount, totalCount } = await getWeekCounts(accessToken, name, weekLabel);
  let existingCount = userCount;
  let weekTotal = totalCount;
  const results: { platform: string; url: string; summary: string; medal: string }[] = [];

  for (const url of links) {
    const platform = detectPlatform(url);
    const summary = isPublic
      ? (await fetchOGSummary(url) ?? await callGemini(url, platform))
      : "";
    existingCount++;
    weekTotal++;
    const numberLabel = `${weekLabel}-${existingCount}회`;
    const medal = weekTotal === 1 ? " 🥇" : weekTotal === 2 ? " 🥈" : weekTotal === 3 ? " 🥉" : "";
    try {
      await appendToSheets(accessToken, [today, name, platform, url, numberLabel, summary, isPublic ? "public" : "private"]);
      results.push({ platform, url, summary, medal });
    } catch (e) {
      console.error(`Sheets 저장 실패 (${url}):`, e);
    }
  }

  if (results.length === 0) {
    await insertAuditLog(req, 500, "sheets_write_failed", name, authContext);
    return jsonResponse(origin, { error: "저장 중 오류가 발생했습니다." }, 500);
  }

  // Discord #챌린지-인증 채널에 메시지 전송
  let msg = `✅ ${name}님, ${weekLabel} 인증 완료! 🎉\n\n`;
  if (!isPublic) {
    msg += "🔒 비공개로 인증했습니다.\n";
    for (const { platform } of results) {
      msg += `• ${platform}\n`;
    }
  } else if (results.length === 1) {
    msg += `📌 ${results[0].platform} · "${results[0].summary}"${results[0].medal}\n${results[0].url}`;
  } else {
    for (const { platform, url, summary, medal } of results) {
      msg += `• ${platform} · "${summary}"${medal}\n  ${url}\n`;
    }
  }
  await sendDiscordMessage(msg.trim());
  await touchApiKey(authContext.apiKeyId);
  await insertAuditLog(req, 200, null, name, authContext);

  return jsonResponse(origin, { ok: true, weekLabel, results });
});
