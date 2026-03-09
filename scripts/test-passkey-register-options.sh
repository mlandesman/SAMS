#!/bin/bash
# Test passkey registration options endpoint
# Usage:
#   bash scripts/test-passkey-register-options.sh          # Use test harness (auto token)
#   bash scripts/test-passkey-register-options.sh --token  # Prompt for token (paste from About)

set -e

EMAIL="michael@landesman.com"
API_BASE="${API_BASE_URL:-http://localhost:5001}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ "$1" = "--token" ]; then
  echo "Passkey Register Options - Test Script (manual token)"
  echo "===================================================="
  echo "Email: $EMAIL"
  echo "API:   $API_BASE"
  echo ""
  echo "Paste your auth token from the About screen (version in status bar):"
  read -r TOKEN

  if [ -z "$TOKEN" ]; then
    echo "Error: No token provided."
    exit 1
  fi

  echo ""
  echo "Calling POST $API_BASE/auth/passkey/register/options ..."
  echo ""

  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/auth/passkey/register/options" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"email\":\"$EMAIL\"}")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  echo "HTTP Status: $HTTP_CODE"
  echo ""
  if command -v jq &>/dev/null; then
    echo "$BODY" | jq .
  else
    echo "$BODY"
  fi
else
  echo "Passkey Register Options - Test Harness (auto token for michael@landesman.com)"
  echo "==============================================================================="
  echo "API: $API_BASE"
  echo ""
  node "$MAIN_DIR/functions/backend/testing/testPasskeyRegisterOptions.js"
fi
