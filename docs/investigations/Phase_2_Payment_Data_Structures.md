# Phase 2: Payment Data Structures Map

**Investigation Date:** October 15, 2025  
**Agent:** Agent_Water_Investigation_Phase_2  
**Purpose:** Document all data structures involved in payment cascade

---

## Overview

Payment cascade touches 4 main Firestore collections:
1. **Bill Documents** - Individual bill records with payment tracking
2. **Transaction Documents** - Accounting records with split allocations
3. **HOA Dues Documents** - Credit balance integration
4. **AggregatedData Documents** - Calculated summary data for UI

---

## 1. Bill Document Structure

### Firestore Path
```
clients/{clientId}/projects/waterBills/bills/{billId}
```

### Document ID Format
```
{fiscalYear}-{fiscalMonth}
Example: "2026-00" = July 2025 (FY 2026, Month 0)
Example: "2026-03" = October 2025 (FY 2026, Month 3)
```

### Document Structure - BEFORE Payment

```javascript
{
  "bills": {
    "units": {
      "203": {
        // Basic Bill Info
        "currentCharge": 350.00,        // Base water charge
        "penalties": 49.98,              // DEPRECATED - use penaltyAmount
        "penaltyAmount": 49.98,          // Stored penalty (from recalc)
        "totalAmount": 399.98,           // currentCharge + penaltyAmount
        
        // Payment Tracking
        "paidAmount": 0,                 // Total paid so far
        "basePaid": 0,                   // Amount paid toward base
        "penaltyPaid": 0,                // Amount paid toward penalties
        "status": "unpaid",              // Status: unpaid | partial | paid
        
        // Payment History
        "payments": [],                  // Array of payment entries
        
        // Consumption Data
        "consumption": 18,               // m³ used
        "previousReading": 1234,
        "currentReading": 1252,
        
        // Washes
        "carWashCount": 1,
        "boatWashCount": 0,
        "carWashCharge": 50.00,
        "boatWashCharge": 0,
        "washCharges": 50.00,
        
        // Dates
        "dueDate": "2025-08-15",
        "readingDate": "2025-07-28T10:30:00.000Z",
        "lastPenaltyUpdate": "2025-10-01T08:00:00.000Z",
        
        // Metadata
        "billNotes": "Water Consumption for Jul 2025 - 0018 m³, 1 Car wash",
        "generatedAt": "2025-07-28T10:35:00.000Z"
      }
    }
  },
  "metadata": {
    "fiscalYear": 2026,
    "fiscalMonth": 0,
    "calendarMonth": 7,
    "calendarYear": 2025,
    "generatedAt": "2025-07-28T10:35:00.000Z"
  }
}
```

### Document Structure - AFTER Full Payment ($399.98)

```javascript
{
  "bills": {
    "units": {
      "203": {
        // Basic Bill Info (unchanged)
        "currentCharge": 350.00,
        "penaltyAmount": 49.98,
        "totalAmount": 399.98,
        
        // Payment Tracking (UPDATED)
        "paidAmount": 399.98,            // ← Updated from 0
        "basePaid": 350.00,              // ← Updated from 0
        "penaltyPaid": 49.98,            // ← Updated from 0
        "status": "paid",                // ← Changed from "unpaid"
        
        // Payment History (UPDATED)
        "payments": [
          {
            "amount": 399.98,            // Payment amount
            "baseChargePaid": 350.00,    // Split: base
            "penaltyPaid": 49.98,        // Split: penalty
            "date": "2025-10-15",        // Payment date
            "method": "eTransfer",       // Payment method
            "reference": "",             // Reference number
            "transactionId": "2025-10-15_105634_123",  // ← Links to transaction
            "recordedAt": "2025-10-15T17:56:34.567Z"
          }
        ],
        
        // Consumption Data (unchanged)
        "consumption": 18,
        // ... rest unchanged
      }
    }
  }
}
```

### Document Structure - AFTER Partial Payment ($200)

