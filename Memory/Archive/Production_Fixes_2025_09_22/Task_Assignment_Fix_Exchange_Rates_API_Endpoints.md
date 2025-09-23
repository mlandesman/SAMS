# Task Assignment: Fix Exchange Rates API Endpoint Migration

## Task Overview
**Agent:** Agent_Production_Exchange_Rates  
**Priority:** HIGH - Critical Production Issue  
**Category:** API Endpoint Migration Fix  
**Estimated Effort:** 1-2 hours

## Problem Analysis
The recent API domain migration broke Exchange Rates functionality. The backend routes were moved to `/system/exchange-rates/*` but frontend code still calls `/exchange-rates/*`, causing 404 errors.

### Specific Errors Observed:
```
Failed to load resource: the server responded with a status of 404 (Not Found)
❌ Error checking exchange rates: SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
:5001/exchange-rates/fetch:1 Failed to load resource: the server responded with a status of 404 (Not Found)
❌ Failed to fetch exchange rates: Error: Backend API error: 404 Not Found
```

### Root Cause:
- **Backend routes** correctly mounted at `/system/exchange-rates/*` (`backend/index.js:66`)
- **Frontend API calls** still using old `/exchange-rates/*` paths
- **API files affected:** `frontend/sams-ui/src/api/exchangeRates.js` and `frontend/sams-ui/src/utils/exchangeRates.js`

## Required Changes

### 1. Update Frontend API Calls
**File:** `frontend/sams-ui/src/api/exchangeRates.js`
- **Lines 18, 59, 89, 149:** Update all API calls from `/exchange-rates/*` to `/system/exchange-rates/*`

**File:** `frontend/sams-ui/src/utils/exchangeRates.js`  
- **Lines 15, 40, 79:** Update all API calls from `/exchange-rates/*` to `/system/exchange-rates/*`

### 2. Verification Points
1. **Console Error Resolution:** No more 404 errors in browser console
2. **Exchange Rate Updates:** Daily exchange rate checking works properly
3. **Manual Updates:** Manual exchange rate fetching functions properly
4. **Transaction Integration:** Exchange rates load correctly in transaction forms

## Implementation Steps

### Step 1: Update Primary API Service
Fix `frontend/sams-ui/src/api/exchangeRates.js`:
- Line 18: `/exchange-rates/daily-update` → `/system/exchange-rates/daily-update`
- Line 59: `/exchange-rates/manual-update` → `/system/exchange-rates/manual-update`  
- Line 89: `/exchange-rates/check` → `/system/exchange-rates/check`
- Line 149: `/exchange-rates/date/${date}` → `/system/exchange-rates/date/${date}`
- Line 113: `/exchange-rates/` → `/system/exchange-rates/`

### Step 2: Update Utility Service
Fix `frontend/sams-ui/src/utils/exchangeRates.js`:
- Line 15: `/exchange-rates/check` → `/system/exchange-rates/check`
- Line 40: `/exchange-rates/fetch` → `/system/exchange-rates/fetch`
- Line 79: `/exchange-rates/fill-missing` → `/system/exchange-rates/fill-missing`

### Step 3: Testing Protocol
1. **Start Development Server:** Run frontend and backend
2. **Test Exchange Rate Check:** Navigate to any page that loads exchange rates
3. **Verify No 404s:** Check browser console for eliminated 404 errors
4. **Test Manual Update:** Trigger manual exchange rate update (if applicable)
5. **Test Transaction Forms:** Verify exchange rates load in expense/transaction entry

## Success Criteria
- ✅ No 404 errors for exchange-rates endpoints in browser console
- ✅ Exchange rate checking/updating functions without errors  
- ✅ Transaction forms load exchange rates properly
- ✅ All exchange rate API endpoints respond with JSON (not HTML 404 pages)

## Critical Guidelines
- **DO NOT** change backend routes - they are correctly placed under `/system`
- **ONLY** update frontend API call paths
- **TEST** all exchange rate functionality after changes
- **VERIFY** that related mobile-app paths don't need similar updates

## Files to Modify
1. `frontend/sams-ui/src/api/exchangeRates.js`
2. `frontend/sams-ui/src/utils/exchangeRates.js`

## Files to Test
1. Any page that displays exchange rates
2. Transaction entry forms
3. Browser console (no errors)

**Report back immediately if this fixes the 404 errors or if you discover additional broken endpoints.**