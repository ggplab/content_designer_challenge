import { createClient } from "npm:@supabase/supabase-js@2";

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseUrl(): string {
  return getRequiredEnv("SUPABASE_URL");
}

export function getSupabasePublishableKey(): string {
  return (
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY") ??
    getRequiredEnv("SUPABASE_ANON_KEY")
  );
}

export function getSupabaseServiceRoleKey(): string {
  return (
    Deno.env.get("SERVICE_ROLE_KEY") ??
    getRequiredEnv("SERVICE_ROLE_KEY")
  );
}

export function createAdminClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createAuthClient() {
  return createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
