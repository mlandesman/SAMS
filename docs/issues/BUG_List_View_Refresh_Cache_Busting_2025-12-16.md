# 🐛 BUG: List View Refresh Issue - Cache-Busting Needed for All Tabs

**Issue Type:** Bug  
**Priority:** 🔥 HIGH  
**Status:** Open  
**Created:** December 16, 2025  
**Module:** Frontend - List Management View

---

## Problem Description

After editing items in the List Management View (Categories, Vendors, Payment Methods), the table does not refresh to show the updated data. Changes are saved to Firestore successfully, but the UI doesn't update until the browser cache is cleared.

**Affected Tabs:**
- ✅ Units (FIXED in v1.0.1)
- ❌ Categories (NOT FIXED)
- ❌ Vendors (NOT FIXED)
- ❌ Payment Methods (NOT FIXED)

**Environment:** Production only (Dev works fine)

---

## Root Cause

The same issue that affected Units list:
1. **HTTP-level caching** - API responses are being cached by the browser
2. **Missing refreshTrigger** - Components don't refetch when `refreshTrigger` changes
3. **No delay after save** - Refresh happens before database write completes

---

## Solution Applied to Units (v1.0.1)

The fix for Units involved three changes:

### 1. Cache-Busting in API Call
**File:** `frontend/sams-ui/src/api/units.js`
```javascript
const response = await fetch(`${API_BASE_URL}/clients/${clientId}/units?t=${Date.now()}`, {
  method: 'GET',
  headers,
  credentials: 'include',
  cache: 'no-store',
});
```

### 2. refreshTrigger Support in Component
**File:** `frontend/sams-ui/src/components/lists/ModernUnitList.jsx`
- Added `refreshTrigger` prop
- Passed to `ModernBaseList`

**File:** `frontend/sams-ui/src/components/lists/ModernBaseList.jsx`
- Added `refreshTrigger` to `useEffect` dependency array

### 3. Delay After Modal Close
**File:** `frontend/sams-ui/src/views/ListManagementView.jsx`
```javascript
// Close modal first
handleCloseModal();

// Brief pause to allow database write to complete
await new Promise(resolve => setTimeout(resolve, 500));

// Refresh the list by triggering a re-render
setRefreshTrigger(prev => prev + 1);
```

---

## Required Changes

### 1. Add Cache-Busting to API Calls

**Files to Update:**
- `frontend/sams-ui/src/api/vendors.js` - `getVendors()` function
- `frontend/sams-ui/src/api/categories.js` - `getCategories()` function
- `frontend/sams-ui/src/api/paymentMethods.js` - `getPaymentMethods()` function

**Change Pattern:**
```javascript
// BEFORE
const response = await fetch(`${API_BASE_URL}/clients/${clientId}/vendors`, {
  method: 'GET',
  headers,
  credentials: 'include',
});

// AFTER
const response = await fetch(`${API_BASE_URL}/clients/${clientId}/vendors?t=${Date.now()}`, {
  method: 'GET',
  headers,
  credentials: 'include',
  cache: 'no-store',
});
```

### 2. Add refreshTrigger Support to List Components

**Files to Update:**
- `frontend/sams-ui/src/components/lists/ModernVendorList.jsx`
- `frontend/sams-ui/src/components/lists/ModernCategoryList.jsx`
- `frontend/sams-ui/src/components/lists/ModernPaymentMethodList.jsx`

**Change Pattern:**
```javascript
// Add refreshTrigger prop
const ModernVendorList = ({ selectedItem, onItemSelect, onItemCountChange, searchTerm = '', refreshTrigger = 0 }) => {
  // ... existing code ...
  
  return (
    <ModernBaseList
      // ... existing props ...
      refreshTrigger={refreshTrigger}
    />
  );
};
```

**Note:** `ModernBaseList` already supports `refreshTrigger` (fixed in v1.0.1), so components just need to pass it through.

### 3. Add Delay to Save Handlers

**File:** `frontend/sams-ui/src/views/ListManagementView.jsx`

**Functions to Update:**
- `handleSaveVendor()` - Line ~718
- `handleSaveCategory()` - Line ~746
- `handleSavePaymentMethod()` - Line ~780

**Change Pattern:**
```javascript
// BEFORE
await updateVendor(...);
setRefreshTrigger(prev => prev + 1);
handleCloseModal();

// AFTER
await updateVendor(...);
handleCloseModal();
await new Promise(resolve => setTimeout(resolve, 500));
setRefreshTrigger(prev => prev + 1);
```

---

## Testing Checklist

After implementing the fix:

- [ ] Edit a Category → Modal closes → Table refreshes with new data
- [ ] Edit a Vendor → Modal closes → Table refreshes with new data
- [ ] Edit a Payment Method → Modal closes → Table refreshes with new data
- [ ] Create new item → Modal closes → Table refreshes with new item
- [ ] Delete item → Table refreshes (item removed)
- [ ] Test in Production (where issue occurs)
- [ ] Verify no regression in Dev

---

## Related Issues

- **Fixed:** Units list refresh issue (v1.0.1 - commits `af3d85c`, `0909b4f`)
- **Reference:** Production deployment v1.0.1 completion log

---

## Acceptance Criteria

✅ All list view tabs (Categories, Vendors, Payment Methods) refresh immediately after edits  
✅ No browser cache clearing required  
✅ Changes visible immediately after modal closes  
✅ Works in Production environment  
✅ No regression in Dev environment

---

## Implementation Notes

- **Estimated Effort:** 1-2 hours
- **Risk:** Low (same pattern as Units fix, already proven)
- **Dependencies:** None
- **Breaking Changes:** None

---

**Issue Created:** December 16, 2025  
**Last Updated:** December 16, 2025
