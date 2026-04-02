import { assertEquals, assertRejects } from "jsr:@std/assert";
import { stub } from "jsr:@std/testing/mock";
import { sheetsGet, sheetsAppend } from "../../supabase/functions/_shared/sheets.ts";

Deno.env.set("GOOGLE_SHEET_ID", "test-sheet-id");

// ── sheetsGet ──────────────────────────────────────────────────────────────

Deno.test("sheetsGet: 정상 응답 → rows 반환", async () => {
  const mockRows = [["2026-03-09", "Alice", "LinkedIn"]];
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(JSON.stringify({ values: mockRows }), { status: 200 }))
  );
  try {
    const result = await sheetsGet("token", "시트1!A:G");
    assertEquals(result, mockRows);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("sheetsGet: values 없으면 빈 배열 반환", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
  );
  try {
    const result = await sheetsGet("token", "시트1!A:G");
    assertEquals(result, []);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("sheetsGet: range가 URL 인코딩되어 호출됨", async () => {
  let calledUrl = "";
  const fetchStub = stub(globalThis, "fetch", (url) => {
    calledUrl = url.toString();
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
  });
  try {
    await sheetsGet("token", "시트1!A:G");
    assertEquals(calledUrl.includes(encodeURIComponent("시트1!A:G")), true);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("sheetsGet: API 오류 → throw", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response("Forbidden", { status: 403 }))
  );
  try {
    await assertRejects(() => sheetsGet("token", "시트1!A:G"), Error, "Sheets 조회 실패");
  } finally {
    fetchStub.restore();
  }
});

// ── sheetsAppend ───────────────────────────────────────────────────────────

Deno.test("sheetsAppend: 성공 시 throw 없음", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response("{}", { status: 200 }))
  );
  try {
    await sheetsAppend("token", "시트1!A:G", ["a", "b", "c"]);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("sheetsAppend: POST + :append URL로 호출됨", async () => {
  let calledUrl = "";
  let calledMethod = "";
  const fetchStub = stub(globalThis, "fetch", (url, init) => {
    calledUrl = url.toString();
    calledMethod = (init as RequestInit)?.method ?? "";
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
  try {
    await sheetsAppend("token", "시트1!A:G", ["row"]);
    assertEquals(calledMethod, "POST");
    assertEquals(calledUrl.includes(":append"), true);
    assertEquals(calledUrl.includes(encodeURIComponent("시트1!A:G")), true);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("sheetsAppend: API 오류 → throw", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response("Forbidden", { status: 403 }))
  );
  try {
    await assertRejects(() => sheetsAppend("token", "시트1!A:G", ["row"]), Error, "Sheets 저장 실패");
  } finally {
    fetchStub.restore();
  }
});