```javascript
{
  "bills": {
    "units": {
      "203": {
        // Basic Bill Info (unchanged)
        "currentCharge": 350.00,
        "penaltyAmount": 49.98,
        "totalAmount": 399.98,
        
        // Payment Tracking (UPDATED)
        "paidAmount": 200.00,            // ← Partial payment
        "basePaid": 200.00,              // ← All to base (priority)
        "penaltyPaid": 0.00,             // ← None to penalties yet
        "status": "partial",             // ← Partial status
        
        // Payment History (UPDATED)
        "payments": [
          {
            "amount": 200.00,
            "baseChargePaid": 200.00,    // All to base
            "penaltyPaid": 0.00,         // None to penalties
            "date": "2025-10-15",
            "method": "eTransfer",
            "reference": "",
            "transactionId": "2025-10-15_105634_123",
            "recordedAt": "2025-10-15T17:56:34.567Z"
          }
        ],
        
        // Still Due:
        // - Base: $350 - $200 = $150
        // - Penalties: $49.98 - $0 = $49.98
        // - Total: $199.98
      }
    }
  }
}
```

### Key Fields for Payment Cascade

| Field | Type | Purpose | Updated By |
|-------|------|---------|------------|
| `currentCharge` | Number | Base water charge | Bill generation |
| `penaltyAmount` | Number | Stored penalty | Penalty recalc |
| `totalAmount` | Number | currentCharge + penaltyAmount | Bill generation |
| `paidAmount` | Number | Total paid | Payment service |
| `basePaid` | Number | Amount toward base | Payment service |
| `penaltyPaid` | Number | Amount toward penalties | Payment service |
| `status` | String | unpaid/partial/paid | Payment service |
| `payments[]` | Array | Payment history | Payment service |

---

## 2. Transaction Document Structure

### Firestore Path
```
clients/{clientId}/transactions/{transactionId}
```

### Document ID Format
```
{YYYY}-{MM}-{DD}_{HHMMSS}_{RANDOM}
Example: "2025-10-15_105634_123"
```

### Transaction Structure - Water Bills Payment (Split)

```javascript
{
  // Transaction Identity
  "transactionId": "2025-10-15_105634_123",
  "date": "2025-10-15",
  "timestamp": "2025-10-15T17:56:34.567Z",
  
  // Transaction Type
  "type": "income",                    // Always "income" for payments
  "categoryId": "-split-",             // "-split-" for multiple allocations
  "categoryName": "-Split-",           // Display name
  
  // Amount (in cents)
  "amount": 39998,                     // $399.98 in cents
  
  // Description
  "description": "Water Bill Payment - Water Consumption for Jul 2025 - 0018 m³, 1 Car wash",
  
  // Unit Context
  "unitId": "203",
  "clientId": "AVII",
  
  // Account Info
  "accountId": "acc_scotiabank_001",
  "accountType": "bank",
  
  // Payment Method
  "paymentMethod": "eTransfer",
  "paymentMethodId": "pm_etransfer_001",
  "reference": "",
  
  // Notes
  "notes": "Water bill payment for Unit 203 - Water Consumption for Jul 2025 - 0018 m³, 1 Car wash - $350.00 charges + $49.98 penalties",
  
  // Fiscal Info
  "fiscalYear": 2026,
  
  // CRITICAL: Allocations Array (Split Transaction)
  "allocations": [
    {
      "id": "alloc_001",
      "type": "water_bill",
      "targetId": "bill_2026-00",
      "targetName": "2026-00 - Unit 203",
      "amount": 35000,               // $350.00 in cents
      "percentage": null,
      "categoryName": "Water Consumption",
      "categoryId": "water-consumption",
      "data": {
        "unitId": "203",
        "billId": "2026-00",
        "billPeriod": "2026-00",
        "billType": "base_charge"
      },
      "metadata": {
        "processingStrategy": "water_bills",
        "cleanupRequired": true,
        "auditRequired": true,
        "createdAt": "2025-10-15T17:56:34.567Z"
      }
    },
    {
      "id": "alloc_002",
      "type": "water_penalty",
      "targetId": "penalty_2026-00",
      "targetName": "2026-00 Penalties - Unit 203",
      "amount": 4998,                // $49.98 in cents
      "percentage": null,
      "categoryName": "Water Penalties",
      "categoryId": "water-penalties",
      "data": {
        "unitId": "203",
        "billId": "2026-00",
        "billPeriod": "2026-00",
        "billType": "penalty"
      },
      "metadata": {
        "processingStrategy": "water_bills",
        "cleanupRequired": true,
        "auditRequired": true,
        "createdAt": "2025-10-15T17:56:34.567Z"
      }
    }
  ],
  
  // Allocation Summary (validation)
  "allocationSummary": {
    "totalAllocated": 39998,         // Sum of allocations (cents)
    "allocationCount": 2,            // Number of allocations
    "allocationType": "water_bill",
    "hasMultipleTypes": true,        // Has both base and penalty
    "integrityCheck": {
      "expectedTotal": 39998,
      "actualTotal": 39998,
      "isValid": true                // Within 1 peso tolerance
    }
  },
  
  // Metadata (optional)
  "metadata": {
    "billPayments": [
      {
        "period": "2026-00",
        "amountPaid": 399.98,
        "baseChargePaid": 350.00,
        "penaltyPaid": 49.98
      }
    ],
    "totalBaseCharges": 350.00,
    "totalPenalties": 49.98,
    "paymentType": "bills_and_credit"
  },
  
  // Audit Fields
  "createdBy": "michael@landesman.com",
  "createdAt": "2025-10-15T17:56:34.567Z",
  "modifiedBy": null,
  "modifiedAt": null
}
```

