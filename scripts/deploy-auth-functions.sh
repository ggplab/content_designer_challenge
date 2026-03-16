#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${PROJECT_REF:-tcxtcacibgoancvoiybx}"

functions=(
  "discord-verify"
  "web-verify"
  "claim-member-profile"
  "create-api-key"
  "list-api-keys"
  "revoke-api-key"
)

for fn in "${functions[@]}"; do
  echo "Deploying ${fn}..."
  supabase functions deploy "${fn}" --project-ref "${PROJECT_REF}" --no-verify-jwt
done

echo "All auth-related functions deployed."
