---
name: 유닛테스트
description: Edge Function의 핵심 로직(주차 계산, 플랫폼 분류, 메달 부여, URL 필터)을 유닛 테스트하고 결과를 리포트한다. 코드 변경 후 배포 전에 검증할 때 사용한다.
---

Edge Function 핵심 로직을 유닛 테스트하고 결과를 리포트해줘.

## 테스트 대상

`supabase/functions/discord-verify/index.ts`와 `supabase/functions/web-verify/index.ts`의 공통 핵심 로직:

1. **getWeekLabel()** — 날짜별 주차 계산
2. **detectPlatform()** — URL → 플랫폼 분류
3. **메달 로직** — weekTotal 1/2/3/4+ 에 따른 이모지
4. **빈 URL 예외** — http로 시작하지 않는 링크 필터

## 작업 순서

1. `/tmp/edge_fn_test.ts` 임시 테스트 파일 생성 (아래 템플릿 기반)
2. `deno test /tmp/edge_fn_test.ts --allow-all` 실행
3. 결과 리포트 출력
4. 실패한 테스트가 있으면 원인 분석 후 수정 방안 제시
5. 전체 통과 시 "배포할까요?" 확인

## 테스트 파일 템플릿

```typescript
import { assertEquals } from "jsr:@std/assert";

// ── getWeekLabel 로직 복사 ─────────────────────────────────────────────────
function getWeekLabel(now: Date): string {
  const KST_OFFSET = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + KST_OFFSET);
  const start = new Date("2026-03-02T00:00:00Z");
  if (kstNow < start) return "준비기간";
  const days = Math.floor((kstNow.getTime() - start.getTime()) / 86400000);
  return `${Math.max(1, Math.ceil((days + 1) / 7))}주차`;
}

// ── detectPlatform 로직 복사 ───────────────────────────────────────────────
function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("linkedin.com")) return "LinkedIn";
  if (u.includes("instagram.com")) return "Instagram";
  if (u.includes("threads.net") || u.includes("threads.com")) return "Threads";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "YouTube";
  if (u.includes("tiktok.com")) return "TikTok";
  if (u.includes("brunch.co.kr")) return "Brunch";
  return "Blog";
}

// ── 메달 로직 복사 ────────────────────────────────────────────────────────
function getMedal(weekTotal: number): string {
  return weekTotal === 1 ? " 🥇" : weekTotal === 2 ? " 🥈" : weekTotal === 3 ? " 🥉" : "";
}

// ── 테스트 ────────────────────────────────────────────────────────────────

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

Deno.test("detectPlatform: LinkedIn", () => {
  assertEquals(detectPlatform("https://www.linkedin.com/posts/abc"), "LinkedIn");
});

Deno.test("detectPlatform: Instagram", () => {
  assertEquals(detectPlatform("https://www.instagram.com/p/abc"), "Instagram");
});

Deno.test("detectPlatform: Threads", () => {
  assertEquals(detectPlatform("https://www.threads.net/@user/post/abc"), "Threads");
});

Deno.test("detectPlatform: YouTube", () => {
  assertEquals(detectPlatform("https://youtu.be/abc123"), "YouTube");
});

Deno.test("detectPlatform: Brunch", () => {
  assertEquals(detectPlatform("https://brunch.co.kr/@someone/1"), "Brunch");
});

Deno.test("detectPlatform: 기타 = Blog", () => {
  assertEquals(detectPlatform("https://velog.io/@user/post"), "Blog");
});

Deno.test("getMedal: 1등 = 🥇", () => {
  assertEquals(getMedal(1), " 🥇");
});

Deno.test("getMedal: 2등 = 🥈", () => {
  assertEquals(getMedal(2), " 🥈");
});

Deno.test("getMedal: 3등 = 🥉", () => {
  assertEquals(getMedal(3), " 🥉");
});

Deno.test("getMedal: 4등 이상 = 없음", () => {
  assertEquals(getMedal(4), "");
  assertEquals(getMedal(10), "");
});

Deno.test("URL 필터: http로 시작하지 않으면 제외", () => {
  const rawLinks = ["https://valid.com", "not-a-url", "ftp://skip.me", "http://also-valid.com"];
  const filtered = rawLinks.map(l => l.trim()).filter(l => l.startsWith("http"));
  assertEquals(filtered, ["https://valid.com", "http://also-valid.com"]);
});
```

## 주의사항

- 테스트 파일은 `/tmp/edge_fn_test.ts`에 생성 (프로젝트 오염 방지)
- 테스트 완료 후 `/tmp/edge_fn_test.ts` 삭제
- 실패한 테스트는 원인을 분석하되, Edge Function 코드를 수정하기 전에 사용자 확인 필요
