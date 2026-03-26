import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;
const GOOGLE_SHEET_ID = Deno.env.get("GOOGLE_SHEET_ID")!;
const GCP_SERVICE_ACCOUNT_JSON = Deno.env.get("GCP_SERVICE_ACCOUNT_JSON")!;
const DISCORD_CHANNEL_ID = Deno.env.get("DISCORD_WEEK_SUMMARY_CHANNEL_ID")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;

// ── 주차 계산 ──────────────────────────────────────────────────────────────

function getWeekLabel(): string {
  const KST_OFFSET = 9 * 60 * 60 * 1000;
  const now = new Date(Date.now() + KST_OFFSET);
  const start = new Date("2026-03-02T00:00:00Z");
  if (now < start) return "준비기간";
  const days = Math.floor((now.getTime() - start.getTime()) / 86400000);
  const currentWeek = Math.max(1, Math.ceil((days + 1) / 7));
  const lastWeek = currentWeek - 1;
  if (lastWeek < 1) return "준비기간";
  return `${lastWeek}주차`;
}

// ── Google SA 인증 ─────────────────────────────────────────────────────────

function toBase64Url(input: string | Uint8Array): string {
  const str = typeof input === "string" ? input : String.fromCharCode(...input);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function getGoogleAccessToken(): Promise<string> {
  const fixedJson = GCP_SERVICE_ACCOUNT_JSON.replace(/\r?\n/g, "\\n");
  const sa = JSON.parse(fixedJson);
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = toBase64Url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));
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
  if (!tokenData.access_token) throw new Error(`OAuth 실패: ${JSON.stringify(tokenData)}`);
  return tokenData.access_token;
}

// ── Sheets 데이터 읽기 ─────────────────────────────────────────────────────

async function fetchSheetRows(accessToken: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/%EC%8B%9C%ED%8A%B81!A:G`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) throw new Error(`Sheets 조회 실패 (${resp.status}): ${await resp.text()}`);
  const data = await resp.json();
  return data.values ?? [];
}

// ── URL 단축 (is.gd) ──────────────────────────────────────────────────────

async function shortenUrl(url: string): Promise<string> {
  try {
    const resp = await fetch(
      `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`
    );
    if (!resp.ok) return url;
    const short = await resp.text();
    return short.trim().startsWith("https://is.gd/") ? short.trim() : url;
  } catch {
    return url;
  }
}

// ── Discord 메시지 전송 ────────────────────────────────────────────────────

async function sendDiscordEmbed(embed: Record<string, unknown>): Promise<void> {
  const resp = await fetch(
    `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ embeds: [embed] }),
    }
  );
  if (!resp.ok) throw new Error(`Discord 전송 실패 (${resp.status}): ${await resp.text()}`);
}

// ── Gemini 추천 콘텐츠 ─────────────────────────────────────────────────────

type ContentItem = { user: string; platform: string; summary: string; url: string };
type GeminiPick = { index: number; reason: string };

async function pickRecommendedContents(
  items: ContentItem[]
): Promise<{ educational: GeminiPick | null; challenge: GeminiPick | null; hooking: GeminiPick | null }> {
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
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 1000,
          },
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

// ── 정산 로직 ──────────────────────────────────────────────────────────────

