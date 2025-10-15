# Phase 1: Penalty Data Structures Map

**Investigation Date:** October 15, 2025  
**Agent:** Agent_Water_Investigation_Phase_1  
**Purpose:** Document where penalty data is stored and how it flows through the system

---

## Overview

Penalty data flows through three main storage locations:
1. **Water Bills Config** - Penalty rules (rate, grace period)
2. **Bill Documents** - Source of truth for calculated penalties
3. **aggregatedData** - Cache for UI display

---

## A. Bill Document Structure

### Firestore Path
```
clients/AVII/projects/waterBills/bills/{YYYY-MM}
```

### Document Structure (BEFORE Penalty Calculation)

```javascript
{
  // Document ID: "2026-03" (October 2025 in fiscal year)
  dueDate: "2025-10-28",  // Bills due 28th of billing month
  
  bills: {
    units: {
      "203": {
        // Base bill fields
        currentCharge: 350,        // Water consumption charge
        consumption: 5,            // m³ consumed
        currentReading: 125,       // Current meter reading
        previousReading: 120,      // Prior month reading
        
        // PENALTY FIELDS - BEFORE calculation
        penaltyAmount: 0,          // ❌ Not calculated yet
        totalAmount: 350,          // ❌ Missing penalty component
        lastPenaltyUpdate: null,   // ❌ Never updated
        
        // Payment fields
        paidAmount: 0,
        status: "unpaid",
        payments: []
      }
    }
  }
}
```

### Document Structure (AFTER Penalty Calculation)

```javascript
{
  dueDate: "2025-10-28",
  
  bills: {
    units: {
      "203": {
        // Base bill fields (unchanged)
        currentCharge: 350,
        consumption: 5,
        currentReading: 125,
        previousReading: 120,
        
        // PENALTY FIELDS - AFTER calculation ✅
        penaltyAmount: 49.98,                      // ✅ 5% compounded over 2 months
        totalAmount: 399.98,                       // ✅ 350 + 49.98
        lastPenaltyUpdate: "2025-10-15T10:30:00Z", // ✅ Timestamp of calculation
        
        // Payment fields
        paidAmount: 0,
        status: "unpaid",
        payments: []
      }
    }
  }
}
```

### Document Structure (AFTER Payment)

```javascript
{
  dueDate: "2025-10-28",
  
  bills: {
    units: {
      "203": {
        // Base bill fields
        currentCharge: 350,
        consumption: 5,
        currentReading: 125,
        previousReading: 120,
        
        // PENALTY FIELDS - Should be recalculated but aren't
        penaltyAmount: 49.98,      // ⚠️ STALE - not recalculated after payment
        totalAmount: 399.98,       // ⚠️ STALE
        lastPenaltyUpdate: "2025-10-15T10:30:00Z",  // ⚠️ OLD timestamp
        
        // Payment fields - UPDATED ✅
        paidAmount: 399.98,        // ✅ Full payment recorded
        status: "paid",            // ✅ Status updated
        payments: [
          {
            transactionId: "2025-10-15_123456_789",
            amount: 399.98,
            date: "2025-10-15",
            baseChargePaid: 350,
            penaltyPaid: 49.98
          }
        ]
      }
    }
  }
}
```

**Current Problem:**
- After payment, `penaltyAmount` should be recalculated (might now be $0 if fully paid)
- But penalty recalculation isn't triggered by surgical update
- Bill documents keep old penalty values

---

## B. aggregatedData Structure

### Firestore Path
```
clients/AVII/projects/waterBills/bills/aggregatedData
```

### Top-Level Document Structure

