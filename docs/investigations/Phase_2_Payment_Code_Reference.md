# Phase 2: Payment Code Reference Document

**Investigation Date:** October 15, 2025  
**Agent:** Agent_Water_Investigation_Phase_2  
**Purpose:** Complete code reference for payment cascade system

---

## Primary Payment Functions

### 1. recordPayment() - Main Entry Point

**File:** `backend/services/waterPaymentsService.js`  
**Lines:** 198-491  
**Purpose:** Main payment processing function - orchestrates entire payment flow

**Signature:**
```javascript
async recordPayment(clientId, unitId, paymentData)
```

**Parameters:**
```javascript
{
  amount: Number,              // Payment amount in dollars
  paymentDate: String,         // ISO date (YYYY-MM-DD)
  paymentMethod: String,       // 'cash', 'eTransfer', etc.
  paymentMethodId: String,     // Payment method ID
  reference: String,           // Reference number
  notes: String,               // User notes
  accountId: String,           // Required - deposit account
  accountType: String          // Required - 'bank', 'cash', etc.
}
```

**Flow:**
1. **Validation** (lines 213-220)
   - Requires: unitId, amount > 0, accountId, accountType
   - Throws error if invalid

2. **Get Credit Balance** (lines 223-229)
   ```javascript
   const fiscalYear = getFiscalYear(getNow(), 7);
   const creditResponse = await this._getCreditBalance(clientId, unitId, fiscalYear);
   const currentCreditBalance = creditResponse.creditBalance || 0;
   ```

3. **Calculate Total Funds** (lines 232-233)
   ```javascript
   const totalAvailableFunds = this._roundCurrency(amount + currentCreditBalance);
   ```

4. **Get Unpaid Bills** (lines 236-237)
   ```javascript
   const unpaidBills = await this._getUnpaidBillsForUnit(clientId, unitId);
   ```

5. **Handle No Bills Scenario** (lines 239-294)
   - All payment goes to credit balance
   - Creates transaction with single allocation
   - Returns early

6. **Allocate Payment** (lines 296-368)
   - Loop through bills oldest first
   - Apply funds: base before penalties
   - Create billPayments array

7. **Calculate Credit Changes** (lines 370-385)
   - Determine overpayment vs credit used
   - Calculate new credit balance

8. **Update Credit Balance** (lines 388-394)
   ```javascript
   await this._updateCreditBalance(clientId, unitId, fiscalYear, {
     newBalance: newCreditBalance,
     changeAmount: overpayment > 0 ? overpayment : -creditUsed,
     changeType: overpayment > 0 ? 'water_overpayment' : 'water_credit_used',
     description: this._generateCreditDescription(...),
     transactionId: null  // Updated after transaction creation
   });
   ```

9. **Create Allocations** (lines 407-409)
   ```javascript
   const allocations = createWaterBillsAllocations(billPayments, unitId, paymentDataForAllocations);
   const allocationSummary = createWaterBillsAllocationSummary(billPayments, dollarsToCents(amount));
   ```

10. **Create Transaction** (lines 414-456)
    ```javascript
    const transactionData = {
      amount: amount,
      type: 'income',
      categoryId: allocations.length > 1 ? "-split-" : "water-consumption",
      categoryName: allocations.length > 1 ? "-Split-" : "Water Consumption",
      // ... rest of transaction data
      allocations: allocations
    };
    
    const transactionResult = await createTransaction(clientId, transactionData);
    ```

11. **Update Bills** (line 459)
    ```javascript
    await this._updateBillsWithPayments(clientId, unitId, billPayments, ...);
    ```

12. **Surgical Update** (lines 466-477)
    ```javascript
    try {
      const affectedUnitsAndMonths = billPayments.map(bp => ({
        unitId: bp.unitId,
        monthId: bp.billId
      }));
      await waterDataService.updateAggregatedDataAfterPayment(clientId, fiscalYear, affectedUnitsAndMonths);
    } catch (error) {
      console.warn(`⚠️ [PAYMENT] Surgical update failed (non-critical):`, error.message);
    }
    ```

