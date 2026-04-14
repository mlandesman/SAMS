#!/usr/bin/env bash

set -euo pipefail

ALLOW_NOT_MAIN=0
ALLOW_STASH=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --allow-not-main)
      ALLOW_NOT_MAIN=1
      shift
      ;;
    --allow-stash)
      ALLOW_STASH=1
      shift
      ;;
    -h|--help)
      cat <<'EOF'
Usage:
  bash scripts/assert-clean-ready.sh [--allow-not-main] [--allow-stash]

Default policy checks:
  - must be on branch `main`
  - no modified/staged files
  - no untracked files
  - no unresolved merge/rebase/cherry-pick
  - no stash entries

Exit code:
  0 = clean/ready
  1 = not clean (fail fast)
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "FAIL: Not inside a git repository."
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

fail=0

if [[ "$ALLOW_NOT_MAIN" -ne 1 && "$CURRENT_BRANCH" != "main" ]]; then
  echo "FAIL: Current branch is '$CURRENT_BRANCH' (expected 'main')."
  fail=1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "FAIL: Working tree is not clean."
  git status --short
  fail=1
fi

if [[ -f .git/MERGE_HEAD || -d .git/rebase-merge || -d .git/rebase-apply || -f .git/CHERRY_PICK_HEAD ]]; then
  echo "FAIL: Merge/rebase/cherry-pick in progress."
  fail=1
fi

if [[ "$ALLOW_STASH" -ne 1 ]]; then
  stash_count="$(git stash list | wc -l | tr -d ' ')"
  if [[ "$stash_count" != "0" ]]; then
    echo "FAIL: Found $stash_count stash entr$( [[ "$stash_count" == "1" ]] && echo "y" || echo "ies" )."
    echo "Run: git stash list"
    fail=1
  fi
fi

if [[ "$fail" -ne 0 ]]; then
  echo ""
  echo "Repository is NOT ready for next task assignment."
  echo "Resolve the failures above, then re-run this check."
  exit 1
fi

echo "PASS: Repository is clean and ready."
