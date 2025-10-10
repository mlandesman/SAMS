# Phase 3: Split Transaction UI Enhancement

**Task ID:** Phase_3_Split_Transaction_UI_Enhancement  
**Priority:** HIGH  
**Assigned To:** Implementation Agent  
**Estimated Sessions:** 2-3  
**Type:** Frontend Enhancement + Backend Support

## Objective

Implement Quicken-style split transaction interface for manual invoice splitting. Enable users to split a single transaction across multiple budget categories with intuitive UI that maintains running balance and enforces total validation.

## Strategic Context

Building on the successful Phase 2 HOA Allocations foundation, Phase 3 extends split transaction capability to general transaction entry. This provides users with familiar Quicken-style workflow for splitting invoices, combined payments, and multi-category expenses while maintaining the proven `allocations` array data structure.

## User Experience Design

### **Workflow Overview:**
1. User clicks "Add Expense" → Opens enhanced transaction modal
2. User enters required fields: Date, Vendor, Amount, Payment Method, Account, Unit (optional)
3. [Split] button becomes active when all required fields completed
4. Click [Split] → Opens Split Entry Modal with total amount at top
5. User adds allocation rows: Category + Amount + Notes per line
6. Running "Remaining" balance decrements as allocations added
7. Save enabled only when total allocations = transaction amount
8. Transaction displays with Category = "-Split-" and expandable breakdown

### **Transaction Display Pattern:**
**Single Category Transaction:**
```
Date: 09/19/2025 | Vendor: ABC Supplies | Category: Office Supplies | Amount: $1,800
```

**Split Transaction:**
```
Date: 09/19/2025 | Vendor: ABC Supplies | Category: -Split- | Amount: $1,800
  ↳ Click to expand: Office Supplies ($600), Maintenance ($800), Utilities ($400)
```

## Required Implementation Tasks

### Task 3.1: Backend Enhancement - createTransaction Support
**Objective:** Update `createTransaction` to properly handle `allocations` array

**Current Issue:** 
`createTransaction` in `backend/controllers/transactionsController.js` still contains legacy `duesDistribution` logic but does not handle the new `allocations` array format.

**Requirements:**
- Accept `allocations` array in transaction data
- Validate that allocations sum equals transaction amount
- Store allocations properly in transaction document
- Maintain backward compatibility with single-category transactions
- Set `categoryName = "-Split-"` when allocations array present

**Implementation Details:**
```javascript
// Example allocations array structure:
{
  "date": "2025-09-19",
  "vendorName": "ABC Supplies", 
  "amount": 180000, // cents
  "categoryName": "-Split-", // Set automatically when allocations present
  "allocations": [
    {
      "categoryId": "office-supplies",
      "categoryName": "Office Supplies",
      "amount": 60000,
      "notes": "Printer paper and pens"
    },
    {
      "categoryId": "maintenance",
      "categoryName": "Maintenance",
      "amount": 80000,
      "notes": "Repair supplies"
    },
    {
      "categoryId": "utilities",
      "categoryName": "Utilities", 
      "amount": 40000,
      "notes": "Electrical components"
    }
  ]
}
```

**Validation Rules:**
- If `allocations` array present, set `categoryName = "-Split-"`
- Sum of `allocations[].amount` must equal transaction `amount`
- Each allocation must have valid `categoryName` and `amount > 0`
- Date, vendor, account, payment method consistent across transaction

### Task 3.2: Split Entry Modal Component
**Objective:** Create Quicken-style split transaction entry interface

**Component:** `frontend/sams-ui/src/components/transactions/SplitEntryModal.jsx`

**Requirements:**
- **Header:** Transaction summary (Date, Vendor, Total Amount)
- **Running Balance:** Shows "Remaining: $X.XX" that decrements as allocations added
- **Allocation Rows:** Category dropdown + Amount input + Notes input per row
- **Add Row Button:** Add new allocation line
- **Remove Row:** Delete allocation line (with confirmation)
- **Save/Cancel:** Save enabled only when remaining = $0.00

**UI Layout:**
```
┌─────────────────────────────────────────────────────┐
│ Split Transaction: ABC Supplies - $1,800.00        │
│ Date: 09/19/2025 | Account: Business Checking      │
├─────────────────────────────────────────────────────┤
│ Remaining: $400.00                                  │
├─────────────────────────────────────────────────────┤
│ Category ▼          Amount     Notes          [✕]   │
│ Office Supplies     $600.00    Printer paper        │
│ Maintenance         $800.00    Repair supplies      │
│ [Select Category ▼] $         [Notes...]      [+]   │
├─────────────────────────────────────────────────────┤
│                    [Cancel] [Save Split] (disabled) │
└─────────────────────────────────────────────────────┘
```

**Interaction Logic:**
- Amount input automatically focuses when category selected
- Running balance updates in real-time as amounts entered
- [Save Split] enabled only when Remaining = $0.00
- Prevent saving if any allocation has invalid category or amount ≤ 0

### Task 3.3: Enhanced Add Expense Modal
**Objective:** Add [Split] button with activation logic to existing transaction modal

**File:** `frontend/sams-ui/src/components/transactions/AddTransactionModal.jsx` (or equivalent)

**Requirements:**
- Add [Split] button next to existing save button
- Button activation logic: enabled only when required fields completed
  - Date ✓
  - Vendor ✓  
  - Amount > 0 ✓
  - Payment Method ✓
  - Account ✓
  - Unit (optional)
