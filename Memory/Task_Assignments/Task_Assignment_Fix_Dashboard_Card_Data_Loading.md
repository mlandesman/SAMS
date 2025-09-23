# Task Assignment: Fix Dashboard Card Data Loading - Cache Key Collision

**Priority**: HIGH - CRITICAL  
**Estimated Duration**: 45-60 minutes  
**Prerequisites**: API Domain Migration Cleanup (Complete), Test Harness Fixed  
**Assigned To**: Implementation Agent  

## Task Overview

Fix the dashboard cards that are displaying zeros instead of actual data due to cache key collisions between Dashboard and HOA Dues contexts. The root cause is identical cache keys being used for different API endpoints, causing data structure mismatches.

## Problem Statement

**Current Issue**: Dashboard cards show:
- HOA Dues Status: 0.0% (should show actual collection rate)
- Past Due Units: $0 (should show actual past due amounts)

**Root Cause**: Cache key collision between contexts:
- Dashboard calls `/clients/{id}/hoadues/year/{year}` 
- HOA Context calls `/hoadues/{id}/year/{year}`
- Both use same cache key: `hoa_dues_${clientId}_${year}`
- Data structure mismatch causes parsing errors → display zeros

## Scope of Work

### Files Requiring Updates

**PRIMARY FILE:**
1. `/frontend/sams-ui/src/hooks/useDashboardData.js` - Fix cache key collision and data loading

**INVESTIGATION FILES:**
2. `/frontend/sams-ui/src/context/HOADuesContext.jsx` - Reference for proper implementation
3. `/frontend/sams-ui/src/views/DashboardView.jsx` - Verify card display logic

## Implementation Strategy

### Option 1: Use HOA Context Data (RECOMMENDED)

**Modify Dashboard to use existing HOA Context instead of duplicate API calls:**

```javascript
// CURRENT (Problematic):
const getCacheKey = (clientId, year) => `hoa_dues_${clientId}_${year}`;
const response = await fetch(`${API_BASE_URL}/clients/${selectedClient.id}/hoadues/year/${currentYear}`);

// PROPOSED (Fixed):
// Import and use HOADuesContext data
import { useHOADues } from '../context/HOADuesContext';
const { duesData, unitsData, loading } = useHOADues();
```

### Option 2: Separate Cache Keys (Alternative)

**Change Dashboard cache keys to prevent collision:**

```javascript
// CURRENT:
const getCacheKey = (clientId, year) => `hoa_dues_${clientId}_${year}`;

// PROPOSED:
const getCacheKey = (clientId, year) => `dashboard_hoa_dues_${clientId}_${year}`;
```

## Acceptance Criteria

### ✅ Functional Requirements
- [ ] Dashboard HOA Dues Status card displays actual collection rate (not 0.0%)
- [ ] Dashboard Past Due Units card displays actual past due amounts (not $0)
- [ ] Dashboard cards reflect real data from HOA Dues section
- [ ] Cache keys no longer conflict between Dashboard and HOA contexts

### ✅ Technical Requirements
- [ ] No cache key collisions between contexts
- [ ] Consistent data sources across Dashboard and HOA sections
- [ ] Proper error handling for data loading failures
- [ ] Cache invalidation works correctly for both contexts

### ✅ Performance Requirements
- [ ] Dashboard loads without unnecessary duplicate API calls
- [ ] Cache utilization is efficient and non-conflicting
- [ ] No regression in dashboard loading performance

## Testing Instructions

### 1. **Dashboard Card Verification**:
```bash
# Load dashboard and verify cards display actual data
# Navigate to: http://localhost:3000/dashboard
# Check: HOA Dues Status shows percentage > 0.0%
# Check: Past Due Units shows amount > $0 (if applicable)
```

### 2. **Cache Verification**:
```bash
# Open browser developer tools → Application → Session Storage
# Verify cache keys don't conflict:
# - Dashboard context cache keys are distinct OR
# - Dashboard uses HOA Context data (no separate cache)
```

### 3. **Cross-Section Verification**:
```bash
# Navigate to HOA Dues section: http://localhost:3000/hoadues
# Verify data consistency between Dashboard cards and HOA section
# Values should match between both views
```

### 4. **Use Test Harness**:
```bash
cd backend/testing
node examples/basicUsageExample.js
# Verify HOA dues API endpoints return consistent data
```

## Detailed Implementation Guide

### Current Problematic Code (useDashboardData.js lines 14-16, 250):
```javascript
const getCacheKey = (clientId, year) => `hoa_dues_${clientId}_${year}`;
const response = await fetch(`${API_BASE_URL}/clients/${selectedClient.id}/hoadues/year/${currentYear}`);
```

### Option 1 Implementation - Use HOA Context:
```javascript
// Remove duplicate cache logic, use HOA Context
import { useHOADues } from '../context/HOADuesContext';

const useDashboardData = () => {
  const { duesData, unitsData, loading: hoaLoading } = useHOADues();
  
  // Calculate dashboard metrics from HOA context data
  const collectionRate = calculateCollectionRate(duesData);
  const pastDueAmount = calculatePastDue(duesData, unitsData);
  
  return { collectionRate, pastDueAmount, loading: hoaLoading };
};
```

### Option 2 Implementation - Separate Cache Keys:
```javascript
// Change cache key pattern to prevent collision
const getCacheKey = (clientId, year) => `dashboard_hoa_${clientId}_${year}`;
const getUnitsKey = (clientId) => `dashboard_units_${clientId}`;
```

## Business Impact

**Restores dashboard functionality** - Users can see accurate financial overview cards showing real collection rates and past due amounts, enabling proper financial monitoring.

## Notes

- **Option 1 (Use HOA Context) is preferred** - eliminates duplicate API calls and ensures data consistency
- **Option 2 (Separate keys) maintains current architecture** - but keeps duplicate API calls
- Cache collision affects both MTC and AVII clients
- Issue impacts Super Admin view where dashboard cards are primary financial overview

## Handoff Instructions

1. **Choose implementation approach** based on codebase architecture preferences
2. **Test with both MTC and AVII clients** to ensure cache keys work correctly
3. **Verify dashboard cards show real data** - not zeros
4. **Use test harness to validate API endpoint consistency**
5. **Test cache invalidation** - ensure updates propagate correctly

**Ready for Implementation Agent assignment.**