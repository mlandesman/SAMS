# Credit Balance Migration & HOA Dues Refactor Plan

**Created:** October 19, 2025  
**Manager Agent:** APM Manager Agent  
**Product Manager:** Michael Landesman  
**Strategic Goal:** Simplify credit balance architecture and prepare for HOA Dues refactor  

---

## 🎯 EXECUTIVE SUMMARY

**Mission:** Migrate credit balances to simplified structure, eliminate cache complexity, extract reusable Water Bills components, and refactor HOA Dues to match Water Bills architecture.

**Total Effort:** 57-74 hours across 4 phases  
**Foundation:** Water Bills Architecture v0.1.0  
**Expected Outcome:** Both modules use same patterns, shared components, optimal performance  

---

## 📐 ARCHITECTURAL CONTEXT

### Historical Evolution

**HOA Dues Original (Pre-Water Bills):**
- Multiple document reads per load (`units/101/dues/2026-00`, `units/102/dues/2026-00`...)
- Significant load time
- **Solution:** SessionStorage cache to avoid re-reading
- Cache worked well for read performance

**Water Bills Innovation:**
- Not just reads - heavy calculations required
- **Solution:** Pre-calculated aggregatedData document
- Single read, no calculations
- Surgical updates for changes
- **Future:** Nightly cloud function for recalculation

**Credit Balance Current State:**
- **Location:** `/clients/{clientId}/units/{unitId}/dues/{year}/creditBalance`
- **Problem:** Too deep, too slow, buried in HOA structure
- **Shared Resource:** Both Water Bills and HOA Dues need access

### Key Insights

1. **Cache May Not Be Needed Anymore**
   - With aggregatedData: Single read, no calculations
   - Module loads once, uses until navigate away
   - Navigate back = fresh read
   - Single user + light usage = 2-3 second load acceptable

2. **Credit Balance Needs Simplification**
   - Current location too deep
   - Shared by multiple modules
   - Needs fast, simple access

3. **Avoid Duplication**
   - Water Bills has proven patterns
   - Extract shared components
   - HOA Dues reuses, doesn't duplicate

4. **Cross-Module Sync Can Wait**
   - Once both use aggregatedData pattern
   - Reload is fast enough
   - Defer complexity until proven needed

---

## 🚀 PHASE 1: CREDIT BALANCE MIGRATION (6-8 hours)

### Objective
Move credit balances from deep HOA Dues structure to simplified units-level location.

**EXPECTED OUTCOME:** This will temporarily break HOA Dues (acceptable - full refactor coming in Phase 4)

---

### Task 1.1: Design New Credit Balance Structure (1 hour)

**Current Structure:**
```
/clients/{clientId}/units/{unitId}/dues/{year}/
  creditBalance: 100000
  creditBalanceHistory: [...]
```

**New Structure:**
```
/clients/{clientId}/units/creditBalances/
  {
    "101": {
      creditBalance: 100000,
      lastChange: {
        year: "2026",
        historyIndex: 15
      }
    },
    "102": { ... }
  }
```

**Design Decisions:**
- ✅ Single document per client (one read gets all units)
- ✅ Unit map structure (fast unit lookup)
- ✅ creditBalanceHistory stays in dues/{year} (annual context makes sense)
- ✅ lastChange points to history entry (lightweight reference)

**Benefits:**
- Single read for all credit balances
- No deep nesting
- Shared by Water Bills and HOA Dues
- Fast unit-specific lookup

**Deliverable:** Data structure specification document

---

### Task 1.2: Create Migration Script (2-3 hours)

**File:** `backend/scripts/migrateCreditBalances.js`

**Script Logic:**
1. For each client (MTC, AVII)
2. For each unit in client
3. Get current fiscal year
4. Read credit balance from old location: `units/{unitId}/dues/{year}/creditBalance`
5. Read creditBalanceHistory to get lastChange info
6. Transform to new structure
7. Write to new location: `units/creditBalances`
8. Verify data integrity
9. Export backup of old data

