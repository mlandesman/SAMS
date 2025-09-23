# ISSUE: HOA Dues Payment Failing - Forbidden Fields in Transaction Creation

**Issue ID**: ISSUE-20250724_1518  
**Created**: 2025-07-24  
**Priority**: 🚨 CRITICAL  
**Module**: Backend - HOA Dues Controller  
**Status**: 🔴 OPEN  

## Description

HOA Dues payment transactions are failing with forbidden field validation errors. The backend correctly rejects transactions containing legacy field names that violate our critical field schema requirements. This is a direct failure of the Phase 3 HOA migration that was marked as complete.

## Error Details

```
❌ Transaction validation failed: [
  "Forbidden field 'vendor' cannot be used. Use 'vendorId' and 'vendorName' instead",
  "Forbidden field 'category' cannot be used. Use 'categoryId' and 'categoryName' instead",
  "Forbidden field 'unit' cannot be used. Use 'unitId' instead",
  "Forbidden field 'transactionType' cannot be used. Use 'type' instead"
]
```

## Root Cause

The `hoaDuesController.js` is creating transactions with ALL forbidden fields:
- Line 215: `category: 'HOA Dues'` (should be `categoryId` and `categoryName`)
- Line 216: `transactionType: 'income'` (should be `type`)
- Line 220: `unit: unitId` (should be only `unitId`)
- Line 222: `vendor: 'Deposit'` (should be `vendorId` and `vendorName`)

## Impact

- **Production Blocker**: HOA dues payments cannot be recorded
- **User Experience**: Generic error message "Failed to create transaction record" provides no actionable information
- **Migration Failure**: Phase 3 HOA migration marked complete but is actually broken
- **Trust Issue**: Critical requirements explicitly forbid these fields but were used anyway

## Required Actions

1. **Immediate Fix**: Update `hoaDuesController.js` to use correct field schema:
   ```javascript
   // WRONG (Current)
   category: 'HOA Dues',
   transactionType: 'income',
   unit: unitId,
   vendor: 'Deposit'
   
   // CORRECT (Required)
   categoryId: 'cat-hoa-dues',
   categoryName: 'HOA Dues',
   type: 'income',
   unitId: unitId,  // Already correct on line 221
   vendorId: 'vendor-deposit',
   vendorName: 'Deposit'
   ```

2. **Testing**: Comprehensive testing of HOA dues payment flow
3. **Audit**: Check ALL transaction creation points for similar violations
4. **Update Phase 3 Status**: Mark as incomplete/failed

## Related Files

- `/backend/controllers/hoaDuesController.js` - Contains forbidden fields
- `/backend/controllers/transactionsController.js` - Correctly validates and rejects
- `/apm/memory/critical/SAMS_PROJECT_CRITICAL_REQUIREMENTS.md` - Defines requirements

## Notes

- Backend validation is working correctly by rejecting these fields
- This should have been caught during Phase 3 testing
- Violates 5 days of field cleanup work already completed
- Must ensure ALL agents understand these are FORBIDDEN fields