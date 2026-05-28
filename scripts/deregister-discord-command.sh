#!/usr/bin/env bash
# 너만알맡봇 /인증 슬래시 커맨드 등록 해제 (1기 종료 처리)
#
# 토큰은 파일에 하드코딩하지 않고 환경변수로만 받는다.
# 사용법:
#   CHALLENGE_BOT_TOKEN='너만알맡봇_토큰' bash scripts/deregister-discord-command.sh
#
# 2기 재등록은 docs/season1-teardown.md "4. Discord /인증 슬래시 커맨드 재등록" 참고.
set -euo pipefail

TOKEN="${CHALLENGE_BOT_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  echo "ERROR: CHALLENGE_BOT_TOKEN 환경변수가 비어 있습니다." >&2
  echo "사용법: CHALLENGE_BOT_TOKEN='너만알맡봇_토큰' bash $0" >&2
  exit 1
fi

APP=1474072217447829514          # 너만알맡봇 Application ID
GUILD=1473868607640305889        # 넌 만들기만하고 알고리즘에 맡겨 서버
BASE="https://discord.com/api/v10/applications/$APP/guilds/$GUILD/commands"
AUTH="Authorization: Bot $TOKEN"

echo "[1/3] 봇 신원 확인 (잘못된 토큰 방지)..."
ME_ID=$(curl -s "https://discord.com/api/v10/applications/@me" -H "$AUTH" \
  | python3 -c "import sys,json;print(json.load(sys.stdin).get('id',''))")
if [ "$ME_ID" != "$APP" ]; then
  echo "ERROR: 토큰의 봇 id($ME_ID)가 너만알맡봇($APP)이 아닙니다. 중단합니다." >&2
  exit 1
fi
echo "  확인됨: 너만알맡봇 ($ME_ID)"

echo "[2/3] /인증 커맨드 조회 및 삭제..."
CMD_ID=$(curl -s "$BASE" -H "$AUTH" \
  | python3 -c "import sys,json;print(next((c['id'] for c in json.load(sys.stdin) if c['name']=='인증'),''))")
if [ -z "$CMD_ID" ]; then
  echo "  /인증 커맨드가 이미 없습니다."
else
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/$CMD_ID" -H "$AUTH")
  echo "  삭제 요청 HTTP $CODE (204=성공)"
fi

echo "[3/3] 잔여 검증..."
REMAIN=$(curl -s "$BASE" -H "$AUTH" \
  | python3 -c "import sys,json;print(sum(1 for c in json.load(sys.stdin) if c['name']=='인증'))")
echo "  잔여 /인증 커맨드: $REMAIN 개"
if [ "$REMAIN" = "0" ]; then
  echo "완료: /인증 등록 해제됨."
else
  echo "경고: /인증 커맨드가 아직 남아 있습니다." >&2
  exit 1
fi
