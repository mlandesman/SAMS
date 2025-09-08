#!/bin/bash

# Migrate Exchange Rates from Production to Development
# This script demonstrates the Dev↔Prod migration pattern
#
# Usage: ./migrate-exchange-rates.sh

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Exchange Rates Migration: Prod → Dev${NC}"
echo -e "${BLUE}================================================${NC}"

# Step 1: Export from Production
echo -e "\n${YELLOW}Step 1: Exporting exchangeRates from PRODUCTION...${NC}"
FIRESTORE_ENV=prod node export-collection.js exchangeRates exchangeRates-prod-export.json

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Export from Production failed${NC}"
    exit 1
fi

# Step 2: Show what we exported
echo -e "\n${YELLOW}Step 2: Reviewing exported data...${NC}"
echo "First few lines of export:"
head -20 exchangeRates-prod-export.json

# Step 3: Import to Development (with purge)
echo -e "\n${YELLOW}Step 3: Importing to DEVELOPMENT (with purge of existing data)...${NC}"
echo -e "${YELLOW}This will DELETE all existing exchangeRates in Dev and replace with Prod data.${NC}"
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${RED}Migration cancelled${NC}"
    exit 0
fi

FIRESTORE_ENV=dev node import-collection.js exchangeRates-prod-export.json --purge

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Import to Development failed${NC}"
    exit 1
fi

echo -e "\n${GREEN}✅ Migration completed successfully!${NC}"
echo -e "${GREEN}Exchange rates have been copied from Production to Development.${NC}"
echo -e "\n${BLUE}View in Firebase Console:${NC}"
echo "Dev: https://console.firebase.google.com/project/sandyland-management-system/firestore/data/~2FexchangeRates"