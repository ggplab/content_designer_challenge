import { assertEquals, assertRejects } from "jsr:@std/assert";
import { stub } from "jsr:@std/testing/mock";

// createAdminClient mock 주입을 위해 동적 import 대신 fetch stub 사용
// createShortLink / resolveShortLink 는 내부적으로 supabase-js fetch를 사용하므로
// 실제 네트워크 없이 테스트하려면 fetch를 stub 처리

import { createShortLink, resolveShortLink } from "../../supabase/functions/_shared/short-links.ts";

Deno.env.set("SUPABASE_URL", "http://localhost:54321");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

// ── createShortLink ────────────────────────────────────────────────────────

Deno.test("createShortLink: insert 성공 시 code 반환", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response("[]", { status: 201 }))
  );
  try {
    const code = await createShortLink("https://example.com/post");
    assertEquals(typeof code, "string");
    assertEquals(code.length, 6);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("createShortLink: 23505 충돌 시 재시도 후 성공", async () => {
  let callCount = 0;
  const fetchStub = stub(globalThis, "fetch", () => {
    callCount++;
    if (callCount < 3) {
      // 첫 2번은 unique violation
      return Promise.resolve(
        new Response(JSON.stringify({ code: "23505", message: "duplicate key" }), { status: 409 })
      );
    }
    return Promise.resolve(new Response("[]", { status: 201 }));
  });
  try {
    const code = await createShortLink("https://example.com/post");
    assertEquals(typeof code, "string");
    assertEquals(callCount, 3);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("createShortLink: 23505 외 오류 → 즉시 throw", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(
      new Response(JSON.stringify({ code: "42501", message: "permission denied" }), { status: 403 })
    )
  );
  try {
    await assertRejects(
      () => createShortLink("https://example.com/post"),
      Error,
      "short_links insert 실패"
    );
  } finally {
    fetchStub.restore();
  }
});

Deno.test("createShortLink: 재시도 횟수 초과 → throw", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(
      new Response(JSON.stringify({ code: "23505", message: "duplicate key" }), { status: 409 })
    )
  );
  try {
    await assertRejects(
      () => createShortLink("https://example.com/post", 3),
      Error,
      "재시도 횟수 초과"
    );
  } finally {
    fetchStub.restore();
  }
});

// ── resolveShortLink ───────────────────────────────────────────────────────

Deno.test("resolveShortLink: 코드에 해당하는 URL 반환", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(
      new Response(JSON.stringify({ original_url: "https://example.com/post" }), { status: 200 })
    )
  );
  try {
    const url = await resolveShortLink("abc123");
    assertEquals(url, "https://example.com/post");
  } finally {
    fetchStub.restore();
  }
});

Deno.test("resolveShortLink: 코드 없으면 null 반환", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response("null", { status: 200 }))
  );
  try {
    const url = await resolveShortLink("notexist");
    assertEquals(url, null);
  } finally {
    fetchStub.restore();
  }
});
