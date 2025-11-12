# AVII Client Import Analysis - Quarterly Billing Support

**Date**: November 12, 2025  
**Task**: Analyze AVII client importing code for quarterly billing architecture changes  
**Status**: ✅ Complete

## Executive Summary

**Result**: ✅ **MINOR CHANGES NEEDED**

The AVII client importing code requires **minor configuration changes** to properly support the new quarterly billing architecture. The existing import infrastructure is well-designed and mostly compatible with quarterly billing, but configuration files need to be created/updated to specify quarterly billing frequencies.

## Background

Recent work completed for quarterly billing includes:
- **Phase 5**: HOA Dues quarterly billing (November 8, 2025)
- **Water Bills**: Quarterly migration (November 12, 2025)
- Both implementations maintain backward compatibility with monthly billing (MTC continues to use monthly)

## Quarterly Billing Architecture Overview

### 1. HOA Dues Quarterly Billing
- **Configuration Field**: `duesFrequency` (values: 'monthly' or 'quarterly')
- **Data Structure**: Maintains monthly payment array (12 months) but groups by quarter for display
- **Due Date Logic**: "Group by due date" pattern - 3 fiscal months share same due date
  - Q1: fiscal months 0,1,2 → all due on fiscal month 0 date
  - Q2: fiscal months 3,4,5 → all due on fiscal month 3 date
  - Q3: fiscal months 6,7,8 → all due on fiscal month 6 date
  - Q4: fiscal months 9,10,11 → all due on fiscal month 9 date
- **Implementation**: `backend/controllers/hoaDuesController.js` (function: `calculateFrequencyAwareDueDate`)

### 2. Water Bills Quarterly Billing
- **Configuration Field**: `billingPeriod` (values: 'monthly' or 'quarterly')
- **Data Structure**: Quarterly bills with IDs like `2026-Q1`, `2026-Q2`, etc.
- **Bill Aggregation**: Each bill aggregates all readings since the last bill (typically 3 months)
- **Implementation**: `backend/services/waterBillsService.js` (function: `generateQuarterlyBill`)

## Configuration Locations

### Client-Level Configuration
```javascript
// Path: clients/{clientId}/
{
  feeStructure: {
    duesFrequency: 'quarterly'  // or 'monthly'
  },
  configuration: {
    fiscalYearStartMonth: 7,    // July (for AVII)
    duesFrequency: 'quarterly'  // Fallback location
  }
}
```

### HOA Dues Configuration
```javascript
// Path: clients/{clientId}/config/hoaDues
{
  penaltyDays: 30,
  penaltyRate: 0.05,
  dueDay: 1,
  fiscalYearStartMonth: 7     // If not in client doc
}
```

### Water Bills Configuration
```javascript
// Path: clients/{clientId}/config/waterBills
{
  billingPeriod: 'quarterly',  // 'monthly' or 'quarterly'
  penaltyDays: 30,            // Grace period
  penaltyRate: 0.05,          // 5% monthly
  compoundPenalty: true
}
```

## Current Import Infrastructure

### Key Files
1. **Central Config**: `scripts/client-onboarding/import-config.js`
   - Provides DateService, timezone handling, common utilities
   - Generic for all clients

2. **Client-Specific Configs**: `scripts/client-onboarding/config/`
   - Example: `mtc-import-config.js` (for MTC)
   - **Missing**: AVII-specific config file

3. **Setup Scripts**:
   - `setup-firebase-config.js` - Sets up activity menu and email config
   - `create-default-accounts.js` - Creates account structure
   - `create-yearend-snapshot.js` - Creates year-end balances

4. **Import Scripts**:
   - `importHOADuesWithLinking.js` - Imports HOA dues data
   - `importHOADuesEnhanced.js` - Enhanced version with transaction linking
   - Various water bills import scripts

## Analysis: What Needs to Change

### ✅ What Works (No Changes Needed)

1. **Data Structure Compatibility**
   - HOA dues imports store monthly payment arrays - fully compatible
   - Water bills readings can be aggregated into quarterly bills post-import
   - Import scripts don't need to change their data format

2. **DateService Integration**
   - Already uses `America/Cancun` timezone
   - Proper fiscal year handling (July 1 - June 30 for AVII)
   - No timezone issues expected

3. **Payment Processing**
   - Unified Payment System handles both monthly and quarterly automatically
   - No changes needed to payment import logic

### ⚠️ What Needs Changes (Configuration)

#### 1. Create AVII Import Config File
**File to Create**: `scripts/client-onboarding/config/avii-import-config.js`