```javascript
{
  // Fiscal Year as top-level key
  "2026": {
    // Metadata
    _metadata: {
      lastCalculated: Timestamp("2025-10-11T04:41:34.116Z"),  // ⚠️ STATIC - never updates
      calculationTimestamp: 1728618094116,                     // ⚠️ STATIC
      calculatedBy: "waterDataService.buildYearData",
      fiscalYear: 2026
    },
    
    // Month-by-month data array
    months: [
      // Month 0 (July)
      {
        month: 0,
        monthName: "July",
        billingPeriod: "2026-00",
        
        units: {
          "203": {
            // Consumption data
            consumption: 5,
            currentReading: 125,
            previousReading: 120,
            
            // Billing data
            currentCharge: 350,
            
            // PENALTY DATA - Copied from bill document
            penaltyAmount: 0,      // ❌ Shows $0 even when bill has penalties
            
            // Totals
            totalAmount: 350,      // ❌ Missing penalty component
            
            // Payment status
            paidAmount: 0,
            unpaidAmount: 350,     // ❌ Wrong - doesn't include penalties
            status: "unpaid",
            
            // Transaction linking
            transactionId: null,
            payments: []
          },
          
          "204": { /* ... */ },
          "205": { /* ... */ }
          // ... all 10 units
        },
        
        // Month summary
        totalConsumption: 50,
        totalCharge: 3500,
        totalPenalties: 0,     // ❌ Should show sum of all unit penalties
        totalPaid: 0,
        totalUnpaid: 3500
      },
      
      // Months 1-11 (August - June)
      { /* ... */ }
    ],
    
    // Year summary
    summary: {
      totalConsumption: 600,
      totalCharge: 42000,
      totalPenalties: 0,        // ❌ Should show year-to-date penalties
      totalPaid: 15000,
      totalUnpaid: 27000,
      totalRevenue: 42000
    }
  }
}
```

### Expected vs Actual State (Unit 203, October 2025)

#### Expected (If Penalties Working)
```javascript
{
  month: 3,  // October
  monthName: "October",
  units: {
    "203": {
      // Base charges
      currentCharge: 350,
      consumption: 5,
      
      // PENALTIES - Should show calculated amount
      penaltyAmount: 49.98,      // ✅ 5% compounded over 2 months
      
      // Totals
      totalAmount: 399.98,       // ✅ 350 + 49.98
      unpaidAmount: 399.98,      // ✅ Includes penalty
      
      // Status
      status: "overdue",         // ✅ Past grace period
      
      // Transaction data
      transactionId: null,
      payments: []
    }
  }
}
```

#### Actual (Current Broken State)
```javascript
{
  month: 3,  // October
  monthName: "October",
  units: {
    "203": {
      // Base charges
      currentCharge: 350,
      consumption: 5,
      
      // PENALTIES - Showing $0 incorrectly
      penaltyAmount: 0,          // ❌ Should be 49.98
      
      // Totals
      totalAmount: 350,          // ❌ Should be 399.98
      unpaidAmount: 350,         // ❌ Should be 399.98
      
      // Status
      status: "unpaid",          // ⚠️ Should be "overdue"
      
      // Transaction data
      transactionId: null,
      payments: []
    }
  }
}
```

---

## C. Water Bills Configuration

### Firestore Path
```
clients/AVII/config/waterBills
```

### Configuration Document
```javascript
{
  // Penalty configuration
  penaltyRate: 0.05,         // 5% per month (compounding)
  penaltyDays: 10,           // Grace period: 10 days after due date
  
  // Billing rates
  ratePerM3: 7000,           // 70 pesos per m³ (stored as centavos)
  rateCarWash: 100,          // 100 pesos per car wash
  rateBoatWash: 200,         // 200 pesos per boat wash
  
  // Other config
  billingDay: 28,            // Bills due on 28th of month
  fiscalYearStart: 7         // July (month 7)
}
```

### How Configuration is Used

#### By Penalty Recalculation Service
```javascript
// penaltyRecalculationService.js - Line 58
const config = await this.loadValidatedConfig(clientId);

// Calculate grace period end
const gracePeriodEnd = billDueDate + config.penaltyDays;  // +10 days

// Calculate monthly penalty
const monthlyPenalty = overdueAmount × config.penaltyRate;  // 5%
```

#### Validation Requirements
```javascript
// Must have:
- penaltyRate: positive number (e.g., 0.05)
- penaltyDays: positive number (e.g., 10)

// Error if missing or invalid
if (typeof config.penaltyRate !== 'number' || config.penaltyRate <= 0) {
  throw new Error('penaltyRate must be a positive number');
}
```

---

## D. Synchronization Analysis

### Data Flow: Full Rebuild (Working ✅)

