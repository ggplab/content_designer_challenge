export async function sendFollowup(token: string, content: string): Promise<void> {
  const DISCORD_APPLICATION_ID = Deno.env.get("DISCORD_APPLICATION_ID")!;
  const resp = await fetch(
    `https://discord.com/api/v10/webhooks/${DISCORD_APPLICATION_ID}/${token}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }
  );
  if (!resp.ok) {
    console.error("Discord follow-up 실패:", resp.status, await resp.text());
  }
}