```javascript
/**
 * AVII Import Configuration
 * Centralized configuration for AVII import scripts
 */

export const AVII_IMPORT_CONFIG = {
  clientId: 'AVII',
  
  // AVII uses quarterly billing
  billingFrequency: {
    hoaDues: 'quarterly',
    waterBills: 'quarterly'
  },
  
  // Fiscal year configuration
  fiscalYear: {
    startMonth: 7,  // July
    startDay: 1
  },
  
  // Account definitions
  accounts: {
    bank: {
      id: 'bank-001',
      name: 'AVII Bank',
      type: 'bank',
      currency: 'USD'
    }
  },
  
  // Year-end balances (if needed)
  yearEndBalances: {
    year: '2025',
    balances: {
      'bank-001': 0  // AVII started data collection July 1, 2025
    }
  }
};

export default AVII_IMPORT_CONFIG;
```

#### 2. Update Client Document Configuration
When creating/importing AVII client, ensure these fields are set:

```javascript
// In clients/AVII document
{
  feeStructure: {
    duesFrequency: 'quarterly'
  },
  configuration: {
    fiscalYearStartMonth: 7,  // July
    timezone: 'America/Cancun'
  }
}
```

#### 3. Create/Update HOA Dues Config
**Path**: `clients/AVII/config/hoaDues`

```javascript
{
  penaltyDays: 30,           // 30-day grace period for quarterly
  penaltyRate: 0.05,         // 5% monthly penalty
  dueDay: 1,                 // Due on 1st of quarter start month
  fiscalYearStartMonth: 7,   // July
  compoundPenalty: true
}
```

#### 4. Update Water Bills Config
**Path**: `clients/AVII/config/waterBills`

This is already handled by the script:
- `backend/scripts/updateWaterConfigToQuarterly.js` ✅

```javascript
{
  billingPeriod: 'quarterly',  // Key setting
  penaltyDays: 30,
  penaltyRate: 0.05,
  compoundPenalty: true
}
```

#### 5. Document Import Process for AVII
Create/update documentation specifying:
- AVII uses quarterly billing for both HOA Dues and Water Bills
- Import process should set `duesFrequency: 'quarterly'` in client config
- Post-import: Run quarterly bill generation for water bills
- Post-import: Verify HOA dues display correctly grouped by quarter

## Recommended Changes

### 1. Create AVII Import Config File (Priority: HIGH)
**File**: `scripts/client-onboarding/config/avii-import-config.js`

This provides a single source of truth for AVII-specific settings.

### 2. Create AVII Setup Script (Priority: MEDIUM)
**File**: `scripts/client-onboarding/setup-avii-config.js`

Similar to `setup-firebase-config.js` but specifically for AVII:

```javascript
/**
 * Setup AVII Client Configuration
 * Sets quarterly billing for HOA Dues and Water Bills
 */

import { initializeFirebase } from './utils/environment-config.js';
import { getCurrentTimestamp } from './utils/timestamp-converter.js';
import { AVII_IMPORT_CONFIG } from './config/avii-import-config.js';

const CLIENT_ID = 'AVII';

async function setupAVIIConfig() {
  const { db } = await initializeFirebase();
  
  // Check if client exists
  const clientDoc = await db.collection('clients').doc(CLIENT_ID).get();
  if (!clientDoc.exists) {
    console.error('❌ AVII client does not exist');
    process.exit(1);
  }
  
  // Update client document with quarterly config
  await db.collection('clients').doc(CLIENT_ID).update({
    'feeStructure.duesFrequency': 'quarterly',
    'configuration.fiscalYearStartMonth': 7,
    'configuration.timezone': 'America/Cancun',
    updatedAt: getCurrentTimestamp()
  });
  
  // Setup HOA Dues config
  await db.collection(`clients/${CLIENT_ID}/config`).doc('hoaDues').set({
    penaltyDays: 30,
    penaltyRate: 0.05,
    dueDay: 1,
    fiscalYearStartMonth: 7,
    compoundPenalty: true,
    updatedAt: getCurrentTimestamp()
  });
  
  // Water Bills config (if not already set)
  await db.collection(`clients/${CLIENT_ID}/config`).doc('waterBills').set({
    billingPeriod: 'quarterly',
    penaltyDays: 30,
    penaltyRate: 0.05,
    compoundPenalty: true,
    updatedAt: getCurrentTimestamp()
  }, { merge: true });
  
  console.log('✅ AVII configuration updated for quarterly billing');
}

setupAVIIConfig();
```

### 3. Update Import Documentation (Priority: MEDIUM)
**File**: `scripts/client-onboarding/README.md`

Add section:
```markdown
## Client-Specific Configurations

### AVII (Quarterly Billing)
- Uses quarterly billing for both HOA Dues and Water Bills
- Fiscal year: July 1 - June 30
- After import, run: `node scripts/client-onboarding/setup-avii-config.js`
- Then generate quarterly water bills: `node backend/scripts/generateWaterQ1Bills.js`

### MTC (Monthly Billing)
- Uses monthly billing for both HOA Dues and Water Bills
- Fiscal year: January 1 - December 31
- Uses standard import process
```