```
1. penaltyRecalculationService.recalculatePenaltiesForClient()
   └─> Reads: Water Bills Config
   └─> Reads: All Bill Documents
   └─> Calculates: Penalty for each unpaid bill
   └─> Writes: Bill Documents with updated penalties
        ↓
2. waterDataService.buildYearData()
   └─> Reads: Bill Documents (with fresh penalties) ✅
   └─> Builds: Month data for each month
   └─> Writes: aggregatedData with correct penalties ✅
        ↓
3. Frontend displays aggregatedData
   └─> Shows: Correct penalty amounts ✅
```

### Data Flow: Surgical Update (Broken ❌)

```
1. waterPaymentsService.recordPayment()
   └─> Writes: Bill Documents (payment data only)
   └─> ❌ MISSING: Penalty recalculation NOT triggered
        ↓
2. waterDataService.updateAggregatedDataAfterPayment()
   └─> Reads: aggregatedData (existing data)
   └─> Reads: Bill Documents (for payment status only)
   └─> ❌ PROBLEM: Uses fast path, spreads old penalty data
   └─> Writes: aggregatedData with STALE penalties ❌
        ↓
3. Frontend displays aggregatedData
   └─> Shows: $0 penalties (stale data) ❌
```

### Source of Truth

**Which is the authoritative source?**

| Data | Source of Truth | Cache |
|------|----------------|-------|
| **Penalty calculations** | Bill Documents | aggregatedData |
| **Payment status** | Bill Documents | aggregatedData |
| **Consumption** | Readings Documents | aggregatedData |
| **Billing rates** | Water Bills Config | N/A |

**Synchronization Rules:**
1. Bill Documents are written by penalty recalculation service
2. aggregatedData is built FROM Bill Documents
3. aggregatedData should NEVER be more current than Bill Documents
4. **Problem:** Surgical update copies stale data without refreshing source

---

## E. Field-Level Mapping

### Penalty-Related Fields

| Field Name | Bill Document | aggregatedData | Source | Updated By |
|------------|---------------|----------------|--------|------------|
| `penaltyAmount` | ✅ | ✅ | Calculated | penaltyRecalculationService |
| `totalAmount` | ✅ | ✅ | currentCharge + penaltyAmount | penaltyRecalculationService |
| `lastPenaltyUpdate` | ✅ | ❌ | Timestamp | penaltyRecalculationService |
| `penaltyRate` | ❌ | ❌ | Config only | Manual config |
| `penaltyDays` | ❌ | ❌ | Config only | Manual config |

### Payment-Related Fields

| Field Name | Bill Document | aggregatedData | Source | Updated By |
|------------|---------------|----------------|--------|------------|
| `paidAmount` | ✅ | ✅ | Payment records | waterPaymentsService |
| `unpaidAmount` | ✅ | ✅ | totalAmount - paidAmount | Calculated |
| `status` | ✅ | ✅ | Payment state | calculateStatus() |
| `payments` | ✅ | ✅ | Transaction history | waterPaymentsService |
| `transactionId` | ✅ | ✅ | Last payment | waterPaymentsService |

### Fields Updated by Surgical Update

**Currently Updated (Working):**
- `paidAmount` ✅
- `unpaidAmount` ✅
- `status` ✅
- `transactionId` ✅
- `payments` ✅

**NOT Updated (Broken):**
- `penaltyAmount` ❌ (copied from old data)
- `totalAmount` ❌ (copied from old data)
- `lastPenaltyUpdate` ❌ (not in aggregatedData)

---

## F. Data Consistency Issues

### Issue 1: Stale Penalties in aggregatedData

**Symptom:**
- All units show `penaltyAmount: 0` in aggregatedData
- Bill Documents also show `penaltyAmount: 0`
- Bills are overdue and past grace period

**Root Cause:**
- Penalty recalculation never called after payments
- Surgical update copies old penalty data
- No timestamp validation for penalty freshness

