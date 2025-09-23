# Issue: Add Expense Modal Should Filter Active Payment Methods

**Issue ID**: ISSUE-20250730_1630  
**Module**: Frontend Desktop - Transaction Entry  
**Priority**: MEDIUM  
**Status**: 🔴 OPEN  
**Created**: July 30, 2025 16:30 EST  
**Reporter**: APM Manager Agent (via Michael)  

## Description

The Add Expense modal currently shows ALL payment methods regardless of their status (active or null). This is inconsistent with the HOA Dues modal which correctly filters to show only `status: "active"` payment methods.

## Current Behavior

- Add Expense modal: Shows all payment methods (active, inactive, null status)
- HOA Dues modal: Shows only payment methods with `status: "active"`

## Expected Behavior

Both modals should consistently show only active payment methods:
- Filter payment methods where `status === "active"`
- Hide inactive or null status payment methods
- Maintain consistency across all transaction entry points

## Business Impact

- **User Confusion**: Users may select inactive payment methods
- **Data Integrity**: Transactions could be linked to discontinued payment methods
- **Consistency**: Different behavior between modals creates poor UX

## Technical Details

The payment methods query in Add Expense modal needs to add a filter:

```javascript
// Current (showing all)
const paymentMethods = await getPaymentMethods(clientId);

// Should be (filtered)
const paymentMethods = await getPaymentMethods(clientId)
  .filter(method => method.status === 'active');
```

## Reproduction Steps

1. Add payment methods with different statuses (active, inactive, null)
2. Open Add Expense modal
3. Check payment method dropdown - see all methods listed
4. Open HOA Dues modal
5. Check payment method dropdown - see only active methods

## Proposed Solution

Update the Add Expense modal to filter payment methods by active status, matching the HOA Dues modal behavior.

## Related Issues

- Payment Methods import now includes status field (fixed in import scripts)
- HOA Dues modal already implements correct filtering

---
*Issue created by*: APM Manager Agent  
*Discovered during*: Import script fixes discussion  