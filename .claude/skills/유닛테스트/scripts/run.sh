#!/bin/bash
# run.sh — Edge Function 유닛 테스트 실행
# Usage: bash run.sh

set -e

PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$(dirname "$0")")")")"

echo "[test] deno test 실행 중..."
deno test "$PROJECT_ROOT/tests/" --allow-env --allow-all

echo "[test] 완료"