13. **Return Success** (lines 479-490)
    ```javascript
    return {
      success: true,
      paymentType: 'bills_and_credit',
      totalFundsAvailable: totalAvailableFunds,
      billsPaid: billPayments,
      newCreditBalance: newCreditBalance,
      creditUsed: creditUsed,
      overpayment: overpayment,
      totalBaseChargesPaid: totalBaseChargesPaid,
      totalPenaltiesPaid: totalPenaltiesPaid,
      transactionId: transactionResult
    };
    ```

---

### 2. _getUnpaidBillsForUnit() - Bill Retrieval

**File:** `backend/services/waterPaymentsService.js`  
**Lines:** 555-650  
**Purpose:** Retrieve all unpaid bills for a unit, sorted oldest first

**Signature:**
```javascript
async _getUnpaidBillsForUnit(clientId, unitId)
```

**Logic:**
1. **Query All Bills** (lines 558-563)
   ```javascript
   const billsSnapshot = await this.db.collection('clients').doc(clientId)
     .collection('projects').doc('waterBills')
     .collection('bills')
     .orderBy('__name__')  // Document name = YYYY-MM (oldest first)
     .get();
   ```

2. **Filter Unpaid** (lines 568-611)
   ```javascript
   billsSnapshot.forEach(doc => {
     const billData = doc.data();
     const unitBill = billData.bills?.units?.[unitId];
     
     if (unitBill && unitBill.status !== 'paid') {
       // Extract base amount
       const storedBaseAmount = unitBill.currentCharge || 0;
       const unpaidBaseAmount = storedBaseAmount - (unitBill.basePaid || 0);
       
       if (unpaidBaseAmount > 0) {
         // Store bill metadata
         billsMetadata.push({
           id: doc.id,
           period: doc.id,
           originalData: unitBill,
           paidAmount: unitBill.paidAmount || 0,
           basePaid: unitBill.basePaid || 0,
           penaltyPaid: unitBill.penaltyPaid || 0,
           status: unitBill.status
         });
       }
     }
   });
   ```

3. **Build Bill Objects** (lines 615-647)
   ```javascript
   for (const metadata of billsMetadata) {
     const unitBill = metadata.originalData;
     
     // Use STORED penalty amounts (not calculated)
     const storedPenaltyAmount = unitBill.penaltyAmount || 0;
     const storedTotalAmount = unitBill.totalAmount || unitBill.currentCharge || 0;
     const currentCharge = unitBill.currentCharge || 0;
     
     const totalCurrentlyDue = storedTotalAmount - metadata.paidAmount;
     
     if (totalCurrentlyDue > 0) {
       bills.push({
         id: metadata.id,
         period: metadata.period,
         penaltyAmount: storedPenaltyAmount,
         totalAmount: storedTotalAmount,
         currentCharge: currentCharge,
         paidAmount: metadata.paidAmount,
         basePaid: metadata.basePaid,
         penaltyPaid: metadata.penaltyPaid,
         unpaidAmount: totalCurrentlyDue,
         status: metadata.status,
         dueDate: unitBill.dueDate,
         _usingStoredPenalties: true  // Debug flag
       });
     }
   }
   ```

4. **Return Sorted** (line 649)
   ```javascript
   return bills;  // Already sorted by document name (oldest first)
   ```

**Key Points:**
- Uses STORED penalty data (from penalty recalculation service)
- Does NOT calculate penalties dynamically
- Filters for `status !== 'paid'` AND `unpaidAmount > 0`
- Returns empty array if no unpaid bills (no "NOBILL" error thrown here)

---

### 3. createWaterBillsAllocations() - Split Transaction Creation

**File:** `backend/services/waterPaymentsService.js`  
**Lines:** 25-136  
**Purpose:** Create allocations array for split transactions

**Signature:**
```javascript
function createWaterBillsAllocations(billPayments, unitId, paymentData)
```

**Parameters:**
- `billPayments`: Array of payment objects from recordPayment()
- `unitId`: Unit identifier
- `paymentData`: Object with `creditUsed`, `overpayment`, `newCreditBalance`

