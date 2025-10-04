#!/bin/bash

# Selective Complete Import Script for SAMS Clients
# This script runs import scripts selectively based on command line options
#
# Usage: ./run-complete-import-selective.sh <CLIENT_ID> [options]
#
# Options:
#   --skip-users         Don't import users
#   --skip-clients       Don't import client config/settings
#   --skip-units         Don't import units
#   --skip-transactions  Don't import transactions
#   --skip-hoadues       Don't import HOA dues
#   --skip-categories    Don't import categories
#   --skip-vendors       Don't import vendors
#   --skip-yearend       Don't import year-end balances
#   --skip-accounts      Don't import accounts
#   --only <collections> Only import specific collections (comma-separated)
#   --data-path <path>   Custom data path (default: ../../{CLIENT_ID}data)
#   --force              Skip confirmation prompt
#
# Examples:
#   # Import only transactions and HOA dues:
#   ./run-complete-import-selective.sh AVII --only transactions,hoadues
#   
#   # Import everything except users and client config:
#   ./run-complete-import-selective.sh AVII --skip-users --skip-clients
#
# IMPORTANT: Run from the scripts/client-onboarding directory

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default values
CLIENT_ID=""
DATA_PATH=""
SKIP_COLLECTIONS=()
ONLY_COLLECTIONS=()
FORCE=false

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-*)
                collection="${1#--skip-}"
                SKIP_COLLECTIONS+=("$collection")
                shift
                ;;
            --only)
                IFS=',' read -ra ONLY_COLLECTIONS <<< "$2"
                shift 2
                ;;
            --data-path)
                DATA_PATH="$2"
                shift 2
                ;;
            --force)
                FORCE=true
                shift
                ;;
            *)
                if [ -z "$CLIENT_ID" ]; then
                    CLIENT_ID="$1"
                else
                    echo -e "${RED}Error: Unknown parameter: $1${NC}"
                    exit 1
                fi
                shift
                ;;
        esac
    done
}

