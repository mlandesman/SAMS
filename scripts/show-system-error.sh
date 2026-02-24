#!/usr/bin/env bash
# Show a captured system error by docID (local file: test-results/systemErrors.json).
# For agents and humans — use the docID from the app, StatusBar, or Firestore systemErrors collection.
#
# Usage: ./scripts/show-system-error.sh <docID> [path-to-systemErrors.json]
# Example: ./scripts/show-system-error.sh v0Bul2WYmTtwOzPBn9Dq

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOC_ID="$1"
FILE_PATH="$2"

if [ -z "$DOC_ID" ]; then
  echo "Usage: $0 <docID> [path-to-systemErrors.json]"
  echo "Example: $0 v0Bul2WYmTtwOzPBn9Dq"
  exit 1
fi

node "$SCRIPT_DIR/show-system-error.js" "$DOC_ID" $FILE_PATH
