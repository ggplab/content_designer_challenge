import { assertEquals } from "jsr:@std/assert";
import { stub } from "jsr:@std/testing/mock";
import { sendFollowup } from "../../../supabase/functions/discord-verify/services/discord.ts";

Deno.env.set("DISCORD_APPLICATION_ID", "test-app-id");

// ── sendFollowup ───────────────────────────────────────────────────────────

Deno.test("sendFollowup: 성공 시 throw 없음", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response("{}", { status: 200 }))
  );
  try {
    await sendFollowup("test-token", "✅ 인증 완료!");
  } finally {
    fetchStub.restore();
  }
});

Deno.test("sendFollowup: API 오류 → throw 없이 로그만 (fire-and-forget)", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response("error", { status: 500 }))
  );
  try {
    // 오류가 발생해도 throw하지 않음
    await sendFollowup("test-token", "메시지");
  } finally {
    fetchStub.restore();
  }
});

Deno.test("sendFollowup: PATCH 메서드로 올바른 endpoint 호출", async () => {
  let calledMethod = "";
  let calledUrl = "";
  const fetchStub = stub(globalThis, "fetch", (url, init) => {
    calledUrl = url.toString();
    calledMethod = (init as RequestInit)?.method ?? "";
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
  try {
    await sendFollowup("my-token", "메시지");
    assertEquals(calledMethod, "PATCH");
    assertEquals(calledUrl.includes("test-app-id"), true);
    assertEquals(calledUrl.includes("my-token"), true);
  } finally {
    fetchStub.restore();
  }
});
