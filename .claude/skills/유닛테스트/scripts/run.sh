#!/bin/bash
# run.sh — Edge Function 유닛 테스트 실행
# Usage: bash run.sh

set -e

SKILL_DIR="$(dirname "$(dirname "$0")")"
TEST_FILE="/tmp/edge_fn_test.ts"

echo "[test] 테스트 파일 복사: $SKILL_DIR/scripts/test.ts → $TEST_FILE"
cp "$SKILL_DIR/scripts/test.ts" "$TEST_FILE"

echo "[test] deno test 실행 중..."
deno test "$TEST_FILE" --allow-all

echo "[test] 정리 중..."
rm -f "$TEST_FILE"
echo "[test] 완료"
