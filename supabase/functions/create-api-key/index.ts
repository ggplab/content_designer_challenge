import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  buildCorsHeaders,
  createAdminClient,
  createApiKeyPlaintext,
  getSessionUser,
  isOriginAllowed,
  jsonResponse,
  sha256Hex,
} from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (!isOriginAllowed(origin)) {
    return jsonResponse(origin, { error: "허용되지 않은 Origin입니다." }, 403);
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: buildCorsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return jsonResponse(origin, { error: "Method Not Allowed" }, 405);
  }

  const user = await getSessionUser(req);
  if (!user) {
    return jsonResponse(origin, { error: "로그인이 필요합니다." }, 401);
  }

  let label = "";
  let expiresAt: string | null = null;
  try {
    const body = await req.json();
    label = String(body.label ?? "").trim();
    expiresAt = body.expiresAt ? String(body.expiresAt) : null;
  } catch {
    return jsonResponse(origin, { error: "잘못된 요청 형식입니다." }, 400);
  }

  if (!label || label.length > 80) {
    return jsonResponse(origin, { error: "키 이름은 1~80자로 입력해주세요." }, 400);
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("member_profiles")
    .select("user_id, challenge_name, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("member_profiles lookup failed:", profileError);
    return jsonResponse(origin, { error: "계정 정보를 확인할 수 없습니다." }, 500);
  }
  if (!profile || !profile.is_active) {
    return jsonResponse(origin, { error: "활성 참가자 계정만 API 키를 발급할 수 있습니다." }, 403);
  }

  const plaintext = createApiKeyPlaintext();
  const keyHash = await sha256Hex(plaintext);
  const keyPrefix = plaintext.slice(0, 14);

  const { data, error } = await admin
    .from("api_keys")
    .insert({
      user_id: user.id,
      label,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      expires_at: expiresAt,
      scopes: ["submit:verify"],
    })
    .select("id, label, key_prefix, expires_at, created_at")
    .single();

  if (error) {
    console.error("api_keys insert failed:", error);
    return jsonResponse(origin, { error: "API 키를 발급하지 못했습니다." }, 500);
  }

  return jsonResponse(origin, {
    ok: true,
    apiKey: plaintext,
    key: data,
    challengeName: profile.challenge_name,
  });
});
