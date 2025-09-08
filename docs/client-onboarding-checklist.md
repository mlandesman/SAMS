# Client Onboarding Checklist

This document provides a comprehensive checklist for onboarding new clients to the SAMS (Sandyland Asset Management System).

## Overview

When onboarding a new client, certain collections and data structures must be in place for the system to function properly, even if the client doesn't have existing data for all categories.

## Pre-Migration Steps

### 1. Client Setup
- [ ] Create client record in system
- [ ] Configure client-specific settings
- [ ] Set up user accounts and permissions

### 2. Data Preparation
- [ ] Gather client's existing data files
- [ ] Review data formats and structure
- [ ] Identify missing data categories

## Core Data Import Scripts

Run these scripts in order for full client data migration:

### Required Data (if available)
1. **Units Import**
   ```bash
   node scripts/import-units-with-audit.js
   ```

2. **Users Import** 
   ```bash
   node scripts/import-users-with-audit.js
   ```

3. **Categories Import**
   ```bash
   node scripts/import-categories-with-audit.js
   ```

4. **Vendors Import**
   ```bash
   node scripts/import-vendors-with-audit.js
   ```

5. **Transactions Import**
   ```bash
   node scripts/import-transactions-with-audit.js
   ```

6. **HOA Dues Import** (if applicable)
   ```bash
   node scripts/import-hoa-dues-with-audit.js
   ```

### Data Linking Scripts
7. **Fix HOA Dues Sequence Linking** (if HOA dues exist)
   ```bash
   node scripts/fix-hoa-dues-sequence-linking.js
   ```

8. **Create Balance Snapshots**
   ```bash
   node scripts/create-balance-snapshots.js
   ```

### Missing Authentication Setup
9. **Create Firebase Auth Users**
   ```bash
   node scripts/fix-missing-firebase-auth-users.js
   ```

## Empty Collections Creation

### **CRITICAL STEP: Always run this script**

Even if a client doesn't have data for certain categories, the collections must exist for the list management system to function:

```bash
node scripts/create-empty-collections.js
```

This script creates the following collections with sample documents:

#### List Management Collections
- **paymentTypes** - Payment method types (Credit Card, Bank Transfer, etc.)
- **projects** - Project tracking for expenses and budgets  
- **budgets** - Budget categories and allocations
- **paymentMethods** - Specific payment methods (bank accounts, cards, etc.)
- **costCenters** - Cost center allocations for expense tracking
- **documentTemplates** - Document templates for receipts and reports

### Why This Is Important
- The frontend list management interface expects these collections to exist
- Without them, certain tabs and features will not appear or will error
- Sample documents provide a template structure for users to follow
- Collections can be populated later through the UI

## Post-Migration Verification

### 1. Data Verification
- [ ] Verify all units imported correctly
- [ ] Check user accounts and permissions
- [ ] Validate transaction data and balances
- [ ] Test HOA dues calculations (if applicable)

### 2. System Functionality
- [ ] Test user login and authentication
- [ ] Verify list management tabs are visible
- [ ] Check transaction entry and editing
- [ ] Test reporting functionality
- [ ] Validate client-specific permissions

### 3. Interactive Features
- [ ] HOA dues hover tooltips working
- [ ] Transaction navigation arrows functional
- [ ] All modals and forms operational

## Production Deployment Checklist

### Before Go-Live
- [ ] All data imported and verified
- [ ] Empty collections created
- [ ] User authentication tested
- [ ] Backup procedures in place
- [ ] Training materials prepared

### Go-Live Day
- [ ] Final data sync (if needed)
- [ ] User credential distribution
- [ ] System monitoring active
- [ ] Support contacts available

### Post Go-Live
- [ ] Monitor system performance
- [ ] Address any user issues
- [ ] Schedule follow-up training
- [ ] Document any customizations

## Common Issues and Solutions

### Missing List Management Tabs
**Issue**: Users report missing tabs or interface elements
**Solution**: Run `create-empty-collections.js` script

### Authentication Errors
**Issue**: "No valid authorization header" errors
**Solution**: Run `fix-missing-firebase-auth-users.js` script

### HOA Dues Display Issues
**Issue**: Interactive elements not working in HOA dues view
**Solution**: Run `fix-hoa-dues-sequence-linking.js` script

### Balance Discrepancies
**Issue**: Transaction balances not calculating correctly
**Solution**: Run `create-balance-snapshots.js` script

## Script Execution Order Summary

For a complete client onboarding, execute scripts in this order:

```bash
# 1. Core data import (if data exists)
node scripts/import-units-with-audit.js
node scripts/import-users-with-audit.js  
node scripts/import-categories-with-audit.js
node scripts/import-vendors-with-audit.js
node scripts/import-transactions-with-audit.js
node scripts/import-hoa-dues-with-audit.js  # if applicable

# 2. Data linking and fixes
node scripts/fix-hoa-dues-sequence-linking.js  # if HOA dues exist
node scripts/create-balance-snapshots.js

# 3. Authentication setup
node scripts/fix-missing-firebase-auth-users.js

# 4. ALWAYS RUN: Empty collections for list management
node scripts/create-empty-collections.js
```

## Notes

- Each script includes comprehensive audit logging
- Scripts are idempotent (safe to run multiple times)
- Empty collections contain sample documents that can be edited/deleted
- All scripts support the CLIENT_ID variable for different clients
- Monitor script output for any errors or warnings

## Support

For issues during client onboarding:
1. Check script output logs for specific errors
2. Verify Firebase authentication and permissions
3. Ensure all required collections exist
4. Contact system administrator if problems persist