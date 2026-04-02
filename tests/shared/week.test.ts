import { assertEquals } from "jsr:@std/assert";
import { getPrevWeekLabel, getWeekLabel, getTodayKST } from "../../supabase/functions/_shared/week.ts";

// ── getWeekLabel ───────────────────────────────────────────────────────────

Deno.test("getWeekLabel: 발행 시작일 = 1주차", () => {
  assertEquals(getWeekLabel(new Date("2026-03-02T00:00:00+09:00")), "1주차");
});

Deno.test("getWeekLabel: 1주차 마지막날", () => {
  assertEquals(getWeekLabel(new Date("2026-03-08T23:59:59+09:00")), "1주차");
});

Deno.test("getWeekLabel: 2주차 시작일", () => {
  assertEquals(getWeekLabel(new Date("2026-03-09T00:00:00+09:00")), "2주차");
});

Deno.test("getWeekLabel: 준비기간", () => {
  assertEquals(getWeekLabel(new Date("2026-03-01T23:59:59+09:00")), "준비기간");
});

// ── getPrevWeekLabel ───────────────────────────────────────────────────────

Deno.test("getPrevWeekLabel: 1주차 중에는 준비기간", () => {
  assertEquals(getPrevWeekLabel(new Date("2026-03-05T00:00:00+09:00")), "준비기간");
});

Deno.test("getPrevWeekLabel: 2주차 시작일 → 1주차", () => {
  assertEquals(getPrevWeekLabel(new Date("2026-03-09T00:00:00+09:00")), "1주차");
});

Deno.test("getPrevWeekLabel: 3주차 → 2주차", () => {
  assertEquals(getPrevWeekLabel(new Date("2026-03-16T00:00:00+09:00")), "2주차");
});

Deno.test("getPrevWeekLabel: 준비기간 중에는 준비기간", () => {
  assertEquals(getPrevWeekLabel(new Date("2026-03-01T00:00:00+09:00")), "준비기간");
});

// ── getTodayKST ────────────────────────────────────────────────────────────

Deno.test("getTodayKST: YYYY-MM-DD 형식 반환", () => {
  const result = getTodayKST();
  assertEquals(/^\d{4}-\d{2}-\d{2}$/.test(result), true);
});