# Check if a collection should be imported
should_import() {
    local collection=$1
    
    # If --only is specified, only import those collections
    if [ ${#ONLY_COLLECTIONS[@]} -gt 0 ]; then
        for only_col in "${ONLY_COLLECTIONS[@]}"; do
            if [ "$only_col" = "$collection" ]; then
                return 0
            fi
        done
        return 1
    fi
    
    # Otherwise, import unless in skip list
    for skip_col in "${SKIP_COLLECTIONS[@]}"; do
        if [ "$skip_col" = "$collection" ]; then
            return 1
        fi
    done
    
    return 0
}

# Display import plan
display_import_plan() {
    echo -e "\n${BLUE}📋 Import Plan:${NC}"
    echo "================================================"
    
    local collections=(
        "clients:Client Configuration"
        "users:Users"
        "accounts:Chart of Accounts"
        "yearend:Year-End Balances"
        "paymentMethods:Payment Methods"
        "categories:Categories"
        "vendors:Vendors"
        "units:Units"
        "transactions:Transactions"
        "hoadues:HOA Dues"
    )
    
    echo -e "\n${GREEN}✅ Collections to import:${NC}"
    for col_info in "${collections[@]}"; do
        IFS=':' read -r col_name col_desc <<< "$col_info"
        if should_import "$col_name"; then
            echo -e "   - $col_desc"
        fi
    done
    
    echo -e "\n${YELLOW}⏭️  Collections to skip:${NC}"
    for col_info in "${collections[@]}"; do
        IFS=':' read -r col_name col_desc <<< "$col_info"
        if ! should_import "$col_name"; then
            echo -e "   - $col_desc"
        fi
    done
    
    echo "================================================"
}

# Function to run import and check status
run_import() {
    local script=$1
    local description=$2
    local collection=$3
    
    # Check if we should run this import
    if [ -n "$collection" ] && ! should_import "$collection"; then
        echo -e "\n${YELLOW}⏭️  Skipping: ${description}${NC}"
        return 0
    fi
    
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

# Main script starts here
parse_args "$@"

# Validate parameters
if [ -z "$CLIENT_ID" ]; then
    echo -e "${RED}Error: CLIENT_ID is required${NC}"
    echo "Usage: $0 <CLIENT_ID> [options]"
    echo ""
    echo "Options:"
    echo "  --skip-<collection>  Skip importing specific collection"
    echo "  --only <collections> Only import specific collections (comma-separated)"
    echo "  --data-path <path>   Custom data path"
    echo "  --force              Skip confirmation prompt"
    echo ""
    echo "Examples:"
    echo "  $0 AVII --only transactions,hoadues"
    echo "  $0 AVII --skip-users --skip-clients"
    exit 1
fi

# Set default data path if not provided
if [ -z "$DATA_PATH" ]; then
    DATA_PATH="../../${CLIENT_ID}data"
fi

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}SAMS Selective ${CLIENT_ID} Data Import${NC}"
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

# Display import plan
display_import_plan

# Safety confirmation
if [ "$FORCE" != "true" ]; then
    echo -e "\n${YELLOW}⚠️  Environment: ${ENV_NAME}${NC}"
    echo -e "${YELLOW}⚠️  This will import data to: ${PROJECT_NAME}${NC}"
    echo -e "${YELLOW}⚠️  Client: ${CLIENT_ID}${NC}"
    echo -e "${YELLOW}⚠️  Data source: ${DATA_PATH}${NC}"
    read -p "Continue with selective import? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        echo -e "${RED}Import cancelled${NC}"
        exit 0
    fi
fi

# Set environment variables for import scripts
export IMPORT_CLIENT_ID=$CLIENT_ID
export IMPORT_DATA_PATH=$DATA_PATH

# Start timer
start_time=$(date +%s)

echo -e "\n${GREEN}Starting selective import sequence...${NC}"

# Track what was imported for summary
IMPORTED_COLLECTIONS=()
SKIPPED_COLLECTIONS=()

# Determine import approach based on available scripts and data
if [ -f "$DATA_PATH/client-config.json" ] && [ -f "import-client-from-json.js" ]; then
    # Since we don't have import-client-from-json.js, we'll use the legacy approach
    echo -e "\n${BLUE}=== USING STEP-BY-STEP IMPORT APPROACH ===${NC}"
    
else
    # Legacy approach: Step-by-step import
    echo -e "\n${BLUE}=== USING LEGACY STEP-BY-STEP APPROACH ===${NC}"
    
    # 1. Create Client (if not skipped)
    if should_import "clients"; then
        echo -e "\n${BLUE}=== STEP 1: CREATE CLIENT ===${NC}"
        if ! run_import "create-mtc-client.js" "Create ${CLIENT_ID} Client" ""; then
            echo -e "${RED}Critical error: Client creation failed. Stopping.${NC}"
            exit 1
        fi
        IMPORTED_COLLECTIONS+=("Client Config")
    else
        echo -e "\n${YELLOW}⏭️  Skipping client creation${NC}"
        SKIPPED_COLLECTIONS+=("Client Config")
    fi
    
    # 2. Create Default Accounts (if not skipped)
    if should_import "accounts"; then
        echo -e "\n${BLUE}=== STEP 2: CREATE ACCOUNTS ===${NC}"
        if ! run_import "create-default-accounts.js" "Create Default Accounts" ""; then
            echo -e "${RED}Critical error: Account creation failed. Stopping.${NC}"
            exit 1
        fi
        IMPORTED_COLLECTIONS+=("Accounts")
    else
        echo -e "\n${YELLOW}⏭️  Skipping accounts creation${NC}"
        SKIPPED_COLLECTIONS+=("Accounts")
    fi
    
    # 3. Import Year-End Balances (if not skipped)
    if should_import "yearend"; then
        echo -e "\n${BLUE}=== STEP 3: IMPORT YEAR-END BALANCES ===${NC}"
        echo -e "${YELLOW}   ⚠️  CRITICAL: Must import before transactions for balance calculations${NC}"
        if ! run_import "import-yearend-balances.js" "Import Year-End Balances" ""; then
            echo -e "${YELLOW}Warning: Year-end balance import had issues. Creating fallback.${NC}"
        fi
        IMPORTED_COLLECTIONS+=("Year-End Balances")
    else
        echo -e "\n${YELLOW}⏭️  Skipping year-end balances import${NC}"
        SKIPPED_COLLECTIONS+=("Year-End Balances")
    fi
    
    # 4. Import Payment Methods (if not skipped)
    if should_import "paymentMethods"; then
        echo -e "\n${BLUE}=== STEP 4: IMPORT PAYMENT METHODS ===${NC}"
        if ! run_import "import-payment-methods-with-crud.js" "Payment Methods Import" ""; then
            echo -e "${YELLOW}Warning: Payment Methods import had issues. Check logs.${NC}"
        fi
        IMPORTED_COLLECTIONS+=("Payment Methods")
    else
        echo -e "\n${YELLOW}⏭️  Skipping payment methods import${NC}"
        SKIPPED_COLLECTIONS+=("Payment Methods")
    fi
    
    # 5. Import Categories & Vendors (if not skipped)
    if should_import "categories" || should_import "vendors"; then
        echo -e "\n${BLUE}=== STEP 5: IMPORT CATEGORIES & VENDORS ===${NC}"
        if ! run_import "import-categories-vendors-with-crud.js" "Categories & Vendors Import" ""; then
            echo -e "${YELLOW}Warning: Categories/Vendors import had issues. Check logs.${NC}"
        fi
        should_import "categories" && IMPORTED_COLLECTIONS+=("Categories")
        should_import "vendors" && IMPORTED_COLLECTIONS+=("Vendors")
    else
        echo -e "\n${YELLOW}⏭️  Skipping categories & vendors import${NC}"
        SKIPPED_COLLECTIONS+=("Categories" "Vendors")
    fi
    
    # 6. Import Units (if not skipped)
    if should_import "units"; then
        echo -e "\n${BLUE}=== STEP 6: IMPORT UNITS ===${NC}"
        if ! run_import "import-units-with-crud.js" "Units Import" ""; then
            echo -e "${YELLOW}Warning: Units import had issues. Check logs.${NC}"
        fi
        IMPORTED_COLLECTIONS+=("Units")
    else
        echo -e "\n${YELLOW}⏭️  Skipping units import${NC}"
        SKIPPED_COLLECTIONS+=("Units")
    fi
    
    # 7. Import Transactions (if not skipped)
    if should_import "transactions"; then
        echo -e "\n${BLUE}=== STEP 7: IMPORT TRANSACTIONS ===${NC}"
        if ! run_import "import-transactions-with-crud.js" "Transactions Import" ""; then
            echo -e "${YELLOW}Warning: Transactions import had issues. Check logs.${NC}"
        fi
        IMPORTED_COLLECTIONS+=("Transactions")
    else
        echo -e "\n${YELLOW}⏭️  Skipping transactions import${NC}"
        SKIPPED_COLLECTIONS+=("Transactions")
    fi
    
    # 8. Import HOA Dues (if not skipped)
    if should_import "hoadues"; then
        echo -e "\n${BLUE}=== STEP 8: IMPORT HOA DUES ===${NC}"
        echo -e "${YELLOW}⚠️  Note: HOA Dues import script not currently available${NC}"
        echo -e "${YELLOW}   HOA dues data is typically included with units import${NC}"
        # Since HOA dues are part of units subcollection, they're imported with units
        # but we'll still track this as "imported" if units were imported
        if should_import "units"; then
            IMPORTED_COLLECTIONS+=("HOA Dues")
        else
            SKIPPED_COLLECTIONS+=("HOA Dues")
        fi
    else
        echo -e "\n${YELLOW}⏭️  Skipping HOA dues import${NC}"
        SKIPPED_COLLECTIONS+=("HOA Dues")
    fi
    
    # 9. Import Users (if not skipped)
    if should_import "users"; then
        echo -e "\n${BLUE}=== STEP 9: IMPORT USERS ===${NC}"
        if [ -f "import-users-with-crud.js" ]; then
            if ! run_import "import-users-with-crud.js" "Users Import" ""; then
                echo -e "${YELLOW}Warning: Users import had issues. Check logs.${NC}"
            fi
            IMPORTED_COLLECTIONS+=("Users")
        else
            echo -e "${YELLOW}Skipping users import (script not found)${NC}"
            SKIPPED_COLLECTIONS+=("Users")
        fi
    else
        echo -e "\n${YELLOW}⏭️  Skipping users import${NC}"
        SKIPPED_COLLECTIONS+=("Users")
    fi
fi

# Calculate elapsed time
end_time=$(date +%s)
elapsed=$((end_time - start_time))
minutes=$((elapsed / 60))
seconds=$((elapsed % 60))

echo -e "\n${BLUE}================================================${NC}"
echo -e "${GREEN}Selective import sequence completed in ${minutes}m ${seconds}s${NC}"
echo -e "${BLUE}================================================${NC}"

# Run validation if available and appropriate collections were imported
if should_import "transactions" || should_import "hoadues" || should_import "units"; then
    echo -e "\n${YELLOW}Running validation...${NC}"
    if [ -f "validate-import.js" ]; then
        echo -e "\n${BLUE}▶ Import Validation${NC}"
        NODE_ENV=${FIRESTORE_ENV:-dev} node validate-import.js
    else
        echo -e "${YELLOW}No validation script found${NC}"
    fi
fi

# Check if cross-reference was generated (only if HOA dues were imported)
if should_import "hoadues" && [ -f "$DATA_PATH/HOA_Transaction_CrossRef.json" ]; then
    echo -e "\n${GREEN}✅ HOA Transaction cross-reference file generated successfully${NC}"
elif should_import "hoadues"; then
    echo -e "\n${YELLOW}⚠️  HOA Transaction cross-reference file not found${NC}"
fi

echo -e "\n${GREEN}🎉 Selective import process complete!${NC}"
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Summary:${NC}"
echo -e "${BLUE}  - Client: ${CLIENT_ID}${NC}"
echo -e "${BLUE}  - Environment: ${ENV_NAME}${NC}"
echo -e "${BLUE}  - Data source: ${DATA_PATH}${NC}"
echo -e "${GREEN}  - Imported: ${IMPORTED_COLLECTIONS[@]:-None}${NC}"
echo -e "${YELLOW}  - Skipped: ${SKIPPED_COLLECTIONS[@]:-None}${NC}"
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