### Transaction Structure - Multi-Bill Payment (4 Bills)

```javascript
{
  "transactionId": "2025-10-15_195608_056",
  "amount": 210000,                  // $2100.00 in cents
  "type": "income",
  "categoryId": "-split-",           // Multiple allocations
  "categoryName": "-Split-",
  "description": "Water Bill Payment - Unit 103",
  "unitId": "103",
  
  // 8 Allocations: 4 bills × 2 (base + penalty each)
  "allocations": [
    // July Bill
    {
      "id": "alloc_001",
      "type": "water_bill",
      "targetId": "bill_2026-00",
      "amount": 35000,               // July base: $350
      "categoryName": "Water Consumption",
      "data": { "billId": "2026-00", "billType": "base_charge" }
    },
    {
      "id": "alloc_002",
      "type": "water_penalty",
      "targetId": "penalty_2026-00",
      "amount": 4998,                // July penalty: $49.98
      "categoryName": "Water Penalties",
      "data": { "billId": "2026-00", "billType": "penalty" }
    },
    
    // August Bill
    {
      "id": "alloc_003",
      "type": "water_bill",
      "targetId": "bill_2026-01",
      "amount": 35000,               // Aug base: $350
      "categoryName": "Water Consumption",
      "data": { "billId": "2026-01", "billType": "base_charge" }
    },
    {
      "id": "alloc_004",
      "type": "water_penalty",
      "targetId": "penalty_2026-01",
      "amount": 4998,                // Aug penalty: $49.98
      "categoryName": "Water Penalties",
      "data": { "billId": "2026-01", "billType": "penalty" }
    },
    
    // September Bill (similar)
    // ... allocations 005-006
    
    // October Bill (similar)
    // ... allocations 007-008
  ],
  
  "allocationSummary": {
    "totalAllocated": 210000,
    "allocationCount": 8,
    "allocationType": "water_bill",
    "hasMultipleTypes": true
  }
}
```

### Transaction Structure - Credit Only (No Bills)

```javascript
{
  "transactionId": "2025-10-15_110000_456",
  "amount": 50000,                   // $500.00 in cents
  "type": "income",
  "categoryId": "account-credit",    // NOT "-split-"
  "categoryName": "Account Credit",
  "description": "Water bill credit - Unit 203",
  
  // Single allocation for credit only
  "allocations": [
    {
      "id": "alloc_001",
      "type": "water_credit",
      "targetId": "credit_203_water",
      "targetName": "Account Credit - Unit 203",
      "amount": 50000,               // $500.00 in cents
      "categoryName": "Account Credit",
      "categoryId": "account-credit",
      "data": {
        "unitId": "203",
        "creditType": "water_overpayment"
      }
    }
  ],
  
  "metadata": {
    "paymentType": "credit_only"
  }
}
```

