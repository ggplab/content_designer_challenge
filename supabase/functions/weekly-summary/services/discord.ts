export async function fetchGuildMemberIds(): Promise<Map<string, string>> {
  const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;
  const DISCORD_GUILD_ID = Deno.env.get("DISCORD_GUILD_ID")!;

  const resp = await fetch(
    `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members?limit=1000`,
    { headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` } }
  );
  if (!resp.ok) {
    console.error("[summary] 길드 멤버 조회 실패:", resp.status, await resp.text());
    return new Map();
  }
  const members = await resp.json();
  const map = new Map<string, string>();
  for (const m of members) {
    const id = m.user?.id;
    const nick = m.nick ?? m.user?.global_name ?? m.user?.username;
    if (id && nick) map.set(nick, id);
  }
  return map;
}

export async function sendDiscordEmbed(embed: Record<string, unknown>): Promise<void> {
  const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;
  const DISCORD_CHANNEL_ID = Deno.env.get("DISCORD_WEEK_SUMMARY_CHANNEL_ID")!;

  const resp = await fetch(
    `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ embeds: [embed] }),
    }
  );
  if (!resp.ok) throw new Error(`Discord 전송 실패 (${resp.status}): ${await resp.text()}`);
}
