import { assertEquals, assertRejects } from "jsr:@std/assert";
import { stub } from "jsr:@std/testing/mock";
import { appendToSheets, getWeekCounts } from "../../../supabase/functions/discord-verify/services/sheets.ts";

Deno.env.set("GOOGLE_SHEET_ID", "test-sheet-id");

// ── appendToSheets ─────────────────────────────────────────────────────────

Deno.test("appendToSheets: 성공 시 throw 없음", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response("{}", { status: 200 }))
  );
  try {
    await appendToSheets("test-token", ["2026-03-09", "Alice", "LinkedIn", "https://a", "1주차-1회", "요약", "public"]);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("appendToSheets: API 오류 → throw", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response("Forbidden", { status: 403 }))
  );
  try {
    await assertRejects(
      () => appendToSheets("test-token", ["row"]),
      Error,
      "Sheets 저장 실패"
    );
  } finally {
    fetchStub.restore();
  }
});

Deno.test("appendToSheets: GOOGLE_SHEET_TAB env 적용", async () => {
  Deno.env.set("GOOGLE_SHEET_TAB", "커스텀시트");
  let calledUrl = "";
  const fetchStub = stub(globalThis, "fetch", (url) => {
    calledUrl = url.toString();
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
  try {
    await appendToSheets("token", ["row"]);
    assertEquals(calledUrl.includes(encodeURIComponent("커스텀시트")), true);
  } finally {
    fetchStub.restore();
    Deno.env.delete("GOOGLE_SHEET_TAB");
  }
});

// ── getWeekCounts ──────────────────────────────────────────────────────────

Deno.test("getWeekCounts: 주차별 유저/전체 카운트 집계", async () => {
  const mockRows = [
    ["Alice", "LinkedIn", "https://a", "1주차-1회"],
    ["Bob", "YouTube", "https://b", "1주차-1회"],
    ["Alice", "Blog", "https://c", "1주차-2회"],
    ["Carol", "Instagram", "https://d", "2주차-1회"], // 다른 주차, 제외
  ];
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(JSON.stringify({ values: mockRows }), { status: 200 }))
  );
  try {
    const result = await getWeekCounts("token", "Alice", "1주차");
    assertEquals(result.userCount, 2);
    assertEquals(result.totalCount, 3);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("getWeekCounts: API 오류 → 0으로 fallback", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response("error", { status: 500 }))
  );
  try {
    const result = await getWeekCounts("token", "Alice", "1주차");
    assertEquals(result, { userCount: 0, totalCount: 0 });
  } finally {
    fetchStub.restore();
  }
});
