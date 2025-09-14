# Business Logic Documentation
## SAMS APM v0.4

**Document Version:** 1.0  
**Last Updated:** 2025-09-09  
**Purpose:** Comprehensive documentation of all business rules, calculation logic, and operational policies implemented in SAMS

---

## Table of Contents

1. [Payment Processing Logic](#1-payment-processing-logic)
2. [Penalty Calculation Rules](#2-penalty-calculation-rules)
3. [Cache Control Logic](#3-cache-control-logic)
4. [Configuration Management](#4-configuration-management)
5. [Cross-Module Integration Rules](#5-cross-module-integration-rules)
6. [Data Integrity Rules](#6-data-integrity-rules)
7. [Critical Business Constants](#7-critical-business-constants)

---

## 1. Payment Processing Logic

### 1.1 Universal Credit Balance System

**Central Authority:** All credit balances are managed through the HOA Dues module, even for water bill payments.

```javascript
// Location: /backend/controllers/hoaDuesController.js
// Credit balance is the single source of truth across all payment types
const creditBalance = hoaDuesDoc.creditBalance || 0;
const totalAvailableFunds = paymentAmount + creditBalance;
```

**Key Rules:**
- Credit balances are stored in cents (integer) to prevent floating-point errors
- Negative credit balances are allowed but require explicit handling
- All credit changes must include transaction ID for audit trail

### 1.2 Payment Distribution Algorithm

#### Water Bills Payment Distribution

**Source:** `/backend/services/waterPaymentsService.js`

**Priority Order:**
1. Base charges (oldest bills first)
2. Penalty amounts (after all base charges paid)
3. Excess funds → credit balance

**Implementation:**
```javascript
// Pseudo-code representation of actual logic
for (const bill of unpaidBills.sort(byDate)) {
  if (availableFunds >= bill.baseAmount) {
    payBaseCharge(bill);
    availableFunds -= bill.baseAmount;
  } else {
    applyPartialPayment(bill, availableFunds);
    availableFunds = 0;
    break;
  }
}

// After base charges, apply to penalties
for (const bill of billsWithPenalties) {
  if (availableFunds >= bill.penaltyAmount) {
    payPenalty(bill);
    availableFunds -= bill.penaltyAmount;
  }
}

// Remaining funds become credit
if (availableFunds > 0) {
  updateCreditBalance(unitId, availableFunds);
}
```

#### HOA Dues Payment Distribution

**Source:** `/backend/controllers/hoaDuesController.js`

**Monthly Dues:** $250 USD per month (configurable via `scheduledAmount`)

**Distribution Methods:**
1. **Automatic:** System fills unpaid months chronologically (Jan → Dec)
2. **Manual:** Frontend specifies exact month allocation via `distribution` array

**Data Structure:**
```javascript
// 12-element array representing Jan-Dec payments
payments: [
  250.00,  // January (paid)
  250.00,  // February (paid)
  0,       // March (unpaid)
  // ... through December
]
```

### 1.3 Shortfall and Overpayment Handling

#### Shortfall Processing
```javascript
// When payment < total due
const shortfall = totalDue - paymentAmount;

// Priority: Fix negative credit balance first
if (creditBalance < 0) {
  const creditRepair = Math.min(paymentAmount, Math.abs(creditBalance));
  creditBalance += creditRepair;
  paymentAmount -= creditRepair;
}

// Then apply remaining to bills
applyPartialPayment(paymentAmount);
```

#### Overpayment Processing
```javascript
// When payment > total due
const overpayment = paymentAmount - totalDue;

// Add to credit balance with audit trail
creditHistory.push({
  timestamp: new Date(),
  type: 'overpayment',
  amount: overpayment,
  description: `Overpayment from ${paymentMethod}`,
  transactionId: txnId,
  balance: newCreditBalance
});
```

---

## 2. Penalty Calculation Rules

### 2.1 Water Bill Penalties

**Legal Basis:** *"Water consumption must be paid within the first 10 days of the corresponding month, after the ten days there will be a 5% interest per month as approved by the Condominium Owner's Meeting"*

**Source:** `/backend/services/penaltyRecalculationService.js`

#### Core Parameters
| Parameter | Default Value | Configurable | Storage Location |
|-----------|--------------|--------------|------------------|
| Grace Period | 10 days | Yes | `config.penaltyDays` |
| Penalty Rate | 5% monthly | Yes | `config.penaltyRate` |
| Calculation Type | Compound | Yes | `config.compoundPenalty` |
| Currency | MXN | Yes | `config.currency` |

#### Compound Interest Formula
```javascript
// Actual implementation from penaltyRecalculationService.js
let runningTotal = bill.baseAmount;
let totalPenalty = 0;

for (let month = 1; month <= monthsSinceGracePeriod; month++) {
  const monthlyPenalty = runningTotal * penaltyRate;
  totalPenalty += monthlyPenalty;
  runningTotal += monthlyPenalty; // Compound effect
}

bill.penaltyAmount = Math.round(totalPenalty); // Store in cents
```

#### Penalty Timeline
- **Day 1-10:** Grace period, no penalties
- **Day 11:** First penalty calculation (5% of base amount)
- **Month 2:** 5% of (base + month 1 penalty)
- **Month 3+:** Continues compounding

### 2.2 HOA Dues Penalties

**Source:** `/backend/utils/penaltyCalculations.js`

**Default Configuration:**
- Rate: 5% monthly compound
- Grace Period: Client-specific
- Calculation: Same compound formula as water bills

### 2.3 Penalty Recalculation Service

**Trigger Points:**
1. Manual API call: `POST /water/clients/:clientId/bills/recalculate-penalties`
2. Scheduled: Monthly on the 11th (after grace period)
3. Bill generation: Automatically during new bill creation

**Optimization Rules:**
```javascript
// Only update if penalty changed by more than 1 cent
if (Math.abs(currentPenalty - expectedPenalty) > 0.01) {
  updatePenalty(billId, expectedPenalty);
  logPenaltyChange(billId, currentPenalty, expectedPenalty);
}
```

---

## 3. Cache Control Logic

### 3.1 Water Data Service Cache

**Source:** `/backend/services/waterDataService.js`

#### Cache Architecture
```javascript
// Cache structure
const cache = new Map();
// Key format: '${clientId}-${fiscalYear}'
// Value: Complete fiscal year data object

const configCache = new Map();
// Key format: 'config-${clientId}'
// Value: Units and billing configuration
```

#### Cache Lifecycle

| Event | Action | Scope | Duration |
|-------|--------|-------|----------|
| Data Request | Check cache first | Client+Year | 1 hour |
| Bill Generation | Invalidate cache | Affected months | Immediate |
| Payment Processing | Smart update | Specific months | Immediate |
| Penalty Recalc | Full rebuild | Entire year | After calc |
| Manual Clear | Force invalidate | All or specific | Immediate |

#### Smart Cache Updates
```javascript
// Instead of full invalidation, update specific months
function updateMonthInCache(clientId, year, month, newData) {
  const cacheKey = `${clientId}-${year}`;
  const cachedData = cache.get(cacheKey);
  
  if (cachedData) {
    // Surgical update of specific month
    cachedData.months[month - 1] = newData;
    cachedData.lastUpdated = Date.now();
    
    // Recalculate year totals
    recalculateTotals(cachedData);
  }
}
```

### 3.2 Frontend Context Caching

#### HOA Dues Context
- **Trigger:** Payment completion
- **Action:** Automatic refresh
- **Scope:** Current fiscal year

#### Water Bills Context
- **Trigger:** Payment processing
- **Action:** Invalidate and reload
- **Scope:** Affected billing periods

#### Exchange Rate Context
- **Trigger:** Time-based (configurable)
- **Action:** Background refresh
- **Scope:** All cached rates

---

## 4. Configuration Management

### 4.1 Configuration Hierarchy

**Priority Order (highest to lowest):**
1. Database configuration (per-client settings)
2. Document-level defaults (e.g., unit-specific `scheduledAmount`)
3. Service-level defaults (class constants)
4. Hard-coded fallbacks (last resort)

### 4.2 Water Billing Configuration

**Storage:** `/clients/{clientId}/config/waterBilling`

```javascript
{
  ratePerM3: 5000,        // Centavos ($50.00 MXN)
  minimumCharge: 0,       // No minimum
  penaltyRate: 0.05,      // 5% monthly
  penaltyDays: 10,        // Grace period
  compoundPenalty: true,  // Compound vs simple
  currency: 'MXN',
  currencySymbol: '$'
}
```

### 4.3 HOA Dues Configuration

**Storage:** `/clients/{clientId}/units/{unitId}`

```javascript
{
  scheduledAmount: 25000,  // Cents ($250.00 USD)
  creditBalance: 0,        // Current credit in cents
  fiscalYearStartMonth: 7, // July
  penaltyConfig: {
    enabled: true,
    rate: 0.05,
    graceDays: 10
  }
}
```

### 4.4 System Constants (Hard-coded)

**Location:** Various service files

| Constant | Value | Location | Purpose |
|----------|-------|----------|---------|
| Cache Timeout | 3600000ms | waterDataService.js | 1-hour cache duration |
| Default HOA Dues | $250 | hoaDuesController.js | Fallback monthly amount |
| Fiscal Year Start | July (7) | Multiple files | Default fiscal year start |
| Currency Precision | 2 decimals | utils/currency.js | Rounding precision |
| Transaction Categories | Fixed list | constants.js | Valid transaction types |

---

## 5. Cross-Module Integration Rules

### 5.1 Credit Balance Sharing

**Central Authority:** HOA Dues module owns credit balance

```javascript
// Water payment using HOA credit
// Location: /backend/controllers/waterPaymentsController.js
import { getCreditBalance, updateCreditBalance } from './hoaDuesController.js';

async function processWaterPayment(payment) {
  const currentCredit = await getCreditBalance(clientId, unitId);
  const totalFunds = payment.amount + currentCredit;
  
  // Process payment with combined funds
  const remaining = await applyToWaterBills(totalFunds);
  
  // Update credit balance in HOA module
  await updateCreditBalance(clientId, unitId, remaining);
}
```

### 5.2 Transaction Linking

**Bidirectional References:**
- Transaction → HOA Dues: `relatedDocumentId` points to dues document
- HOA Dues → Transaction: `transactionIds` array contains all related transactions
- Water Bill → Transaction: `paymentTransactionId` links to payment record

### 5.3 Cascade Operations

**Delete Transaction → Update Related Documents:**
```javascript
// When deleting a transaction
1. Remove from HOA dues transactionIds array
2. Recalculate dues payment status
3. Update credit balance if needed
4. Clear water bill payment references
5. Trigger cache invalidation
```

---

## 6. Data Integrity Rules

### 6.1 Monetary Value Storage

**Universal Rule:** All monetary values stored as integers (cents)

```javascript
// Conversion utilities
function dollarsToCents(dollars) {
  return Math.round(dollars * 100);
}

function centsToDollars(cents) {
  return cents / 100;
}

// Database storage
{
  amount: 25000,  // $250.00 stored as 25000 cents
  displayAmount: "$250.00"  // For UI only
}
```

### 6.2 Synchronization Requirements

**Critical Invariants:**
1. `monthsBehind` must equal count of months with zero payment
2. `unpaidBalance` must equal sum of all unpaid amounts
3. Credit balance changes must have corresponding history entry
4. Transaction totals must match sum of line items

### 6.3 Audit Trail Requirements

**Every Financial Operation Must Log:**
```javascript
{
  timestamp: new Date().toISOString(),
  userId: currentUser.uid,
  action: 'PAYMENT_PROCESSED',
  details: {
    amount: paymentAmount,
    method: paymentMethod,
    previousBalance: oldBalance,
    newBalance: newBalance,
    transactionId: txnId
  }
}
```

---

## 7. Critical Business Constants

### 7.1 Financial Constants

| Constant | Value | Context | Immutable |
|----------|-------|---------|-----------|
| HOA Monthly Dues | $250 USD | Per unit per month | No (configurable) |
| Water Rate | $50 MXN/m³ | Flat rate billing | No (configurable) |
| Penalty Rate | 5% monthly | Compound interest | No (configurable) |
| Grace Period | 10 days | Before penalties | No (configurable) |
| Fiscal Year Start | July 1 | Annual cycle | Yes (system-wide) |
| Payment Priority | Base→Penalty→Credit | Distribution order | Yes (business rule) |

### 7.2 System Limits

| Limit | Value | Purpose |
|-------|-------|---------|
| Max Transaction Amount | $1,000,000 | Sanity check |
| Min Payment Amount | $0.01 | Prevent zero payments |
| Cache Duration | 1 hour | Performance vs freshness |
| Penalty Calculation Depth | 60 months | Maximum compound periods |
| Credit Balance Min | No limit | Can go negative |
| Credit Balance Max | No limit | Can accumulate |

### 7.3 Transaction Categories

**Fixed Categories (cannot be modified without code changes):**
```javascript
const TRANSACTION_CATEGORIES = {
  HOA_DUES: 'hoa_dues',
  WATER_PAYMENT: 'water_payments',
  WATER_CONSUMPTION: 'water-consumption',
  UTILITIES: 'utilities',
  MAINTENANCE: 'maintenance',
  OTHER: 'other'
};
```

---

## Implementation Notes

### Critical Implementation Requirements

1. **NEVER use CommonJS syntax** - System requires ES6 modules
2. **Always use utility functions** for date/currency operations
3. **Store amounts in cents** to prevent floating-point errors
4. **Maintain transaction audit trail** for all financial operations
5. **Cache invalidation required** after any data modification
6. **Credit balance is centralized** in HOA Dues module
7. **Compound penalties** calculated monthly, not daily
8. **Fiscal year starts July 1** for all clients

### Common Pitfalls to Avoid

1. **Direct float arithmetic** - Use integer cents instead
2. **Forgetting cache invalidation** - Leads to stale data
3. **Bypassing credit balance system** - Must use HOA module
4. **Manual penalty calculations** - Use centralized service
5. **Hardcoding configuration values** - Check database first

---

**Document End**  
*This document represents the complete business logic implementation as of SAMS APM v0.4*