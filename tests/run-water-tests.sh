#!/bin/bash

# Water Bills Payment Test Runner
# Runs diagnostic tests for the payment system

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo -e "\n${BOLD}${BLUE}🧪 WATER BILLS PAYMENT TEST RUNNER${NC}"
echo "================================================================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must run from SAMS root directory${NC}"
    exit 1
fi

# Parse command line arguments
TEST_TYPE=${1:-all}

case $TEST_TYPE in
    quick)
        echo -e "\n${YELLOW}Running Quick Check...${NC}\n"
        node tests/water-payment-quick-check.js
        ;;
    
    bug)
        echo -e "\n${YELLOW}Running Bug Demonstration...${NC}\n"
        node tests/water-payment-bug-demo.js
        ;;
    
    full)
        echo -e "\n${YELLOW}Running Full Diagnostic Suite...${NC}\n"
        node tests/water-payment-diagnostic-suite.js
        ;;
    
    all)
        echo -e "\n${BOLD}Running all tests...${NC}\n"
        
        echo -e "${BLUE}1/3: Quick Check${NC}"
        echo "--------------------------------------------------------------------------------"
        node tests/water-payment-quick-check.js || true
        
        echo -e "\n\n${BLUE}2/3: Bug Demonstration${NC}"
        echo "--------------------------------------------------------------------------------"
        node tests/water-payment-bug-demo.js || true
        
        echo -e "\n\n${BLUE}3/3: Full Diagnostic Suite${NC}"
        echo "--------------------------------------------------------------------------------"
        node tests/water-payment-diagnostic-suite.js || true
        ;;
    
    *)
        echo -e "${RED}Unknown test type: $TEST_TYPE${NC}"
        echo ""
        echo "Usage: ./tests/run-water-tests.sh [quick|bug|full|all]"
        echo ""
        echo "  quick - Fast preview vs payment comparison"
        echo "  bug   - Demonstration of the selectedMonth bug"
        echo "  full  - Complete diagnostic test suite"
        echo "  all   - Run all tests (default)"
        exit 1
        ;;
esac

echo -e "\n${GREEN}${BOLD}✓ Test run complete${NC}\n"

