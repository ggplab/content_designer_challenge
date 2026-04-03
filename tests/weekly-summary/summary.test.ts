import { assertEquals } from "jsr:@std/assert";

// ── 유저별 집계 로직 ───────────────────────────────────────────────────────
// runSummary 내부의 집계 로직을 검증

type Row = string[];

function aggregateUsers(weekRows: Row[]): Map<string, { count: number; platforms: string[] }> {
  const userMap = new Map<string, { count: number; platforms: string[] }>();
  for (const row of weekRows) {
    const user = row[1] ?? "Unknown";
    const platform = row[2] ?? "기타";
    const existing = userMap.get(user);
    if (existing) {
      existing.count++;
      existing.platforms.push(platform);
    } else {
      userMap.set(user, { count: 1, platforms: [platform] });
    }
  }
  return userMap;
}

function filterCandidates(weekRows: Row[]) {
  return weekRows.filter((row) => {
    const summary = row[5] ?? "";
    return summary.length > 5 && !/^.+\s콘텐츠$/.test(summary);
  });
}

// ── aggregateUsers ─────────────────────────────────────────────────────────

Deno.test("aggregateUsers: 단일 제출", () => {
  const rows: Row[] = [
    ["2026-03-09", "Alice", "LinkedIn", "https://...", "1주차-1회", "마케팅 전략", "public"],
  ];
  const result = aggregateUsers(rows);
  assertEquals(result.get("Alice"), { count: 1, platforms: ["LinkedIn"] });
});

Deno.test("aggregateUsers: 같은 유저 복수 제출 누적", () => {
  const rows: Row[] = [
    ["2026-03-09", "Alice", "LinkedIn", "https://a", "1주차-1회", "요약1", "public"],
    ["2026-03-10", "Alice", "Instagram", "https://b", "1주차-2회", "요약2", "public"],
  ];
  const result = aggregateUsers(rows);
  assertEquals(result.get("Alice"), { count: 2, platforms: ["LinkedIn", "Instagram"] });
});

Deno.test("aggregateUsers: 여러 유저 독립 집계", () => {
  const rows: Row[] = [
    ["2026-03-09", "Alice", "LinkedIn", "https://a", "1주차-1회", "요약", "public"],
    ["2026-03-09", "Bob", "YouTube", "https://b", "1주차-1회", "요약", "public"],
  ];
  const result = aggregateUsers(rows);
  assertEquals(result.get("Alice")?.count, 1);
  assertEquals(result.get("Bob")?.count, 1);
  assertEquals(result.size, 2);
});

Deno.test("aggregateUsers: user 컬럼 없으면 Unknown으로 처리", () => {
  const rows: Row[] = [["2026-03-09"]]; // row[1]이 undefined → "Unknown"
  const result = aggregateUsers(rows);
  assertEquals(result.has("Unknown"), true);
});

// ── filterCandidates ───────────────────────────────────────────────────────

Deno.test("filterCandidates: 요약 있는 항목은 후보 포함", () => {
  const rows: Row[] = [
    ["", "Alice", "LinkedIn", "https://a", "", "마케팅 인사이트 공유", "public"],
  ];
  assertEquals(filterCandidates(rows).length, 1);
});

Deno.test("filterCandidates: Gemini fallback 패턴은 제외", () => {
  const rows: Row[] = [
    ["", "Alice", "LinkedIn", "https://a", "", "LinkedIn 콘텐츠", "public"],
    ["", "Bob", "YouTube", "https://b", "", "YouTube 콘텐츠", "public"],
  ];
  assertEquals(filterCandidates(rows).length, 0);
});

Deno.test("filterCandidates: 요약 5자 이하는 제외", () => {
  const rows: Row[] = [
    ["", "Alice", "Blog", "https://a", "", "짧음", "public"],
  ];
  assertEquals(filterCandidates(rows).length, 0);
});

Deno.test("filterCandidates: 혼합 케이스 — 유효한 것만 통과", () => {
  const rows: Row[] = [
    ["", "Alice", "LinkedIn", "https://a", "", "마케팅 전략 정리", "public"],
    ["", "Bob", "YouTube", "https://b", "", "YouTube 콘텐츠", "public"],
    ["", "Carol", "Blog", "https://c", "", "짧음", "public"],
  ];
  const result = filterCandidates(rows);
  assertEquals(result.length, 1);
  assertEquals(result[0][1], "Alice");
});
