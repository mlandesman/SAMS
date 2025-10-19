# Phase 1: Penalty Code Reference

**Investigation Date:** October 15, 2025  
**Agent:** Agent_Water_Investigation_Phase_1  
**Purpose:** Complete reference of all penalty-related functions with file paths, line numbers, and relationships

---

## Primary Penalty Calculation Functions

### Function 1: recalculatePenaltiesForClient()

**File:** `backend/services/penaltyRecalculationService.js`  
**Lines:** 51-163  
**Purpose:** Main entry point - recalculates penalties for all unpaid bills for a client

**Signature:**
```javascript
async recalculatePenaltiesForClient(clientId, currentDate = getNow())
```

**Parameters:**
- `clientId` (string) - Client identifier (e.g., "AVII")
- `currentDate` (Date) - Current date for penalty calculation (defaults to getNow())

**Returns:**
```javascript
{
  success: boolean,
  data: {
    clientId: string,
    processedBills: number,
    updatedBills: number,
    totalPenaltiesUpdated: number,
    errors: []
  }
}
```

**Called By:**
- `waterDataService.buildYearData()` - Line 366 ✅
- **MISSING:** Should be called by `waterDataService.updateAggregatedDataAfterPayment()` ❌

**Calls:**
- `loadValidatedConfig(clientId)` - Load penalty configuration
- `calculatePenaltyForBill(billData, currentDate, billDueDate, config)` - For each bill

**Reads:**
- `clients/{clientId}/config/waterBills` - Configuration
- `clients/{clientId}/projects/waterBills/bills/{YYYY-MM}` - All bill documents

**Writes:**
- `clients/{clientId}/projects/waterBills/bills/{YYYY-MM}` - Updated penalties
  - `bills.units[unitId].penaltyAmount`
  - `bills.units[unitId].totalAmount`
  - `bills.units[unitId].lastPenaltyUpdate`

**Current Status:** ✅ WORKING when called by full rebuild, ❌ NOT CALLED by surgical update

**Performance:** ~1-2 seconds for AVII (10 units × 12 months)

**Code Flow:**
```javascript
async recalculatePenaltiesForClient(clientId, currentDate = getNow()) {
  // 1. Load and validate configuration
  const config = await this.loadValidatedConfig(clientId);
  
  // 2. Get all bill documents
  const billsSnapshot = await db.collection('clients')
    .doc(clientId)
    .collection('projects').doc('waterBills')
    .collection('bills')
    .get();
  
  // 3. Process each month's bills
  for (const billDoc of billsSnapshot.docs) {
    const billData = billDoc.data();
    
    // 4. Process each unit in the month
    for (const [unitId, unitData] of Object.entries(billData.bills.units)) {
      if (unitData.status === 'paid') continue;  // Skip paid bills
      
      // 5. Calculate penalty
      const penaltyResult = this.calculatePenaltyForBill(
        unitData, 
        currentDate, 
        billData.dueDate, 
        config
      );
      
      // 6. Update bill if penalty changed
      if (penaltyResult.updated) {
        unitData.penaltyAmount = penaltyResult.penaltyAmount;
        unitData.totalAmount = unitData.currentCharge + penaltyResult.penaltyAmount;
        unitData.lastPenaltyUpdate = penaltyResult.details.lastUpdate;
      }
    }
    
    // 7. Save updated bill document
    if (hasUpdates) {
      await billDoc.ref.set(billData, { merge: true });
    }
  }
  
  return { success: true, data: results };
}
```

---

### Function 2: calculatePenaltyForBill()

**File:** `backend/services/penaltyRecalculationService.js`  
**Lines:** 184-249  
**Purpose:** Calculate penalty for a single bill using compounding logic

**Signature:**
```javascript
calculatePenaltyForBill(billData, currentDate, billDueDate, config)
```

**Parameters:**
- `billData` (Object) - Unit's bill data from Firestore
- `currentDate` (Date) - Current date for calculation
- `billDueDate` (string) - Due date from bill document (ISO format)
- `config` (Object) - Water billing configuration with `penaltyRate` and `penaltyDays`

