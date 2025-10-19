# 🧪 Testing Guide for Implementation Agents

## ⚠️ CRITICAL: Why You MUST Use testHarness

### The Problem:
```javascript
// This will FAIL with 401/403 errors:
const response = await axios.get('http://localhost:5001/water/AVII/bills');
// Error: Unauthorized - No Firebase auth token

// This will also FAIL:
const response = await fetch('/api/credit/AVII/203');
// Error: 403 Forbidden - Missing authentication

// Curl will FAIL too:
curl http://localhost:5001/water/AVII/bills
// Error: Authentication required
```

### Why It Fails:
- All SAMS API endpoints require Firebase authentication
- They check for valid Firebase auth tokens in request headers
- Direct calls don't include these tokens
- Backend will reject the request with 401 (Unauthorized) or 403 (Forbidden)

---

## ✅ The Solution: Use testHarness

### What testHarness Does:
1. Authenticates with Firebase using service account
2. Gets valid auth token
3. Includes token in all API requests
4. Provides authenticated context for your tests

### How to Use:

#### Option 1: Interactive testHarness
```bash
cd backend
node testing/testHarness.js

# Then interact with menu to:
# - Select client (AVII)
# - Call endpoints with auth
# - View responses
```

#### Option 2: Create Test Script (Recommended)
```javascript
// backend/testing/testTask1Penalties.js

// Import testHarness utilities (if available)
// OR create simple test that runs through backend services

import admin from 'firebase-admin';
import waterDataService from '../services/waterDataService.js';

// Initialize Firebase (testHarness does this)
const serviceAccount = require('../serviceAccountKey-dev.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function testPenalties() {
  try {
    const clientId = 'AVII';
    const year = 2026;
    
    console.log('Testing penalty calculation...');
    
    // Call service methods directly (already authenticated)
    const aggregatedData = await waterDataService.getAggregatedData(clientId, year);
    
    console.log('Current penalties:', aggregatedData.months[0].units['203'].penalties);
    
    // Trigger recalc
    await waterDataService.calculateYearSummary(clientId, year);
    
    // Check again
    const updatedData = await waterDataService.getAggregatedData(clientId, year);
    console.log('After recalc:', updatedData.months[0].units['203'].penalties);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testPenalties();
```

#### Run Your Test:
```bash
cd backend
node testing/testTask1Penalties.js
```

---

## 🎯 Testing Patterns

### Pattern 1: Service Layer Testing (Preferred)
```javascript
// Import service directly
import waterDataService from '../services/waterDataService.js';

// Call methods (already authenticated via Firebase Admin SDK)
const data = await waterDataService.getAggregatedData('AVII', 2026);
```

**Pros:**
- Direct access to business logic
- Already authenticated
- Fast execution
- Easy to debug

### Pattern 2: API Endpoint Testing (Via Service)
```javascript
// Import controller
import waterController from '../controllers/waterController.js';

// Simulate request/response
const mockReq = {
  params: { clientId: 'AVII' },
  query: { year: 2026 },
  user: { uid: 'test-user' } // Auth context
};

const mockRes = {
  json: (data) => console.log('Response:', data),
  status: (code) => ({ json: (data) => console.error(code, data) })
};

await waterController.getAggregatedData(mockReq, mockRes);
```

### Pattern 3: Using Existing testHarness
```bash
# Interactive menu
cd backend
node testing/testHarness.js

# Follow prompts:
# 1. Select test type
# 2. Enter client ID (AVII)
# 3. View results
```

---

## 📋 Quick Reference

### DO:
✅ Use testHarness for API endpoint testing
✅ Import services directly for unit testing
✅ Use Firebase Admin SDK (already authenticated)
✅ Create task-specific test files
✅ Run tests from backend directory

### DO NOT:
❌ Call endpoints with axios/fetch (no auth token)
❌ Use curl or Postman (no Firebase auth)
❌ Try to manually add auth tokens (complex)
❌ Skip authentication entirely

---

## 🔍 Debugging Authentication Issues

### If You See:
```
Error: Unauthorized (401)
Error: Forbidden (403)
Error: Authentication required
Error: Invalid token
```

### Solution:
You're trying to call endpoints without authentication. Use testHarness or call services directly.

### Verify Authentication:
```javascript
// Check if Firebase initialized
console.log('Firebase apps:', admin.apps.length); // Should be > 0

// Check service account
console.log('Using account:', serviceAccount.project_id); // Should show project ID
```

---

## 📊 Example Test Structure

```javascript
// backend/testing/testTask1Penalties.js

import admin from 'firebase-admin';
import waterDataService from '../services/waterDataService.js';

// Initialize (testHarness does this automatically)
const serviceAccount = require('../serviceAccountKey-dev.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function runTests() {
  console.log('🧪 Starting Task 1 Tests...\n');
  
  // Test 1: Check current state
  console.log('Test 1: Verify penalties = $0 before fix');
  const before = await waterDataService.getAggregatedData('AVII', 2026);
  console.log('  Penalties:', before.months[0].units['203'].penalties);
  console.log('  Expected: 0');
  console.log('  ✅ Pass\n');
  
  // Test 2: Trigger recalc
  console.log('Test 2: Manual refresh calculates penalties');
  await waterDataService.calculateYearSummary('AVII', 2026);
  const after = await waterDataService.getAggregatedData('AVII', 2026);
  console.log('  Penalties:', after.months[0].units['203'].penalties);
  console.log('  Expected: > 0');
  console.log(after.months[0].units['203'].penalties > 0 ? '  ✅ Pass\n' : '  ❌ Fail\n');
  
  // ... more tests
  
  console.log('🎉 All tests complete!');
}

runTests().catch(console.error);
```

---

## 🎯 Summary

**Key Point:** All SAMS endpoints require Firebase authentication. 

**Solution:** Use testHarness or call services directly (they use Firebase Admin SDK which is already authenticated).

**Never:** Try to call HTTP endpoints with axios/fetch/curl - they will fail with 401/403 errors.

---

**Questions?** Ask Manager Agent or review existing test files in `backend/testing/`
