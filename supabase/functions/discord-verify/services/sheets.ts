import { sheetsGet, sheetsAppend } from "../../_shared/sheets.ts";

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
): Promise<{ userCount: number; totalCount: number }> {
  let rows: string[][];
  try {
    rows = await sheetsGet(accessToken, `${getSheetTab()}!B:E`);
  } catch {
    console.error("Sheets 조회 실패");
    return { userCount: 0, totalCount: 0 };
  }

  let userCount = 0;
  let totalCount = 0;
  for (const row of rows) {
    if ((row[3] ?? "").startsWith(weekLabel)) {
      totalCount++;
      if (row[0] === displayName) userCount++;
    }
  }
  return { userCount, totalCount };
}