**Returns:**
```javascript
{
  penaltyAmount: number,        // Calculated penalty
  updated: boolean,             // Whether penalty changed
  details: {
    unpaidBalance: number,      // Base amount for penalty calc
    chargeAmount: number,       // Current charge
    penaltyRate: number,        // Rate from config (0.05)
    graceDays: number,          // Grace period from config (10)
    lastUpdate: string          // ISO timestamp
  }
}
```

**Called By:**
- `recalculatePenaltiesForClient()` - For each unpaid bill

**Calls:**
- `getMonthsDifference(startDate, endDate)` - Calculate months past grace period

**Reads:** Bill data passed as parameter

**Writes:** Returns calculated penalty (caller writes to Firestore)

**Current Status:** ✅ WORKING - calculation logic correct

**Penalty Calculation Logic:**
```javascript
// 1. Parse due date and calculate grace period end
const billDueDateObj = new Date(billDueDate);
const gracePeriodEnd = new Date(billDueDateObj);
gracePeriodEnd.setDate(billDueDateObj.getDate() + config.penaltyDays); // +10 days

// 2. Check if past grace period
const pastGracePeriod = currentDate > gracePeriodEnd;

// 3. Calculate overdue amount (unpaid principal without penalties)
const overdueAmount = Math.max(0, billData.currentCharge - billData.paidAmount);

// 4. If past grace and overdue, calculate compounding penalty
if (pastGracePeriod && overdueAmount > 0) {
  const monthsSinceGrace = this.getMonthsDifference(gracePeriodEnd, currentDate);
  
  // COMPOUNDING LOGIC:
  let runningTotal = overdueAmount;
  let totalPenalty = 0;
  
  for (let month = 1; month <= monthsSinceGrace; month++) {
    const monthlyPenalty = runningTotal × config.penaltyRate;  // 5%
    totalPenalty += monthlyPenalty;
    runningTotal += monthlyPenalty;  // Compound for next iteration
  }
  
  const expectedPenalty = Math.round(totalPenalty × 100) / 100;
  
  // Update if different
  if (Math.abs(result.penaltyAmount - expectedPenalty) > 0.01) {
    result.penaltyAmount = expectedPenalty;
    result.updated = true;
    result.details.lastUpdate = currentDate.toISOString();
  }
}

return result;
```

**Example Calculation:**
```
Bill: October 2025, Due: Oct 28, Grace End: Nov 7
Current Date: December 15, 2025
Overdue Amount: $350
Penalty Rate: 5% per month
Months Past Grace: 1 (Nov 7 → Dec 15 = 1 complete month)

Month 1: $350 × 5% = $17.50 penalty
Running Total: $367.50

Month 2: $367.50 × 5% = $18.38 penalty
Running Total: $385.88

Total Penalty: $17.50 + $18.38 = $35.88
```

---

### Function 3: scheduleMonthlyPenaltyRecalc()

**File:** `backend/services/penaltyRecalculationService.js`  
**Lines:** 268-311  
**Purpose:** Schedule penalty recalculation for all clients (should run on 11th of month)

**Signature:**
```javascript
async scheduleMonthlyPenaltyRecalc()
```

**Parameters:** None

**Returns:**
```javascript
[
  {
    clientId: string,
    success: boolean,
    data: { /* recalculation results */ }
  },
  // ... one entry per client
]
```

**Called By:** 
- **Scheduled job (MISSING)** - Should be called by cron/scheduler on 11th of month
- Manual admin trigger

**Calls:**
- `recalculatePenaltiesForClient(clientId, currentDate)` - For each client

**Reads:**
- All client documents
- Checks for waterBills project in each client

**Writes:** Via `recalculatePenaltiesForClient()`

**Current Status:** ⚠️ Function exists but NOT scheduled (no cron job)

**Note:** According to Michael, penalties should be calculated on 11th of month (grace period expires). This function exists but needs to be scheduled.

---

## Integration Functions

### Function 4: buildYearData()

**File:** `backend/services/waterDataService.js`  
**Lines:** 350-430  
**Purpose:** Build complete year data for water bills (full recalculation)