**Safety:**
- Backup existing data before migration
- Verify row counts match
- Dry-run mode first
- Can rollback if issues

**Testing:**
- Run on Dev environment first
- Verify all units migrated
- Check credit balance totals match
- Ensure no data loss

**Deliverable:** Working migration script with verification

---

### Task 1.3: Update Credit Service (2-3 hours)

**File:** `backend/services/creditService.js`

**Changes Required:**

**Read Credit Balance:**
```javascript
// OLD:
const creditDoc = await db
  .collection('clients').doc(clientId)
  .collection('units').doc(unitId)
  .collection('dues').doc(year)
  .get();
const balance = creditDoc.data()?.creditBalance || 0;

// NEW:
const creditDoc = await db
  .collection('clients').doc(clientId)
  .collection('units').doc('creditBalances')
  .get();
const balance = creditDoc.data()?.[unitId]?.creditBalance || 0;
```

**Update Credit Balance:**
```javascript
// OLD:
await db
  .collection('clients').doc(clientId)
  .collection('units').doc(unitId)
  .collection('dues').doc(year)
  .update({ creditBalance: newBalance });

// NEW:
await db
  .collection('clients').doc(clientId)
  .collection('units').doc('creditBalances')
  .update({
    [`${unitId}.creditBalance`]: newBalance,
    [`${unitId}.lastChange`]: { year, historyIndex }
  });
```

**Fix Credit History Display Bug:**
```javascript
// CURRENT ISSUE: [object Object] in history entries
// ROOT CAUSE: Date objects not properly serialized

// FIX: Ensure proper date formatting in history entries
const addCreditHistoryEntry = async (clientId, unitId, year, entry) => {
  const historyEntry = {
    ...entry,
    date: entry.date instanceof Date ? entry.date.toISOString() : entry.date,
    timestamp: new Date().toISOString()
  };
  
  // Add to history array
  await db
    .collection('clients').doc(clientId)
    .collection('units').doc(unitId)
    .collection('dues').doc(year)
    .update({
      creditBalanceHistory: admin.firestore.FieldValue.arrayUnion(historyEntry)
    });
};
```

**Fix Delete Reversal Logic:**
```javascript
// CURRENT ISSUE: Adding new reversal entry instead of deleting original
// AGREED APPROACH: Delete the specific history entry by index

const deleteCreditHistoryEntry = async (clientId, unitId, year, historyIndex) => {
  // Get current history
  const duesDoc = await db
    .collection('clients').doc(clientId)
    .collection('units').doc(unitId)
    .collection('dues').doc(year)
    .get();
  
  const history = duesDoc.data()?.creditBalanceHistory || [];
  
  // Remove entry at specific index
  history.splice(historyIndex, 1);
  
  // Update history array
  await db
    .collection('clients').doc(clientId)
    .collection('units').doc(unitId)
    .collection('dues').doc(year)
    .update({
      creditBalanceHistory: history
    });
  
  // Update lastChange pointer in new creditBalances location
  await db
    .collection('clients').doc(clientId)
    .collection('units').doc('creditBalances')
    .update({
      [`${unitId}.lastChange.historyIndex`]: history.length - 1
    });
};
```

**Files to Modify:**
- `backend/services/creditService.js` - All CRUD operations + history fixes
- `backend/controllers/creditController.js` - Verify no changes needed
- `backend/api/creditAPI.js` - Frontend API (verify no changes needed)

**Testing:**
- GET credit balance for unit
- UPDATE credit balance for unit
- Add credit history entry (verify no [object Object])
- Delete credit history entry (verify deletion, not addition)
- Verify Water Bills integration

---

### Task 1.4: Verify Water Bills Integration (1-2 hours)

**Test Scenarios:**
1. Water Bills payment using credit
2. Water Bills overpayment (adds to credit)
3. Credit balance display in UI
4. Delete payment (credit restoration)

