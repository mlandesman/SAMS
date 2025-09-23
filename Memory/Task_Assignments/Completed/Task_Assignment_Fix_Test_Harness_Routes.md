# Task Assignment: Fix Test Harness Routes for Clean Domain Architecture

**Priority**: HIGH  
**Estimated Duration**: 30-45 minutes  
**Prerequisites**: API Domain Migration Cleanup (Complete)  
**Assigned To**: Implementation Agent  

## Task Overview

Fix the test harness system to use the new clean domain architecture routes instead of legacy `/api/*` patterns. This will restore Implementation Agent testing capabilities that are currently broken due to outdated route references.

## Problem Statement

The test harness health check is referencing the legacy `/api/clients/test` endpoint which no longer exists after the API Domain Migration Cleanup. This breaks the testing framework that Implementation Agents rely on for verification.

**Current Error**: References to `/api/clients/test` return 404 Not Found  
**Required Fix**: Update to use `/system/health` endpoint for health checks

## Scope of Work

### Files Requiring Updates (8 total)

**HIGH PRIORITY - Core Functionality:**
1. `backend/testing/apiClient.js` (Line 89) - Update healthCheck method
2. `backend/testing/config.js` (Lines 36, 44) - Update BACKEND_HEALTH_CHECK_PATH and ENDPOINTS.HEALTH
3. `backend/testing/testSuccess.js` (Line 15) - Update validation test

**MEDIUM PRIORITY - Examples:**
4. `backend/testing/examples/basicUsageExample.js` (Lines 16, 58) - Update example code
5. `backend/testing/examples/multipleTestsExample.js` - Update if needed

**LOW PRIORITY - Documentation:**
6. `backend/testing/README.md` (Lines 73, 188) - Update documentation examples

## Route Changes Required

| **Current (Legacy)** | **New (Clean Architecture)** | **Purpose** |
|---------------------|------------------------------|-------------|
| `/api/clients/test` | `/system/health` | System health monitoring |

## Implementation Requirements

### 1. Update Core Configuration
**File**: `backend/testing/config.js`
```javascript
// OLD:
BACKEND_HEALTH_CHECK_PATH: '/api/clients/test'

// NEW:
BACKEND_HEALTH_CHECK_PATH: '/system/health'
```

### 2. Update Health Check Method
**File**: `backend/testing/apiClient.js`
- Update the healthCheck method to use `/system/health`
- Ensure response parsing works with new endpoint format

### 3. Update Validation Tests
**File**: `backend/testing/testSuccess.js`
- Update test validation to use new health endpoint
- Verify response format compatibility

### 4. Update Examples and Documentation
- Update all example files to use new routes
- Update README.md with correct endpoint references

## Acceptance Criteria

### ✅ Functional Requirements
- [ ] Test harness health check works with `/system/health` endpoint
- [ ] All example files use correct routes
- [ ] Implementation Agents can successfully run tests
- [ ] No legacy `/api/*` references remain in testing framework

### ✅ Technical Requirements
- [ ] Health check returns proper status (200 OK)
- [ ] Response parsing works correctly
- [ ] Configuration properly updated
- [ ] Examples run without errors

### ✅ Documentation Requirements
- [ ] README.md updated with correct endpoints
- [ ] Example code reflects new architecture
- [ ] Comments explain route usage

## Testing Instructions

1. **Test Health Check Endpoint**:
   ```bash
   curl http://localhost:5001/system/health
   ```
   Should return: `200 OK` with system status

2. **Test Harness Functionality**:
   ```bash
   cd backend/testing
   node testSuccess.js
   ```
   Should complete without errors

3. **Run Example Tests**:
   ```bash
   node examples/basicUsageExample.js
   ```
   Should execute test scenarios successfully

## Business Impact

**Restores Implementation Agent testing capabilities** - Critical for maintaining code quality and enabling agents to verify their work properly.

## Notes

- The `/system/health` endpoint is the appropriate choice for health monitoring
- This follows the clean domain architecture established in the API migration
- Maintains backward compatibility for test functionality while using proper routes

## Handoff Instructions

1. Update all files in the specified order (HIGH → MEDIUM → LOW priority)
2. Test each change incrementally
3. Verify full test harness functionality before completion
4. Document any issues encountered during migration

**Ready for Implementation Agent assignment.**