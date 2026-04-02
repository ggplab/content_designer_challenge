import { getWeekLabel, getTodayKST } from "../_shared/week.ts";
import { detectPlatform, getMedal } from "../_shared/platform.ts";
import { getGoogleAccessToken } from "../_shared/google-auth.ts";

const DISCORD_APPLICATION_ID = Deno.env.get("DISCORD_APPLICATION_ID")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GOOGLE_SHEET_ID = Deno.env.get("GOOGLE_SHEET_ID")!;

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

// ── Gemini 요약 ───────────────────────────────────────────────────────────────

export async function callGemini(url: string, platform: string): Promise<string> {
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

    if (!resp.ok) {
      console.error("Gemini HTTP error:", resp.status, await resp.text());
      return `${platform} 콘텐츠`;
    }

    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(text);
    return (parsed.summary as string)?.slice(0, 20) || `${platform} 콘텐츠`;
  } catch (e) {
    console.error("Gemini error:", e);
    return `${platform} 콘텐츠`;
  }
}

// ── Google Sheets ─────────────────────────────────────────────────────────────

export async function appendToSheets(accessToken: string, row: string[]): Promise<void> {
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

export async function getWeekCounts(
  accessToken: string,
  displayName: string,
  weekLabel: string
): Promise<{ userCount: number; totalCount: number }> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/%EC%8B%9C%ED%8A%B81!B:E`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    console.error("Sheets 조회 실패:", resp.status);
    return { userCount: 0, totalCount: 0 };
  }
  const data = await resp.json();
  const rows: string[][] = data.values ?? [];
  let userCount = 0;
  let totalCount = 0;
  for (const row of rows) {
    if ((row[3] ?? "").startsWith(weekLabel)) {
      totalCount++;
      if (row[0] === displayName) userCount++;
    }
  }
  return { userCount, totalCount };
}

// ── Discord follow-up ─────────────────────────────────────────────────────────

export async function sendFollowup(token: string, content: string): Promise<void> {
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

// ── 모달 정의 ─────────────────────────────────────────────────────────────────

export function buildModal(isPublic: boolean) {
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
            style: 1,
            placeholder: "https://...",
            required,
            max_length: 500,
          },
        ],
      })),
    },
  };
}

// ── 인증 처리 메인 로직 ───────────────────────────────────────────────────────

export async function processVerification(
  displayName: string,
  userId: string,
  rawLinks: string[],
  token: string,
  isPublic: boolean
): Promise<void> {
  const links = rawLinks.map((l) => l.trim()).filter((l) => l.startsWith("http"));

  if (links.length === 0) {
    await sendFollowup(token, "❌ 유효한 URL이 없습니다. http 또는 https로 시작하는 링크를 입력해주세요.");
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

  const { userCount, totalCount } = await getWeekCounts(accessToken, displayName, weekLabel);
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
    const medal = getMedal(weekTotal);

    try {
      await appendToSheets(accessToken, [
        today,
        displayName,
        platform,
        url,
        numberLabel,
        summary,
        isPublic ? "public" : "private",
      ]);
      results.push({ platform, url, summary, medal });
      console.log(`✅ Sheets 저장: ${platform} — ${url}`);
    } catch (e) {
      console.error(`Sheets 저장 실패 (${url}):`, e);
    }
  }

  if (results.length === 0) {
    await sendFollowup(token, "❌ 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    return;
  }

  const mention = userId ? `<@${userId}>` : displayName;
  let msg = `✅ ${mention}님, ${weekLabel} 인증 완료! 🎉\n\n`;
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

  await sendFollowup(token, msg.trim());
}
