export async function fetchSheetRows(accessToken: string): Promise<string[][]> {
  const GOOGLE_SHEET_ID = Deno.env.get("GOOGLE_SHEET_ID")!;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/%EC%8B%9C%ED%8A%B81!A:G`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) throw new Error(`Sheets 조회 실패 (${resp.status}): ${await resp.text()}`);
  const data = await resp.json();
  return data.values ?? [];
}
