const GOOGLE_SHEET_ID = Deno.env.get("GOOGLE_SHEET_ID")!;

/**
 * Google Sheets 범위 읽기
 * @param range - 예: "시트1!A:G"
 */
export async function sheetsGet(accessToken: string, range: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) throw new Error(`Sheets 조회 실패 (${resp.status}): ${await resp.text()}`);
  const data = await resp.json();
  return data.values ?? [];
}

/**
 * Google Sheets 행 추가
 * @param range - 예: "시트1!A:G"
 */
export async function sheetsAppend(accessToken: string, range: string, row: string[]): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [row] }),
  });
  if (!resp.ok) throw new Error(`Sheets 저장 실패 (${resp.status}): ${await resp.text()}`);
}
