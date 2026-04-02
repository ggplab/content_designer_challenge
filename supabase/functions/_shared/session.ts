import { createAuthClient } from "./supabase.ts";

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
