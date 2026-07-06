#!/bin/bash
# discord-send.sh — Discord #업데이트-이력 채널에 새 메시지 POST
# Usage: bash discord-send.sh < /tmp/discord_msg.txt
#   또는: echo "메시지" | bash discord-send.sh

set -e

# .env 로드
if [ -f ".env" ]; then
  set -a
  source .env
  set +a
fi

if [ -z "$DISCORD_WEBHOOK_UPDATE" ]; then
  echo "[discord] Error: DISCORD_WEBHOOK_UPDATE 미설정"
  exit 1
fi

# stdin에서 메시지 읽기
MESSAGE=$(cat)
if [ -z "$MESSAGE" ]; then
  echo "[discord] Error: 메시지가 비어있음 (stdin으로 전달 필요)"
  exit 1
fi

# JSON escape
TMP_MSG=$(mktemp)
echo "$MESSAGE" > "$TMP_MSG"
ESCAPED=$(python3 -c "
import json, sys
print(json.dumps(open('$TMP_MSG').read())[1:-1])
")
rm -f "$TMP_MSG"

# 새 메시지 전송
echo "[discord] 새 메시지 전송..."
RESPONSE=$(curl -s -X POST "${DISCORD_WEBHOOK_UPDATE}?wait=true" \
  -H "Content-Type: application/json" \
  -d "{\"content\": \"$ESCAPED\"}")

RESULT_ID=$(python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get('id', ''))
except:
    print('')
" <<< "$RESPONSE" 2>/dev/null)

if [ -z "$RESULT_ID" ]; then
  echo "[discord] Error: 전송 실패"
  echo "$RESPONSE"
  exit 1
fi

echo "[discord] 완료 — id=$RESULT_ID"
