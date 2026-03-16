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
  if (req.method !== "GET") {
    return jsonResponse(origin, { error: "Method Not Allowed" }, 405);
  }

  const user = await getSessionUser(req);
  if (!user) {
    return jsonResponse(origin, { error: "로그인이 필요합니다." }, 401);
  }

  const admin = createAdminClient();

  const [
    { data: profile, error: profileError },
    { data: keys, error: keysError },
    { data: logs, error: logsError },
    { data: challengeMembers, error: challengeMembersError },
  ] = await Promise.all([
    admin
      .from("member_profiles")
      .select("display_name, challenge_name, discord_user_id, is_active, role, created_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("api_keys")
      .select("id, label, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("api_audit_logs")
      .select("id, request_name, status_code, error_code, origin, ip_address, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("challenge_members")
      .select("challenge_name")
      .eq("is_active", true)
      .order("challenge_name", { ascending: true }),
  ]);

  if (profileError || keysError || logsError || challengeMembersError) {
    console.error("list-api-keys query failed:", profileError ?? keysError ?? logsError ?? challengeMembersError);
    return jsonResponse(origin, { error: "계정 정보를 불러오지 못했습니다." }, 500);
  }

  return jsonResponse(origin, {
    ok: true,
    profile,
    apiKeys: keys ?? [],
    auditLogs: logs ?? [],
    challengeMembers: (challengeMembers ?? []).map((row) => row.challenge_name),
  });
});
