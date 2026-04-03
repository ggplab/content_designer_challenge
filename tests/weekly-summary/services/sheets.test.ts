import { assertEquals, assertRejects } from "jsr:@std/assert";
import { stub } from "jsr:@std/testing/mock";
import { fetchSheetRows } from "../../../supabase/functions/weekly-summary/services/sheets.ts";

Deno.env.set("GOOGLE_SHEET_ID", "test-sheet-id");

// ── fetchSheetRows ─────────────────────────────────────────────────────────

Deno.test("fetchSheetRows: 정상 응답 → rows 반환", async () => {
  const mockRows = [
    ["2026-03-09", "Alice", "LinkedIn", "https://a", "1주차-1회", "요약", "public"],
    ["2026-03-09", "Bob", "YouTube", "https://b", "1주차-1회", "요약", "public"],
  ];
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(JSON.stringify({ values: mockRows }), { status: 200 }))
  );
  try {
    const result = await fetchSheetRows("test-token");
    assertEquals(result, mockRows);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("fetchSheetRows: values 없으면 빈 배열 반환", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
  );
  try {
    const result = await fetchSheetRows("test-token");
    assertEquals(result, []);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("fetchSheetRows: API 오류 → throw", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response("Forbidden", { status: 403 }))
  );
  try {
    await assertRejects(
      () => fetchSheetRows("test-token"),
      Error,
      "Sheets 조회 실패"
    );
  } finally {
    fetchStub.restore();
  }
});
