const CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

export function generateShortCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CHARS[b % CHARS.length]).join("");
}
