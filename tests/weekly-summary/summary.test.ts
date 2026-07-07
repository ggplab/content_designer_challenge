import { assertEquals } from "jsr:@std/assert";
import { stub } from "jsr:@std/testing/mock";
import {
  buildUserWeeks,
  computeAchievements,
  filterCandidates,
  fetchRoster,
} from "../../supabase/functions/weekly-summary/summary.ts";

type Row = string[];

const identity = (n: string) => n;

// ── buildUserWeeks ─────────────────────────────────────────────────────────

Deno.test("buildUserWeeks: 유저별 인증 주차 집합 생성", () => {
  const rows: Row[] = [
    ["2026-07-13", "임정", "YouTube", "https://a", "1주차-1회", "요약", "public"],
    ["2026-07-20", "임정", "YouTube", "https://b", "2주차-1회", "요약", "public"],
    ["2026-07-20", "슬기", "YouTube", "https://c", "2주차-1회", "요약", "public"],
  ];
  const result = buildUserWeeks(rows, identity);
  assertEquals(result.get("임정"), new Set([1, 2]));
  assertEquals(result.get("슬기"), new Set([2]));
});

Deno.test("buildUserWeeks: 같은 주 복수 제출도 주차는 1개로 집계", () => {
  const rows: Row[] = [
    ["", "임정", "YouTube", "https://a", "1주차-1회", "요약", "public"],
    ["", "임정", "YouTube", "https://b", "1주차-2회", "요약", "public"],
  ];
  const result = buildUserWeeks(rows, identity);
  assertEquals(result.get("임정"), new Set([1]));
});

Deno.test("buildUserWeeks: 준비기간 행은 제외", () => {
  const rows: Row[] = [
    ["", "임정", "YouTube", "https://a", "준비기간-1회", "요약", "public"],
  ];
  const result = buildUserWeeks(rows, identity);
  assertEquals(result.size, 0);
});

Deno.test("buildUserWeeks: 닉네임을 표기명으로 정규화", () => {
  const nicknameMap: Record<string, string> = { "jj_dev": "임정" };
  const toRealName = (n: string) => nicknameMap[n] ?? n;
  const rows: Row[] = [
    ["", "jj_dev", "YouTube", "https://a", "1주차-1회", "요약", "public"],
  ];
  const result = buildUserWeeks(rows, toRealName);
  assertEquals(result.get("임정"), new Set([1]));
  assertEquals(result.has("jj_dev"), false);
});

// ── computeAchievements ────────────────────────────────────────────────────

Deno.test("computeAchievements: 달성 멤버 → achieved=true + 스트릭", () => {
  const userWeeks = new Map([["임정", new Set([1, 2, 3])]]);
  const result = computeAchievements(["임정"], userWeeks, 3);
  assertEquals(result, [{ name: "임정", achieved: true, streak: 3 }]);
});

Deno.test("computeAchievements: 미달성 멤버 → achieved=false, streak=0", () => {
  const userWeeks = new Map([["임정", new Set([1, 2])]]);
  const result = computeAchievements(["임정"], userWeeks, 3);
  assertEquals(result, [{ name: "임정", achieved: false, streak: 0 }]);
});

Deno.test("computeAchievements: 인증 기록이 전혀 없는 멤버도 명단에 포함", () => {
  const userWeeks = new Map([["임정", new Set([1])]]);
  const result = computeAchievements(["임정", "슬기"], userWeeks, 1);
  assertEquals(result, [
    { name: "임정", achieved: true, streak: 1 },
    { name: "슬기", achieved: false, streak: 0 },
  ]);
});

Deno.test("computeAchievements: 스트릭은 중간에 끊기면 리셋", () => {
  const userWeeks = new Map([["슬기", new Set([1, 3, 4])]]);
  const result = computeAchievements(["슬기"], userWeeks, 4);
  assertEquals(result, [{ name: "슬기", achieved: true, streak: 2 }]);
});

// ── filterCandidates ───────────────────────────────────────────────────────

Deno.test("filterCandidates: 요약 있는 항목은 후보 포함", () => {
  const rows: Row[] = [
    ["", "임정", "YouTube", "https://a", "1주차-1회", "마케팅 인사이트 공유", "public"],
  ];
  assertEquals(filterCandidates(rows).length, 1);
});

Deno.test("filterCandidates: Gemini fallback 패턴은 제외", () => {
  const rows: Row[] = [
    ["", "임정", "YouTube", "https://a", "1주차-1회", "YouTube 콘텐츠", "public"],
  ];
  assertEquals(filterCandidates(rows).length, 0);
});

Deno.test("filterCandidates: 요약 5자 이하는 제외", () => {
  const rows: Row[] = [
    ["", "임정", "YouTube", "https://a", "1주차-1회", "짧음", "public"],
  ];
  assertEquals(filterCandidates(rows).length, 0);
});

Deno.test("filterCandidates: 혼합 케이스 — 유효한 것만 통과", () => {
  const rows: Row[] = [
    ["", "임정", "YouTube", "https://a", "1주차-1회", "촬영 장비 세팅 노하우", "public"],
    ["", "슬기", "YouTube", "https://b", "1주차-1회", "YouTube 콘텐츠", "public"],
    ["", "슬기", "YouTube", "https://c", "1주차-1회", "짧음", "public"],
  ];
  const result = filterCandidates(rows);
  assertEquals(result.length, 1);
  assertEquals(result[0][1], "임정");
});

// ── fetchRoster ────────────────────────────────────────────────────────────

Deno.test("fetchRoster: members.json 정상 응답 → 명단·닉네임맵 반환", async () => {
  const body = JSON.stringify({
    participants: [{ name: "임정", freq: "주1회" }, { name: "슬기", freq: "주1회" }],
    nickname_map: { "jj_dev": "임정" },
  });
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response(body, { status: 200 }))
  );
  try {
    const roster = await fetchRoster();
    assertEquals(roster.names, ["임정", "슬기"]);
    assertEquals(roster.nicknameMap, { "jj_dev": "임정" });
  } finally {
    fetchStub.restore();
  }
});

Deno.test("fetchRoster: HTTP 오류 → 빈 명단 fallback", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(new Response("Not Found", { status: 404 }))
  );
  try {
    const roster = await fetchRoster();
    assertEquals(roster, { names: [], nicknameMap: {} });
  } finally {
    fetchStub.restore();
  }
});
