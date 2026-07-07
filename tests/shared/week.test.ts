import { assertEquals } from "jsr:@std/assert";
import {
  getPrevWeekLabel,
  getWeekLabel,
  getTodayKST,
  parseWeekNumber,
  calcStreak,
  formatStreakBadge,
  PUBLISH_START_DATE,
} from "../../supabase/functions/_shared/week.ts";

// ── 시즌2 시작일 상수 ───────────────────────────────────────────────────────

Deno.test("PUBLISH_START_DATE: 시즌2 발행 시작일 2026-07-13", () => {
  assertEquals(PUBLISH_START_DATE, "2026-07-13");
});

// ── getWeekLabel ───────────────────────────────────────────────────────────

Deno.test("getWeekLabel: 발행 시작일 = 1주차", () => {
  assertEquals(getWeekLabel(new Date("2026-07-13T00:00:00+09:00")), "1주차");
});

Deno.test("getWeekLabel: 1주차 마지막날", () => {
  assertEquals(getWeekLabel(new Date("2026-07-19T23:59:59+09:00")), "1주차");
});

Deno.test("getWeekLabel: 2주차 시작일", () => {
  assertEquals(getWeekLabel(new Date("2026-07-20T00:00:00+09:00")), "2주차");
});

Deno.test("getWeekLabel: 준비기간 (발행 시작 전)", () => {
  assertEquals(getWeekLabel(new Date("2026-07-12T23:59:59+09:00")), "준비기간");
});

Deno.test("getWeekLabel: 12주차 마지막날 (2026-10-04)", () => {
  assertEquals(getWeekLabel(new Date("2026-10-04T23:59:59+09:00")), "12주차");
});

// ── getPrevWeekLabel ───────────────────────────────────────────────────────

Deno.test("getPrevWeekLabel: 1주차 중에는 준비기간", () => {
  assertEquals(getPrevWeekLabel(new Date("2026-07-16T00:00:00+09:00")), "준비기간");
});

Deno.test("getPrevWeekLabel: 2주차 시작일 → 1주차", () => {
  assertEquals(getPrevWeekLabel(new Date("2026-07-20T00:00:00+09:00")), "1주차");
});

Deno.test("getPrevWeekLabel: 3주차 → 2주차", () => {
  assertEquals(getPrevWeekLabel(new Date("2026-07-27T00:00:00+09:00")), "2주차");
});

Deno.test("getPrevWeekLabel: 준비기간 중에는 준비기간", () => {
  assertEquals(getPrevWeekLabel(new Date("2026-07-12T00:00:00+09:00")), "준비기간");
});

// ── getTodayKST ────────────────────────────────────────────────────────────

Deno.test("getTodayKST: YYYY-MM-DD 형식 반환", () => {
  const result = getTodayKST();
  assertEquals(/^\d{4}-\d{2}-\d{2}$/.test(result), true);
});

// ── parseWeekNumber ────────────────────────────────────────────────────────

Deno.test("parseWeekNumber: '3주차' → 3", () => {
  assertEquals(parseWeekNumber("3주차"), 3);
});

Deno.test("parseWeekNumber: '3주차-2회' → 3", () => {
  assertEquals(parseWeekNumber("3주차-2회"), 3);
});

Deno.test("parseWeekNumber: '12주차-1회' → 12", () => {
  assertEquals(parseWeekNumber("12주차-1회"), 12);
});

Deno.test("parseWeekNumber: '준비기간' → null", () => {
  assertEquals(parseWeekNumber("준비기간"), null);
});

Deno.test("parseWeekNumber: 빈 문자열 → null", () => {
  assertEquals(parseWeekNumber(""), null);
});

// ── calcStreak (시즌2: 메달 대체) ───────────────────────────────────────────

Deno.test("calcStreak: 이번 주만 인증 → 1", () => {
  assertEquals(calcStreak([3], 3), 1);
});

Deno.test("calcStreak: 3주 연속 인증 → 3", () => {
  assertEquals(calcStreak([1, 2, 3], 3), 3);
});

Deno.test("calcStreak: 중간에 끊기면 끊긴 이후부터 카운트", () => {
  assertEquals(calcStreak([1, 3, 4], 4), 2);
});

Deno.test("calcStreak: 기준 주 미인증 → 0", () => {
  assertEquals(calcStreak([1, 2], 3), 0);
});

Deno.test("calcStreak: 인증 기록 없음 → 0", () => {
  assertEquals(calcStreak([], 1), 0);
});

Deno.test("calcStreak: 미래 주차 기록은 무시", () => {
  assertEquals(calcStreak([2, 3, 5], 3), 2);
});

// ── formatStreakBadge ──────────────────────────────────────────────────────

Deno.test("formatStreakBadge: 1 이상 → 🔥 N주 연속", () => {
  assertEquals(formatStreakBadge(3), "🔥 3주 연속");
});

Deno.test("formatStreakBadge: 0 → 빈 문자열", () => {
  assertEquals(formatStreakBadge(0), "");
});
