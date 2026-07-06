#!/bin/bash
# git-push.sh — members.json 커밋 후 push
# Usage: bash git-push.sh "이름" "Discord닉네임"

set -e

NAME="${1:-"멤버"}"
NICK="${2:-"unknown"}"

git add web/members.json
git commit -m "feat: 멤버 추가 — ${NAME} (${NICK})"
git push origin main
echo "[git] pushed to origin/main"
