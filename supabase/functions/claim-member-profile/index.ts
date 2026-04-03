import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createAdminClient } from "../_shared/supabase.ts";
import { buildCorsHeaders, isOriginAllowed, jsonResponse } from "../_shared/cors.ts";
import { getSessionUser } from "../_shared/session.ts";

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

  let challengeName = "";
  let displayName = "";
  try {
    const body = await req.json();
    challengeName = String(body.challengeName ?? "").trim();
    displayName = String(body.displayName ?? user.user_metadata?.full_name ?? user.email ?? "").trim();
  } catch {
    return jsonResponse(origin, { error: "잘못된 요청 형식입니다." }, 400);
  }

  if (!challengeName) {
    return jsonResponse(origin, { error: "연결할 참가자 이름을 선택해주세요." }, 400);
  }

  const admin = createAdminClient();

  const [{ data: existingProfile, error: existingProfileError }, { data: challengeMember, error: challengeMemberError }] = await Promise.all([
    admin
      .from("member_profiles")
      .select("user_id, challenge_name")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("challenge_members")
      .select("challenge_name, is_active")
      .eq("challenge_name", challengeName)
      .maybeSingle(),
  ]);

  if (existingProfileError || challengeMemberError) {
    console.error("claim-member-profile lookup failed:", existingProfileError ?? challengeMemberError);
    return jsonResponse(origin, { error: "계정 연결 정보를 확인하지 못했습니다." }, 500);
  }
  if (existingProfile) {
    return jsonResponse(origin, { error: `이미 참가자 이름이 연결되어 있습니다: ${existingProfile.challenge_name}` }, 409);
  }
  if (!challengeMember || !challengeMember.is_active) {
    return jsonResponse(origin, { error: "활성 참가자 목록에 없는 이름입니다." }, 404);
  }

  const { data: claimedProfile, error: claimedError } = await admin
    .from("member_profiles")
    .insert({
      user_id: user.id,
      display_name: displayName || challengeName,
      challenge_name: challengeName,
      discord_user_id: String(user.user_metadata?.provider_id ?? user.user_metadata?.sub ?? ""),
      is_active: true,
      role: "member",
    })
    .select("display_name, challenge_name, discord_user_id, is_active, role, created_at")
    .single();

  if (claimedError) {
    if (claimedError.code === "23505") {
      return jsonResponse(origin, { error: "이미 다른 계정이 이 참가자 이름을 사용 중입니다." }, 409);
    }
    console.error("claim-member-profile insert failed:", claimedError);
    return jsonResponse(origin, { error: "참가자 계정을 연결하지 못했습니다." }, 500);
  }

  return jsonResponse(origin, {
    ok: true,
    profile: claimedProfile,
  });
});