**Evidence:**
```javascript
// aggregatedData shows:
{
  "203": {
    penaltyAmount: 0,       // ❌ Wrong
    totalAmount: 350,       // ❌ Missing penalties
    status: "unpaid"        // ⚠️ Should be "overdue"
  }
}

// Bill document shows same:
{
  bills: {
    units: {
      "203": {
        penaltyAmount: 0,   // ❌ Not calculated
        lastPenaltyUpdate: null  // ❌ Never updated
      }
    }
  }
}
```

### Issue 2: Static Timestamps

**Symptom:**
- `_metadata.lastCalculated` shows old date
- `_metadata.calculationTimestamp` never updates
- Cannot tell if penalties are fresh or stale

**Current Value:**
```javascript
_metadata: {
  lastCalculated: "2025-10-11T04:41:34.116Z",  // 4 days old
  calculationTimestamp: 1728618094116
}
```

**Problem:**
- Timestamp updated only on full rebuild
- Surgical update doesn't update timestamp
- No way to validate penalty freshness

### Issue 3: Fast Path Optimization Trade-off

**Design Decision:**
- Fast path reuses existing data for 94% performance improvement
- Trade-off: Doesn't recalculate derived fields like penalties
- Originally assumed penalties rarely change
- Reality: Penalties should update after every payment

**Fast Path Code:**
```javascript
if (existingUnitData) {
  // Optimization: Reuse everything except payment fields
  return {
    ...existingUnitData,  // ← Includes old penaltyAmount
    paidAmount: bill.paidAmount,
    status: calculateStatus(bill)
  };
}
```

**Should Be:**
```javascript
if (existingUnitData && penaltiesAreFresh) {
  // Only use fast path if penalties don't need recalc
  return { ...existingUnitData, /* updated fields */ };
} else {
  // Force full recalc including penalties
  return fullCalculation();
}
```

---

## G. Integration with Split Transactions

### Penalty Allocations (Priority 1)

**Transaction Structure:**
```javascript
{
  transactionId: "2025-10-15_123456_789",
  amount: 39998,  // cents (399.98 pesos)
  
  allocations: [
    {
      id: "alloc_001",
      categoryName: "Water Consumption",
      amount: 35000,  // cents (350 pesos) - Base charge
      data: {
        unitId: "203",
        billId: "2026-03",
        billType: "base_charge"
      }
    },
    {
      id: "alloc_002",
      categoryName: "Water Penalties",
      amount: 4998,   // cents (49.98 pesos) - Penalty
      data: {
        unitId: "203",
        billId: "2026-03",
        billType: "penalty"
      }
    }
  ]
}
```

**Dependency on Phase 1:**
- Split allocations need correct `penaltyAmount` from bill
- Currently getting $0 from stale data
- Results in transactions showing $0 penalty allocations

---

## H. Recommendations

### 1. Add Penalty Recalc to Surgical Update
```javascript
async updateAggregatedDataAfterPayment(clientId, year, affectedUnitsAndMonths) {
  // ✅ ADD: Recalculate penalties before surgical update
  await penaltyRecalculationService.recalculatePenaltiesForClient(clientId);
  
  // Then proceed with existing logic...
}
```

### 2. Update Timestamps on Surgical Update
```javascript
data._metadata.lastCalculated = admin.firestore.FieldValue.serverTimestamp();
data._metadata.calculationTimestamp = Date.now();
data._metadata.lastSurgicalUpdate = Date.now();
```

### 3. Add Penalty Freshness Check
```javascript
function shouldRecalculatePenalties(lastUpdate, gracePeriod) {
  if (!lastUpdate) return true;  // Never calculated
  
  const hoursSinceUpdate = (Date.now() - lastUpdate) / 3600000;
  return hoursSinceUpdate > 24;  // Recalc if older than 24 hours
}
```

### 4. Validate Data Consistency
```javascript
// After surgical update, verify penalties match
const billPenalty = bill.penaltyAmount;
const aggPenalty = aggregatedData.months[M].units[unitId].penaltyAmount;

if (Math.abs(billPenalty - aggPenalty) > 0.01) {
  console.error('Penalty mismatch:', { billPenalty, aggPenalty });
  // Trigger full recalculation
}
```

---

**Document Version:** 1.0  
**Last Updated:** October 15, 2025  
**Next Steps:** Review with Manager Agent, plan fix implementation


