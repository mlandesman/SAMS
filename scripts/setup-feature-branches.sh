#!/bin/bash

# Setup Feature Branches for New Field Structure Migration
# This script creates all necessary branches for the parallel development work

echo "🌿 Setting up feature branches for new field structure migration..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ensure we're on main and up to date
echo -e "${BLUE}Updating main branch...${NC}"
git checkout main
git pull origin main

# Create main feature branch
echo -e "${GREEN}Creating main feature branch...${NC}"
git checkout -b feature/new-field-structure
git push -u origin feature/new-field-structure

# Backend branches
echo -e "${YELLOW}Creating backend branches...${NC}"
git checkout -b feature/new-field-structure-backend-core
git push -u origin feature/new-field-structure-backend-core
git checkout feature/new-field-structure

git checkout -b feature/new-field-structure-backend-property
git push -u origin feature/new-field-structure-backend-property
git checkout feature/new-field-structure

git checkout -b feature/new-field-structure-backend-entity
git push -u origin feature/new-field-structure-backend-entity
git checkout feature/new-field-structure

git checkout -b feature/new-field-structure-backend-user
git push -u origin feature/new-field-structure-backend-user
git checkout feature/new-field-structure

# Frontend branches
echo -e "${YELLOW}Creating frontend branches...${NC}"
git checkout -b feature/new-field-structure-frontend-transactions
git push -u origin feature/new-field-structure-frontend-transactions
git checkout feature/new-field-structure

git checkout -b feature/new-field-structure-frontend-entity
git push -u origin feature/new-field-structure-frontend-entity
git checkout feature/new-field-structure

git checkout -b feature/new-field-structure-frontend-admin
git push -u origin feature/new-field-structure-frontend-admin
git checkout feature/new-field-structure

# Mobile branches
echo -e "${YELLOW}Creating mobile branches...${NC}"
git checkout -b feature/new-field-structure-mobile-forms
git push -u origin feature/new-field-structure-mobile-forms
git checkout feature/new-field-structure

git checkout -b feature/new-field-structure-mobile-display
git push -u origin feature/new-field-structure-mobile-display
git checkout feature/new-field-structure

# Validation branch
echo -e "${YELLOW}Creating validation branch...${NC}"
git checkout -b feature/new-field-structure-validation
git push -u origin feature/new-field-structure-validation
git checkout feature/new-field-structure

echo -e "${GREEN}✅ All branches created successfully!${NC}"
echo ""
echo "Branch structure:"
echo "  main"
echo "    └── feature/new-field-structure"
echo "         ├── feature/new-field-structure-backend-core (B1)"
echo "         ├── feature/new-field-structure-backend-property (B2)"
echo "         ├── feature/new-field-structure-backend-entity (B3)"
echo "         ├── feature/new-field-structure-backend-user (B4)"
echo "         ├── feature/new-field-structure-frontend-transactions (F1)"
echo "         ├── feature/new-field-structure-frontend-entity (F2)"
echo "         ├── feature/new-field-structure-frontend-admin (F3)"
echo "         ├── feature/new-field-structure-mobile-forms (M1)"
echo "         ├── feature/new-field-structure-mobile-display (M2)"
echo "         └── feature/new-field-structure-validation (V1)"
echo ""
echo "Agents can now checkout their respective branches and begin work."