**Logic:**
1. **Base Charge Allocations** (lines 35-58)
   ```javascript
   if (billPayment.baseChargePaid > 0) {
     allocations.push({
       id: `alloc_${String(++allocationIndex).padStart(3, '0')}`,
       type: "water_bill",
       targetId: `bill_${billPayment.billId}`,
       targetName: `${billPayment.billPeriod} - Unit ${unitId}`,
       amount: billPayment.baseChargePaid,  // In DOLLARS
       categoryName: "Water Consumption",
       categoryId: "water-consumption",
       data: {
         unitId: unitId,
         billId: billPayment.billId,
         billPeriod: billPayment.billPeriod,
         billType: "base_charge"
       },
       metadata: {
         processingStrategy: "water_bills",
         createdAt: getNow().toISOString()
       }
     });
   }
   ```

2. **Penalty Allocations** (lines 61-84)
   ```javascript
   if (billPayment.penaltyPaid > 0) {
     allocations.push({
       id: `alloc_${String(++allocationIndex).padStart(3, '0')}`,
       type: "water_penalty",
       targetId: `penalty_${billPayment.billId}`,
       targetName: `${billPayment.billPeriod} Penalties - Unit ${unitId}`,
       amount: billPayment.penaltyPaid,  // In DOLLARS
       categoryName: "Water Penalties",
       categoryId: "water-penalties",
       data: {
         unitId: unitId,
         billId: billPayment.billId,
         billPeriod: billPayment.billPeriod,
         billType: "penalty"
       }
     });
   }
   ```

3. **Credit Allocations** (lines 89-133)
   ```javascript
   // Overpayment (positive)
   if (paymentData && paymentData.overpayment && paymentData.overpayment > 0) {
     allocations.push({
       id: `alloc_${String(++allocationIndex).padStart(3, '0')}`,
       type: "water_credit",
       amount: paymentData.overpayment,  // Positive
       categoryName: "Account Credit",
       categoryId: "account-credit",
       data: { creditType: "water_overpayment" }
     });
   }
   
   // Credit Used (negative)
   else if (paymentData && paymentData.creditUsed && paymentData.creditUsed > 0) {
     allocations.push({
       id: `alloc_${String(++allocationIndex).padStart(3, '0')}`,
       type: "water_credit",
       amount: -paymentData.creditUsed,  // Negative
       categoryName: "Account Credit",
       categoryId: "account-credit",
       data: { creditType: "water_credit_used" }
     });
   }
   ```

4. **Return Array** (line 135)
   ```javascript
   return allocations;
   ```

**Critical Notes:**
- Amounts kept in DOLLARS (transactionsController converts to cents at line 362)
- Base and penalties NEVER combined (separate allocations)
- Credit overpayment = positive amount
- Credit usage = negative amount
- Uses `getNow()` from DateService (not `new Date()`)

---

### 4. _updateBillsWithPayments() - Bill Document Updates

**File:** `backend/services/waterPaymentsService.js`  
**Lines:** 655-720  
**Purpose:** Update bill documents with payment information

**Signature:**
```javascript
async _updateBillsWithPayments(clientId, unitId, billPayments, paymentMethod, paymentDate, reference, transactionResult, paymentAmount)
```

**Logic:**
1. **Create Batch** (line 656)
   ```javascript
   const batch = this.db.batch();
   ```

2. **Determine Payment Month** (lines 659-665)
   ```javascript
   const currentDate = new Date(paymentDate);
   const currentFiscalYear = getNow().getFullYear() + 1;
   const currentFiscalMonth = Math.max(0, currentDate.getMonth() - 6);
   const paymentMonthId = `${currentFiscalYear}-${String(currentFiscalMonth).padStart(2, '0')}`;
   ```

