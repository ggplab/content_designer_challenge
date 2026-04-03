import { assertEquals, assertThrows } from "jsr:@std/assert";
import {
  getSupabasePublishableKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "../../supabase/functions/_shared/supabase.ts";

// ── env getter 함수들 ────────────────────────────────────────────────────────
// createAdminClient / createAuthClient는 실제 Supabase URL이 필요해 유닛 테스트 제외

Deno.test("getSupabaseUrl: env 없으면 throw", () => {
  Deno.env.delete("SUPABASE_URL");
  assertThrows(() => getSupabaseUrl(), Error, "SUPABASE_URL");
});

Deno.test("getSupabaseUrl: env 있으면 반환", () => {
  Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
  assertEquals(getSupabaseUrl(), "https://test.supabase.co");
  Deno.env.delete("SUPABASE_URL");
});

Deno.test("getSupabasePublishableKey: SUPABASE_PUBLISHABLE_KEY 우선", () => {
  Deno.env.set("SUPABASE_PUBLISHABLE_KEY", "publishable-key");
  Deno.env.set("SUPABASE_ANON_KEY", "anon-key");
  assertEquals(getSupabasePublishableKey(), "publishable-key");
  Deno.env.delete("SUPABASE_PUBLISHABLE_KEY");
  Deno.env.delete("SUPABASE_ANON_KEY");
});

Deno.test("getSupabasePublishableKey: SUPABASE_ANON_KEY fallback", () => {
  Deno.env.delete("SUPABASE_PUBLISHABLE_KEY");
  Deno.env.set("SUPABASE_ANON_KEY", "anon-key");
  assertEquals(getSupabasePublishableKey(), "anon-key");
  Deno.env.delete("SUPABASE_ANON_KEY");
});

Deno.test("getSupabaseServiceRoleKey: env 없으면 throw", () => {
  Deno.env.delete("SERVICE_ROLE_KEY");
  assertThrows(() => getSupabaseServiceRoleKey(), Error, "SERVICE_ROLE_KEY");
});

Deno.test("getSupabaseServiceRoleKey: env 있으면 반환", () => {
  Deno.env.set("SERVICE_ROLE_KEY", "service-role-key");
  assertEquals(getSupabaseServiceRoleKey(), "service-role-key");
  Deno.env.delete("SERVICE_ROLE_KEY");
});
