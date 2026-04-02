import { sheetsGet } from "../../_shared/sheets.ts";

export async function fetchSheetRows(accessToken: string): Promise<string[][]> {
  const tab = Deno.env.get("GOOGLE_SHEET_TAB") ?? "시트1";
  return await sheetsGet(accessToken, `${tab}!A:G`);
}
