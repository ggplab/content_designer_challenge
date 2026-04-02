export async function appendToSheets(accessToken: string, row: string[]): Promise<void> {
  const GOOGLE_SHEET_ID = Deno.env.get("GOOGLE_SHEET_ID")!;
  const SHEET_TAB = encodeURIComponent(Deno.env.get("GOOGLE_SHEET_TAB") ?? "시트1");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${SHEET_TAB}!A:G:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [row] }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Sheets 저장 실패 (${resp.status}): ${err}`);
  }
}

export async function getWeekCounts(
  accessToken: string,
  displayName: string,
  weekLabel: string
): Promise<{ userCount: number; totalCount: number }> {
  const GOOGLE_SHEET_ID = Deno.env.get("GOOGLE_SHEET_ID")!;
  const SHEET_TAB = encodeURIComponent(Deno.env.get("GOOGLE_SHEET_TAB") ?? "시트1");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${SHEET_TAB}!B:E`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    console.error("Sheets 조회 실패:", resp.status);
    return { userCount: 0, totalCount: 0 };
  }
  const data = await resp.json();
  const rows: string[][] = data.values ?? [];
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
