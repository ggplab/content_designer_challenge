import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { buildModal } from "./services/modal.ts";
import { processVerification } from "./verification.ts";

const DISCORD_PUBLIC_KEY = Deno.env.get("DISCORD_PUBLIC_KEY")!;

// ── Ed25519 서명 검증 ─────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const arr = new Uint8Array(
    (hex.match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16))
  );
  return new Uint8Array(arr.buffer as ArrayBuffer);
}

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

// ── 엔트리포인트 ──────────────────────────────────────────────────────────────

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
  if (!await verifySignature(signature, timestamp, body)) {
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
    // deno-lint-ignore no-explicit-any
    const options: any[] = interaction.data?.options ?? [];
    // deno-lint-ignore no-explicit-any
    const visibility = options.find((opt: any) => opt.name === "visibility")?.value;
    // deno-lint-ignore no-explicit-any
    const subcommand = options.find((opt: any) => opt.type === 1)?.name;
    // deno-lint-ignore no-explicit-any
    const mode = options.find((opt: any) => opt.name === "mode")?.value;
    const isBlind =
      visibility === "blind" ||
      subcommand === "blind" ||
      mode === "blind" ||
      // deno-lint-ignore no-explicit-any
      options.find((opt: any) => opt.name === "blind")?.value === true;
    return json(buildModal(!isBlind));
  }

  // type 5: 모달 제출 → deferred + 백그라운드 처리
  if (interaction.type === 5) {
    const user = interaction.member?.user ?? interaction.user ?? {};
    const displayName = user.global_name ?? user.username ?? "Unknown";
    const rawLinks: string[] = (interaction.data?.components ?? []).map(
      // deno-lint-ignore no-explicit-any
      (row: any) => row.components?.[0]?.value ?? ""
    );
    const isPublic = (interaction.data?.custom_id ?? "").endsWith(":public");
    const userId: string = user.id ?? "";

    const runtime = (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<void>) => void } }).EdgeRuntime;
    if (runtime) {
      runtime.waitUntil(processVerification(displayName, userId, rawLinks, interaction.token, isPublic));
    } else {
      processVerification(displayName, userId, rawLinks, interaction.token, isPublic).catch(console.error);
    }

    return json({ type: 5 });
  }

  return json({ type: 1 });
});
