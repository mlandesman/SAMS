# SAMS New Client Onboarding - Complete Guide

**Document Version:** 1.0  
**Date:** June 27, 2025  
**Status:** Production Ready  
**Last Updated:** MTC Production Data Migration Test Completion

## Executive Summary

This document provides the complete, production-tested workflow for onboarding new clients to the SAMS (Sandyland Asset Management System). All procedures have been validated through the successful MTC client migration and are ready for production deployment.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [File Structure & Scripts](#file-structure--scripts)
3. [Migration Workflow](#migration-workflow)
4. [Script Execution Guide](#script-execution-guide)
5. [Data Validation](#data-validation)
6. [Troubleshooting](#troubleshooting)
7. [Post-Migration Tasks](#post-migration-tasks)
8. [Quality Assurance](#quality-assurance)

---

## Prerequisites

### System Requirements
- ✅ Firebase Admin SDK configured
- ✅ Backend server running on port 5001
- ✅ Client record created in system
- ✅ Node.js environment with all dependencies

### Required Data Files (if available)
- `Units.json` - Property/unit information
- `Users.json` - User accounts and contact information  
- `Categories.json` - Expense categories
- `Vendors.json` - Vendor/supplier information
- `Transactions.json` - Financial transactions
- `HOA_Dues_Export.json` - HOA dues payments (if applicable)

### Authentication Setup
- SuperAdmin account access
- Client-specific user credentials prepared
- Firebase authentication enabled

---

## File Structure & Scripts

### Core Migration Scripts
Located in `/scripts/` directory:

```
scripts/
├── import-units-with-audit.js              # Units import with audit logging
├── import-users-with-audit.js              # Users import with Firebase Auth
├── import-categories-with-audit.js         # Categories import
├── import-vendors-with-audit.js            # Vendors import
├── import-transactions-with-audit.js       # Transactions import
├── import-hoa-dues-with-audit.js           # HOA dues import (if applicable)
├── fix-hoa-dues-sequence-linking.js        # Links dues to transactions
├── create-balance-snapshots.js             # Creates transaction balance history
├── fix-missing-firebase-auth-users.js      # Creates Firebase Auth accounts
├── create-empty-collections.js             # Creates empty collections for UI
└── transaction-id-mapping.json             # Transaction sequence mapping
```

### Supporting Utilities
```
scripts/
├── data-augmentation-utils.js              # Data processing utilities
├── check-hoa-dues-data.js                  # Data structure verification
└── find-hoa-dues-data.js                   # Data location discovery
```

### Documentation
```
docs/
├── NEW-CLIENT-ONBOARDING-COMPLETE-GUIDE.md # This document
└── client-onboarding-checklist.md          # Detailed checklist
```

---

## Migration Workflow

### Phase 1: Data Import (Optional - only if client has existing data)

Execute these scripts **only if the client has corresponding data files**:

1. **Units Import** (if Units.json exists)
   ```bash
   node scripts/import-units-with-audit.js
   ```

2. **Users Import** (if Users.json exists)
   ```bash
   node scripts/import-users-with-audit.js
   ```

3. **Categories Import** (if Categories.json exists)
   ```bash
   node scripts/import-categories-with-audit.js
   ```

4. **Vendors Import** (if Vendors.json exists)
   ```bash
   node scripts/import-vendors-with-audit.js
   ```

5. **Transactions Import** (if Transactions.json exists)
   ```bash
   node scripts/import-transactions-with-audit.js
   ```

6. **HOA Dues Import** (if HOA_Dues_Export.json exists)
   ```bash
   node scripts/import-hoa-dues-with-audit.js
   ```

### Phase 2: Data Linking & Reconciliation (Required if data was imported)

7. **HOA Dues Transaction Linking** (if HOA dues were imported)
   ```bash
   node scripts/fix-hoa-dues-sequence-linking.js
   ```

8. **Balance Snapshots Creation** (if transactions were imported)
   ```bash
   node scripts/create-balance-snapshots.js
   ```

### Phase 3: Authentication Setup (Always Required)

9. **Firebase Authentication Setup**
   ```bash
   node scripts/fix-missing-firebase-auth-users.js
   ```

### Phase 4: System Initialization (Always Required)

10. **🔥 CRITICAL: Empty Collections Creation**
    ```bash
    node scripts/create-empty-collections.js
    ```
    
    **⚠️ This step is MANDATORY for every client**, regardless of existing data.

---

## Script Execution Guide

### Script Configuration

Before running any scripts, verify the `CLIENT_ID` constant in each script matches your target client:

```javascript
const CLIENT_ID = 'YOUR_CLIENT_CODE'; // Change this to your client
```

### Execution Order for Complete Migration

```bash
# Navigate to SAMS directory
cd "/path/to/SAMS"

# Phase 1: Data Import (skip if no data exists)
node scripts/import-units-with-audit.js
node scripts/import-users-with-audit.js  
node scripts/import-categories-with-audit.js
node scripts/import-vendors-with-audit.js
node scripts/import-transactions-with-audit.js
node scripts/import-hoa-dues-with-audit.js  # HOA clients only

# Phase 2: Data Linking (skip if no data was imported)
node scripts/fix-hoa-dues-sequence-linking.js  # HOA clients only
node scripts/create-balance-snapshots.js       # If transactions imported

# Phase 3: Authentication (always required)
node scripts/fix-missing-firebase-auth-users.js

# Phase 4: System Initialization (always required)
node scripts/create-empty-collections.js
```

### Execution Order for New Client (No Existing Data)

```bash
# Navigate to SAMS directory
cd "/path/to/SAMS"

# Authentication setup
node scripts/fix-missing-firebase-auth-users.js

# System initialization - REQUIRED
node scripts/create-empty-collections.js
```

---

## Data Validation

### After Each Script Execution

Monitor console output for:
- ✅ **Success indicators**: Green checkmarks and success messages
- ⚠️ **Warnings**: Yellow warnings (usually non-critical)
- ❌ **Errors**: Red error messages (requires investigation)

### Key Validation Points

1. **Units Import**
   - Verify unit count matches source data
   - Check owner information completeness
   - Validate monthly dues amounts

2. **Users Import** 
   - Confirm Firebase Auth accounts created
   - Verify Firestore user profiles exist
   - Check client access permissions

3. **Transactions Import**
   - Validate transaction count and amounts
   - Ensure categories and vendors linked
   - Check balance calculations

4. **HOA Dues Import**
   - Verify payment records match
   - Check transaction linking (arrows appear)
   - Test hover tooltips functionality

5. **Empty Collections**
   - Confirm all 6 collections created:
     - paymentTypes
     - projects  
     - budgets
     - paymentMethods
     - costCenters
     - documentTemplates

---

## Troubleshooting

### Common Issues & Solutions

#### 1. **Missing List Management Tabs**
**Symptoms**: UI tabs missing or interface elements not appearing  
**Cause**: Empty collections not created  
**Solution**: 
```bash
node scripts/create-empty-collections.js
```

#### 2. **Authentication Errors**
**Symptoms**: "No valid authorization header" errors  
**Cause**: Firebase Auth accounts not created for users  
**Solution**:
```bash
node scripts/fix-missing-firebase-auth-users.js
```

#### 3. **HOA Dues Interactive Features Missing**
**Symptoms**: No hover tooltips or transaction arrows in HOA dues view  
**Cause**: Dues not linked to transactions  
**Solution**:
```bash
node scripts/fix-hoa-dues-sequence-linking.js
```

#### 4. **Balance Calculation Issues**
**Symptoms**: Incorrect running balances in transaction view  
**Cause**: Missing balance snapshots  
**Solution**:
```bash
node scripts/create-balance-snapshots.js
```

#### 5. **User Login Failures**
**Symptoms**: Users cannot log in with provided credentials  
**Cause**: Firebase Auth not synchronized with Firestore profiles  
**Solution**:
```bash
node scripts/fix-missing-firebase-auth-users.js
```

#### 6. **Script Execution Errors**
**Symptoms**: Scripts fail with database connection errors  
**Check**:
- Firebase Admin SDK credentials
- Backend server running on port 5001
- Network connectivity
- Client ID exists in system

---

## Post-Migration Tasks

### 1. System Validation
- [ ] Test user authentication with sample credentials
- [ ] Verify all UI tabs and features accessible
- [ ] Check transaction entry and editing functionality
- [ ] Validate reporting and export features
- [ ] Test HOA dues calculations (if applicable)

### 2. User Account Setup
- [ ] Distribute login credentials to users
- [ ] Conduct user training sessions
- [ ] Configure user permissions and roles
- [ ] Set up password change requirements

### 3. Data Cleanup
- [ ] Review and edit sample documents in empty collections
- [ ] Customize categories and vendors for client needs
- [ ] Configure payment methods and cost centers
- [ ] Set up project codes and budget allocations

### 4. Production Readiness
- [ ] Enable production monitoring
- [ ] Configure backup procedures
- [ ] Document client-specific customizations
- [ ] Establish support procedures

---

## Quality Assurance

### Pre-Production Checklist

#### Data Integrity
- [ ] All expected data imported without errors
- [ ] Transaction balances reconcile correctly
- [ ] User accounts functional and accessible
- [ ] HOA dues calculations accurate (if applicable)

#### System Functionality  
- [ ] All list management tabs visible and functional
- [ ] Transaction entry/editing works properly
- [ ] Authentication and authorization working
- [ ] Interactive features operational (tooltips, navigation)

#### User Experience
- [ ] Login process smooth and intuitive
- [ ] Interface responsive and complete
- [ ] Error handling graceful
- [ ] Help documentation accessible

#### Audit & Compliance
- [ ] All import actions logged in audit trail
- [ ] Data migration documented
- [ ] User access properly configured
- [ ] Backup procedures in place

### Success Criteria

A successful client onboarding includes:

1. **✅ Complete Data Migration**: All available client data imported and validated
2. **✅ Full System Functionality**: All UI components and features operational  
3. **✅ User Authentication**: All users can log in and access appropriate features
4. **✅ Interactive Features**: HOA dues, transaction navigation, and other interactive elements working
5. **✅ List Management**: All management tabs visible with proper collections
6. **✅ Audit Trail**: Comprehensive logging of all migration activities

---

## Script Reference Summary

### Required for Every Client
| Script | Purpose | When to Run |
|--------|---------|-------------|
| `fix-missing-firebase-auth-users.js` | Creates Firebase Auth accounts | Always |
| `create-empty-collections.js` | Creates UI management collections | Always |

### Data-Dependent Scripts
| Script | Purpose | When to Run |
|--------|---------|-------------|
| `import-units-with-audit.js` | Import property units | If Units.json exists |
| `import-users-with-audit.js` | Import user accounts | If Users.json exists |
| `import-categories-with-audit.js` | Import expense categories | If Categories.json exists |
| `import-vendors-with-audit.js` | Import vendor information | If Vendors.json exists |
| `import-transactions-with-audit.js` | Import financial transactions | If Transactions.json exists |
| `import-hoa-dues-with-audit.js` | Import HOA payment data | If HOA_Dues_Export.json exists |

### Post-Import Scripts
| Script | Purpose | When to Run |
|--------|---------|-------------|
| `fix-hoa-dues-sequence-linking.js` | Link dues to transactions | After HOA dues import |
| `create-balance-snapshots.js` | Create balance history | After transaction import |

---

## Manager Handover Summary

### Validation Completed Through MTC Migration
- ✅ **Complete workflow tested** end-to-end
- ✅ **All scripts validated** and production-ready  
- ✅ **Interactive features verified** (hover tooltips, transaction navigation)
- ✅ **Authentication system proven** functional
- ✅ **Empty collections solution** implemented and tested
- ✅ **Documentation comprehensive** and accurate

### Ready for Production
- ✅ **Scripts are idempotent** (safe to run multiple times)
- ✅ **Comprehensive error handling** implemented
- ✅ **Audit logging** for all operations
- ✅ **Troubleshooting guide** based on real issues encountered
- ✅ **Quality assurance checklist** validated

### Deliverables
1. **Complete script suite** for client onboarding
2. **Production-tested workflow** with execution order
3. **Comprehensive documentation** with troubleshooting
4. **Quality assurance procedures** for validation

This guide represents the culmination of the MTC Production Data Migration Test and provides a complete, battle-tested process for onboarding new clients to the SAMS system.

---

**Document Status**: ✅ **PRODUCTION READY**  
**Testing Status**: ✅ **VALIDATED VIA MTC MIGRATION**  
**Approval**: Ready for Manager Review and Closure