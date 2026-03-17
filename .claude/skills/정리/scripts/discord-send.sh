#!/bin/bash
# discord-send.sh — Discord #업데이트-이력 채널에 오늘 메시지 POST 또는 PATCH
# Usage: bash discord-send.sh < /tmp/discord_msg.txt
#   또는: echo "메시지" | bash discord-send.sh

set -e

CHANNEL_ID="1480426873963151501"
CACHE_FILE=".discord_message_cache.json"
TODAY=$(TZ=Asia/Seoul date +%Y-%m-%d)

# .env 로드
if [ -f ".env" ]; then
  set -a
  source .env
  set +a
fi

if [ -z "$DISCORD_BOT_TOKEN" ] || [ -z "$DISCORD_WEBHOOK_UPDATE" ]; then
  echo "[discord] Error: DISCORD_BOT_TOKEN 또는 DISCORD_WEBHOOK_UPDATE 미설정"
  exit 1
fi

# stdin에서 메시지 읽기
MESSAGE=$(cat)
if [ -z "$MESSAGE" ]; then
  echo "[discord] Error: 메시지가 비어있음 (stdin으로 전달 필요)"
  exit 1
fi

# 1. 캐시에서 오늘 message_id 조회
MESSAGE_ID=""
if [ -f "$CACHE_FILE" ]; then
  MESSAGE_ID=$(python3 -c "
import json, sys
try:
    data = json.load(open('$CACHE_FILE'))
    print(data.get('$TODAY', ''))
except:
    print('')
" 2>/dev/null)
fi

# 2. 캐시 없으면 Discord API로 조회
if [ -z "$MESSAGE_ID" ]; then
  echo "[discord] 캐시 없음 — Discord API에서 오늘 메시지 조회 중..."
  MESSAGE_ID=$(curl -s "https://discord.com/api/v10/channels/${CHANNEL_ID}/messages?limit=10" \
    -H "Authorization: Bot $DISCORD_BOT_TOKEN" | python3 -c "
import sys, json
today = '$TODAY'
try:
    msgs = json.load(sys.stdin)
    print(next((m['id'] for m in msgs if today in m.get('content', '')), ''))
except:
    print('')
" 2>/dev/null)
fi

# 3. 메시지를 임시 파일로 저장 (JSON escape용)
TMP_MSG=$(mktemp)
echo "$MESSAGE" > "$TMP_MSG"

# JSON escape
ESCAPED=$(python3 -c "
import json, sys
print(json.dumps(open('$TMP_MSG').read())[1:-1])
")
rm -f "$TMP_MSG"

# 4. POST 또는 PATCH
if [ -n "$MESSAGE_ID" ]; then
  echo "[discord] 기존 메시지 수정 (id=$MESSAGE_ID)..."
  RESPONSE=$(curl -s -X PATCH "${DISCORD_WEBHOOK_UPDATE}/messages/${MESSAGE_ID}" \
    -H "Content-Type: application/json" \
    -d "{\"content\": \"$ESCAPED\"}")
  RESULT_ID=$(python3 -c "
import json, sys
try:
    d = json.loads('$RESPONSE')
    print(d.get('id', '$MESSAGE_ID'))
except:
    print('$MESSAGE_ID')
" 2>/dev/null)
else
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
fi

if [ -z "$RESULT_ID" ]; then
  echo "[discord] Error: 전송 실패"
  echo "$RESPONSE"
  exit 1
fi

# 5. 캐시 업데이트
python3 -c "
import json, os
cache_file = '$CACHE_FILE'
data = {}
if os.path.exists(cache_file):
    try:
        data = json.load(open(cache_file))
    except:
        pass
data['$TODAY'] = '$RESULT_ID'
json.dump(data, open(cache_file, 'w'), indent=2)
"

echo "[discord] 완료 — id=$RESULT_ID"
