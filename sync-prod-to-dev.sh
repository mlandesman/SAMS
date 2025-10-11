#!/bin/bash

# SAMS Production to Dev Database Sync Script
# Prompts for parameters and executes the syncExchangeRatesFromProdToDev cloud function

set -e  # Exit on any error

echo "🔄 SAMS Production to Dev Database Sync"
echo "======================================="
echo ""

# Function to prompt for user input with default value
prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    
    echo -n "$prompt [$default]: "
    read user_input
    
    if [ -z "$user_input" ]; then
        eval "$var_name='$default'"
    else
        eval "$var_name='$user_input'"
    fi
}

# Prompt for parameters
echo "📋 Configuration Parameters:"
echo ""

prompt_with_default "Number of days to sync from production" "30" "DAYS_TO_SYNC"
prompt_with_default "Overwrite existing data in dev (true/false)" "false" "OVERWRITE"

echo ""
echo "📝 Summary:"
echo "   Days to sync: $DAYS_TO_SYNC"
echo "   Overwrite existing: $OVERWRITE"
echo ""

# Confirm before execution
echo -n "⚠️  Do you want to proceed with syncing production data to dev? (y/N): "
read confirmation

if [[ ! "$confirmation" =~ ^[Yy]$ ]]; then
    echo "❌ Operation cancelled."
    exit 0
fi

echo ""
echo "🚀 Executing cloud function..."
echo ""

# Convert overwrite to proper boolean
if [ "$OVERWRITE" = "true" ]; then
    OVERWRITE_BOOL="true"
else
    OVERWRITE_BOOL="false"
fi

echo "Data payload: {\"daysToSync\":$DAYS_TO_SYNC,\"overwrite\":$OVERWRITE_BOOL}"
echo ""

# Show the full command being executed
echo "🔍 Debug - Full command:"
echo "gcloud functions call syncExchangeRatesFromProdToDev \\"
echo "  --data \"{\\\"daysToSync\\\":$DAYS_TO_SYNC,\\\"overwrite\\\":$OVERWRITE_BOOL}\" \\"
echo "  --region us-central1 \\"
echo "  --project sams-sandyland-prod"
echo ""

# Get the function URL
FUNCTION_URL="https://us-central1-sams-sandyland-prod.cloudfunctions.net/syncExchangeRatesFromProdToDev"

echo "🔍 Function URL: $FUNCTION_URL"
echo ""

# Execute the function with HTTP request
echo "🚀 Making HTTP request to function..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d "{\"daysToSync\":$DAYS_TO_SYNC,\"overwrite\":$OVERWRITE_BOOL}" \
  "$FUNCTION_URL")

# Split response body and status code
HTTP_BODY=$(echo "$RESPONSE" | sed '$d')
HTTP_STATUS=$(echo "$RESPONSE" | tail -n 1)

echo "📊 Response Status: $HTTP_STATUS"
echo "📋 Response Body:"
echo "$HTTP_BODY" | jq . 2>/dev/null || echo "$HTTP_BODY"

if [ "$HTTP_STATUS" -eq 200 ]; then
    echo ""
    echo "✅ Successfully executed syncExchangeRatesFromProdToDev"
    echo "📊 Sync operation completed successfully"
else
    echo ""
    echo "❌ Failed to execute cloud function"
    echo "💡 HTTP Status: $HTTP_STATUS"
    echo "💡 Check the response above for error details"
    exit 1
fi


echo ""
echo "🎉 Sync operation completed!"
echo ""
echo "💡 If you're getting 'Bad Request' errors, the function may need environment variables:"
echo "   - DEV_PROJECT_ID: Your development Firebase project ID"
echo "   - DEV_SERVICE_ACCOUNT_PATH: Path to dev service account JSON"
echo ""
echo "   Check with: firebase functions:config:get --project sams-sandyland-prod"
echo "   Set with: firebase functions:config:set dev.project_id=YOUR_DEV_PROJECT --project sams-sandyland-prod"