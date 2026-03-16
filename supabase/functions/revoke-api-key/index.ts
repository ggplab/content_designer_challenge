import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  buildCorsHeaders,
  createAdminClient,
  getSessionUser,
  isOriginAllowed,
  jsonResponse,
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

  let keyId = "";
  try {
    const body = await req.json();
    keyId = String(body.keyId ?? "").trim();
  } catch {
    return jsonResponse(origin, { error: "잘못된 요청 형식입니다." }, 400);
  }

  if (!keyId) {
    return jsonResponse(origin, { error: "폐기할 키를 선택해주세요." }, 400);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("api_keys")
    .update({
      revoked_at: new Date().toISOString(),
    })
    .eq("id", keyId)
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .select("id, label, key_prefix, revoked_at")
    .maybeSingle();

  if (error) {
    console.error("revoke-api-key update failed:", error);
    return jsonResponse(origin, { error: "API 키를 폐기하지 못했습니다." }, 500);
  }
  if (!data) {
    return jsonResponse(origin, { error: "유효한 API 키를 찾지 못했습니다." }, 404);
  }

  return jsonResponse(origin, {
    ok: true,
    key: data,
  });
});
