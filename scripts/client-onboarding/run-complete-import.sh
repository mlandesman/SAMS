#!/bin/bash

# Unified Complete Import Script for SAMS Clients
# This script runs all import scripts in the correct order for any client
#
# Usage: ./run-complete-import.sh <CLIENT_ID> [DATA_PATH]
# Example: ./run-complete-import.sh MTC
# Example: ./run-complete-import.sh AVII ../../AVIIdata
#
# IMPORTANT: Run from the scripts/client-onboarding directory

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get parameters
CLIENT_ID=$1
DATA_PATH=${2:-"../../${CLIENT_ID}data"}  # Default to ../../{CLIENT_ID}data

# Validate parameters
if [ -z "$CLIENT_ID" ]; then
    echo -e "${RED}Error: CLIENT_ID is required${NC}"
    echo "Usage: $0 <CLIENT_ID> [DATA_PATH]"
    echo "Example: $0 MTC"
    echo "Example: $0 AVII ../../AVIIdata"
    exit 1
fi

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}SAMS Complete ${CLIENT_ID} Data Import${NC}"
echo -e "${BLUE}================================================${NC}"

# Verify we're in the correct directory
if [ ! -f "create-mtc-client.js" ] && [ ! -f "import-client-from-json.js" ]; then
    echo -e "${RED}Error: Please run this script from the scripts/client-onboarding directory${NC}"
    echo "cd /path/to/SAMS/scripts/client-onboarding"
    exit 1
fi

# Check if data directory exists
echo -e "\n${YELLOW}Checking for data directory...${NC}"
if [ ! -d "$DATA_PATH" ]; then
    echo -e "${RED}Error: Data directory not found: $DATA_PATH${NC}"
    exit 1
fi

