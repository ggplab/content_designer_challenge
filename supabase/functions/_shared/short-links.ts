import { createAdminClient } from "./supabase.ts";
import { generateShortCode } from "./url.ts";

// 코드 생성 + insert. 충돌(23505) 시 최대 maxRetries번 재시도.
export async function createShortLink(originalUrl: string, maxRetries = 5): Promise<string> {
  const client = createAdminClient();
  for (let i = 0; i < maxRetries; i++) {
    const code = generateShortCode();
    const { error } = await client.from("short_links").insert({ code, original_url: originalUrl });
    if (!error) return code;
    if (error.code !== "23505") throw new Error(`short_links insert 실패: ${error.message}`);
  }
  throw new Error("short_links: 코드 생성 재시도 횟수 초과");
}

export async function resolveShortLink(code: string): Promise<string | null> {
  const client = createAdminClient();
  const { data, error } = await client
    .from("short_links")
    .select("original_url")
    .eq("code", code)
    .maybeSingle();
  if (error || !data) return null;
  return data.original_url;
}
