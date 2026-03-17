import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://ggplab.github.io",
  "http://localhost:4173",
];

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

export function getAllowedOrigins(): Set<string> {
  return new Set(
    (Deno.env.get("WEB_VERIFY_ALLOWED_ORIGINS") ?? DEFAULT_ALLOWED_ORIGINS.join(","))
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true;
  return getAllowedOrigins().has(origin);
}

export function buildCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
    "Vary": "Origin",
  };
  if (origin && isOriginAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export function jsonResponse(
  origin: string | null,
  body: Record<string, unknown>,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(origin),
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
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

export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization") ?? req.headers.get("x-api-key");
  if (!header) return null;
  return header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();
}

export async function getSessionUser(req: Request) {
  const token = getBearerToken(req);
  if (!token) return null;

  const authClient = createAuthClient();
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }
  return data.user;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function createApiKeyPlaintext(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `ggplab_${token}`;
}
