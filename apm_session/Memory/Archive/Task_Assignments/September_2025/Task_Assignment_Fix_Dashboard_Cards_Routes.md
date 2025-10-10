# Task Assignment: Fix Dashboard Cards Routes for Mobile PWA

**Priority**: HIGH  
**Estimated Duration**: 20-30 minutes  
**Prerequisites**: API Domain Migration Cleanup (Complete)  
**Assigned To**: Implementation Agent  

## Task Overview

Fix the mobile PWA dashboard cards to use the unified config pattern for API routing instead of legacy `/api/*` fallback patterns. This will restore Exchange Rate card functionality in the mobile dashboard.

## Problem Statement

The mobile PWA dashboard Exchange Rate card is broken due to legacy API route fallback patterns that reference non-existent `/api/*` endpoints. The desktop UI already uses the correct unified config pattern and works properly.

**Current Issue**: Mobile PWA Exchange Rate card fails to load data  
**Root Cause**: Legacy fallback to `/api` instead of proper domain-specific routes  
**Working Reference**: Desktop UI uses correct unified config pattern  

## Scope of Work

### Files Requiring Updates (2 total)

**BROKEN - Mobile PWA Files:**
1. `/frontend/mobile-app/src/hooks/useDashboardData.js` (Line 276)
2. `/frontend/mobile-app/src/hooks/useExchangeRates.jsx` (Line 24)

**WORKING - Desktop Reference Files:**
- `/frontend/sams-ui/src/config/index.js` (correct pattern)
- `/frontend/sams-ui/src/context/ExchangeRateContext.jsx` (working implementation)

## Route Changes Required

### Current Broken Pattern (Mobile):
```javascript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const endpoint = `${API_BASE_URL}/exchange-rates/check`;
// Results in: /api/exchange-rates/check (404 Not Found)
```

### Required Working Pattern (From Desktop):
```javascript
import { config } from '../config';
const endpoint = `${config.api.baseUrl}/system/exchange-rates/check`;
// Results in: http://localhost:5001/system/exchange-rates/check (200 OK)
```

## Implementation Requirements

### 1. Update Mobile Dashboard Data Hook
**File**: `/frontend/mobile-app/src/hooks/useDashboardData.js`
- Remove legacy API_BASE_URL fallback pattern
- Import and use unified config pattern like desktop UI
- Ensure Exchange Rate endpoint uses `/system/exchange-rates/check`

### 2. Update Mobile Exchange Rates Hook  
**File**: `/frontend/mobile-app/src/hooks/useExchangeRates.jsx`
- Remove legacy API_BASE_URL fallback pattern
- Import and use unified config pattern like desktop UI
- Ensure proper domain-specific routing

### 3. Verify Mobile Config Exists
**Check**: `/frontend/mobile-app/src/config/` directory
- Ensure mobile app has equivalent config structure to desktop
- If missing, create config following desktop pattern
- Maintain environment variable compatibility

## Acceptance Criteria

### ✅ Functional Requirements
- [ ] Mobile PWA Exchange Rate card displays current rates
- [ ] Mobile dashboard loads without API errors
- [ ] Exchange rate data updates properly
- [ ] No legacy `/api/*` fallback patterns remain

### ✅ Technical Requirements
- [ ] Uses unified config pattern like desktop UI
- [ ] Proper domain-specific routes (`/system/exchange-rates/check`)
- [ ] Maintains environment variable compatibility
- [ ] No breaking changes to existing functionality

### ✅ Integration Requirements
- [ ] Consistent API routing across desktop and mobile
- [ ] Same endpoints used by both interfaces
- [ ] Unified configuration approach

## Testing Instructions

1. **Test Mobile PWA Dashboard**:
   - Load mobile PWA at development URL
   - Verify Exchange Rate card displays data
   - Check browser console for API errors

2. **Test Exchange Rate Updates**:
   - Verify exchange rates refresh properly
   - Test manual refresh functionality
   - Confirm data consistency with desktop UI

3. **Cross-Platform Verification**:
   - Compare mobile and desktop dashboard data
   - Verify both use same API endpoints
   - Confirm unified behavior

## Desktop Reference Implementation

**Working Config Pattern** (`/frontend/sams-ui/src/config/index.js`):
```javascript
const config = {
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001'
  }
};
```

**Working Usage** (`/frontend/sams-ui/src/context/ExchangeRateContext.jsx`):
```javascript
import { config } from '../config';
const endpoint = `${config.api.baseUrl}/system/exchange-rates/check`;
```

## Business Impact

**Restores mobile PWA dashboard functionality** - Users can access exchange rate information from mobile devices, ensuring feature parity between desktop and mobile interfaces.

## Notes

- Desktop UI already working - use as reference implementation
- Mobile PWA config structure may need to be created if missing
- Focus on Exchange Rate card functionality specifically
- Maintain existing environment variable compatibility

## Handoff Instructions

1. Examine desktop UI config pattern first
2. Update mobile hooks to match desktop pattern
3. Test Exchange Rate card functionality
4. Verify no regression in other dashboard cards
5. Confirm cross-platform consistency

**Ready for Implementation Agent assignment after Test Harness task completion.**