# List available data files
echo -e "\n${BLUE}Available data files in $DATA_PATH:${NC}"
ls -la "$DATA_PATH"/*.json 2>/dev/null | head -10 || echo "No JSON files found"
echo "..."

# Determine environment
ENV_NAME=${FIRESTORE_ENV:-dev}
PROJECT_NAME="sandyland-management-system (Dev)"
if [ "$ENV_NAME" = "prod" ]; then
    PROJECT_NAME="sams-sandyland-prod (Production)"
elif [ "$ENV_NAME" = "staging" ]; then
    PROJECT_NAME="sams-staging-6cdcd (Staging)"
fi

# Safety confirmation
echo -e "\n${YELLOW}⚠️  Environment: ${ENV_NAME}${NC}"
echo -e "${YELLOW}⚠️  This will import data to: ${PROJECT_NAME}${NC}"
echo -e "${YELLOW}⚠️  Client: ${CLIENT_ID}${NC}"
echo -e "${YELLOW}⚠️  Data source: ${DATA_PATH}${NC}"
read -p "Continue with import? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${RED}Import cancelled${NC}"
    exit 0
fi

# Set environment variables for import scripts
export IMPORT_CLIENT_ID=$CLIENT_ID
export IMPORT_DATA_PATH=$DATA_PATH

# Function to run import and check status
run_import() {
    local script=$1
    local description=$2
    
    echo -e "\n${BLUE}▶ Running: ${description}${NC}"
    echo -e "${BLUE}  Script: ${script}${NC}"
    
    # Set NODE_ENV to match FIRESTORE_ENV for backend compatibility
    if NODE_ENV=${FIRESTORE_ENV:-dev} node "$script"; then
        echo -e "${GREEN}✅ ${description} completed successfully${NC}"
        return 0
    else
        echo -e "${RED}❌ ${description} failed${NC}"
        return 1
    fi
}

# Start timer
start_time=$(date +%s)

echo -e "\n${GREEN}Starting import sequence...${NC}"

# 0. Setup Client Configuration (Create template files if needed, preserve existing)
echo -e "\n${BLUE}=== STEP 0: SETUP CLIENT CONFIGURATION ===${NC}"
echo -e "${BLUE}  Script: setup-client-config.js ${CLIENT_ID}${NC}"
if NODE_ENV=${FIRESTORE_ENV:-dev} node setup-client-config.js "$CLIENT_ID"; then
    echo -e "${GREEN}✅ Setup Client Configuration completed successfully${NC}"
else
    echo -e "${YELLOW}Warning: Client configuration setup had issues. Check logs.${NC}"
    # Continue anyway as existing files should be preserved
fi

# Determine import approach based on available scripts and data
if [ -f "$DATA_PATH/client-config.json" ] && [ -f "import-client-from-json.js" ]; then
    # Modern approach: Import from structured JSON
    echo -e "\n${BLUE}=== USING MODERN JSON IMPORT APPROACH ===${NC}"
    
    # 1. Import Client from JSON
    echo -e "\n${BLUE}=== STEP 1: CREATE CLIENT FROM JSON ===${NC}"
    echo -e "${BLUE}  Script: import-client-from-json.js ${CLIENT_ID} ${DATA_PATH}${NC}"
    if NODE_ENV=${FIRESTORE_ENV:-dev} node import-client-from-json.js "$CLIENT_ID" "$DATA_PATH"; then
        echo -e "${GREEN}✅ Import Client from JSON completed successfully${NC}"
    else
        echo -e "${RED}❌ Import Client from JSON failed${NC}"
        echo -e "${RED}Critical error: Client creation failed. Stopping.${NC}"
        exit 1
    fi
    
    # 2. Import Year-End Balances (MUST be before transactions!)
    echo -e "\n${BLUE}=== STEP 2: IMPORT YEAR-END BALANCES ===${NC}"
    echo -e "${YELLOW}   ⚠️  CRITICAL: Must import before transactions for balance calculations${NC}"
    if ! run_import "import-yearend-balances.js" "Import Year-End Balances"; then
        echo -e "${YELLOW}Warning: Year-end balance import had issues. Creating fallback.${NC}"
    fi
    
    # 3. Import All Client Data (includes transactions that update balances)
    echo -e "\n${BLUE}=== STEP 3: IMPORT ALL CLIENT DATA ===${NC}"
    echo -e "${BLUE}  Script: import-client-data.js --client-id ${CLIENT_ID} --data-path ${DATA_PATH}${NC}"
    if NODE_ENV=${FIRESTORE_ENV:-dev} node import-client-data.js --client-id "$CLIENT_ID" --data-path "$DATA_PATH"; then
        echo -e "${GREEN}✅ Import All Client Data completed successfully${NC}"
    else
        echo -e "${YELLOW}Warning: Some data imports had issues. Check logs.${NC}"
    fi
    
else
    # Legacy approach: Step-by-step import
    echo -e "\n${BLUE}=== USING LEGACY STEP-BY-STEP APPROACH ===${NC}"
    
    # 1. Create Client
    echo -e "\n${BLUE}=== STEP 1: CREATE CLIENT ===${NC}"
    if ! run_import "create-mtc-client.js" "Create ${CLIENT_ID} Client"; then
        echo -e "${RED}Critical error: Client creation failed. Stopping.${NC}"
        exit 1
    fi
    
    # 2. Create Default Accounts
    echo -e "\n${BLUE}=== STEP 2: CREATE ACCOUNTS ===${NC}"
    if ! run_import "create-default-accounts.js" "Create Default Accounts"; then
        echo -e "${RED}Critical error: Account creation failed. Stopping.${NC}"
        exit 1
    fi
    
    # 3. Import Year-End Balances (MUST be after accounts but before transactions!)
    echo -e "\n${BLUE}=== STEP 3: IMPORT YEAR-END BALANCES ===${NC}"
    echo -e "${YELLOW}   ⚠️  CRITICAL: Must import before transactions for balance calculations${NC}"
    if ! run_import "import-yearend-balances.js" "Import Year-End Balances"; then
        echo -e "${YELLOW}Warning: Year-end balance import had issues. Creating fallback.${NC}"
    fi
    
    # 4. Import Payment Methods
    echo -e "\n${BLUE}=== STEP 4: IMPORT PAYMENT METHODS ===${NC}"
    if ! run_import "import-payment-methods-with-crud.js" "Payment Methods Import"; then
        echo -e "${YELLOW}Warning: Payment Methods import had issues. Check logs.${NC}"
    fi
    
    # 5. Import Categories & Vendors
    echo -e "\n${BLUE}=== STEP 5: IMPORT CATEGORIES & VENDORS ===${NC}"
    if ! run_import "import-categories-vendors-with-crud.js" "Categories & Vendors Import"; then
        echo -e "${YELLOW}Warning: Categories/Vendors import had issues. Check logs.${NC}"
    fi
    
    # 6. Import Units
    echo -e "\n${BLUE}=== STEP 6: IMPORT UNITS ===${NC}"
    if ! run_import "import-units-with-crud-refactored.js" "Units Import"; then
        echo -e "${YELLOW}Warning: Units import had issues. Check logs.${NC}"
    fi
    
    # 7. Import Transactions
    echo -e "\n${BLUE}=== STEP 7: IMPORT TRANSACTIONS ===${NC}"
    if ! run_import "import-transactions-with-crud-refactored.js" "Transactions Import"; then
        echo -e "${YELLOW}Warning: Transactions import had issues. Check logs.${NC}"
    fi
    
    # 8. Import HOA Dues
    echo -e "\n${BLUE}=== STEP 8: IMPORT HOA DUES ===${NC}"
    if ! run_import "import-hoa-dues-with-crud-refactored.js" "HOA Dues Import"; then
        echo -e "${YELLOW}Warning: HOA Dues import had issues. Check logs.${NC}"
    fi
    
    # 9. Import Users (optional)
    echo -e "\n${BLUE}=== STEP 9: IMPORT USERS ===${NC}"
    if [ -f "import-users-with-crud.js" ]; then
        if ! run_import "import-users-with-crud.js" "Users Import"; then
            echo -e "${YELLOW}Warning: Users import had issues. Check logs.${NC}"
        fi
    else
        echo -e "${YELLOW}Skipping users import (script not found)${NC}"
    fi
fi

# Calculate elapsed time
end_time=$(date +%s)
elapsed=$((end_time - start_time))
minutes=$((elapsed / 60))
seconds=$((elapsed % 60))

echo -e "\n${BLUE}================================================${NC}"
echo -e "${GREEN}Import sequence completed in ${minutes}m ${seconds}s${NC}"
echo -e "${BLUE}================================================${NC}"

# Run validation if available
echo -e "\n${YELLOW}Running validation...${NC}"
if [ -f "validate-import.js" ]; then
    echo -e "\n${BLUE}▶ Import Validation${NC}"
    NODE_ENV=${FIRESTORE_ENV:-dev} node validate-import.js
else
    echo -e "${YELLOW}No validation script found${NC}"
fi

# Check if cross-reference was generated
if [ -f "$DATA_PATH/HOA_Transaction_CrossRef.json" ]; then
    echo -e "\n${GREEN}✅ HOA Transaction cross-reference file generated successfully${NC}"
else
    echo -e "\n${YELLOW}⚠️  HOA Transaction cross-reference file not found${NC}"
fi

echo -e "\n${GREEN}🎉 Import process complete!${NC}"
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Summary:${NC}"
echo -e "${BLUE}  - Client: ${CLIENT_ID}${NC}"
echo -e "${BLUE}  - Environment: ${ENV_NAME}${NC}"
echo -e "${BLUE}  - Data source: ${DATA_PATH}${NC}"
echo -e "${BLUE}================================================${NC}"

# Show Firebase console link
echo -e "\n${YELLOW}View in Firebase Console:${NC}"
if [ "$ENV_NAME" = "prod" ]; then
    echo "https://console.firebase.google.com/project/sams-sandyland-prod/firestore/data/~2Fclients~2F${CLIENT_ID}"
elif [ "$ENV_NAME" = "staging" ]; then
    echo "https://console.firebase.google.com/project/sams-staging-6cdcd/firestore/data/~2Fclients~2F${CLIENT_ID}"
else
    echo "https://console.firebase.google.com/project/sandyland-management-system/firestore/data/~2Fclients~2F${CLIENT_ID}"
fi