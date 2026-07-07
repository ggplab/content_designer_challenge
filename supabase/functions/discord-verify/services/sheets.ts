import { sheetsGet, sheetsAppend } from "../../_shared/sheets.ts";
import { parseWeekNumber } from "../../_shared/week.ts";

function getSheetTab(): string {
  return Deno.env.get("GOOGLE_SHEET_TAB") ?? "시트1";
}

export async function appendToSheets(accessToken: string, row: string[]): Promise<void> {
  await sheetsAppend(accessToken, `${getSheetTab()}!A:G`, row);
}

export async function getWeekCounts(
  accessToken: string,
  displayName: string,
  weekLabel: string
): Promise<{ userCount: number; totalCount: number; userWeeks: number[] }> {
  let rows: string[][];
  try {
    rows = await sheetsGet(accessToken, `${getSheetTab()}!B:E`);
  } catch {
    console.error("Sheets 조회 실패");
    return { userCount: 0, totalCount: 0, userWeeks: [] };
  }

  let userCount = 0;
  let totalCount = 0;
  const weekSet = new Set<number>(); // 해당 유저가 인증한 주차 집합 (스트릭 계산용)
  for (const row of rows) {
    if ((row[3] ?? "").startsWith(weekLabel)) {
      totalCount++;
      if (row[0] === displayName) userCount++;
    }
    if (row[0] === displayName) {
      const week = parseWeekNumber(row[3] ?? "");
      if (week !== null) weekSet.add(week);
    }
  }
  return { userCount, totalCount, userWeeks: [...weekSet].sort((a, b) => a - b) };
}