**Signature:**
```javascript
async buildYearData(clientId, year)
```

**Parameters:**
- `clientId` (string) - Client identifier
- `year` (number) - Fiscal year (e.g., 2026)

**Returns:**
```javascript
{
  fiscalYear: number,
  months: [],          // 12 months of data
  summary: {},         // Year totals
  _metadata: {}        // Timestamps
}
```

**Called By:**
- `waterBillsController.getYearData()` - Manual refresh button
- Initial data load for client

**Calls:**
- `penaltyRecalculationService.recalculatePenaltiesForClient(clientId)` - Line 366 ✅
- `buildMonthData(clientId, year, month)` - For each month (0-11)
- `calculateYearSummary(months)` - Aggregate totals

**Reads:**
- All data sources: readings, bills, units, config
- **After** penalty recalculation updates bills

**Writes:**
- `clients/{clientId}/projects/waterBills/bills/aggregatedData`

**Current Status:** ✅ WORKING - Penalties calculated correctly

**Critical Section (Lines 362-371):**
```javascript
// CRITICAL: Run penalty recalculation before building year data
console.log(`🔄 Running penalty recalculation for client ${clientId}...`);
try {
  await penaltyRecalculationService.recalculatePenaltiesForClient(clientId);
  console.log(`✅ Penalty recalculation completed for ${clientId}`);
} catch (error) {
  console.error(`❌ Penalty recalculation failed:`, error);
  // Continue with data building even if penalty recalculation fails
}
```

**Performance:** ~8-10 seconds (including 1-2s for penalty recalc)

---

### Function 5: updateAggregatedDataAfterPayment()

**File:** `backend/services/waterDataService.js`  
**Lines:** 510-580  
**Purpose:** Surgical update of aggregatedData after payment (fast path)

**Signature:**
```javascript
async updateAggregatedDataAfterPayment(clientId, year, affectedUnitsAndMonths)
```

**Parameters:**
- `clientId` (string) - Client identifier
- `year` (number) - Fiscal year
- `affectedUnitsAndMonths` (Array) - Array of `{unitId, monthId}` objects

**Returns:** void (updates Firestore document)

**Called By:**
- `waterPaymentsService.recordPayment()` - Line 472 (after payment success)

**Calls:**
- `buildSingleUnitData(clientId, year, month, unitId, existingUnitData)` - For each affected unit
- `calculateYearSummary(months)` - Recalculate totals
- **MISSING:** Should call `penaltyRecalculationService.recalculatePenaltiesForClient()` ❌

**Reads:**
- `clients/{clientId}/projects/waterBills/bills/aggregatedData` - Existing data
- Bill documents (for payment status only)

**Writes:**
- `clients/{clientId}/projects/waterBills/bills/aggregatedData` - Updated data

**Current Status:** ❌ BROKEN - Does not recalculate penalties

**Problem Code:**
```javascript
async updateAggregatedDataAfterPayment(clientId, year, affectedUnitsAndMonths) {
  // ❌ MISSING: Should call penalty recalculation HERE
  // await penaltyRecalculationService.recalculatePenaltiesForClient(clientId);
  
  const data = doc.data();
  
  for (const { unitId, monthId } of affectedUnitsAndMonths) {
    const month = parseInt(monthId.split('-')[1]);
    
    // Uses fast path with existing data (including old penalties)
    const existingUnitData = data.months[month].units[unitId];
    const updatedUnitData = await this.buildSingleUnitData(
      clientId, year, month, unitId, 
      existingUnitData  // ← Passes old penalty data
    );
    
    data.months[month].units[unitId] = updatedUnitData;
  }
  
  // Write back to Firestore
  await aggregatedDataRef.set(data);
}
```

**Performance:** 503-728ms (94% faster than full recalc, but incorrect data)

---

### Function 6: buildSingleUnitData()

**File:** `backend/services/waterDataService.js`  
**Lines:** 177-259  
**Purpose:** Calculate or update data for a single unit (surgical optimization)

**Signature:**
```javascript
async buildSingleUnitData(clientId, year, month, unitId, existingUnitData = null)
```

