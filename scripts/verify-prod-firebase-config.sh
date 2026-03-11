#!/bin/bash
# Verify which Firebase project the production build/deployment uses
# Run from SAMS project root

set -e
echo "=== SAMS Production Firebase Config Verification ==="
echo ""

echo "1. Current Firebase CLI project:"
firebase use 2>/dev/null || echo "  (Firebase CLI not available)"
echo ""

echo "2. .firebaserc projects:"
grep -E '"(default|production|development)"' .firebaserc | head -5
echo ""

echo "3. Production build - checking embedded projectId in dist:"
if [ -d "frontend/sams-ui/dist" ]; then
  # Search for project IDs in built JS
  PROD_MATCH=$(grep -r "sams-sandyland-prod" frontend/sams-ui/dist/assets/*.js 2>/dev/null | head -1 | wc -l)
  DEV_MATCH=$(grep -r "sandyland-management-system" frontend/sams-ui/dist/assets/*.js 2>/dev/null | head -1 | wc -l)
  echo "  sams-sandyland-prod in bundle: $([ "$PROD_MATCH" -gt 0 ] && echo 'YES' || echo 'NO')"
  echo "  sandyland-management-system in bundle: $([ "$DEV_MATCH" -gt 0 ] && echo 'YES (suspicious)' || echo 'NO')"
else
  echo "  (No dist/ - run: cd frontend/sams-ui && npm run build)"
fi
echo ""

echo "4. Production .env.production (sams-ui):"
grep VITE_FIREBASE_PROJECT_ID frontend/sams-ui/.env.production 2>/dev/null || echo "  (file not found)"
echo ""

echo "5. Live production /system/version response:"
curl -s https://sams-sandyland-prod.web.app/system/version 2>/dev/null | head -c 200 || echo "  (request failed)"
echo ""
echo ""
