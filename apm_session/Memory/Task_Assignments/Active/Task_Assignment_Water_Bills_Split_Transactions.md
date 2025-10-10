---
task_id: WB-Split-Transactions-001
priority: 🔥 HIGH (Priority 3a - Foundation for Statement of Account)
agent_type: Implementation Agent
status: APPROVED
created: 2025-10-10
approved_by: Manager Agent
approval_date: 2025-10-10
estimated_effort: 4-5 hours
memory_log_path: apm_session/Memory/Task_Completion_Logs/Water_Bills_Split_Transactions_2025-10-11.md
dependencies: 
  - Water Bills Transaction Linking (COMPLETE)
  - HOA Dues Split Transactions (Reference Pattern)
enables:
  - Priority 3b: HOA Dues Quarterly Collection
  - Priority 3c: Statement of Account Report
---

# Task Assignment: Implement Water Bills Split Transactions

## Objective
Implement split transactions for Water Bills payments using the same `allocations[]` pattern as HOA Dues. This will show detailed breakdown of bills and penalties paid in transaction views and is **CRITICAL FOUNDATION** for Statement of Account report integration.

## Strategic Context

### Dependency Chain for Statement of Account
This task is **Priority 3a** in a three-step sequence:
1. **Priority 3a:** Water Bills Split Transactions (THIS TASK) - Enables penalty breakdown
2. **Priority 3b:** HOA Dues Quarterly Collection - Enables quarterly view
3. **Priority 3c:** Statement of Account Report - Uses both foundations

**Why This Order:** Statement of Account pulls from transactions collection. Without split allocations showing bills vs penalties separately, the report cannot display detailed breakdown. Doing this later would require immediate rework of Statement of Account.

## Background
- **Current State**: Water Bills payments create single transactions without detailed breakdown
- **Target State**: Water Bills payments show split view like HOA Dues (see reference: `scripts/2025-10-02_214147_247.json`)
- **Critical Requirement**: Penalties MUST be separate line items for Statement of Account report
- **Business Need**: Statement of Account report requires transaction-level detail of bills and penalties
- **Pattern Proven**: HOA Dues already uses this pattern successfully

## Reference Implementation
**HOA Dues Split Transaction Structure** (`scripts/2025-10-02_214147_247.json`):
```javascript
{
  "categoryName": "-Split-",
  "allocations": [
    {
      "type": "hoa_month",
      "targetName": "Abril 2026",
      "amount": 1108188,
      "categoryName": "HOA Dues",
      "data": { "unitId": "105", "month": 4, "year": 2026 }
    },
    {
      "type": "account_credit", 
      "targetName": "Account Credit - Unit 105",
      "amount": 127936,
      "categoryName": "Account Credit"
    }
  ]
}
```

## Task Requirements

### Step 1: Design Water Bills Allocation Types
Create new allocation types for Water Bills:
- `water_bill` - for base water charges
- `water_penalty` - for penalty charges (only when penalties exist)
- `water_credit` - for credit balance payments

### Step 2: Update Water Payments Service
**File**: `backend/services/waterPaymentsService.js`

1. **Create allocation generation function** (similar to `createHOAAllocations()`)
   ```javascript
   function createWaterBillsAllocations(billPayments, unitId, paymentData) {
     const allocations = [];
     
     billPayments.forEach((billPayment, index) => {
       // Add base charge allocation
       allocations.push({
         id: `alloc_${String(index * 2 + 1).padStart(3, '0')}`,
         type: "water_bill",
         targetId: `bill_${billPayment.billId}`,
         targetName: `${billPayment.billPeriod} - Unit ${unitId}`,
         amount: billPayment.baseChargePaid,
         categoryName: "Water Consumption",
         categoryId: "water-consumption",
         data: {
           unitId: unitId,
           billId: billPayment.billId,
           billType: "base_charge"
         }
       });
       
       // Add penalty allocation (only if penalties exist)
       if (billPayment.penaltyPaid > 0) {
         allocations.push({
           id: `alloc_${String(index * 2 + 2).padStart(3, '0')}`,
           type: "water_penalty",
           targetId: `penalty_${billPayment.billId}`,
           targetName: `${billPayment.billPeriod} Penalties - Unit ${unitId}`,
           amount: billPayment.penaltyPaid,
           categoryName: "Water Penalties",
           categoryId: "water-penalties",
           data: {
             unitId: unitId,
             billId: billPayment.billId,
             billType: "penalty"
           }
         });
       }
     });
     
     return allocations;
   }
   ```

2. **Update transaction creation** to use allocations:
   ```javascript
   const transactionData = {
     amount: amount,
     type: 'income',
     categoryId: 'water-consumption',
     categoryName: 'Water Consumption', // Will be changed to "-Split-" if multiple allocations
     
     // NEW: Water Bills allocation pattern
     allocations: createWaterBillsAllocations(billPayments, unitId, paymentData),
     allocationSummary: createAllocationSummary(billPayments, dollarsToCents(amount)),
     
     // Existing fields...
     vendorId: 'deposit',
     unitId: unitId,
     // ... rest of transaction data
   };
   ```