3. **Update Each Bill** (lines 667-717)
   ```javascript
   for (const payment of billPayments) {
     const billRef = this.db.collection('clients').doc(clientId)
       .collection('projects').doc('waterBills')
       .collection('bills').doc(payment.billId);
     
     // Get current bill data
     const billDoc = await billRef.get();
     const currentBill = billDoc.data()?.bills?.units?.[unitId];
     
     // Calculate new totals
     const newBasePaid = (currentBill.basePaid || 0) + payment.baseChargePaid;
     const newPenaltyPaid = (currentBill.penaltyPaid || 0) + payment.penaltyPaid;
     
     // Display amount logic
     const isPaymentMonth = payment.billId === paymentMonthId;
     const displayPaidAmount = isPaymentMonth ? paymentAmount : payment.amountPaid;
     const newPaidAmount = (currentBill.paidAmount || 0) + displayPaidAmount;
     
     // Create payment entry
     const paymentEntry = {
       amount: displayPaidAmount,
       baseChargePaid: payment.baseChargePaid,
       penaltyPaid: payment.penaltyPaid,
       date: paymentDate,
       method: paymentMethod,
       reference: reference,
       transactionId: transactionResult || null,
       recordedAt: getNow().toISOString()
     };
     
     // Append to payments array
     const existingPayments = currentBill.payments || [];
     const updatedPayments = [...existingPayments, paymentEntry];
     
     // Batch update
     batch.update(billRef, {
       [`bills.units.${unitId}.paidAmount`]: newPaidAmount,
       [`bills.units.${unitId}.basePaid`]: newBasePaid,
       [`bills.units.${unitId}.penaltyPaid`]: newPenaltyPaid,
       [`bills.units.${unitId}.status`]: payment.newStatus,
       [`bills.units.${unitId}.payments`]: updatedPayments
     });
   }
   ```

4. **Commit Batch** (line 719)
   ```javascript
   await batch.commit();
   ```

**Key Points:**
- Uses Firestore batch for atomicity
- Updates multiple fields per bill
- Appends to payments[] array (maintains history)
- Links to transaction via `transactionId`
- Special logic for payment month display amount

---

### 5. _getCreditBalance() - HOA Integration (Read)

**File:** `backend/services/waterPaymentsService.js`  
**Lines:** 496-520  
**Purpose:** Get credit balance from HOA Dues module

**Signature:**
```javascript
async _getCreditBalance(clientId, unitId, year)
```

**Logic:**
```javascript
try {
  // Import HOA controller (clean separation)
  const { getUnitDuesData } = await import('../controllers/hoaDuesController.js');
  
  // Get dues data
  const duesData = await getUnitDuesData(clientId, unitId, year);
  
  if (!duesData) {
    return { creditBalance: 0, creditBalanceHistory: [] };
  }
  
  return {
    creditBalance: duesData.creditBalance || 0,  // In dollars
    creditBalanceHistory: duesData.creditBalanceHistory || []
  };
} catch (error) {
  console.error('Error getting credit balance via HOA controller:', error);
  return { creditBalance: 0, creditBalanceHistory: [] };  // Graceful degradation
}
```

**Key Points:**
- Uses HOA controller directly (clean module separation)
- Returns credit balance in DOLLARS (not cents)
- Gracefully degrades to 0 if HOA module unavailable
- No direct Firestore access (respects module boundaries)

---

### 6. _updateCreditBalance() - HOA Integration (Write)

**File:** `backend/services/waterPaymentsService.js`  
**Lines:** 525-549  
**Purpose:** Update credit balance in HOA Dues module

**Signature:**
```javascript
async _updateCreditBalance(clientId, unitId, year, updateData)
```

**Parameters:**
```javascript
{
  newBalance: Number,        // New balance in dollars
  changeAmount: Number,      // Change amount (+ or -)
  changeType: String,        // 'water_overpayment' or 'water_credit_used'
  description: String,       // Human-readable description
  transactionId: String      // Transaction ID (may be null)
}
```

**Logic:**
```javascript
try {
  const { updateCreditBalance } = await import('../controllers/hoaDuesController.js');
  
  const { newBalance, changeAmount, changeType, description, transactionId } = updateData;
  
  // Use HOA controller function
  const result = await updateCreditBalance(clientId, unitId, year, newBalance);
  
  return {
    success: true,
    newBalance: newBalance,
    changeAmount: changeAmount
  };
} catch (error) {
  console.error('Error updating credit balance via HOA controller:', error);
  throw new Error('Failed to update credit balance via HOA controller');
}
```

**Key Points:**
- Delegates to HOA controller (clean separation)
- Throws error if update fails (payment should fail)
- Does not directly write to Firestore
- **Note:** Description/notes might not be properly passed to HOA controller

---

## Integration Points

### Transaction Controller

**File:** `backend/controllers/transactionsController.js`  
**Function:** `createTransaction(clientId, transactionData)`

**Called By:** `waterPaymentsService.recordPayment()` at line 455

**Key Processing:**
- Converts allocation amounts from dollars to cents (line 362)
  ```javascript
  allocation.amount = dollarsToCents(allocation.amount);
  ```
