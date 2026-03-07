#!/bin/bash
# Update generic summaries in Google Sheets
# YouTube: oEmbed API for title, LinkedIn: decode URL slug, Others: Gemini

set -euo pipefail
cd "$(dirname "$0")/.."

export $(grep GEMINI_API_KEY .env | tr -d "'")
SHEET_ID="1CKyVexXErtbkAVm6I-30fh3tei6J4B9HtCjq0-fmvvU"
SA_JSON="secrets/gen-lang-client-0573007724-8ba750a975fe.json"

get_access_token() {
  local sa_email=$(jq -r .client_email "$SA_JSON")
  local private_key=$(jq -r .private_key "$SA_JSON")
  local now=$(date +%s)
  local exp=$((now + 3600))
  local header=$(echo -n '{"alg":"RS256","typ":"JWT"}' | openssl base64 -e -A | tr '+/' '-_' | tr -d '=')
  local payload=$(echo -n "{\"iss\":\"$sa_email\",\"scope\":\"https://www.googleapis.com/auth/spreadsheets\",\"aud\":\"https://oauth2.googleapis.com/token\",\"exp\":$exp,\"iat\":$now}" | openssl base64 -e -A | tr '+/' '-_' | tr -d '=')
  local signing_input="$header.$payload"
  local signature=$(echo -n "$signing_input" | openssl dgst -sha256 -sign <(echo "$private_key") | openssl base64 -e -A | tr '+/' '-_' | tr -d '=')
  curl -s -X POST "https://oauth2.googleapis.com/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=$signing_input.$signature" | jq -r .access_token
}

# Get title from YouTube oEmbed
get_youtube_title() {
  local url="$1"
  curl -s "https://www.youtube.com/oembed?url=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$url', safe=''))")&format=json" 2>/dev/null | jq -r '.title // empty'
}

# Summarize title with Gemini
summarize_title() {
  local title="$1"
  local resp=$(curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"contents\": [{\"parts\": [{\"text\": \"아래 제목을 한국어로 15자 이내로 요약. 이미 한국어면 줄여서. JSON만: {\\\"summary\\\":\\\"...\\\"}\\n\\n제목: $title\"}]}],
      \"generationConfig\": {\"temperature\": 0.1, \"maxOutputTokens\": 500, \"thinkingConfig\": {\"thinkingBudget\": 0}}
    }")
  echo "$resp" | jq -r '[.candidates[0].content.parts[]? | select(.text) | .text] | join("")' | sed -n 's/.*"summary"\s*:\s*"\([^"]*\)".*/\1/p' | head -1
}

# Decode URL-encoded slug for LinkedIn
decode_linkedin_slug() {
  local url="$1"
  python3 -c "
import urllib.parse
decoded = urllib.parse.unquote('$url')
# Extract slug part after last /
parts = decoded.split('/')
for p in parts:
    if len(p) > 10 and '-' in p:
        # Remove activity ID suffix
        slug = p.split('-activity-')[0] if '-activity-' in p else p
        print(slug[:60])
        break
"
}

echo "Getting access token..."
ACCESS_TOKEN=$(get_access_token)
[ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ] && { echo "Auth failed"; exit 1; }

echo "Reading sheet..."
SHEET_DATA=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
  "https://sheets.googleapis.com/v4/spreadsheets/$SHEET_ID/values/%EC%8B%9C%ED%8A%B81!A:G")

ROW_COUNT=$(echo "$SHEET_DATA" | jq '.values | length')
echo "Rows: $ROW_COUNT"

UPDATED=0

for i in $(seq 1 $((ROW_COUNT - 1))); do
  SUMMARY=$(echo "$SHEET_DATA" | jq -r ".values[$i][5] // \"\"")
  LINK=$(echo "$SHEET_DATA" | jq -r ".values[$i][3] // \"\"")
  PLATFORM=$(echo "$SHEET_DATA" | jq -r ".values[$i][2] // \"\"")

  if ! echo "$SUMMARY" | grep -qE "(YouTube|LinkedIn|Instagram|Blog|Threads) 콘텐츠$"; then
    continue
  fi

  echo "Row $((i+1)): $PLATFORM — $LINK"
  NEW_SUMMARY=""

  # YouTube: oEmbed
  if echo "$LINK" | grep -qE "youtube\.com/watch|youtu\.be/|youtube\.com/shorts"; then
    TITLE=$(get_youtube_title "$LINK")
    if [ -n "$TITLE" ]; then
      echo "  Title: $TITLE"
      NEW_SUMMARY=$(summarize_title "$TITLE")
    fi
  fi

  # YouTube channel/profile — skip, no meaningful title
  if echo "$LINK" | grep -qE "youtube\.com/@|youtube\.com/channel"; then
    NEW_SUMMARY="유튜브 채널"
  fi

  # LinkedIn: decode URL slug and summarize
  if [ -z "$NEW_SUMMARY" ] && echo "$LINK" | grep -q "linkedin.com"; then
    SLUG=$(decode_linkedin_slug "$LINK")
    if [ -n "$SLUG" ]; then
      echo "  Slug: $SLUG"
      NEW_SUMMARY=$(summarize_title "$SLUG")
    fi
  fi

  # Instagram: can't get title easily, try Gemini with URL
  if [ -z "$NEW_SUMMARY" ] && echo "$LINK" | grep -q "instagram.com"; then
    NEW_SUMMARY="인스타그램 포스트"
  fi

  # Google Photos
  if [ -z "$NEW_SUMMARY" ] && echo "$LINK" | grep -q "photos.fife.usercontent"; then
    NEW_SUMMARY="사진 공유"
  fi

  if [ -n "$NEW_SUMMARY" ] && [ "$NEW_SUMMARY" != "null" ]; then
    echo "  -> $NEW_SUMMARY"
    ROW_NUM=$((i + 1))
    curl -s -X PUT \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      "https://sheets.googleapis.com/v4/spreadsheets/$SHEET_ID/values/%EC%8B%9C%ED%8A%B81!F${ROW_NUM}?valueInputOption=USER_ENTERED" \
      -d "{\"values\":[[\"$NEW_SUMMARY\"]]}" > /dev/null
    UPDATED=$((UPDATED + 1))
    sleep 1
  else
    echo "  -> Skipped"
  fi
done

echo "Done! Updated $UPDATED rows."
