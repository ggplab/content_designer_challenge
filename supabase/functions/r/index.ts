import { resolveShortLink } from "../_shared/short-links.ts";

Deno.serve(async (req: Request) => {
  const code = new URL(req.url).pathname.split("/").pop();
  if (!code) return new Response("Not found", { status: 404 });

  let originalUrl: string | null;
  try {
    originalUrl = await resolveShortLink(code);
  } catch {
    return new Response("Server error", { status: 500 });
  }

  if (!originalUrl) return new Response("Not found", { status: 404 });

  return new Response(null, {
    status: 301,
    headers: { Location: originalUrl },
  });
});