### Key Observations - Transactions

1. **Amounts in Cents:** All amounts stored as integers (cents)
2. **Split Detection:** `categoryId === "-split-"` when `allocations.length > 1`
3. **Separate Allocations:** Base and penalties are NEVER combined
4. **Credit Tracking:** Overpayment/usage appears as allocation
5. **Bidirectional Linking:** Transaction ID stored in bill's `payments[]` array

---

## 3. HOA Dues Credit Balance Structure

### Firestore Path
```
clients/{clientId}/hoaDues/units/{unitId}
```

### Document Structure

```javascript
{
  // Credit Balance (in dollars)
  "creditBalance": 500.00,           // Current balance
  
  // Credit History
  "creditBalanceHistory": [
    {
      "amount": -10000,              // -$100.00 (credit USED)
      "date": "2025-10-15",
      "transactionId": "2025-10-15_105634_123",
      "note": "Water Bills Payment - Unit 203",  // EXPECTED
      // Actual might show: "MANUAL ADJUSTMENT" and "[object Object]"
      "timestamp": "2025-10-15T17:56:34.567Z"
    },
    {
      "amount": 20000,               // +$200.00 (overpayment)
      "date": "2025-09-15",
      "transactionId": "2025-09-15_143022_789",
      "note": "Water bill overpayment",
      "timestamp": "2025-09-15T21:30:22.456Z"
    }
  ],
  
  // Other HOA Dues fields...
  "unitId": "203",
  "fiscalYear": 2026,
  "quarterlyCharges": 4500.00,
  // ... other HOA data
}
```

### Credit Balance Integration

**When Water Payment Uses Credit:**
```javascript
// BEFORE payment
creditBalance: 500.00

// Payment of $300 uses $100 credit to pay $400 in bills
// After payment:
creditBalance: 400.00  // $500 - $100 = $400

// History entry:
{
  amount: -10000,  // -$100 in cents (negative = deduction)
  date: "2025-10-15",
  transactionId: "2025-10-15_105634_123",
  note: "Water Bills Payment - Unit 203"
}
```

**When Water Payment Creates Overpayment:**
```javascript
// BEFORE payment
creditBalance: 500.00

// Payment of $300 pays $200 in bills, $100 overpayment
// After payment:
creditBalance: 600.00  // $500 + $100 = $600

// History entry:
{
  amount: 10000,   // +$100 in cents (positive = addition)
  date: "2025-10-15",
  transactionId: "2025-10-15_105634_123",
  note: "Water bill overpayment - no bills due"
}
```

### Issue: Credit Display in History

**Expected:**
```javascript
note: "Water Bills Payment - Unit 203"
```

**Actual (reported bug):**
```javascript
note: "MANUAL ADJUSTMENT"
note: "[object Object]"  // Object not stringified
```

**Hypothesis:** HOA controller might not be properly formatting water bills credit notes.

---

## 4. AggregatedData Structure

### Firestore Path
```
clients/{clientId}/projects/waterBills/aggregatedData/{fiscalYear}
```

### Document Structure