async function runSummary(weekLabel: string): Promise<Record<string, unknown>> {
  const accessToken = await getGoogleAccessToken();
  const rows = await fetchSheetRows(accessToken);

  // 헤더 제외, 해당 주차 행만 필터
  // 컬럼: A=date, B=user, C=platform, D=link, E=number, F=summary, G=etc
  const weekRows = rows.slice(1).filter((row) => (row[4] ?? "").startsWith(weekLabel));

  if (weekRows.length === 0) {
    return { title: `📊 ${weekLabel} 주간 정산`, description: "지난주 인증 없음.", color: 0x95a5a6 };
  }

  // 유저별 집계
  const userMap = new Map<string, { count: number; platforms: string[] }>();
  for (const row of weekRows) {
    const user = row[1] ?? "Unknown";
    const platform = row[2] ?? "기타";
    const existing = userMap.get(user);
    if (existing) {
      existing.count++;
      existing.platforms.push(platform);
    } else {
      userMap.set(user, { count: 1, platforms: [platform] });
    }
  }

  const sorted = [...userMap.entries()].sort((a, b) => b[1].count - a[1].count);

  // 인증한 사람 이름 나열
  const names = sorted.map(([user]) => user).join(", ");

  // top 3
  const medals = ["🥇", "🥈", "🥉"];
  const top3 = sorted.slice(0, 3)
    .map(([user, { count }], i) => `${medals[i]} ${user} (${count}회)`)
    .join("\n");

  // OG 파싱 성공한 콘텐츠만 추천 후보 (summary가 있고 "{platform} 콘텐츠" 패턴 아닌 것)
  const candidates: ContentItem[] = weekRows
    .filter((row) => {
      const summary = row[5] ?? "";
      console.log(`[summary] candidate check: "${summary}" length=${summary.length} pattern=${/^.+\s콘텐츠$/.test(summary)}`);
      return summary.length > 5 && !/^.+\s콘텐츠$/.test(summary);
    })
    .map((row) => ({
      user: row[1] ?? "Unknown",
      platform: row[2] ?? "기타",
      summary: row[5],
      url: row[3] ?? "",
    }));

  const sections: string[] = [
    `**지난주 인증한 멤버 ${userMap.size}명**\n${names}`,
    `**제출 횟수 Top 3**\n${top3}`,
  ];

  console.log(`[summary] 추천 후보 수: ${candidates.length}`);
  if (candidates.length >= 1) {
    const recLines: string[] = ["**지난주 추천 콘텐츠**"];
    const picks = await pickRecommendedContents(candidates);
    const eduItem = picks.educational !== null ? candidates[picks.educational.index] : null;
    const chalItem = picks.challenge !== null ? candidates[picks.challenge.index] : null;
    const hookItem = picks.hooking !== null ? candidates[picks.hooking.index] : null;

    if (eduItem) {
      const shortUrl = await shortenUrl(eduItem.url);
      recLines.push(`📚 인사이트 얻어요 — ${picks.educational!.reason}`);
      recLines.push(`${eduItem.user} · ${eduItem.platform} · ${shortUrl}`);
    }
    if (chalItem) {
      const shortUrl = await shortenUrl(chalItem.url);
      recLines.push(`🎯 챌린지 취지에 딱! — ${picks.challenge!.reason}`);
      recLines.push(`${chalItem.user} · ${chalItem.platform} · ${shortUrl}`);
    }
    if (hookItem) {
      const shortUrl = await shortenUrl(hookItem.url);
      recLines.push(`🪝 이건 클릭 안 할 수 없어 — ${picks.hooking!.reason}`);
      recLines.push(`${hookItem.user} · ${hookItem.platform} · ${shortUrl}`);
    }
    sections.push(recLines.join("\n"));
  } else {
    sections.push("**지난주 추천 콘텐츠**\n추천을 건너뛰어요 — 이번주엔 더 풍성하게! 😊");
  }

  sections.push("**다음 주도 함께 성장해요 💪**\n제출 현황이 궁금하다면? [대시보드 바로가기](https://ggplab.github.io/content_designer_challenge/)");

  return {
    title: `📊 ${weekLabel} 주간 정산`,
    color: 0x5865f2,
    description: sections.join("\n\n\n"),
  };
}

// ── 엔트리포인트 ──────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const weekLabel = getWeekLabel();
    const embed = await runSummary(weekLabel);
    await sendDiscordEmbed(embed);
    return new Response(JSON.stringify({ ok: true, weekLabel }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[weekly-summary] 오류:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