- Click [Split] → Opens SplitEntryModal with transaction data
- Handle split modal return: save split transaction or continue editing

**Required Fields Validation:**
```javascript
const isSplitButtonEnabled = () => {
  return formData.date && 
         formData.vendorName && 
         formData.amount > 0 && 
         formData.paymentMethod && 
         formData.accountId;
};
```

### Task 3.4: Transaction Display Enhancement
**Objective:** Update transaction list/table to show split transactions properly

**Files to Modify:**
- Transaction table components
- Transaction detail views
- Transaction list displays

**Requirements:**
- Display `categoryName = "-Split-"` for split transactions
- Add expand/collapse functionality to show allocation breakdown
- Hover or click to reveal allocation details
- Maintain existing single-category transaction display

**Display Format:**
```
Regular: Category Name | $1,800.00
Split:   -Split-       | $1,800.00 [▼]
         ↳ Office Supplies: $600.00
         ↳ Maintenance: $800.00  
         ↳ Utilities: $400.00
```

### Task 3.5: Edit Split Transaction
**Objective:** Allow editing of existing split transactions

**Requirements:**
- Detect split transactions (has `allocations` array)
- Open SplitEntryModal for editing instead of regular transaction modal
- Pre-populate existing allocation data
- Maintain balance validation during editing
- Update transaction preserving audit trail

**Edit Flow:**
1. Click edit on split transaction
2. Open SplitEntryModal with existing allocations loaded
3. Allow adding/removing/editing allocation rows
4. Enforce balance validation (must sum to total)
5. Save updates to existing transaction document

## Critical Implementation Guidelines

### **1. MANDATORY CODING STANDARDS**
- **USE approved utility functions** (`formatCurrency`, etc.)
- **USE domain-specific API patterns** (`config.api.domainBaseUrl`)
- **NO hardcoded client names, dates, or amounts**
- **FOLLOW existing SAMS component patterns**

### **2. DATA INTEGRITY REQUIREMENTS**
- Mathematical accuracy in amount calculations (use cents throughout)
- Atomic transaction operations (all-or-nothing saves)
- Validate allocations sum equals transaction total (client and server side)
- Preserve audit trail for split transaction edits

### **3. USER EXPERIENCE REQUIREMENTS**
- Intuitive Quicken-style interface familiar to accounting users
- Clear visual feedback for balance validation
- Prevent accidental data loss (confirmation for destructive actions)
- Responsive design compatible with desktop and mobile

### **4. BACKWARD COMPATIBILITY**
- Single-category transactions continue working unchanged
- Existing transaction display/edit functionality preserved
- No breaking changes to current transaction workflows

## Success Criteria

**Technical Success:**
- [ ] createTransaction properly handles allocations array
- [ ] Split Entry Modal enforces balance validation (sum = total)
- [ ] Transaction display shows "-Split-" for allocated transactions
- [ ] Edit functionality works for both single and split transactions
- [ ] All existing transaction functionality preserved

**User Experience Success:**
- [ ] [Split] button activates only when required fields completed
- [ ] Running balance provides clear feedback during allocation entry
- [ ] Split transactions display clearly in transaction list
- [ ] Edit workflow is intuitive for both single and split transactions

**Business Success:**
- [ ] Users can split invoices across multiple budget categories
- [ ] Transaction totals remain mathematically accurate
- [ ] Allocation data supports detailed financial reporting
- [ ] Workflow matches familiar Quicken patterns

## Risk Mitigation

**Data Validation Risk:**
- Client-side and server-side validation for allocation totals
- Prevent saving if allocations don't sum to transaction amount
- Clear error messages for validation failures

**User Experience Risk:**
- Extensive testing of balance calculation edge cases
- Confirmation dialogs for potentially destructive actions
- Fallback to single-category transaction if split fails

**Performance Risk:**
- Efficient allocation display for large transaction lists
- Optimized category lookup for allocation entry
- Responsive UI during allocation calculations

## Integration Testing Requirements

**Test Scenarios:**
1. **Basic Split Creation:** Create 3-way split transaction, verify storage and display
2. **Balance Validation:** Attempt to save with incorrect total, verify error handling
3. **Edit Split Transaction:** Modify existing split, add/remove allocations
4. **Display Testing:** Verify "-Split-" display and allocation breakdown
5. **Backward Compatibility:** Ensure single-category transactions unaffected

**Edge Cases:**
- Single allocation (should remain single-category transaction)
- Maximum allocation count (10+ categories)
- Very small amounts (penny allocations)
- Empty/zero allocations
- Category changes during editing

## Next Phase Preview

Upon successful completion of Phase 3, Phase 4 will focus on:
- Enhanced allocation reporting and analytics
- Category-based filtering for split transactions  
- Bulk operations for split transactions
- Integration with budget variance reporting

## Deliverables

1. **Enhanced createTransaction** - Backend support for allocations array
2. **SplitEntryModal Component** - Quicken-style allocation entry interface
3. **Enhanced Transaction Modal** - [Split] button with activation logic
4. **Updated Transaction Display** - "-Split-" category with expandable details
5. **Edit Split Functionality** - Complete CRUD operations for split transactions
6. **Test Suite** - Comprehensive testing of split transaction workflows

## Timeline

**Session 1:** Backend createTransaction enhancement, basic SplitEntryModal
**Session 2:** Enhanced transaction modal, display updates, basic testing
**Session 3:** Edit functionality, comprehensive testing, polish and refinement

Upon completion, users will have full Quicken-style split transaction capability for manual invoice allocation across multiple budget categories.