#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/start-task-branch.sh <branch-name> [--push]

Examples:
  bash scripts/start-task-branch.sh fix/266-users-loginenabled-dead-field
  bash scripts/start-task-branch.sh fix/266-users-loginenabled-dead-field --push

What it does:
  1) Fails fast unless repository is clean and ready (`assert-clean-ready.sh`)
  2) Ensures local main is fast-forwarded from origin/main
  3) Creates a fresh branch from updated main
  4) Optionally pushes the branch with upstream tracking
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || $# -lt 1 ]]; then
  usage
  exit 0
fi

BRANCH_NAME="$1"
PUSH_FLAG="${2:-}"

if [[ "$BRANCH_NAME" == "main" ]]; then
  echo "Refusing to create branch named 'main'."
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "This script must be run inside a git repository."
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
  echo "Local branch '$BRANCH_NAME' already exists."
  exit 1
fi

if git ls-remote --exit-code --heads origin "$BRANCH_NAME" >/dev/null 2>&1; then
  echo "Remote branch 'origin/$BRANCH_NAME' already exists."
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

echo "Running clean-environment preflight..."
bash scripts/assert-clean-ready.sh

echo "Syncing main..."
git pull --ff-only origin main

echo "Creating branch '$BRANCH_NAME' from main..."
git switch -c "$BRANCH_NAME" >/dev/null

if [[ "$PUSH_FLAG" == "--push" ]]; then
  echo "Pushing branch to origin..."
  git push -u origin "$BRANCH_NAME"
fi

echo ""
echo "Done."
echo "Current branch: $(git rev-parse --abbrev-ref HEAD)"
echo "Base check: $(git rev-list --count origin/main..HEAD) commits ahead of origin/main"
echo "Tip: keep this at 0 until task commits are added."
echo ""
echo "Started from: $CURRENT_BRANCH"
