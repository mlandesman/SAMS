# Task Assignment: Fix HOA Dues API Domain Migration

## Task Overview
**Agent:** Agent_Production_HOA_Critical  
**Priority:** HIGH - Critical Production Blocker  
**Category:** API Domain Migration Fix  
**Estimated Effort:** 1-2 hours

## Problem Analysis
HOA Dues page renders briefly then goes completely blank due to API domain migration. The backend routes were moved to domain-specific pattern `/hoadues/*` but frontend code still calls client-scoped pattern `/clients/:id/hoadues/*`, causing API failures that crash the React component.

### Critical Production Impact:
- **Blank Screen:** Complete HOA Dues page failure after initial render
- **User Impact:** Users cannot access HOA dues functionality at all
- **Error Pattern:** Component renders, makes API call, fails, crashes to blank screen

### Root Cause:
- **Backend routes** correctly moved to `/hoadues/*` domain pattern (`backend/index.js:110`)
- **Frontend API calls** still using old `/clients/${clientId}/hoadues/*` pattern  
- **API file affected:** `frontend/sams-ui/src/context/HOADuesContext.jsx`

## Required Changes

### 1. Update Frontend API Calls
**File:** `frontend/sams-ui/src/context/HOADuesContext.jsx`
- **Line 191:** Units API call - `/clients/${selectedClient.id}/units` (verify this still works)
- **Line 313:** HOA Dues API call - `/clients/${selectedClient.id}/hoadues/year/${year}` → `/hoadues/${selectedClient.id}/year/${year}`

### 2. Verification Points
1. **No Blank Screen:** HOA Dues page loads and displays properly
2. **Data Loading:** Units and dues data load without errors
3. **Console Clean:** No 404 or API errors in browser console
4. **Full Functionality:** HOA dues operations work normally

## Implementation Steps

### Step 1: Update HOA Dues Data API Call
Fix `frontend/sams-ui/src/context/HOADuesContext.jsx` line 313:
```javascript
// OLD (causing crashes)
const response = await fetch(`${API_BASE_URL}/clients/${selectedClient.id}/hoadues/year/${year}`, {

// NEW (domain-specific)
const response = await fetch(`${API_BASE_URL}/hoadues/${selectedClient.id}/year/${year}`, {
```

### Step 2: Verify Units API Call Still Works
Check line 191 - if Units API also fails, update:
```javascript
// Current
const response = await fetch(`${API_BASE_URL}/clients/${selectedClient.id}/units`, {

// If needed, check if should be:
const response = await fetch(`${API_BASE_URL}/units/${selectedClient.id}`, {
```

### Step 3: Check for Additional HOA API Calls
Search the file for any other API calls using the old `/clients/${clientId}/hoa*` pattern and update them to use domain-specific routing.

### Step 4: Testing Protocol
1. **Navigate to /hoadues** - verify page loads without blank screen
2. **Check Browser Console** - verify no 404 or API errors
3. **Test Data Loading** - confirm units and dues data display properly
4. **Test Functionality** - verify HOA dues operations work normally
5. **Test Client Switching** - ensure switching clients works properly

## Success Criteria
- ✅ HOA Dues page loads completely without blank screen
- ✅ No 404 errors for HOA dues endpoints in browser console
- ✅ Units data loads properly (verify units API still works)
- ✅ HOA dues data loads for selected year
- ✅ All HOA dues functionality works normally
- ✅ Client switching works without errors

## Critical Guidelines
- **DO NOT** change backend routes - they are correctly placed under `/hoadues` domain
- **ONLY** update frontend API call paths  
- **TEST** both units loading and dues data loading
- **VERIFY** no other components use the old client-scoped HOA API patterns

## Files to Modify
1. `frontend/sams-ui/src/context/HOADuesContext.jsx` (primary fix)

## Files to Test
1. HOA Dues page (`/hoadues`) - complete functionality
2. Browser console - no API errors
3. Client switching - works properly

## Additional Investigation Required
**If Units API also fails (causing blank screen before HOA dues API):**
- Check if `/clients/${clientId}/units` was also migrated to domain-specific routing
- Update units API call pattern if needed

**Search for other HOA API calls:**
- Check if other components/services make HOA dues API calls
- Update any additional instances of old client-scoped pattern

**Error Handling:**
- Verify error boundaries catch API failures properly
- Ensure graceful fallbacks for API errors

## Backend Route Verification
Current backend routing (confirmed working):
```javascript
// Domain-specific pattern (NEW - backend/index.js:110)
app.use('/hoadues', hoaDuesRoutes);

// Route handler (backend/routes/hoaDues.js:121)
router.get('/year/:year', async (req, res) => {
  const clientId = req.originalParams?.clientId || req.params.clientId;
  // ...
});
```

**Expected Working URL:** `POST /hoadues/${clientId}/year/${year}`

**Report back immediately if this fixes the blank screen or if additional API endpoints need migration.**