**Parameters:**
- `clientId` (string)
- `year` (number)
- `month` (number) - 0-based month (0=July)
- `unitId` (string)
- `existingUnitData` (Object | null) - If provided, uses fast path

**Returns:** Unit data object with all fields

**Called By:**
- `updateAggregatedDataAfterPayment()` - With `existingUnitData` (fast path)
- Other callers - Without `existingUnitData` (full calculation)

**Calls:**
- `fetchBills()` - Get bill data
- `fetchReadings()` - Only if full calculation (no existingUnitData)
- `_calculateUnpaidCarryover()` - Only if full calculation
- `_calculateUnitData()` - Only if full calculation

**Reads:**
- Bill documents (always)
- Readings documents (only if full calculation)

**Writes:** Returns data (caller writes to Firestore)

**Current Status:** ⚠️ Fast path optimization skips penalty updates

**Fast Path Code (Lines 186-208):**
```javascript
if (existingUnitData) {
  console.log(`⚡ [SURGICAL] Using existing unit data, fetching only updated bill`);
  const bills = await this.fetchBills(clientId, year, month);
  const bill = bills?.bills?.units?.[unitId];
  
  if (!bill) {
    return existingUnitData;  // Return unchanged
  }
  
  // ❌ PROBLEM: Update only payment-related fields
  return {
    ...existingUnitData,  // ← Spreads OLD penalty data
    paidAmount: bill.paidAmount || 0,
    unpaidAmount: bill.totalAmount - (bill.paidAmount || 0),
    status: this.calculateStatus(bill),
    transactionId: bill.payments?.[bill.payments.length - 1]?.transactionId,
    payments: bill.payments || []
    // ❌ penaltyAmount from existingUnitData (OLD VALUE)
  };
}
```

**Should Be:**
```javascript
if (existingUnitData) {
  const bills = await this.fetchBills(clientId, year, month);
  const bill = bills?.bills?.units?.[unitId];
  
  return {
    ...existingUnitData,
    // ✅ ADD: Update penalty fields from fresh bill data
    penaltyAmount: bill.penaltyAmount || 0,
    totalAmount: bill.totalAmount,
    paidAmount: bill.paidAmount || 0,
    unpaidAmount: bill.totalAmount - (bill.paidAmount || 0),
    status: this.calculateStatus(bill),
    transactionId: bill.payments?.[bill.payments.length - 1]?.transactionId,
    payments: bill.payments || []
  };
}
```

**Performance:**
- Fast path: ~150ms per unit
- Full calculation: ~600ms per unit

---

## Helper Functions

### Function 7: loadValidatedConfig()

**File:** `backend/services/penaltyRecalculationService.js`  
**Lines:** 15-43  
**Purpose:** Load and validate water billing configuration

**Signature:**
```javascript
async loadValidatedConfig(clientId)
```

**Parameters:**
- `clientId` (string)

**Returns:** Validated config object or throws error

**Called By:**
- `recalculatePenaltiesForClient()` - Before penalty calculation

**Validates:**
- `penaltyRate` must be positive number
- `penaltyDays` must be positive number

**Throws:** Error if config missing or invalid

---

### Function 8: getMonthsDifference()

**File:** `backend/services/penaltyRecalculationService.js`  
**Lines:** 257-261  
**Purpose:** Calculate complete months between two dates

**Signature:**
```javascript
getMonthsDifference(startDate, endDate)
```

**Logic:**
```javascript
const months = (endDate.getFullYear() - startDate.getFullYear()) × 12 + 
               (endDate.getMonth() - startDate.getMonth());
return Math.max(0, months);
```

