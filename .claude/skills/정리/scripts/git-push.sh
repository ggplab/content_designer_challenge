#!/bin/bash
# git-push.sh — update.md (+ architecture.md if changed) 커밋 후 push
# Usage: bash git-push.sh "commit message"

set -e

COMMIT_MSG="${1:-"docs: update release notes"}"

# architecture.md가 변경됐으면 함께 스테이징
ARCH="docs/architecture.md"
if git diff --name-only HEAD -- "$ARCH" 2>/dev/null | grep -q "architecture.md" || \
   git diff --cached --name-only -- "$ARCH" 2>/dev/null | grep -q "architecture.md" || \
   git status --short "$ARCH" 2>/dev/null | grep -q "architecture.md"; then
  git add update.md "$ARCH"
  echo "[git] staged: update.md + $ARCH"
else
  git add update.md
  echo "[git] staged: update.md only"
fi

git commit -m "$COMMIT_MSG"
git push origin main
echo "[git] pushed to origin/main"
