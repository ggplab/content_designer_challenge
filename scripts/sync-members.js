// Sheets gviz API로 인증 기록 읽어서 members.json에 없는 닉네임 자동 추가
// 인증이 필요 없음 — 시트가 공개 게시 상태

const fs = require("fs");
const path = require("path");

const SHEET_ID = "1CKyVexXErtbkAVm6I-30fh3tei6J4B9HtCjq0-fmvvU";
const MEMBERS_PATH = path.join(__dirname, "../web/members.json");

async function main() {
  // 공개 gviz API로 Sheets 데이터 읽기
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
  const resp = await fetch(url);
  const text = await resp.text();
  const json = JSON.parse(text.match(/\{.*\}/s)[0]);

  // user 컬럼(index 1)에서 유니크 닉네임 수집
  const nicknames = new Set(
    json.table.rows
      .map((row) => row.c[1]?.v)
      .filter(Boolean)
      .map((n) => String(n).trim())
      .filter((n) => n.length > 0)
  );

  console.log(`Sheets에서 발견된 닉네임: ${[...nicknames].join(", ")}`);

  // 현재 members.json 읽기
  const members = JSON.parse(fs.readFileSync(MEMBERS_PATH, "utf8"));
  const existingNames = new Set(members.participants.map((p) => p.name));
  const existingNicknames = new Set(Object.keys(members.nickname_map));

  let added = 0;
  for (const nickname of nicknames) {
    // nickname_map에 있거나 participants에 이름으로 있으면 스킵
    if (existingNicknames.has(nickname) || existingNames.has(nickname)) continue;

    members.participants.push({ name: nickname, freq: "2주1회" });
    members.nickname_map[nickname] = nickname;
    console.log(`추가: ${nickname}`);
    added++;
  }

  if (added > 0) {
    fs.writeFileSync(MEMBERS_PATH, JSON.stringify(members, null, 2) + "\n");
    console.log(`완료: ${added}명 추가됨`);
  } else {
    console.log("새 멤버 없음");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
