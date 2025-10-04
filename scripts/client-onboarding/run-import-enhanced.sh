#!/bin/bash

# Enhanced Import Script with DateService Support
# 
# Master script to run all enhanced import scripts in proper order
# Ensures timezone consistency across all imports
#
# Usage:
#   ./run-import-enhanced.sh <CLIENT_ID> [DATA_PATH] [COMPONENTS]
#
# Examples:
#   ./run-import-enhanced.sh MTC
#   ./run-import-enhanced.sh AVII /custom/path
#   ./run-import-enhanced.sh MTC default "transactions,hoa"
#
# Created: September 29, 2025

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Parse arguments
CLIENT_ID=$1
DATA_PATH=$2
COMPONENTS=$3

# Validate inputs
if [ -z "$CLIENT_ID" ]; then
    echo -e "${RED}❌ Error: CLIENT_ID is required${NC}"
    echo "Usage: ./run-import-enhanced.sh <CLIENT_ID> [DATA_PATH] [COMPONENTS]"
    echo ""
    echo "Available components:"
    echo "  - all (default): Run all imports in order"
    echo "  - categories: Import categories only"
    echo "  - vendors: Import vendors only"
    echo "  - units: Import units only"
    echo "  - transactions: Import transactions only"
    echo "  - hoa: Import HOA dues only"
    echo "  - yearend: Import year-end balances only"
    echo "  - users: Import users only"
    echo ""
    echo "Multiple components: \"transactions,hoa\""
    exit 1
fi

# Set default data path if not provided
if [ -z "$DATA_PATH" ] || [ "$DATA_PATH" = "default" ]; then
    DATA_PATH="/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/${CLIENT_ID}data"
fi

# Set default components if not provided
if [ -z "$COMPONENTS" ]; then
    COMPONENTS="all"
fi

# Set timezone for all operations
export TZ='America/Cancun'

# Function to print section headers
print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC} $1"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Function to check if component should run
should_run_component() {
    local component=$1
    if [ "$COMPONENTS" = "all" ]; then
        return 0
    fi
    if [[ "$COMPONENTS" == *"$component"* ]]; then
        return 0
    fi
    return 1
}

# Function to run import script
run_import() {
    local script_name=$1
    local component_name=$2
    
    if should_run_component "$component_name"; then
        print_header "Running $component_name Import"
        
        if [ -f "$SCRIPT_DIR/$script_name" ]; then
            node "$SCRIPT_DIR/$script_name" "$CLIENT_ID" "$DATA_PATH"
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✅ $component_name import completed successfully${NC}"
            else
                echo -e "${RED}❌ $component_name import failed${NC}"
                return 1
            fi
        else
            echo -e "${YELLOW}⚠️  Enhanced script not found: $script_name${NC}"
            echo "Using legacy script as fallback..."
            # Fallback to legacy script if enhanced not available
            local legacy_script="${script_name//-enhanced/}"
            if [ -f "$SCRIPT_DIR/$legacy_script" ]; then
                node "$SCRIPT_DIR/$legacy_script"
            else
                echo -e "${RED}❌ No import script found for $component_name${NC}"
                return 1
            fi
        fi
    else
        echo -e "${YELLOW}⏭️  Skipping $component_name import${NC}"
    fi
    
    return 0
}

# Main import process
print_header "🚀 Enhanced Import Process for $CLIENT_ID"

echo -e "${GREEN}Configuration:${NC}"
echo "  Client ID: $CLIENT_ID"
echo "  Data Path: $DATA_PATH"
echo "  Components: $COMPONENTS"
echo "  Timezone: $TZ"
echo "  Environment: ${FIRESTORE_ENV:-dev}"
echo ""

# Check data directory exists
if [ ! -d "$DATA_PATH" ]; then
    echo -e "${RED}❌ Error: Data directory not found: $DATA_PATH${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Data directory found${NC}"

# Create results directory
RESULTS_DIR="$DATA_PATH/import-results-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"
echo -e "${GREEN}✅ Results directory created: $RESULTS_DIR${NC}"

