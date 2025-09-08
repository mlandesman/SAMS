#!/bin/bash

# Test Protected Routes with cURL
# This script helps test API routes with and without authentication

API_BASE="http://localhost:5001/api"
CLIENT_ID="MTC"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 Protected Routes Testing Script${NC}\n"

# Check if token is provided
TOKEN=$1

if [ -z "$TOKEN" ]; then
    echo -e "${YELLOW}⚠️  No token provided. Testing without authentication...${NC}"
    echo -e "${YELLOW}Usage: $0 <firebase-id-token>${NC}"
    echo -e "${YELLOW}To get a token, use one of these methods:${NC}"
    echo -e "  1. Run: node scripts/test-protected-routes.js user@example.com password"
    echo -e "  2. Copy from browser DevTools (Network tab) when logged into the app"
    echo -e "  3. Use Firebase Auth REST API\n"
else
    echo -e "${GREEN}✅ Using provided token${NC}\n"
fi

# Function to test a route
test_route() {
    local name=$1
    local path=$2
    local method=${3:-GET}
    
    if [ -z "$TOKEN" ]; then
        # Test without auth
        response=$(curl -s -w "\n%{http_code}" -X $method "$API_BASE$path")
        status=$(echo "$response" | tail -n 1)
        body=$(echo "$response" | head -n -1)
    else
        # Test with auth
        response=$(curl -s -w "\n%{http_code}" -X $method \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            "$API_BASE$path")
        status=$(echo "$response" | tail -n 1)
        body=$(echo "$response" | head -n -1)
    fi
    
    # Format output
    if [ -z "$TOKEN" ]; then
        # Without auth - expect 401
        if [ "$status" = "401" ]; then
            echo -e "${GREEN}✅${NC} $name - ${GREEN}$status${NC} (Protected)"
        else
            echo -e "${RED}❌${NC} $name - ${RED}$status${NC} (NOT PROTECTED!)"
        fi
    else
        # With auth - expect 200 or 404
        if [ "$status" = "200" ] || [ "$status" = "404" ]; then
            echo -e "${GREEN}✅${NC} $name - ${GREEN}$status${NC}"
            if [ "$status" = "200" ]; then
                # Try to extract count from response
                count=$(echo "$body" | grep -o '"count":[0-9]*' | grep -o '[0-9]*' | head -1)
                if [ ! -z "$count" ]; then
                    echo "   └─ Records found: $count"
                fi
            fi
        else
            echo -e "${RED}❌${NC} $name - ${RED}$status${NC}"
            echo "   └─ Response: $body"
        fi
    fi
}

# Test routes
echo -e "${YELLOW}📋 Testing Routes${NC}"
echo "────────────────────────────────────────────"

test_route "Accounts" "/clients/$CLIENT_ID/accounts"
test_route "Vendors" "/clients/$CLIENT_ID/vendors"
test_route "Categories" "/clients/$CLIENT_ID/categories"
test_route "Payment Methods" "/clients/$CLIENT_ID/paymentMethods"
test_route "Email Config" "/clients/$CLIENT_ID/email/config"
test_route "Transactions" "/clients/$CLIENT_ID/transactions"
test_route "Units" "/clients/$CLIENT_ID/units"
test_route "Reports" "/clients/$CLIENT_ID/reports/unit/101"

echo ""

# Additional helper commands
if [ ! -z "$TOKEN" ]; then
    echo -e "${BLUE}📝 Example API Calls:${NC}"
    echo "────────────────────────────────────────────"
    echo "# Get all accounts:"
    echo "curl -H \"Authorization: Bearer \$TOKEN\" $API_BASE/clients/$CLIENT_ID/accounts"
    echo ""
    echo "# Create a vendor:"
    echo "curl -X POST -H \"Authorization: Bearer \$TOKEN\" -H \"Content-Type: application/json\" \\"
    echo "  -d '{\"name\": \"Test Vendor\", \"email\": \"test@vendor.com\"}' \\"
    echo "  $API_BASE/clients/$CLIENT_ID/vendors"
    echo ""
fi

# Get a test token
if [ -z "$TOKEN" ]; then
    echo -e "${BLUE}🔑 How to Get a Test Token:${NC}"
    echo "────────────────────────────────────────────"
    echo "1. Using the test script (recommended):"
    echo "   node scripts/test-protected-routes.js your-email@example.com your-password"
    echo ""
    echo "2. From browser DevTools:"
    echo "   - Login to the app"
    echo "   - Open DevTools → Network tab"
    echo "   - Look for API calls"
    echo "   - Copy the Bearer token from Authorization header"
    echo ""
    echo "3. Using Firebase REST API:"
    echo "   See: https://firebase.google.com/docs/reference/rest/auth"
    echo ""
fi