- Generates transaction ID
- Writes to `clients/{clientId}/transactions/{transactionId}`
- Returns transaction ID

**Critical:** transactionsController is SHARED across Water Bills, HOA Dues, and Expenses modules. Changes to controller affect all modules.

---

### Water Data Service - Surgical Update

**File:** `backend/services/waterDataService.js`  
**Function:** `updateAggregatedDataAfterPayment(clientId, year, affectedUnitsAndMonths)`

**Called By:** `waterPaymentsService.recordPayment()` at line 472

**Purpose:** Update aggregatedData for only the affected units/months (surgical, not full rebuild)

**Expected Behavior:**
1. Fetch existing aggregatedData document
2. For each affected month:
   - Call `buildSingleUnitData()` with existing data (fast path)
   - Update only that unit's data in that month
3. Recalculate month totals
4. Recalculate year summary
5. Write updated aggregatedData back to Firestore

**Performance (from Memory Log):**
- Single month: ~728ms backend
- Multi-month (4): ~503ms backend
- 94% faster than full recalculation

**Error Handling:**
- Wrapped in try/catch in recordPayment()
- Failure is logged but does NOT fail the payment
- Payment succeeds even if surgical update fails

---

### Frontend Components

#### Payment Modal

**File:** `frontend/sams-ui/src/components/water/WaterPaymentModal.jsx`  
**Lines:** 200-259  
**Function:** `handleSubmit()`

**Submit Logic:**
```javascript
const response = await waterAPI.recordPayment(selectedClient.id, {
  unitId,
  amount: parseFloat(amount),
  paymentDate,
  paymentMethod,
  paymentMethodId,
  reference,
  notes,
  accountId: selectedAccount.id,
  accountType: selectedAccount.type
});

if (response.data.success) {
  const transactionId = response.data.transactionId || result?.transactionId;
  console.log(`💳 Transaction ID captured: ${transactionId}`);
  onSuccess();  // Calls parent success handler
  onClose();    // Closes modal
}
```

**API Call:** `POST /water/clients/:clientId/payments/record`

---

#### Bills List - Success Handler

**File:** `frontend/sams-ui/src/components/water/WaterBillsList.jsx`  
**Lines:** 547-551  

**Success Callback:**
```javascript
<WaterPaymentModal
  onSuccess={() => {
    refreshData();  // Clears cache and fetches fresh data
    console.log('✅ Payment recorded - refreshing bill data');
  }}
/>
```

**refreshData() Function:**
- Lives in WaterBillsContext
- Clears sessionStorage cache for water bills
- Fetches fresh aggregatedData from backend
- Updates React state
- Triggers UI re-render

**Potential Issue:** refreshData() only refreshes water bills. Credit balance lives in HOA Dues context (separate).

---

## API Routes

### Payment Recording

**Route:** `POST /water/clients/:clientId/payments/record`  
**File:** `backend/routes/waterRoutes.js`  
**Controller:** `waterPaymentsController.recordPayment()`  
**Service:** `waterPaymentsService.recordPayment()`

**Request Body:**
```javascript
{
  unitId: "203",
  amount: 399.98,
  paymentDate: "2025-10-15",
  paymentMethod: "eTransfer",
  paymentMethodId: "pm_etransfer_001",
  reference: "",
  notes: "",
  accountId: "acc_scotiabank_001",
  accountType: "bank"
}
```

**Response:**
```javascript
{
  success: true,
  data: {
    paymentType: "bills_and_credit",
    totalFundsAvailable: 399.98,
    billsPaid: [{...}],
    newCreditBalance: 0,
    creditUsed: 0,
    overpayment: 0,
    totalBaseChargesPaid: 350.00,
    totalPenaltiesPaid: 49.98,
    transactionId: "2025-10-15_105634_123"
  }
}
```

---

### Unpaid Bills Summary

**Route:** `GET /water/clients/:clientId/bills/unpaid/:unitId`  
**File:** `backend/routes/waterRoutes.js`  
**Controller:** `waterPaymentsController.getUnpaidBillsSummary()`  
**Service:** `waterPaymentsService._getUnpaidBillsForUnit()`

