const KST_OFFSET = 9 * 60 * 60 * 1000;
const PUBLISH_START = new Date("2026-03-02T00:00:00Z");

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
