#!/bin/bash
# run.sh — Edge Function 유닛 테스트 실행
# Usage: bash run.sh

set -e

PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$(dirname "$(dirname "$0")")")")")"

echo "[test] deno test 실행 중..."
deno test "$PROJECT_ROOT/tests/" --allow-all --ignore="$PROJECT_ROOT/tests/dashboard-data.test.js"

echo "[test] 완료"
