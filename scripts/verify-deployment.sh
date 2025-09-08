#!/bin/bash
# SAMS Deployment Verification Script
# This script helps verify that all components are properly deployed

echo "🔍 SAMS Deployment Verification"
echo "==============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check function
check_endpoint() {
    local url=$1
    local description=$2
    local expected_status=${3:-200}
    
    echo -n "Checking $description... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✓ OK${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $response, expected $expected_status)"
        return 1
    fi
}

# Configuration - UPDATE THESE WITH YOUR ACTUAL URLs
BACKEND_URLS=(
    "https://backend-michael-landesmans-projects.vercel.app"
    "https://backend-liart-seven.vercel.app"
    "https://sams-backend.vercel.app"
    "https://backend.vercel.app"
)

MOBILE_URL="https://mobile.sams.sandyland.com.mx"
DESKTOP_URL="https://sams.sandyland.com.mx"

echo "1. Backend API Verification"
echo "---------------------------"

# Find the working backend URL
WORKING_BACKEND=""
for url in "${BACKEND_URLS[@]}"; do
    if check_endpoint "$url/api/health" "Backend at $url"; then
        WORKING_BACKEND="$url"
        break
    fi
done

if [ -z "$WORKING_BACKEND" ]; then
    echo -e "${RED}ERROR: No working backend found!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Working backend found at: $WORKING_BACKEND${NC}"
echo ""

# Check specific endpoints
echo "2. API Endpoints Verification"
echo "-----------------------------"
check_endpoint "$WORKING_BACKEND/api/health" "Health endpoint"
check_endpoint "$WORKING_BACKEND/api/auth/reset-password" "Password reset endpoint (GET should return 405)" 405
check_endpoint "$WORKING_BACKEND/api/user/clients" "User clients endpoint (should return 401 without auth)" 401

echo ""
echo "3. Frontend Verification"
echo "-----------------------"
check_endpoint "$MOBILE_URL" "Mobile PWA"
check_endpoint "$MOBILE_URL/manifest.json" "PWA Manifest"
check_endpoint "$DESKTOP_URL" "Desktop UI"

echo ""
echo "4. Environment Configuration Check"
echo "---------------------------------"
echo "Mobile app expects backend at:"
grep "VITE_API_BASE_URL" frontend/mobile-app/.env.production 2>/dev/null || echo "No .env.production found"

echo ""
if [ "$WORKING_BACKEND" != "https://backend-michael-landesmans-projects.vercel.app" ]; then
    echo -e "${YELLOW}⚠️  WARNING: Mobile app is configured to use a different backend URL${NC}"
    echo "   Current config: https://backend-michael-landesmans-projects.vercel.app"
    echo "   Working backend: $WORKING_BACKEND"
    echo ""
    echo "To fix this:"
    echo "1. Update frontend/mobile-app/.env.production:"
    echo "   VITE_API_BASE_URL=$WORKING_BACKEND/api"
    echo "2. Redeploy the mobile app"
fi

echo ""
echo "5. CORS Test (requires authentication)"
echo "-------------------------------------"
echo "To test CORS, you'll need to:"
echo "1. Log into the mobile app at $MOBILE_URL"
echo "2. Check the browser console for CORS errors"
echo "3. Try to load clients or create an expense"

echo ""
echo "==============================="
echo "Verification complete!"
echo ""
echo "Summary:"
echo "- Backend API: $WORKING_BACKEND"
echo "- Mobile PWA: $MOBILE_URL"
echo "- Desktop UI: $DESKTOP_URL"
echo ""

# Check if we found any issues
if [ "$WORKING_BACKEND" != "https://backend-michael-landesmans-projects.vercel.app" ]; then
    echo -e "${YELLOW}Action Required: Update mobile app configuration with correct backend URL${NC}"
    exit 1
else
    echo -e "${GREEN}All basic checks passed!${NC}"
fi