#!/bin/bash
# SAMS Version Bump and Deploy
# Usage: ./scripts/bump-version.sh [patch|minor|major]

set -e
BUMP_TYPE=${1:-patch}

if [[ ! "$BUMP_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo "❌ Invalid bump type. Use: patch, minor, or major"
    exit 1
fi

echo "🚀 SAMS Version Bump & Deploy"
echo "Bump Type: $BUMP_TYPE"
node scripts/updateVersion.js bump $BUMP_TYPE
NEW_VERSION=$(node -p "require('./shared/version.json').version")
echo "✅ Version: $NEW_VERSION"

git add shared/version.json frontend/sams-ui/package.json frontend/sams-ui/version.json frontend/mobile-app/package.json frontend/mobile-app/version.json
git commit -m "chore: bump version to $NEW_VERSION" || true
git tag -a "v$NEW_VERSION" -m "Version $NEW_VERSION"

cd frontend/sams-ui && npm run build && cd ../..
firebase deploy

git push origin main
git push origin --tags

echo "🎉 Deployed v$NEW_VERSION"
