import { assertEquals, assertRejects } from "jsr:@std/assert";
import { stub } from "jsr:@std/testing/mock";
import { fetchGuildMemberIds, sendDiscordEmbed } from "../../../supabase/functions/weekly-summary/services/discord.ts";

Deno.env.set("DISCORD_BOT_TOKEN", "test-token");
Deno.env.set("DISCORD_GUILD_ID", "test-guild");
Deno.env.set("DISCORD_WEEK_SUMMARY_CHANNEL_ID", "test-channel");

// ── fetchGuildMemberIds ────────────────────────────────────────────────────

Deno.test("fetchGuildMemberIds: nick 우선 사용", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(JSON.stringify([
      { user: { id: "111", global_name: "GlobalAlice", username: "alice" }, nick: "NickAlice" },
    ]), { status: 200 }))
  );
  try {
    const result = await fetchGuildMemberIds();
    assertEquals(result.get("NickAlice"), "111");
    assertEquals(result.has("GlobalAlice"), false);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("fetchGuildMemberIds: nick 없으면 global_name 사용", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(JSON.stringify([
      { user: { id: "222", global_name: "GlobalBob", username: "bob" }, nick: null },
    ]), { status: 200 }))
  );
  try {
    const result = await fetchGuildMemberIds();
    assertEquals(result.get("GlobalBob"), "222");
  } finally {
    fetchStub.restore();
  }
});

Deno.test("fetchGuildMemberIds: global_name도 없으면 username 사용", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(JSON.stringify([
      { user: { id: "333", global_name: null, username: "carol" }, nick: null },
    ]), { status: 200 }))
  );
  try {
    const result = await fetchGuildMemberIds();
    assertEquals(result.get("carol"), "333");
  } finally {
    fetchStub.restore();
  }
});

Deno.test("fetchGuildMemberIds: API 오류 → 빈 Map 반환", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response("Unauthorized", { status: 401 }))
  );
  try {
    const result = await fetchGuildMemberIds();
    assertEquals(result.size, 0);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("fetchGuildMemberIds: 여러 멤버 모두 파싱", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(JSON.stringify([
      { user: { id: "1", global_name: "Alice", username: "alice" }, nick: null },
      { user: { id: "2", global_name: "Bob", username: "bob" }, nick: null },
    ]), { status: 200 }))
  );
  try {
    const result = await fetchGuildMemberIds();
    assertEquals(result.size, 2);
    assertEquals(result.get("Alice"), "1");
    assertEquals(result.get("Bob"), "2");
  } finally {
    fetchStub.restore();
  }
});

// ── sendDiscordEmbed ───────────────────────────────────────────────────────

Deno.test("sendDiscordEmbed: 성공 시 throw 없음", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response("{}", { status: 200 }))
  );
  try {
    await sendDiscordEmbed({ title: "테스트", color: 0x5865f2, description: "내용" });
  } finally {
    fetchStub.restore();
  }
});

Deno.test("sendDiscordEmbed: API 오류 → throw", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response("Bad Request", { status: 400 }))
  );
  try {
    await assertRejects(
      () => sendDiscordEmbed({ title: "테스트" }),
      Error,
      "Discord 전송 실패"
    );
  } finally {
    fetchStub.restore();
  }
});