```javascript
{
  "fiscalYear": 2026,
  "clientId": "AVII",
  "calculatedAt": "2025-10-15T17:56:40.123Z",
  
  // Monthly data array
  "months": [
    {
      "month": 0,                    // Fiscal month (0 = July)
      "monthName": "July",
      "calendarMonth": 7,
      "calendarYear": 2025,
      "billsGenerated": true,        // Bills exist for this month
      
      // Per-unit data
      "units": {
        "203": {
          // Consumption
          "consumption": 18,
          "previousReading": 1234,
          "currentReading": 1252,
          "readingDate": "2025-07-28T10:30:00.000Z",
          
          // Charges
          "currentCharge": 350.00,   // Base charge
          "carWashCount": 1,
          "boatWashCount": 0,
          "washCharges": 50.00,
          "totalCharges": 400.00,    // Base + washes
          
          // Penalties
          "penaltyAmount": 49.98,
          "monthsOverdue": 3,
          "daysOverdue": 90,
          
          // Payment Status
          "paidAmount": 399.98,      // ← Updated by surgical update
          "unpaidAmount": 0.00,      // ← Should be 0 after payment
          "status": "paid",          // ← Should change to "paid"
          
          // Transaction Link
          "transactionId": "2025-10-15_105634_123",  // ← Added after payment
          
          // Metadata
          "billNotes": "Water Consumption for Jul 2025 - 0018 m³, 1 Car wash",
          "lastModified": "2025-10-15T17:56:40.123Z"
        },
        
        "204": {
          // ... similar structure for other units
        }
      },
      
      // Month Totals
      "totals": {
        "consumption": 180,          // Sum of all units
        "charges": 3500.00,
        "penalties": 499.80,
        "paid": 3999.80,
        "due": 0.00
      }
    },
    
    // Months 1-11 (August - June)
    // ... similar structure for each month
  ],
  
  // Year Summary
  "yearSummary": {
    "totalConsumption": 2160,        // Sum all months
    "totalCharges": 42000.00,
    "totalPenalties": 5997.60,
    "totalPaid": 47997.60,
    "totalDue": 0.00,
    "billsGenerated": 12,            // Count of months with bills
    "unitsTracked": 10               // Number of units
  }
}
```

### Surgical Update Impact

**BEFORE Surgical Update (Unit 203 just paid):**
```javascript
"203": {
  "paidAmount": 0.00,              // ← OLD value
  "unpaidAmount": 399.98,          // ← OLD value
  "status": "unpaid",              // ← OLD status
  "transactionId": null            // ← No transaction linked
}
```

**AFTER Surgical Update (should be immediate):**
```javascript
"203": {
  "paidAmount": 399.98,            // ← UPDATED
  "unpaidAmount": 0.00,            // ← UPDATED
  "status": "paid",                // ← UPDATED
  "transactionId": "2025-10-15_105634_123"  // ← UPDATED
}
```

**Issue:** If surgical update doesn't work correctly:
- Frontend fetches aggregatedData with OLD values
- Display shows "UNPAID" and due amount even though payment succeeded
- Only after manual refresh (10s recalc) or browser reload does it show correct

---

## 5. Data Flow After Payment

### Step-by-Step Data Updates

**Step 1: Bill Documents Updated**
```
Path: clients/AVII/projects/waterBills/bills/2026-00
Action: Batch write
Fields Updated:
- bills.units.203.paidAmount: 0 → 399.98
- bills.units.203.basePaid: 0 → 350.00
- bills.units.203.penaltyPaid: 0 → 49.98
- bills.units.203.status: "unpaid" → "paid"
- bills.units.203.payments: [] → [payment entry]
```

**Step 2: HOA Dues Credit Updated**
```
Path: clients/AVII/hoaDues/units/203
Action: Direct write (via HOA controller)
Fields Updated:
- creditBalance: 500.00 → 400.00 (if $100 credit used)
- creditBalanceHistory: Append new entry
```

**Step 3: Transaction Created**
```
Path: clients/AVII/transactions/2025-10-15_105634_123
Action: Create new document
Data: Full transaction with allocations array
```

**Step 4: AggregatedData Surgical Update**
```
Path: clients/AVII/projects/waterBills/aggregatedData/2026
Action: Field-level update (not full rebuild)
Fields Updated:
- months[0].units.203.paidAmount: 0 → 399.98
- months[0].units.203.unpaidAmount: 399.98 → 0.00
- months[0].units.203.status: "unpaid" → "paid"
- months[0].units.203.transactionId: null → "2025-10-15_105634_123"
- months[0].totals: Recalculated
- yearSummary: Recalculated
```

**Step 5: Frontend Cache Invalidation**
```
Location: sessionStorage
Action: Delete cached water bills data
Key: "water_bills_AVII_2026"
```

