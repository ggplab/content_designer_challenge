#!/bin/bash
# 주간 정산 실행 스크립트
# 사용법: bash scripts/run-weekly-summary.sh [local|prod]
#   local — 로컬 Deno 서버 (기본값)
#   prod  — 운영 Supabase Edge Function

set -e

MODE="${1:-local}"

if [ "$MODE" = "prod" ]; then
  URL="https://tcxtcacibgoancvoiybx.supabase.co/functions/v1/weekly-summary"
  AUTH_HEADER="Authorization: Bearer ${SUPABASE_ANON_KEY}"
else
  URL="http://localhost:8000/functions/v1/weekly-summary"
  AUTH_HEADER="Authorization: Bearer local"
fi

echo "[run] 모드: $MODE"
echo "[run] URL: $URL"
echo ""

curl -s -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if data.get('ok'):
    print('[run] 완료 ✅')
    print(data.get('msg', ''))
else:
    print('[run] 실패 ❌')
    print(data.get('error', ''))
    sys.exit(1)
"
