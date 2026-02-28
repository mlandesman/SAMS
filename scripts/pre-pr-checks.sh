#!/bin/bash
# Pre-PR Quality Gate for SAMS
# Run before creating a PR to catch common issues.
# Usage: bash scripts/pre-pr-checks.sh [base-branch]
#
# Checks:
#   1. new Date() violations (timezone rule)
#   2. Dead files (created on branch but never imported)
#   3. Unused imports in changed files
#   4. navigate() targets vs App.jsx routes
#   5. CommonJS in frontend code

set -euo pipefail

BASE_BRANCH="${1:-main}"
ISSUES_FOUND=0
YELLOW='\033[1;33m'
RED='\033[1;31m'
GREEN='\033[0;32m'
NC='\033[0m'

warn() { echo -e "${YELLOW}⚠  $1${NC}"; ISSUES_FOUND=$((ISSUES_FOUND + 1)); }
fail() { echo -e "${RED}✘  $1${NC}"; ISSUES_FOUND=$((ISSUES_FOUND + 1)); }
pass() { echo -e "${GREEN}✔  $1${NC}"; }
header() { echo -e "\n${NC}━━━ $1 ━━━${NC}"; }

# Get list of files changed on this branch (only existing files)
CHANGED_FILES=$(git diff --name-only --diff-filter=d "$BASE_BRANCH"...HEAD 2>/dev/null || git diff --name-only --diff-filter=d "$BASE_BRANCH" HEAD)
NEW_FILES=$(git diff --name-only --diff-filter=A "$BASE_BRANCH"...HEAD 2>/dev/null || git diff --name-only --diff-filter=A "$BASE_BRANCH" HEAD)
FRONTEND_CHANGES=$(echo "$CHANGED_FILES" | grep -E '^frontend/.*\.(js|jsx|ts|tsx)$' || true)

if [ -z "$FRONTEND_CHANGES" ]; then
  echo "No frontend changes detected. Skipping checks."
  exit 0
fi

echo "Pre-PR Quality Gate — checking $(echo "$FRONTEND_CHANGES" | wc -l | tr -d ' ') frontend files against $BASE_BRANCH"

# ━━━ CHECK 1: new Date() violations ━━━
header "Check 1: new Date() violations"
DATE_VIOLATIONS=$(echo "$FRONTEND_CHANGES" | xargs grep -n 'new Date()' 2>/dev/null | grep -v 'node_modules' | grep -v '\.test\.' | grep -v '_archive' || true)
if [ -n "$DATE_VIOLATIONS" ]; then
  fail "Found new Date() — use getMexicoDate() or getMexicoDateTime() instead:"
  echo "$DATE_VIOLATIONS" | head -20
else
  pass "No new Date() violations"
fi

# ━━━ CHECK 2: Dead files ━━━
header "Check 2: Dead files (new files not imported anywhere)"
NEW_JSX_FILES=$(echo "$NEW_FILES" | grep -E '^frontend/.*\.(js|jsx|ts|tsx)$' | grep -v '\.test\.' | grep -v '\.css$' | grep -v '_archive' || true)
if [ -n "$NEW_JSX_FILES" ]; then
  while IFS= read -r newfile; do
    BASENAME=$(basename "$newfile" | sed 's/\.[^.]*$//')
    # Check if any other file imports this basename
    IMPORTERS=$(grep -rl "$BASENAME" frontend/ --include="*.jsx" --include="*.js" --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "$newfile" | grep -v 'node_modules' | grep -v '_archive' | head -1 || true)
    if [ -z "$IMPORTERS" ]; then
      warn "New file appears unused — no imports found: $newfile"
    fi
  done <<< "$NEW_JSX_FILES"
  # If no warnings were printed for this section
  if [ "$ISSUES_FOUND" -eq 0 ] 2>/dev/null; then
    pass "All new files are imported"
  fi
else
  pass "No new files to check"
fi

# ━━━ CHECK 3: navigate() targets vs routes ━━━
header "Check 3: Navigation targets vs defined routes"
# Extract all navigate() targets from changed files
NAV_TARGETS=$(echo "$FRONTEND_CHANGES" | xargs grep -ohE "navigate\(['\"]\/[^'\"]*['\"]" 2>/dev/null | sed "s/navigate(['\"]//;s/['\"]$//" | sort -u || true)
if [ -n "$NAV_TARGETS" ]; then
  # Find all App.jsx files to extract route definitions
  APP_FILES=$(find frontend/ -name 'App.jsx' -o -name 'App.tsx' | grep -v node_modules | grep -v _archive)
  DEFINED_ROUTES=$(cat $APP_FILES 2>/dev/null | grep -oE 'path="[^"]*"' | sed 's/path="//;s/"$//' | sort -u || true)
  
  while IFS= read -r target; do
    if ! echo "$DEFINED_ROUTES" | grep -qF "$target"; then
      warn "navigate('$target') has no matching route in App.jsx"
    fi
  done <<< "$NAV_TARGETS"
  
  if echo "$NAV_TARGETS" | while IFS= read -r t; do echo "$DEFINED_ROUTES" | grep -qF "$t" || exit 1; done 2>/dev/null; then
    pass "All navigation targets match defined routes"
  fi
else
  pass "No navigation targets to check"
fi

# ━━━ CHECK 4: CommonJS in frontend ━━━
header "Check 4: CommonJS in frontend code"
CJS_VIOLATIONS=$(echo "$FRONTEND_CHANGES" | xargs grep -nE '(require\(|module\.exports)' 2>/dev/null | grep -v 'node_modules' | grep -v '\.config\.' | grep -v 'vite.config' || true)
if [ -n "$CJS_VIOLATIONS" ]; then
  fail "Found CommonJS syntax in frontend (must use ES6 imports/exports):"
  echo "$CJS_VIOLATIONS" | head -10
else
  pass "No CommonJS violations"
fi

# ━━━ SUMMARY ━━━
header "Summary"
if [ "$ISSUES_FOUND" -gt 0 ]; then
  echo -e "${RED}Found $ISSUES_FOUND potential issue(s). Review before creating PR.${NC}"
  exit 1
else
  echo -e "${GREEN}All automated checks passed.${NC}"
  echo ""
  echo "Manual review still required:"
  echo "  - State reset when context deps change (selectedUnitId, currentClient)"
  echo "  - Data unit consistency in fallback chains (centavos vs pesos)"
  echo "  - Role/permission alignment between component visibility and route access"
  exit 0
fi
