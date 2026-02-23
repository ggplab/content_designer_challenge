import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const DISCORD_PUBLIC_KEY = Deno.env.get("DISCORD_PUBLIC_KEY")!;
const DISCORD_APPLICATION_ID = Deno.env.get("DISCORD_APPLICATION_ID")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GOOGLE_SHEET_ID = Deno.env.get("GOOGLE_SHEET_ID")!;
const GCP_SERVICE_ACCOUNT_JSON = Deno.env.get("GCP_SERVICE_ACCOUNT_JSON")!;

// ── 유틸 ──────────────────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(
    (hex.match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16))
  );
}

function toBase64Url(input: string | Uint8Array): string {
  const str =
    typeof input === "string"
      ? input
      : String.fromCharCode(...input);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ── Ed25519 서명 검증 ─────────────────────────────────────────────────────────

async function verifySignature(
  signature: string,
  timestamp: string,
  body: string
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      hexToBytes(DISCORD_PUBLIC_KEY),
      { name: "Ed25519" },
      false,
      ["verify"]
    );
    return await crypto.subtle.verify(
      "Ed25519",
      key,
      hexToBytes(signature),
      new TextEncoder().encode(timestamp + body)
    );
  } catch {
    return false;
  }
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
  if (u.includes("threads.net")) return "Threads";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "YouTube";
  return "Blog";
}

// ── Gemini 요약 ───────────────────────────────────────────────────────────────

async function callGemini(url: string, platform: string): Promise<string> {
  const prompt = `당신은 콘텐츠 챌린지 인증 도우미입니다.
아래 URL은 ${platform} 플랫폼의 콘텐츠입니다.
URL 경로와 슬러그를 분석하여 어떤 주제의 글/영상인지 한국어로 20자 이내로 추측해 주세요.
추측이 불가능하면 "${platform} 콘텐츠"라고 답하세요.
반드시 {"summary":"..."} JSON만 반환하세요.

URL: ${url}`;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 100 },
        }),
      }
    );

    if (!resp.ok) {
      console.error("Gemini HTTP error:", resp.status);
      return `${platform} 콘텐츠`;
    }

    const data = await resp.json();
    const text: string =
      data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return parsed.summary ?? `${platform} 콘텐츠`;
    }
    return text.slice(0, 20) || `${platform} 콘텐츠`;
  } catch (e) {
    console.error("Gemini error:", e);
    return `${platform} 콘텐츠`;
  }
}

// ── Google Service Account → Access Token ────────────────────────────────────

async function getGoogleAccessToken(): Promise<string> {
  console.log("[auth] parsing SA JSON, length:", GCP_SERVICE_ACCOUNT_JSON?.length);
  // 시크릿 저장 시 \n이 실제 줄바꿈으로 변환된 경우 JSON escape로 복원
  const fixedJson = GCP_SERVICE_ACCOUNT_JSON.replace(/\r?\n/g, "\\n");
  const sa = JSON.parse(fixedJson);
  console.log("[auth] client_email:", sa.client_email);

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
  console.log("[auth] pemBody length:", pemBody.length);

  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  console.log("[auth] binaryKey length:", binaryKey.length);

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  console.log("[auth] cryptoKey imported");

  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );
  console.log("[auth] signed, sig length:", sig.byteLength);

  const jwt = `${signingInput}.${toBase64Url(new Uint8Array(sig))}`;

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResp.json();
  console.log("[auth] token response:", JSON.stringify(tokenData).slice(0, 100));
  if (!tokenData.access_token) {
    throw new Error(`OAuth 토큰 발급 실패: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

// ── Google Sheets에 행 추가 ───────────────────────────────────────────────────

async function appendToSheets(
  accessToken: string,
  row: string[]
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/%EC%8B%9C%ED%8A%B81!A:G:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [row] }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Sheets 저장 실패 (${resp.status}): ${err}`);
  }
}

// ── Discord follow-up 메시지 ──────────────────────────────────────────────────

