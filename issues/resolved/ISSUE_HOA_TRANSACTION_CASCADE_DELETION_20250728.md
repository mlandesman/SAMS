# ISSUE: Balance Import Fix - Incorrect API Client Import Pattern

## Issue ID
TASK-BALANCE-IMPORT-FIX-001

## Date
July 28, 2025

## Component
Frontend - Balance Utilities

## Priority
High

## Status
RESOLVED

## Description
The Vite development server was failing to start due to import errors in two balance utility files (`balanceRecalculation.js` and `clientAccounts.js`). Both files were trying to import `apiClient` from `../api/secureApiClient`, but this named export doesn't exist.

## Root Cause Analysis

### Why the Implementation Agent Used the Wrong Import

1. **Pattern Confusion**: The Implementation Agent was following the authentication pattern from `client.js` which uses direct fetch calls with manual authentication token retrieval.

2. **API Client Misunderstanding**: The agent assumed there would be a simple `apiClient` export from `secureApiClient.js` similar to what exists in `enhancedApiClient.js`.

3. **Missing Documentation**: The codebase has two different API client patterns:
   - `secureApiClient.js`: Exports a class that requires a `samsUser` object (for React components)
   - `enhancedApiClient.js`: Exports a pre-configured `apiClient` instance (for utilities)

4. **Incomplete Migration**: The Implementation Agent successfully removed Firebase imports but didn't properly identify which API client to use for non-React utilities.

## Solution

Changed both files to import from the correct API client:

```javascript
// Before (incorrect)
import { apiClient } from '../api/secureApiClient';

// After (correct)
import { apiClient } from '../api/enhancedApiClient';
```

## Technical Details

### Available API Clients in the Codebase

1. **`secureApiClient.js`**:
   - Exports: `SecureApiClient` class, `createSecureApiClient()`, `useSecureApi()` hook
   - Requires: `samsUser` object for permission validation
   - Use case: React components with access to AuthContext

2. **`enhancedApiClient.js`**:
   - Exports: Pre-configured `apiClient` instance
   - Handles: Authentication via Firebase tokens automatically
   - Use case: Utility functions and non-React code

3. **`client.js`**:
   - Pattern: Direct fetch calls with manual token retrieval
   - Use case: Legacy pattern, being phased out

## Files Modified

1. `/frontend/sams-ui/src/utils/balanceRecalculation.js`
2. `/frontend/sams-ui/src/utils/clientAccounts.js`

## Testing

- ✅ Vite development server starts without import errors
- ✅ Both utility files can now properly import the API client
- ✅ Authentication is handled correctly by `enhancedApiClient`

## Lessons Learned

1. **Documentation Gap**: Need better documentation about which API client to use in different contexts
2. **Pattern Clarity**: The codebase has evolved to have multiple API patterns, which can be confusing
3. **Migration Guidance**: Future Firebase migrations should specify which API client pattern to use

## Prevention

To prevent similar issues:
1. Document the different API client patterns and their use cases
2. Add code comments in utility files about which API client to use
3. Consider consolidating API client patterns to reduce confusion

## Resolution Date
July 28, 2025

## Resolved By
Debug Specialist (Claude Code Instance)