**Response:**
```javascript
{
  success: true,
  data: {
    unpaidBills: [{
      id: "2026-00",
      period: "2026-00",
      penaltyAmount: 49.98,
      totalAmount: 399.98,
      currentCharge: 350.00,
      paidAmount: 0,
      unpaidAmount: 399.98,
      status: "unpaid"
    }],
    currentCreditBalance: 500.00
  }
}
```

---

## Helper Functions

### _roundCurrency()

**File:** `backend/services/waterPaymentsService.js`  
**Lines:** 190-192  
**Purpose:** Prevent floating-point precision errors

```javascript
_roundCurrency(amount) {
  return Math.round(amount * 100) / 100;
}
```

**Used Throughout:** All currency calculations use this function

---

### _generateCreditDescription()

**Purpose:** Create human-readable description for credit balance changes

**Called:** When updating credit balance

**Expected Output:** "Water Bills Payment - Unit 203"

**Potential Issue:** Might not be properly formatted when passed to HOA controller

---

## Console Logging

The payment cascade includes extensive console logging for debugging:

### Key Log Points

**Payment Start:**
```javascript
console.log(`💧 Recording water payment: Unit ${unitId}, Amount $${amount}`);
console.log(`💰 Current credit balance: $${currentCreditBalance}`);
console.log(`💵 Total available funds: $${totalAvailableFunds}`);
```

**Bill Processing:**
```javascript
console.log(`📋 Found ${unpaidBills.length} unpaid bills`);
console.log(`📄 Bill ${bill.period}: Total due $${unpaidAmount} (Base: $${baseUnpaid}, Penalties: $${penaltyUnpaid})`);
console.log(`✅ Bill ${bill.period} paid in full: $${unpaidAmount}`);
console.log(`🔸 Bill ${bill.period} partial payment: $${remainingFunds}`);
```

**Credit Calculation:**
```javascript
console.log(`💰 Credit calculation: Used $${creditUsed}, Overpaid $${overpayment}, New balance $${newCreditBalance}`);
```

**Allocations:**
```javascript
console.log(`📊 Generated ${allocations.length} allocations for water bill payment`);
console.log(`✂️ Multiple allocations detected - setting category to "-Split-"`);
```

**Surgical Update:**
```javascript
console.log(`✅ [PAYMENT] Surgical update completed - UI will auto-refresh with "Paid" status`);
console.warn(`⚠️ [PAYMENT] Surgical update failed (non-critical):`, error.message);
```

**These logs would be visible in the backend server logs when payments are processed.**

---

## Testing Entry Points

### Manual Testing

**Login to SAMS:**
- URL: `http://localhost:5175`
- Credentials: `michael@landesman.com / maestro`
- Select Client: AVII

**Navigate to Water Bills:**
- Click "Water Bills" in sidebar
- Select "Bills" tab
- View unpaid bills

**Make Payment:**
- Click UNPAID button for a unit
- Payment modal opens with bill details
- Enter amount and payment details
- Submit payment
- Observe console logs in backend

**Verify:**
- Bill status changes to PAID
- Due amount cleared
- Credit balance updated
- Transaction created

---

## Summary: Critical Code Locations

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| **Main Entry** | waterPaymentsService.js | 198-491 | recordPayment() |
| **Bill Retrieval** | waterPaymentsService.js | 555-650 | _getUnpaidBillsForUnit() |
| **Allocation** | waterPaymentsService.js | 302-368 | Payment cascade loop |
| **Split Creation** | waterPaymentsService.js | 25-136 | createWaterBillsAllocations() |
| **Bill Updates** | waterPaymentsService.js | 655-720 | _updateBillsWithPayments() |
| **Credit Read** | waterPaymentsService.js | 496-520 | _getCreditBalance() |
| **Credit Write** | waterPaymentsService.js | 525-549 | _updateCreditBalance() |
| **Transaction** | transactionsController.js | - | createTransaction() |
| **Surgical Update** | waterDataService.js | - | updateAggregatedDataAfterPayment() |
| **Frontend Modal** | WaterPaymentModal.jsx | 200-259 | handleSubmit() |
| **Frontend Refresh** | WaterBillsList.jsx | 547-551 | onSuccess callback |

---

**Status:** All code references documented with file paths, line numbers, and function purposes. Complete reference for debugging payment cascade issues.