async function sendFollowup(token: string, content: string): Promise<void> {
  const resp = await fetch(
    `https://discord.com/api/v10/webhooks/${DISCORD_APPLICATION_ID}/${token}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }
  );
  if (!resp.ok) {
    console.error("Discord follow-up 실패:", resp.status, await resp.text());
  }
}

// ── 메인 처리 로직 ────────────────────────────────────────────────────────────

async function processVerification(
  displayName: string,
  rawLinks: string[],
  token: string,
  isPublic: boolean
): Promise<void> {
  const links = rawLinks
    .map((l) => l.trim())
    .filter((l) => l.startsWith("http"));

  if (links.length === 0) {
    await sendFollowup(
      token,
      "❌ 유효한 URL이 없습니다. http 또는 https로 시작하는 링크를 입력해주세요."
    );
    return;
  }

  const today = getTodayKST();
  const weekLabel = getWeekLabel();

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken();
  } catch (e) {
    console.error("Google 인증 실패:", e);
    await sendFollowup(token, "❌ Google 인증 오류가 발생했습니다. 관리자에게 문의해주세요.");
    return;
  }

  const results: { platform: string; url: string }[] = [];

  for (const url of links) {
    const platform = detectPlatform(url);
    const summary = await callGemini(url, platform);

    try {
      // 컬럼: date | user | platfrom(오타유지) | link | number | summary | etc
      await appendToSheets(accessToken, [
        today,
        displayName,
        platform,
        url,
        weekLabel,
        summary,
        isPublic ? "public" : "private",
      ]);
      results.push({ platform, url });
      console.log(`✅ Sheets 저장: ${platform} — ${url}`);
    } catch (e) {
      console.error(`Sheets 저장 실패 (${url}):`, e);
    }
  }

  if (results.length === 0) {
    await sendFollowup(token, "❌ 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    return;
  }

  // 결과 메시지 조합
  let msg = `✅ ${displayName}님, ${weekLabel} 인증 완료! 🎉\n\n`;
  if (!isPublic) {
    msg += "🔒 링크 비공개로 저장했습니다.\n";
    if (results.length === 1) {
      msg += `📌 ${results[0].platform} 1건 등록`;
    } else {
      msg += `📌 ${results.length}개 플랫폼 등록:\n`;
      for (const { platform } of results) {
        msg += `• ${platform}\n`;
      }
    }
  } else if (results.length === 1) {
    msg += `📌 ${results[0].platform}\n${results[0].url}`;
  } else {
    msg += `📌 ${results.length}개 플랫폼 등록:\n`;
    for (const { platform, url } of results) {
      msg += `• ${platform} — ${url}\n`;
    }
  }

  await sendFollowup(token, msg.trim());
}

// ── 모달 정의 ─────────────────────────────────────────────────────────────────

function buildModal(isPublic: boolean) {
  const fields = [
    { id: "link1", label: "링크 1 (필수)", required: true },
    { id: "link2", label: "링크 2", required: false },
    { id: "link3", label: "링크 3", required: false },
    { id: "link4", label: "링크 4", required: false },
    { id: "link5", label: "링크 5", required: false },
  ];

  return {
    type: 9,
    data: {
      custom_id: `verify_modal:${isPublic ? "public" : "private"}`,
      title: "콘텐츠 인증",
      components: fields.map(({ id, label, required }) => ({
        type: 1,
        components: [
          {
            type: 4,
            custom_id: id,
            label,
            style: 1, // SHORT
            placeholder: "https://...",
            required,
            max_length: 500,
          },
        ],
      })),
    },
  };
}

// ── Deno.serve 엔트리포인트 ───────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");
  if (!signature || !timestamp) {
    return new Response("Missing signature headers", { status: 401 });
  }

  const body = await req.text();

  const valid = await verifySignature(signature, timestamp, body);
  if (!valid) {
    return new Response("Invalid signature", { status: 401 });
  }

  const interaction = JSON.parse(body);
  const json = (obj: unknown) =>
    new Response(JSON.stringify(obj), {
      headers: { "Content-Type": "application/json" },
    });

  // type 1: PING → PONG
  if (interaction.type === 1) {
    return json({ type: 1 });
  }

  // type 2: /인증 슬래시 커맨드 → 모달 표시
  if (interaction.type === 2) {
    const isPublic = Boolean(
      // deno-lint-ignore no-explicit-any
      (interaction.data?.options ?? []).find((opt: any) => opt.name === "public")
        ?.value === true
    );
    return json(buildModal(isPublic));
  }

  // type 5: 모달 제출 → deferred + 백그라운드 처리
  if (interaction.type === 5) {
    const user =
      interaction.member?.user ?? interaction.user ?? {};
    const displayName =
      user.global_name ?? user.username ?? "Unknown";

    const rawLinks: string[] = (interaction.data?.components ?? []).map(
      // deno-lint-ignore no-explicit-any
      (row: any) => row.components?.[0]?.value ?? ""
    );
    const customId: string = interaction.data?.custom_id ?? "";
    const isPublic = customId.endsWith(":public");

    EdgeRuntime.waitUntil(
      processVerification(displayName, rawLinks, interaction.token, isPublic)
    );

    return json({ type: 5 }); // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
  }

  // 기타: PONG fallback
  return json({ type: 1 });
});