# Start import log
LOG_FILE="$RESULTS_DIR/import.log"
echo "Enhanced Import Log - $(date)" > "$LOG_FILE"
echo "Client: $CLIENT_ID" >> "$LOG_FILE"
echo "Data Path: $DATA_PATH" >> "$LOG_FILE"
echo "Components: $COMPONENTS" >> "$LOG_FILE"
echo "================================" >> "$LOG_FILE"

# Track overall success
OVERALL_SUCCESS=true

# Run imports in dependency order
# Categories (if exists)
if [ -f "$DATA_PATH/Categories.json" ]; then
    run_import "import-categories-vendors-enhanced.js" "categories" 2>&1 | tee -a "$LOG_FILE"
    if [ $? -ne 0 ]; then OVERALL_SUCCESS=false; fi
fi

# Vendors (if exists)
if [ -f "$DATA_PATH/Vendors.json" ]; then
    run_import "import-categories-vendors-enhanced.js" "vendors" 2>&1 | tee -a "$LOG_FILE"
    if [ $? -ne 0 ]; then OVERALL_SUCCESS=false; fi
fi

# Units (required)
run_import "import-units-enhanced.js" "units" 2>&1 | tee -a "$LOG_FILE"
if [ $? -ne 0 ]; then 
    OVERALL_SUCCESS=false
    if should_run_component "all"; then
        echo -e "${RED}❌ Units import failed - stopping process${NC}"
        exit 1
    fi
fi

# Transactions (required for HOA linking)
run_import "import-transactions-enhanced.js" "transactions" 2>&1 | tee -a "$LOG_FILE"
if [ $? -ne 0 ]; then 
    OVERALL_SUCCESS=false
    if should_run_component "hoa"; then
        echo -e "${YELLOW}⚠️  Transactions import failed - HOA dues won't be linked${NC}"
    fi
fi

# HOA Dues (if data exists)
if [ -f "$DATA_PATH/HOA_Dues_Export.json" ] || [ -f "$DATA_PATH/HOADues.json" ]; then
    run_import "import-hoa-dues-enhanced.js" "hoa" 2>&1 | tee -a "$LOG_FILE"
    if [ $? -ne 0 ]; then OVERALL_SUCCESS=false; fi
fi

# Year-end balances
run_import "import-yearend-balances-enhanced.js" "yearend" 2>&1 | tee -a "$LOG_FILE"
if [ $? -ne 0 ]; then OVERALL_SUCCESS=false; fi

# Users (last to ensure units exist)
if [ -f "$DATA_PATH/Users.json" ]; then
    run_import "import-users-enhanced.js" "users" 2>&1 | tee -a "$LOG_FILE"
    if [ $? -ne 0 ]; then OVERALL_SUCCESS=false; fi
fi

# Final summary
print_header "📊 Import Summary"

if [ "$OVERALL_SUCCESS" = true ]; then
    echo -e "${GREEN}✅ ENHANCED IMPORT COMPLETED SUCCESSFULLY!${NC}"
    echo ""
    echo "🕐 All dates preserved in America/Cancun timezone"
    echo "📁 Import log: $LOG_FILE"
    echo "📊 Results directory: $RESULTS_DIR"
    echo ""
    echo "Next steps:"
    echo "1. Review the import log for any warnings"
    echo "2. Verify data in Firebase console"
    echo "3. Run validation scripts if available"
    echo "4. Test application functionality"
else
    echo -e "${RED}❌ IMPORT COMPLETED WITH ERRORS${NC}"
    echo ""
    echo "Please review the import log for details:"
    echo "$LOG_FILE"
    echo ""
    echo "Common issues:"
    echo "- Missing data files"
    echo "- Invalid date formats"
    echo "- Account mapping errors"
    echo "- Network connectivity"
fi

echo ""
echo "Import completed at: $(date)"

# Exit with appropriate code
if [ "$OVERALL_SUCCESS" = true ]; then
    exit 0
else
    exit 1
fi