3. **Set category to "-Split-" when multiple allocations exist**:
   ```javascript
   if (transactionData.allocations.length > 1) {
     transactionData.categoryName = "-Split-";
     transactionData.categoryId = null;
   }
   ```

### Step 3: Update Import Service
**File**: `backend/services/importService.js`

1. **Create water bills allocation function** (similar to HOA Dues)
2. **Update transaction creation during import** to use allocations
3. **Handle CrossRef with allocation data**

### Step 4: Update Transaction Display
**Files**: Transaction-related UI components

1. **Verify split transaction display works** (should work automatically with existing HOA Dues logic)
2. **Test with Water Bills transactions** to ensure proper formatting
3. **Add any Water Bills-specific display logic** if needed

## Testing Requirements

### Test Case 1: Single Bill Payment
- Pay single water bill (e.g., Unit 203 June bill: $2150)
- **Expected**: Single allocation showing base charge
- **Transaction Category**: "Water Consumption" (not "-Split-")

### Test Case 2: Multiple Bills Payment  
- Pay multiple bills (e.g., Unit 203 June + July: $2150 + $1807.50)
- **Expected**: Multiple allocations showing each bill
- **Transaction Category**: "-Split-"

### Test Case 3: Bills with Penalties
- Pay bills that include penalties (e.g., Unit 203 with $300 penalty)
- **Expected**: Separate allocations for base charge AND penalty
- **Format**: 
  - "June 2025 - Unit 203" (base charge)
  - "June 2025 Penalties - Unit 203" (penalty)

### Test Case 4: Bills without Penalties
- Pay bills with no penalties
- **Expected**: Only base charge allocation (no penalty line item)

### Test Case 5: Import with Allocations
- Run import process
- **Expected**: Imported transactions show proper split breakdown

## Success Criteria
- [ ] Water Bills payments create transactions with `allocations[]` array
- [ ] Split transactions show "-Split-" category like HOA Dues
- [ ] Penalties appear as separate line items when they exist
- [ ] No penalty line items when penalties are $0
- [ ] Transaction views show detailed breakdown of bills and penalties paid
- [ ] Import process creates proper split transactions
- [ ] Statement of Account report can access detailed allocation data

## Deliverables
1. Updated `waterPaymentsService.js` with allocation generation
2. Updated `importService.js` for split transaction imports
3. Test results showing proper split transaction display
4. Memory log documenting implementation and testing

## References
- **HOA Dues Implementation**: `backend/controllers/hoaDuesController.js` (lines 60-140)
- **Example Split Transaction**: `scripts/2025-10-02_214147_247.json`
- **Transaction Structure**: `backend/controllers/transactionsController.js`

## Critical Implementation Notes

### Must-Have Requirements for Statement of Account
1. **Penalty Separation is CRITICAL**: Statement of Account MUST show penalties as separate line items
2. **Allocation Structure**: Must match HOA Dues pattern exactly for consistency
3. **Transaction Collection**: This creates the data structure that Statement of Account will read
4. **No Rework**: If not done correctly now, Statement of Account will need immediate rework

### Technical Guidelines
- **Pattern**: Follow exact same structure as HOA Dues allocations
- **UI**: Split transaction display should work automatically with existing logic
- **Backward Compatibility**: Maintain existing transaction structure for non-split payments
- **Testing**: Use real AVII data with penalties to validate

### Why This Approach
- **Data-Driven Reports**: Statement of Account reads from transactions collection
- **Proven Pattern**: HOA Dues already uses this successfully
- **Foundation First**: Building data structure correctly prevents later rework
- **Consistency**: Same pattern across all payment types simplifies maintenance

---

## Manager Agent Review Criteria

When reviewing completion of this task, Manager Agent will verify:
- [ ] Penalties appear as separate allocations (not combined with base charge)
- [ ] Allocation structure matches HOA Dues pattern exactly
- [ ] Transaction category shows "-Split-" when multiple allocations exist
- [ ] Single allocation payments show actual category (not "-Split-")
- [ ] Import process creates proper split transactions
- [ ] Testing demonstrates penalty separation with real data
- [ ] Code follows existing HOA Dues pattern (minimal new patterns)

**Success Definition:** Statement of Account can read transaction allocations and display bills vs penalties separately without any data transformation.

---

**Manager Agent Approval:** This task is APPROVED as Priority 3a in the Statement of Account dependency chain. The Implementation Agent should focus on creating clean allocation generation logic that mirrors HOA Dues pattern, with emphasis on penalty separation as a CRITICAL requirement for Statement of Account reporting.