### 4. Add Validation Script (Priority: LOW)
**File**: `scripts/client-onboarding/validate-avii-quarterly.js`

Script to verify AVII quarterly configuration is correct:

```javascript
/**
 * Validate AVII Quarterly Billing Configuration
 */
async function validateAVIIQuarterly() {
  const { db } = await initializeFirebase();
  
  console.log('🔍 Validating AVII quarterly billing configuration...\n');
  
  // Check client config
  const clientDoc = await db.collection('clients').doc('AVII').get();
  const clientData = clientDoc.data();
  
  const checks = [
    {
      name: 'Client duesFrequency',
      path: 'feeStructure.duesFrequency',
      expected: 'quarterly',
      actual: clientData.feeStructure?.duesFrequency
    },
    {
      name: 'Fiscal year start',
      path: 'configuration.fiscalYearStartMonth',
      expected: 7,
      actual: clientData.configuration?.fiscalYearStartMonth
    }
  ];
  
  // Check HOA config
  const hoaConfig = await db.collection('clients/AVII/config').doc('hoaDues').get();
  const hoaData = hoaConfig.data();
  
  checks.push({
    name: 'HOA penalty days',
    path: 'config/hoaDues.penaltyDays',
    expected: 30,
    actual: hoaData?.penaltyDays
  });
  
  // Check Water Bills config
  const waterConfig = await db.collection('clients/AVII/config').doc('waterBills').get();
  const waterData = waterConfig.data();
  
  checks.push({
    name: 'Water billingPeriod',
    path: 'config/waterBills.billingPeriod',
    expected: 'quarterly',
    actual: waterData?.billingPeriod
  });
  
  // Report results
  let allPassed = true;
  checks.forEach(check => {
    const passed = check.actual === check.expected;
    allPassed = allPassed && passed;
    
    console.log(`${passed ? '✅' : '❌'} ${check.name}:`);
    console.log(`   Expected: ${check.expected}`);
    console.log(`   Actual: ${check.actual}`);
  });
  
  console.log(allPassed ? '\n✅ All checks passed!' : '\n❌ Some checks failed');
  return allPassed;
}
```

## Implementation Checklist

- [ ] Create `scripts/client-onboarding/config/avii-import-config.js`
- [ ] Create `scripts/client-onboarding/setup-avii-config.js`
- [ ] Create `scripts/client-onboarding/validate-avii-quarterly.js`
- [ ] Update `scripts/client-onboarding/README.md` with AVII-specific instructions
- [ ] Test AVII import process end-to-end
- [ ] Verify HOA dues display correctly grouped by quarter
- [ ] Verify water bills generate as quarterly bills
- [ ] Document any additional findings during testing

## Testing Recommendations

### 1. Configuration Testing
```bash
# Test AVII config setup
node scripts/client-onboarding/setup-avii-config.js

# Validate configuration
node scripts/client-onboarding/validate-avii-quarterly.js
```

### 2. HOA Dues Testing
- Import HOA dues data for AVII
- Verify dues are grouped by quarter in UI
- Check that Q1, Q2, Q3, Q4 all share correct due dates
- Test payment distribution across quarters

### 3. Water Bills Testing
```bash
# Generate Q1 bill
node backend/scripts/generateWaterQ1Bills.js

# Verify bill structure
# Should see: 2026-Q1 bill with aggregated Jul/Aug/Sep readings
```

### 4. Integration Testing
- Test unified payment modal with quarterly bills
- Verify penalty calculation for overdue quarterly bills
- Check Statement of Account displays correctly

## Conclusion

**Summary**: The AVII client importing code is well-architected and mostly compatible with quarterly billing. The main changes needed are:

1. **Configuration files** - Create AVII-specific config to set `duesFrequency: 'quarterly'` and `billingPeriod: 'quarterly'`
2. **Setup scripts** - Add scripts to properly configure AVII for quarterly billing
3. **Documentation** - Update docs to clarify AVII uses quarterly billing

**Estimated Effort**: 2-3 hours
- Create config files: 30 min
- Create setup script: 1 hour
- Create validation script: 30 min
- Update documentation: 30 min
- Testing: 30 min

**Risk Level**: LOW - Changes are isolated to configuration, no code logic changes needed

**Breaking Changes**: None - backward compatible with existing monthly billing clients (MTC)

## References

- **HOA Dues Controller**: `backend/controllers/hoaDuesController.js` (lines 37-88)
- **Water Bills Service**: `backend/services/waterBillsService.js` (lines 24-279)
- **Water Config Script**: `backend/scripts/updateWaterConfigToQuarterly.js`
- **Client Template**: `backend/templates/clientTemplates.js`
- **Import Infrastructure**: `scripts/client-onboarding/`
