/**
 * Discord Interactions Relay — Cloudflare Worker
 *
 * 역할:
 *   type=1 PING  → 즉시 PONG
 *   type=2 /인증  → 즉시 모달 반환 (cold start 없음)
 *   type=5 모달제출 → 즉시 {type:5} 응답 + Supabase로 백그라운드 포워딩
 */

const SUPABASE_FN_URL =
  "https://tcxtcacibgoancvoiybx.supabase.co/functions/v1/discord-verify";

// ── Ed25519 서명 검증 ─────────────────────────────────────────────────────────

function hexToBytes(hex) {
  return new Uint8Array(
    (hex.match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16))
  );
}

async function verifySignature(publicKeyHex, signature, timestamp, body) {
  try {
    const encoder = new TextEncoder();
    const timestampBytes = encoder.encode(timestamp);
    const bodyBytes = encoder.encode(body);
    const message = new Uint8Array(timestampBytes.length + bodyBytes.length);
    message.set(timestampBytes);
    message.set(bodyBytes, timestampBytes.length);

    const key = await crypto.subtle.importKey(
      "raw",
      hexToBytes(publicKeyHex),
      { name: "Ed25519" },
      false,
      ["verify"]
    );
    return await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      hexToBytes(signature),
      message
    );
  } catch (e) {
    console.error("[verify] error:", e.message);
    return false;
  }
}

// ── 모달 빌더 ─────────────────────────────────────────────────────────────────

function buildModal(isPublic) {
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

// ── 메인 핸들러 ───────────────────────────────────────────────────────────────

export default {
  async fetch(req, env, ctx) {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const signature = req.headers.get("x-signature-ed25519");
    const timestamp = req.headers.get("x-signature-timestamp");
    console.log(
      JSON.stringify({
        stage: "request_received",
        method: req.method,
        hasSignature: Boolean(signature),
        hasTimestamp: Boolean(timestamp),
      })
    );

    if (!signature || !timestamp) {
      console.log(JSON.stringify({ stage: "missing_signature_headers" }));
      return new Response("Missing signature headers", { status: 401 });
    }

    const body = await req.text();

    const valid = await verifySignature(
      env.DISCORD_PUBLIC_KEY,
      signature,
      timestamp,
      body
    );
    console.log(JSON.stringify({ stage: "signature_verified", valid }));
    if (!valid) {
      return new Response("Invalid signature", { status: 401 });
    }

    const interaction = JSON.parse(body);
    console.log(
      JSON.stringify({
        stage: "interaction_parsed",
        type: interaction.type,
      })
    );
    const json = (obj) =>
      new Response(JSON.stringify(obj), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    // type=1: PING → PONG
    if (interaction.type === 1) {
      console.log(JSON.stringify({ stage: "responding_pong" }));
      return new Response('{"type":1}', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // type=2: 슬래시 커맨드 → 모달 즉시 반환
    if (interaction.type === 2) {
      const options = interaction.data?.options ?? [];
      const visibility = options.find((o) => o.name === "visibility")?.value;
      const isPublic = visibility !== "blind";
      return json(buildModal(isPublic));
    }

    // type=5: 모달 제출 → 즉시 응답 + Supabase 백그라운드 포워딩
    if (interaction.type === 5) {
      ctx.waitUntil(
        (async () => {
          try {
            const resp = await fetch(SUPABASE_FN_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-signature-ed25519": signature,
                "x-signature-timestamp": timestamp,
              },
              body,
            });
            const text = await resp.text();
            console.log(
              JSON.stringify({
                stage: "supabase_forward_complete",
                status: resp.status,
                body: text.slice(0, 300),
              })
            );
          } catch (error) {
            console.log(
              JSON.stringify({
                stage: "supabase_forward_failed",
                error: String(error),
              })
            );
          }
        })()
      );
      console.log(JSON.stringify({ stage: "responding_deferred" }));
      return json({ type: 5 });
    }

    return json({ type: 1 });
  },
};