**Expected:**
- ✅ All Water Bills functionality works
- ✅ Credit reads from new location
- ✅ Credit updates to new location
- ✅ No errors or regressions

**Known Impact:**
- ❌ HOA Dues will break (expected)
- HOA Dues reads from old location (will be fixed in Phase 4)

**Deliverable:** Test results confirming Water Bills works with new credit location

---

## 🧹 PHASE 2: CACHE ELIMINATION (3-4 hours)

### Objective
Remove cache complexity and test performance with direct aggregatedData reads.

**RATIONALE:** With aggregatedData (single read, no calculations), cache may not be needed for single-user, light-usage system.

---

### Task 2.1: Remove Cache from Water Bills (1.5-2 hours)

**File:** `frontend/sams-ui/src/context/WaterBillsContext.jsx`

**Current Architecture:**
- React Context (in-memory state)
- SessionStorage cache (persistent)
- Cache timestamp validation
- Complex invalidation logic

**New Architecture:**
- React Context only (in-memory state)
- Load aggregatedData on mount
- Reload after mutations
- Simple and clean

**Changes:**
```javascript
// REMOVE:
- sessionStorage.getItem('waterBills_aggregatedData')
- sessionStorage.setItem('waterBills_aggregatedData', data)
- Cache timestamp checking
- Cache invalidation logic

// KEEP:
- React Context state (in-memory)
- loadAggregatedData() function
- Reload after payment/delete

// SIMPLIFY:
const loadAggregatedData = async () => {
  const data = await waterAPI.getAggregatedData(clientId, fiscalYear);
  setAggregatedData(data);
};

// After payment
const handlePaymentSuccess = async () => {
  await loadAggregatedData(); // Just reload
};
```