**Step 6: Frontend Data Fetch**
```
API Call: GET /water/clients/AVII/data/2026
Response: Updated aggregatedData (with surgical update changes)
State Update: React context updated with fresh data
UI Render: Display shows "PAID" status
```

---

## 6. Data Consistency Checks

### Validation 1: Bill vs Transaction Totals

**Bill Payment Totals:**
```javascript
billPayments: [
  { baseChargePaid: 350.00, penaltyPaid: 49.98, amountPaid: 399.98 }
]
Total: $399.98
```

**Transaction Amount:**
```javascript
transaction.amount: 39998 cents = $399.98
```

**Allocation Totals:**
```javascript
allocations: [
  { amount: 35000 },  // $350.00
  { amount: 4998 }    // $49.98
]
Total: 39998 cents = $399.98
```

**Validation:** All three must match within 1 peso tolerance (100 cents)

---

### Validation 2: Credit Balance Consistency

**Calculation:**
```
New Credit = Payment + Old Credit - Bills Paid
```

**Example:**
```
Payment: $300
Old Credit: $200
Bills Paid: $400
New Credit: $300 + $200 - $400 = $100
```

**Stored Values Must Match:**
- HOA Dues `creditBalance`: $100
- Credit history entry `amount`: -$100 (change)
- Transaction metadata should reflect credit used

---

### Validation 3: AggregatedData vs Bill Documents

**For Each Bill:**
```javascript
// Bill Document
bills.units.203.paidAmount: 399.98
bills.units.203.status: "paid"

// AggregatedData (same month)
months[0].units.203.paidAmount: 399.98  // MUST match
months[0].units.203.status: "paid"      // MUST match
```

**If Mismatch:**
- Surgical update might have failed
- AggregatedData showing stale data
- Frontend displaying incorrect information

---

## 7. Potential Data Issues

### Issue 1: Credit Balance Not Reflecting Immediately

**Expected Data Flow:**
1. Payment recorded → HOA Dues `creditBalance` updated
2. Surgical update → AggregatedData updated
3. Frontend refreshes → Fetches fresh data
4. UI updates → Shows new credit balance

**Potential Gap:**
- Frontend `WaterBillsContext.refreshData()` only refreshes water bills data
- HOA Dues credit balance lives in separate context (`HOADuesContext`?)
- HOA context not notified of credit change
- **Result:** Water bills show updated, but credit balance shows old value until manual refresh

---

### Issue 2: Paid Amount Not Cleared

**Expected:**
```javascript
// After payment
months[0].units.203: {
  paidAmount: 399.98,
  unpaidAmount: 0.00,  // ← Should be 0
  status: "paid"
}
```

**Potential Issue:**
- Surgical update calculates `unpaidAmount` incorrectly
- Formula might be: `totalAmount - paidAmount`
- If `totalAmount` not updated or `paidAmount` not propagated correctly
- **Result:** Still shows amount due even after payment

---

### Issue 3: Transaction Allocation Integrity

**Expected:**
```javascript
transaction.amount === sum(allocations.map(a => a.amount))
```

**Validation in Code:**
```javascript
// Lines 144-174 in waterPaymentsService.js
createWaterBillsAllocationSummary(billPayments, totalAmountCents) {
  // ...
  integrityCheck: {
    expectedTotal: totalAmountCents,
    actualTotal: totalAllocated,
    isValid: Math.abs(totalAmountCents - totalAllocated) < 100
  }
}
```

**If Invalid:**
- Transaction might be created with wrong amount
- Allocations don't match payment
- Accounting discrepancy

---

## Summary: Critical Data Structures

| Structure | Path | Purpose | Updated By |
|-----------|------|---------|------------|
| **Bill Document** | `bills/{billId}` | Individual bill records | Payment service |
| **Transaction** | `transactions/{txnId}` | Accounting records | Transaction controller |
| **HOA Dues Credit** | `hoaDues/units/{unitId}` | Credit balance | HOA controller (called by water) |
| **AggregatedData** | `aggregatedData/{year}` | UI display data | Surgical update |

---

**Status:** All data structures fully documented from code. Live testing would capture actual "BEFORE" and "AFTER" snapshots from Firestore to verify field updates.


