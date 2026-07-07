const KST_OFFSET = 9 * 60 * 60 * 1000;

// ── 시즌 설정 (백엔드 SSOT) ──────────────────────────────────────────────────
// 시즌2 · 유튜브 에디션 발행 시작일 (월요일, KST). 시작일이 바뀌면 이 상수만 수정한다.
// 단, 정적 대시보드 web/index.html의 CHALLENGE_START는 별도 번들이므로 함께 갱신할 것.
// (문서: config/challenge_config.json · docs/youtube-challenge-plan.md)
export const PUBLISH_START_DATE = "2026-07-13";

const PUBLISH_START = new Date(`${PUBLISH_START_DATE}T00:00:00Z`);

function weekNumber(now: Date): number {
  const kstNow = new Date(now.getTime() + KST_OFFSET);
  if (kstNow < PUBLISH_START) return 0;
  const days = Math.floor((kstNow.getTime() - PUBLISH_START.getTime()) / 86400000);
  return Math.max(1, Math.ceil((days + 1) / 7));
}

/** 현재 주차 레이블 (인증 시 사용) */
export function getWeekLabel(now: Date = new Date()): string {
  const week = weekNumber(now);
  return week === 0 ? "준비기간" : `${week}주차`;
}

/** 직전 주차 레이블 (주간 정산 시 사용) */
export function getPrevWeekLabel(now: Date = new Date()): string {
  const week = weekNumber(now);
  if (week <= 1) return "준비기간";
  return `${week - 1}주차`;
}

export function getTodayKST(): string {
  return new Date(Date.now() + KST_OFFSET).toISOString().slice(0, 10);
}

// ── 스트릭 (시즌2: 메달 🥇🥈🥉 대체) ────────────────────────────────────────

/** 주차 레이블에서 주차 번호 추출 — "3주차" | "3주차-1회" → 3, "준비기간" 등은 null */
export function parseWeekNumber(label: string): number | null {
  const m = label.match(/^(\d+)주차/);
  return m ? Number(m[1]) : null;
}

/**
 * fromWeek(기준 주)을 포함해 뒤로 연속 인증한 주 수.
 * fromWeek 자체가 미인증이면 0.
 */
export function calcStreak(verifiedWeeks: Iterable<number>, fromWeek: number): number {
  const weeks = new Set(verifiedWeeks);
  let streak = 0;
  let w = fromWeek;
  while (w >= 1 && weeks.has(w)) {
    streak++;
    w--;
  }
  return streak;
}

/** 스트릭 표시 문자열 — 0이면 빈 문자열 */
export function formatStreakBadge(streak: number): string {
  return streak > 0 ? `🔥 ${streak}주 연속` : "";
}