**Comment Out (Don't Delete):**
- Wrap cache logic in `/* CACHE_DISABLED */` comments
- Can restore if performance issues
- Keep as reference for future

**Testing:**
- Load Water Bills module
- Navigate away and back
- Make payment
- Verify data loads correctly

---

### Task 2.2: Performance Testing (1-2 hours)

**Test Environment:** Dev with AVII client data

**Measurements:**

**Dashboard Load:**
- Time from client selection to dashboard display
- Target: < 2 seconds
- Includes: aggregatedData read + rendering

**Water Bills Load:**
- Time from navigation to Water Bills view display
- Target: < 2 seconds
- Includes: Context load + component render

**After Payment:**
- Time from payment submit to UI refresh
- Target: < 2 seconds
- Includes: Payment API + reload aggregatedData

**Navigate Away & Back:**
- Time to reload when returning to Water Bills
- Target: < 2 seconds
- Should be same as initial load

**Results Documentation:**
- If all < 2 seconds: ✅ Cache elimination successful
- If any > 3 seconds: 🔶 Consider simplified cache
- If any > 5 seconds: ❌ Need cache optimization

**Deliverable:** Performance report with recommendation (keep eliminated or restore simplified)

---

### Task 2.3: Decision Point - Cache Strategy

**Based on performance testing:**

**If Performance Acceptable (< 2s):**
- Keep cache eliminated
- Simpler codebase
- Maintain going forward

**If Performance Marginal (2-3s):**
- Consider simplified cache (React Context + in-memory only)
- Eliminate sessionStorage complexity
- Just store aggregatedData in context until navigate away

**If Performance Poor (> 3s):**
- Restore simplified cache
- Keep sessionStorage for aggregatedData only
- Remove complex invalidation (just timestamp check)

**Deliverable:** Final decision on cache strategy with rationale

---

## 🔧 PHASE 3: EXTRACT REUSABLE COMPONENTS (8-12 hours)

### Objective
Identify and modularize Water Bills components for reuse in HOA Dues and future modules.

**CRITICAL:** Avoid duplication - extract once, reuse everywhere.

---

### Task 3.1: Reusability Analysis (3-4 hours)

**Analyze Water Bills Components:**

#### Backend Services Analysis

**penaltyRecalculationService.js:**
- What's Water Bills-specific? (bill structure, field names)
- What's generic? (penalty calculation logic, grace period, percentage)
- Can it be parameterized for HOA Dues?

**waterPaymentsService.js:**
- Payment distribution logic (allocate payment across bills)
- Credit balance integration
- Can be extracted for HOA Dues?

**waterDataService.js:**
- AggregatedData generation pattern
- Status calculation logic
- Display field generation (displayDue, displayPenalties, displayOverdue)
- Can be extracted as generic pattern?

**Surgical Update Pattern:**
- Unit-scoped recalculation
- AggregatedData update logic
- Can be extracted as generic service?

#### Frontend Components Analysis

**WaterPaymentModal.jsx:**
- Preview calculation before save
- Payment allocation display
- Credit usage breakdown
- Status indicators
- What's Water Bills-specific vs generic?

**Status Display Pattern:**
- Colored indicators (paid/partial/unpaid)
- Can be shared component?

**Payment Allocation Display:**
- Shows split allocations
- Credit usage
- Can be shared component?

**Deliverable:** Comprehensive reusability analysis document
- Component inventory
- Generic vs specific breakdown
- Extraction effort estimates
- Shared component design proposals

---

### Task 3.2: Extract Shared Backend Services (3-4 hours)

**Create Shared Services Directory:**
`backend/services/shared/`

#### Service 1: Generic Penalty Calculation
**File:** `backend/services/shared/penaltyCalculationService.js`

**Interface:**
```javascript
export async function calculatePenalties(bills, config) {
  // Input:
  // - bills: Array of bill objects with {dueDate, unpaidAmount, status}
  // - config: {gracePeriodDays, penaltyPercentage, compoundDaily}
  
  // Output:
  // - Updated bills with calculated penalties
  
  // Logic:
  // - Generic penalty calculation
  // - Works for Water Bills OR HOA Dues
  // - Configuration-driven
}
```

#### Service 2: Generic Payment Distribution
**File:** `backend/services/shared/paymentDistributionService.js`

**Interface:**
```javascript
export async function distributePayment(paymentAmount, unpaidBills, creditBalance) {
  // Input:
  // - paymentAmount: Amount in pesos
  // - unpaidBills: Array of bills to pay
  // - creditBalance: Current credit in pesos
  
  // Output:
  // - billPayments: Array of {billId, amountPaid, status}
  // - creditUsed: Amount of credit used
  // - overpayment: Amount going to credit
  // - newCreditBalance: Resulting credit balance
  
  // Logic:
  // - Allocate payment + credit across bills (oldest first)
  // - Handle underpayment, exact, overpayment
  // - Works for any bill type
}
```

#### Service 3: Generic AggregatedData Builder
**File:** `backend/services/shared/aggregatedDataBuilder.js`

**Interface:**
```javascript
export async function buildAggregatedData(clientId, year, billType, config) {
  // Input:
  // - clientId: Client identifier
  // - year: Fiscal year
  // - billType: 'water' or 'hoa'
  // - config: Module-specific configuration
  
  // Output:
  // - AggregatedData document structure
  
  // Logic:
  // - Read bills for all units
  // - Calculate status, totals, penalties
  // - Generate display fields (displayDue, displayPenalties, etc.)
  // - Format for single-read access
}
```

#### Service 4: Generic Surgical Update
**File:** `backend/services/shared/surgicalUpdateService.js`

**Interface:**
```javascript
export async function performSurgicalUpdate(clientId, year, affectedUnits, moduleType) {
  // Input:
  // - clientId: Client identifier
  // - year: Fiscal year
  // - affectedUnits: Array of {unitId, monthId}
  // - moduleType: 'water' or 'hoa'
  
  // Logic:
  // - Recalculate only affected units
  // - Update aggregatedData document
  // - Trigger penalty recalculation
  // - Maintain performance (< 2 seconds)
}
```

**Deliverable:** 4 shared service modules ready for use

---

### Task 3.3: Extract Shared Frontend Components (2-4 hours)

**Create Shared Components Directory:**
`frontend/shared-components/billing/`

#### Component 1: Payment Modal with Preview
**File:** `frontend/shared-components/billing/PaymentModalWithPreview.tsx`

**Props:**
```typescript
interface PaymentModalWithPreviewProps {
  billType: 'water' | 'hoa';
  unitId: string;
  unpaidBills: Bill[];
  previewAPI: (amount) => Promise<PreviewResult>;
  recordAPI: (paymentData) => Promise<RecordResult>;
  onSuccess: () => void;
}
```

**Features:**
- Preview calculation before save
- Payment allocation display
- Credit usage breakdown
- Status indicators (paid/partial/unpaid)
- Works for Water Bills OR HOA Dues

#### Component 2: Bill Status Indicator
**File:** `frontend/shared-components/billing/BillStatusIndicator.tsx`

**Props:**
```typescript
interface BillStatusIndicatorProps {
  status: 'paid' | 'partial' | 'unpaid';
  size?: 'small' | 'medium' | 'large';
}
```

**Features:**
- Color coding (green/orange/red)
- Consistent styling
- Reusable across all billing modules

#### Component 3: Payment Allocation Display
**File:** `frontend/shared-components/billing/PaymentAllocationDisplay.tsx`

**Props:**
```typescript
interface PaymentAllocationDisplayProps {
  allocations: Allocation[];
  creditUsed: number;
  overpayment: number;
  billType: 'water' | 'hoa';
}
```

**Features:**
- Shows split allocations
- Credit usage breakdown
- Clear payment distribution
- Works for any bill type

**Deliverable:** 3 shared components ready for use

---

## 💰 DETAILED PHASE 1: CREDIT BALANCE MIGRATION

### Task 1.1: Design Credit Balance Structure (1 hour)

**Document:**
`docs/CREDIT_BALANCE_ARCHITECTURE.md`

**Contents:**
- New data structure specification
- Collection path: `/clients/{clientId}/units/creditBalances`
- Document schema with examples
- Migration strategy
- Rollback plan

**Key Decisions:**
- Single document with unit map (fast single read)
- creditBalanceHistory stays in `dues/{year}` (annual context)
- lastChange points to history entry (year + index)
- All amounts in centavos (consistent with architecture)

---

### Task 1.2: Create Migration Script (2-3 hours)

**File:** `backend/scripts/migrateCreditBalances.js`

**Implementation:**

```javascript
import admin from 'firebase-admin';
import { serviceAccount } from '../config/firebase-admin.js';

// Initialize for Dev environment
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://sandyland-management-dev.firebaseio.com'
});

const db = admin.firestore();

async function migrateCreditBalances() {
  const clients = ['MTC', 'AVII'];
  
  for (const clientId of clients) {
    console.log(`\n🔄 Migrating credit balances for ${clientId}...`);
    
    // Get all units
    const unitsSnapshot = await db
      .collection('clients').doc(clientId)
      .collection('units')
      .get();
    
    const creditBalances = {};
    
    for (const unitDoc of unitsSnapshot.docs) {
      const unitId = unitDoc.id;
      
      // Get current fiscal year (AVII uses July start)
      const year = '2026'; // Current fiscal year
      
      // Read old credit balance location
      const duesDoc = await db
        .collection('clients').doc(clientId)
        .collection('units').doc(unitId)
        .collection('dues').doc(year)
        .get();
      
      if (duesDoc.exists) {
        const data = duesDoc.data();
        const creditBalance = data.creditBalance || 0;
        const history = data.creditBalanceHistory || [];
        
        // Create new structure
        creditBalances[unitId] = {
          creditBalance: creditBalance,
          lastChange: {
            year: year,
            historyIndex: history.length - 1
          }
        };
        
        console.log(`  ✅ Unit ${unitId}: ${creditBalance} centavos`);
      }
    }
    
    // Write to new location
    await db
      .collection('clients').doc(clientId)
      .collection('units').doc('creditBalances')
      .set(creditBalances);
    
    console.log(`✅ ${clientId}: Migrated ${Object.keys(creditBalances).length} units`);
  }
  
  console.log('\n✅ Migration complete!');
}

// Run migration
migrateCreditBalances().catch(console.error);
```

**Backup Before Migration:**
```javascript
// Export current credit balances to JSON
async function backupCreditBalances() {
  // Save to file before migration
}
```

**Verification:**
```javascript
async function verifyCreditBalances() {
  // Compare old vs new totals
  // Ensure no data loss
}
```

**Deliverable:** Migration script with backup and verification

---

### Task 1.3: Update Credit Service (2-3 hours)

**File:** `backend/services/creditService.js`

**Methods to Update:**

**getCreditBalance(clientId, unitId, year):**
- Change from: `units/{unitId}/dues/{year}`
- To: `units/creditBalances` → get `[unitId].creditBalance`
- Return same format (pesos)

**updateCreditBalance(clientId, unitId, year, changeData):**
- Update: `units/creditBalances` → set `[unitId].creditBalance`
- Update: `[unitId].lastChange` → {year, historyIndex}
- Still append to creditBalanceHistory in `dues/{year}` (unchanged)

**addCreditBalanceHistoryEntry(clientId, unitId, year, entry):**
- Append entry to `units/{unitId}/dues/{year}/creditBalanceHistory`
- Update `units/creditBalances` → `[unitId].lastChange.historyIndex`

**deleteCreditBalanceHistoryEntry(clientId, unitId, year, index):**
- Remove from history array
- Update lastChange pointer if needed

**Testing:**
- Unit tests for each method
- Integration test with Water Bills
- Verify credit history still works

---

### Task 1.4: Test Water Bills Integration (1-2 hours)

**Test Suite:**

**Test 1: Payment Using Credit**
- Setup: Unit with $100 credit balance, $200 bill
- Execute: Pay $150 (uses $50 credit)
- Verify: Credit balance = $50, bill paid

**Test 2: Overpayment**
- Setup: Unit with $0 credit, $100 bill
- Execute: Pay $150 (overpay $50)
- Verify: Credit balance = $50, bill paid

**Test 3: Credit Balance Display**
- Setup: Any unit
- Execute: Open Water Bills payment modal
- Verify: Shows correct credit balance from new location

**Test 4: Delete Payment**
- Setup: Payment using credit (created in Test 1)
- Execute: Delete transaction
- Verify: Credit balance restored correctly

**Test 5: Credit History Display**
- Setup: Any unit with credit history
- Execute: View credit history
- Verify: History displays properly (no [object Object])
- Verify: History still accessible from `dues/{year}`

**Test 6: Credit History Deletion**
- Setup: Unit with credit history entries
- Execute: Delete a payment that used credit
- Verify: History entry is deleted (not added as reversal)
- Verify: Credit balance restored correctly

**Expected Result:**
- ✅ All Water Bills tests pass
- ✅ Credit history displays properly (no [object Object])
- ✅ Delete operations remove history entries (not add reversals)
- ❌ HOA Dues broken (can't read from new location)

**Deliverable:** Test results with pass/fail for each scenario

---

## 🧩 PHASE 3: EXTRACT REUSABLE COMPONENTS (8-12 hours)

### Task 3.1: Comprehensive Reusability Analysis (3-4 hours)

**Deliverable:** `docs/WATER_BILLS_REUSABILITY_ANALYSIS.md`

**Analysis Sections:**

#### Section 1: Backend Services
For each service, document:
- Current implementation file
- Generic vs module-specific logic
- Input/output interfaces
- Configuration requirements
- Extraction complexity (Easy/Medium/Hard)
- Reuse potential for HOA Dues

**Services to Analyze:**
- `penaltyRecalculationService.js`
- `waterPaymentsService.js` (payment distribution)
- `waterDataService.js` (aggregatedData generation)
- Surgical update pattern
- Preview calculation pattern

#### Section 2: Frontend Components
For each component, document:
- Current implementation file
- Generic vs module-specific UI
- Props interface
- Styling dependencies
- Extraction complexity
- Reuse potential for HOA Dues

**Components to Analyze:**
- `WaterPaymentModal.jsx`
- Status indicators
- Payment allocation display
- Bill list display patterns

#### Section 3: Shared Utilities
- Currency conversion (`currencyUtils.js`)
- Date utilities
- Validation logic
- Any other shared code

#### Section 4: Extraction Recommendations
- Priority order for extraction
- Effort estimates per component
- Risk assessment
- Testing requirements

**Deliverable:** Complete analysis document (~500+ lines)

---

### Task 3.2: Extract Shared Backend Services (3-4 hours)

**Create:** `backend/services/shared/` directory

#### Extract 1: Penalty Calculation Service
**File:** `backend/services/shared/penaltyCalculationService.js`

**Design:**
```javascript
export class GenericPenaltyCalculator {
  constructor(config) {
    this.gracePeriodDays = config.gracePeriodDays;
    this.penaltyPercentage = config.penaltyPercentage;
    this.compoundDaily = config.compoundDaily || false;
  }
  
  calculatePenalty(bill, currentDate) {
    // Generic penalty calculation
    // Works for Water Bills, HOA Dues, or any future billing module
  }
  
  async recalculatePenalties(clientId, year, bills, unitId = null) {
    // Unit-scoped optimization
    // Skip paid bills
    // Returns updated bills with penalties
  }
}
```

**Migration:**
- Extract from `penaltyRecalculationService.js`
- Refactor Water Bills to use shared service
- Test Water Bills still works

#### Extract 2: Payment Distribution Service
**File:** `backend/services/shared/paymentDistributionService.js`

**Design:**
```javascript
export async function distributePaymentAcrossBills(
  paymentAmount,    // In pesos
  creditBalance,    // In pesos
  unpaidBills,      // Array of bills (centavos)
  config            // Module-specific config
) {
  // Generic payment distribution logic
  // Returns: billPayments, creditUsed, overpayment, newCreditBalance
  // Works for Water Bills, HOA Dues, or future modules
}
```

**Migration:**
- Extract from `waterPaymentsService.js`
- Refactor Water Bills to use shared service
- Test Water Bills still works

#### Extract 3: AggregatedData Builder
**File:** `backend/services/shared/aggregatedDataBuilder.js`

**Design:**
```javascript
export class AggregatedDataBuilder {
  constructor(moduleType, config) {
    this.moduleType = moduleType; // 'water' or 'hoa'
    this.config = config;
  }
  
  async buildAggregatedData(clientId, year) {
    // Generic aggregatedData generation
    // Returns: aggregatedData structure
    // Configurable for different bill types
  }
  
  async updateUnitData(clientId, year, unitId, monthId) {
    // Surgical update for single unit
    // Returns: Updated unit data
  }
}
```

#### Extract 4: Surgical Update Service
**File:** `backend/services/shared/surgicalUpdateService.js`

**Design:**
```javascript
export async function performSurgicalUpdate(
  clientId,
  year,
  affectedUnits,  // [{unitId, monthId}]
  moduleType,     // 'water' or 'hoa'
  aggregatorService
) {
  // Generic surgical update
  // Recalculates only affected units
  // Updates aggregatedData document
  // Returns: Success status
}
```

**Testing:**
- Refactor Water Bills to use all 4 shared services
- Test all Water Bills functionality
- Verify no regressions
- Measure performance (should be same)

**Deliverable:** 4 shared services + Water Bills refactored to use them

---

### Task 3.3: Extract Shared Frontend Components (2-4 hours)

**Create:** `frontend/shared-components/billing/` directory

#### Component 1: Payment Modal with Preview
**File:** `frontend/shared-components/billing/PaymentModalWithPreview.tsx`

**Design:**
```typescript
interface PaymentModalWithPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  unitId: string;
  billType: 'water' | 'hoa';
  unpaidBills: Bill[];
  creditBalance: number;
  previewAPI: (amount: number) => Promise<PreviewResult>;
  recordAPI: (paymentData: PaymentData) => Promise<RecordResult>;
  onSuccess: () => void;
}

export const PaymentModalWithPreview: React.FC<PaymentModalWithPreviewProps> = (props) => {
  // Generic payment modal
  // Works for Water Bills or HOA Dues
  // Shows preview, allocations, credit usage
};
```

**Features:**
- Amount input with validation
- Preview button (shows allocation before saving)
- Payment allocation display
- Credit usage breakdown
- Status indicators
- Save button (records payment)

#### Component 2: Bill Status Indicator
**File:** `frontend/shared-components/billing/BillStatusIndicator.tsx`

```typescript
interface BillStatusIndicatorProps {
  status: 'paid' | 'partial' | 'unpaid';
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}
```

#### Component 3: Payment Allocation Display
**File:** `frontend/shared-components/billing/PaymentAllocationDisplay.tsx`

```typescript
interface PaymentAllocationDisplayProps {
  allocations: Allocation[];
  creditUsed: number;
  overpayment: number;
  billType: 'water' | 'hoa';
}
```

**Testing:**
- Refactor Water Bills to use shared components
- Test all payment scenarios
- Verify styling consistency
- Ensure no regressions

**Deliverable:** 3 shared components + Water Bills refactored to use them

---

## 🏗️ PHASE 4: HOA DUES REFACTOR (40-50 hours)

### Overview
Apply Water Bills architecture to HOA Dues using extracted shared components.

**Detailed breakdown deferred until Phase 3 complete** (will know exact shared components available)

### High-Level Tasks:
1. Backend centavos conversion (8-10 hrs)
2. Create HOA aggregatedData (6-8 hrs) - Use shared builder
3. API layer with conversion (4-6 hrs)
4. Frontend context (4-6 hrs) - No cache (like Water Bills)
5. Payment modal (4-6 hrs) - Use shared PaymentModalWithPreview
6. Penalty integration (4-6 hrs) - Use shared penaltyCalculationService
7. Surgical updates (4-6 hrs) - Use shared surgicalUpdateService
8. Testing (4-6 hrs)

---

## 📊 SUMMARY & TIMELINE

### Phase Breakdown
- **Phase 1:** Credit Balance Migration (6-8 hours) - BREAKS HOA DUES
- **Phase 2:** Cache Elimination (3-4 hours) - Simplifies Water Bills
- **Phase 3:** Extract Shared Components (8-12 hours) - Avoids duplication
- **Phase 4:** HOA Dues Refactor (40-50 hours) - Uses shared components

### Total Effort: 57-74 hours

### Dependencies
- Phase 2 can start after Phase 1 complete
- Phase 3 can start after Phase 2 complete
- Phase 4 requires Phase 3 complete (needs shared components)

### Key Decisions Made
1. ✅ Credit balances: Single document with unit map at `/clients/{clientId}/units/creditBalances`
2. ✅ Cache: Eliminate entirely from Water Bills, test performance
3. ✅ Cross-module sync: Defer until both use aggregatedData (Phase 4)
4. ✅ Sequence: Credit → Cache → Extract → Refactor

### Expected Outcomes
- ✅ Credit balances fast and simple
- ✅ Water Bills cache-free and clean
- ✅ Shared components ready for reuse
- ✅ HOA Dues matches Water Bills architecture
- ✅ No duplication across modules

---

**Plan Created By:** Manager Agent  
**Date:** October 19, 2025  
**Status:** Ready for approval and task assignment  
**First Task:** Phase 1 - Credit Balance Migration
