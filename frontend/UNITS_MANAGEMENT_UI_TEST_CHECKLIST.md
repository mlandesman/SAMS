# Units & Management UI Testing Checklist

## Test Date: _________________
## Tester: _________________
## Environment: ⬜ Dev ⬜ Staging ⬜ Production

## 1. Units Display Tests

### Unit List View
- ⬜ Unit ID shows correctly (no unitNumber field)
- ⬜ Owners array displays as comma-separated list
- ⬜ Managers array displays as comma-separated list  
- ⬜ Status shows as 'active' or 'inactive' (not Occupied/Vacant)
- ⬜ Notes truncate properly in list view

### Unit Detail Modal
- ⬜ Unit ID displays correctly
- ⬜ Address field shows if present
- ⬜ Owners list shows all names
- ⬜ Managers list shows all names (or "None assigned")
- ⬜ Email addresses show as list
- ⬜ Square feet displays with proper formatting
- ⬜ Square meters calculated and displayed correctly
- ⬜ Property type shows (not 'type')

## 2. Unit Form Tests

### Create New Unit
- ⬜ Unit ID field is required and accepts input
- ⬜ Can add multiple owners (comma-separated)
- ⬜ Can add multiple managers (comma-separated)
- ⬜ Can add multiple emails (comma-separated)
- ⬜ Email validation works for invalid formats
- ⬜ Address field accepts input
- ⬜ Status dropdown shows active/inactive options
- ⬜ Property type dropdown shows correct options
- ⬜ Square feet input accepts numbers
- ⬜ Percentage ownership auto-calculates from square feet
- ⬜ Create button successfully saves unit

### Edit Existing Unit
- ⬜ Form pre-populates with existing data
- ⬜ Unit ID field is disabled (can't change)
- ⬜ Arrays display as comma-separated for editing
- ⬜ All changes save correctly
- ⬜ Square meters recalculates on square feet change

## 3. Categories Tests

### Category Display
- ⬜ Simple list without budget columns
- ⬜ Type shows as expense/income
- ⬜ Description displays if present

### Category Form
- ⬜ Name field is required
- ⬜ Description field is optional
- ⬜ Type dropdown has expense/income options
- ⬜ Status dropdown has active/inactive options
- ⬜ NO budget fields present anywhere
- ⬜ Create/Update works correctly

## 4. Vendors Tests  

### Vendor Display
- ⬜ Contact person name shows correctly
- ⬜ All contact fields visible in detail view

### Vendor Form
- ⬜ Contact Person field (not Contact Name)
- ⬜ Phone field accepts input
- ⬜ Email field validates format
- ⬜ Website field accepts URLs
- ⬜ Address field accepts multiline text
- ⬜ All contact info saves correctly

## 5. Mobile Experience Tests

### Touch Interactions
- ⬜ All buttons have adequate touch targets
- ⬜ Forms are usable on small screens
- ⬜ Modals scroll properly on mobile

### Mobile Unit Display
- ⬜ Unit reports show unitId (not unitNumber)
- ⬜ Arrays display properly in mobile view
- ⬜ Status displays correctly

## 6. Data Integrity Tests

### Field Removal Verification
- ⬜ No console errors about unitNumber
- ⬜ No console errors about missing budget fields
- ⬜ No display of undefined/null for removed fields

### Array Field Management
- ⬜ Empty arrays don't cause errors
- ⬜ Single item arrays display without trailing comma
- ⬜ Multiple items display with proper formatting

## 7. Cross-Component Integration

### Transaction Integration
- ⬜ Transactions display unit ID correctly
- ⬜ Unit selection dropdowns show unit IDs

### Report Integration  
- ⬜ Unit reports display correct unit identifier
- ⬜ All unit data accessible in reports

## Issues Found

### Critical Issues
1. _________________________________________________
2. _________________________________________________

### Minor Issues
1. _________________________________________________
2. _________________________________________________

### Suggestions
1. _________________________________________________
2. _________________________________________________

## Test Summary

- Total Tests: 55
- Passed: _____ 
- Failed: _____
- Blocked: _____

## Sign-off

- ⬜ All critical tests passed
- ⬜ Ready for deployment

Tester Signature: _________________
Date: _________________