# Task Assignment: Migrate Dashboard HOA Dues Endpoint to Domain-Specific Route

**Priority**: HIGH - CRITICAL  
**Estimated Duration**: 15-20 minutes  
**Prerequisites**: API Domain Migration Cleanup (Complete)  
**Assigned To**: Implementation Agent  

## Task Overview

Fix the dashboard cards showing zeros by migrating the last remaining legacy HOA Dues endpoint to the domain-specific route established during the API Domain Migration. The dashboard is calling a deleted endpoint.

## Problem Statement

**Current Issue**: Dashboard cards show zeros instead of actual data:
- HOA Dues Status: 0.0% (should show actual collection rate)
- Past Due Units: $0 (should show actual past due amounts)

**Root Cause**: Dashboard calls **deleted endpoint** `/clients/{id}/hoadues/year/{year}` that was eliminated during API Domain Migration. Only the `/hoadues/{id}/year/{year}` endpoints exist now.

## Scope of Work

### Single File Migration Required

**FILE**: `/frontend/sams-ui/src/hooks/useDashboardData.js`
- **Line 250**: Update endpoint from legacy to domain-specific route
- **Duration**: Single line change + testing

### API Endpoint Migration

**CURRENT (Broken - Calls Deleted Endpoint):**
```javascript
// Line 250
const response = await fetch(`${API_BASE_URL}/clients/${selectedClient.id}/hoadues/year/${currentYear}`);
```

**REQUIRED (Working - Uses Domain Route):**
```javascript
// Line 250
const response = await fetch(`${API_BASE_URL}/hoadues/${selectedClient.id}/year/${currentYear}`);
```

## Validation Reference

**HOA Dues Context is ALREADY CORRECT** (for reference):
- File: `/frontend/sams-ui/src/context/HOADuesContext.jsx`
- Line 313: `${API_BASE_URL}/hoadues/${selectedClient.id}/year/${year}` ✅
- Status: Working properly, returns actual data

**Dashboard should use IDENTICAL endpoint pattern.**

## Acceptance Criteria

### ✅ Functional Requirements
- [ ] Dashboard HOA Dues Status card displays actual collection rate (not 0.0%)
- [ ] Dashboard Past Due Units card displays actual past due amounts (not $0)
- [ ] Dashboard data matches HOA Dues section data (same source)
- [ ] No 404 errors for HOA Dues API calls

### ✅ Technical Requirements
- [ ] Dashboard uses domain-specific `/hoadues/` endpoint
- [ ] No references to deleted `/clients/.../hoadues/...` endpoints remain
- [ ] API calls return 200 OK instead of 404 Not Found
- [ ] Data structure remains consistent with HOA Dues Context

### ✅ Integration Requirements
- [ ] Dashboard cards reflect real financial data
- [ ] Cache functionality works correctly with new endpoint
- [ ] No breaking changes to other dashboard cards

## Testing Instructions

### 1. **Before Fix - Verify Problem**:
```bash
# Open browser network tab
# Load dashboard: http://localhost:3000/dashboard
# Observe: 404 error for /clients/MTC/hoadues/year/2025
# Observe: Dashboard cards show 0.0% and $0
```

### 2. **After Fix - Verify Resolution**:
```bash
# Load dashboard: http://localhost:3000/dashboard
# Observe: 200 OK for /hoadues/MTC/year/2025
# Observe: Dashboard cards show actual percentages and amounts
```

### 3. **Cross-Validation**:
```bash
# Navigate to HOA Dues section: http://localhost:3000/hoadues
# Compare values: Dashboard cards should match HOA section data
# Both should show identical collection rates and past due amounts
```

### 4. **Use Test Harness**:
```bash
cd backend/testing
node examples/basicUsageExample.js
# Test /hoadues/ endpoints return proper data
```

## Implementation Details

### Exact Change Required

**File**: `/frontend/sams-ui/src/hooks/useDashboardData.js`
**Line**: 250

**FROM (Broken):**
```javascript
const response = await fetch(`${API_BASE_URL}/clients/${selectedClient.id}/hoadues/year/${currentYear}`);
```

**TO (Fixed):**
```javascript
const response = await fetch(`${API_BASE_URL}/hoadues/${selectedClient.id}/year/${currentYear}`);
```

### Why This Works

1. **Endpoint Exists**: `/hoadues/` routes were established during API Domain Migration
2. **Data Structure**: Returns same data structure as HOA Dues Context expects
3. **Cache Compatibility**: Uses same cache keys as HOA Dues Context (no collision)
4. **Consistent Source**: Dashboard and HOA section use identical data source

## Business Impact

**Restores dashboard financial overview** - Users can see accurate collection rates and past due amounts for informed financial decision-making.

## Notes

- This is the **only remaining legacy endpoint** after API Domain Migration
- HOA Dues Context already uses correct domain routes
- Single line change with immediate results
- No cache collision issues after migration (contexts use same endpoint)

## Handoff Instructions

1. **Make the single endpoint change** on line 250
2. **Test dashboard immediately** - should show real data
3. **Verify no 404 errors** in browser network tab
4. **Compare with HOA Dues section** - values should match
5. **Use test harness for verification**

**This is a critical but simple fix - one line change to restore dashboard functionality.**

**Ready for Implementation Agent assignment.**