**Note:** Returns complete months only (partial months don't count)

---

### Function 9: calculateStatus()

**File:** `backend/services/waterDataService.js`  
**Lines:** Not shown in investigation (helper function)  
**Purpose:** Determine bill status based on payment

**Logic:**
```javascript
if (paidAmount >= totalAmount) return 'paid';
if (paidAmount > 0) return 'partial';
return 'unpaid';
```

**Note:** Does NOT check for "overdue" status (missing feature)

---

### Function 10: calculateYearSummary()

**File:** `backend/services/waterDataService.js`  
**Lines:** Not fully investigated  
**Purpose:** Aggregate monthly data into year totals

**Calculates:**
- `totalConsumption` - Sum of all month consumptions
- `totalCharge` - Sum of all month charges
- `totalPenalties` - ❌ Sum of all penalties (currently $0)
- `totalPaid` - Sum of all payments
- `totalUnpaid` - Sum of all unpaid amounts
- `totalRevenue` - Total charges + penalties

**Called By:**
- `buildYearData()` - After all months built
- `updateAggregatedDataAfterPayment()` - After surgical update

---

## Configuration Functions

### Water Bills Configuration

**Path:** `clients/{clientId}/config/waterBills`

**Structure:**
```javascript
{
  penaltyRate: 0.05,      // 5% per month
  penaltyDays: 10,        // Grace period days
  ratePerM3: 7000,        // 70 pesos per m³ (centavos)
  billingDay: 28          // Bills due on 28th
}
```

**Accessed By:**
- `penaltyRecalculationService.loadValidatedConfig()` - Penalty calculation
- `waterDataService.getClientConfig()` - Data building

**Defaults:**
- Grace Period: 10 days
- Penalty Rate: 5% per month (compounding)
- Billing Due Date: 28th of each month

---

## Call Hierarchy

### Full Rebuild Flow
```
waterBillsController.getYearData()
  └─> waterDataService.buildYearData()
      ├─> penaltyRecalculationService.recalculatePenaltiesForClient() ✅
      │   ├─> loadValidatedConfig()
      │   └─> calculatePenaltyForBill() [for each bill]
      │       └─> getMonthsDifference()
      │
      └─> buildMonthData() [for each month]
          └─> Reads updated penalties from bills ✅
```

### Surgical Update Flow (Current - Broken)
```
waterPaymentsService.recordPayment()
  └─> waterDataService.updateAggregatedDataAfterPayment()
      ├─> ❌ MISSING: penaltyRecalculationService.recalculatePenaltiesForClient()
      │
      └─> buildSingleUnitData(existingUnitData)
          └─> Fast path: Spreads old penalty data ❌
```

### Surgical Update Flow (Proposed Fix)
```
waterPaymentsService.recordPayment()
  └─> waterDataService.updateAggregatedDataAfterPayment()
      ├─> ✅ ADD: penaltyRecalculationService.recalculatePenaltiesForClient()
      │   └─> calculatePenaltyForBill() [updates bills]
      │
      └─> buildSingleUnitData(existingUnitData)
          └─> Fast path: Now reads fresh penalty data ✅
```

---

## File Summary

| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `penaltyRecalculationService.js` | 383 | Main penalty calculation service | ✅ Working |
| `waterDataService.js` | 1358+ | Data aggregation and caching | ⚠️ Missing penalty recalc call |
| `waterPaymentsService.js` | 806 | Payment processing | ✅ Triggers surgical update |
| `waterBillsService.js` | ~600 | Bill management | ✅ Working |
| `waterBillsController.js` | ~200 | API endpoints | ✅ Working |

---

## Missing Integrations

### 1. Scheduled Penalty Recalculation
**Status:** ❌ NOT IMPLEMENTED  
**Required:** Cron job to call `scheduleMonthlyPenaltyRecalc()` on 11th of each month  
**Priority:** HIGH - Per Michael's requirements

### 2. Surgical Update Penalty Recalc
**Status:** ❌ NOT IMPLEMENTED  
**Required:** Add penalty recalc call to `updateAggregatedDataAfterPayment()`  
**Priority:** CRITICAL - Current blocker for Phase 1

### 3. Cascade Delete Penalty Recalc
**Status:** ⚠️ ATTEMPTED (Oct 14) but task blocked  
**Required:** Trigger penalty recalc after transaction deletion  
**Priority:** HIGH - Part of Priority 1B

---

**Document Version:** 1.0  
**Last Updated:** October 15, 2025  
**Next Steps:** Create Gap Analysis and Integration Points documents


