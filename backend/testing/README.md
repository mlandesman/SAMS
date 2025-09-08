# SAMS Backend Universal Test Harness

> **Zero-friction backend testing for SAMS** - No more authentication headaches!

This test harness eliminates the need for Test Agents to deal with tokens, API keys, or environment setup. Just import and test!

## 🎯 Quick Start

```javascript
import { testHarness } from './testing/testHarness.js';

// Simple test - authentication handled automatically
await testHarness.runTest({
  name: 'Test User Profile',
  async test({ api }) {
    const response = await api.get('/api/user/profile');
    return { passed: response.data.success === true };
  }
});
```

**That's it!** No tokens, no auth setup, no configuration needed.

## 📁 Structure

```
backend/testing/
├── testHarness.js      # Main test harness - import this
├── tokenManager.js     # Automatic token generation & caching
├── apiClient.js        # Pre-configured axios client
├── config.js           # Test configuration
├── examples/           # Example test scripts
│   ├── basicUsageExample.js
│   ├── userEndpointsExample.js
│   └── multipleTestsExample.js
└── README.md          # This file
```

## 🚀 Core Features

### ✅ Automatic Authentication
- Generates Firebase tokens automatically using the existing test UID
- Caches tokens for performance (50-minute cache, 1-hour token validity)
- Automatic token refresh on 401 errors
- No need to find API keys or configure Firebase

### ✅ Pre-configured API Client
- Axios instance with proper base URL and timeouts
- Authentication headers included automatically
- Debug logging (configurable)
- Error handling and retry logic

### ✅ Simple Test Interface
- Write test logic, not authentication code
- Consistent test result format
- Built-in test runner with summaries
- Support for single tests or test suites

### ✅ ES Modules Only
- All code uses modern ES module syntax
- No CommonJS anywhere
- Compatible with the existing SAMS backend architecture

## 📖 Usage Examples

### Basic Test
```javascript
import { testHarness } from './testing/testHarness.js';

await testHarness.runTest({
  name: 'Health Check',
  async test({ api }) {
    const response = await api.get('/api/clients/test');
    return {
      passed: response.status === 200,
      data: response.data
    };
  }
});
```

### Test with Custom User
```javascript
await testHarness.runTest({
  name: 'Test Different User',
  testUser: 'custom-test-uid',
  async test({ api, userId }) {
    const response = await api.get('/api/user/profile');
    return {
      passed: response.data.success,
      message: `Profile loaded for ${userId}`
    };
  }
});
```

### Multi-step Test
```javascript
await testHarness.runTest({
  name: 'Complete User Flow',
  async test({ api }) {
    // Step 1: Get clients
    const clients = await api.get('/api/user/clients');
    
    // Step 2: Select first client
    await api.post('/api/user/select-client', { 
      clientId: clients.data.clients[0].id 
    });
    
    // Step 3: Verify selection
    const profile = await api.get('/api/user/profile');
    
    return {
      passed: profile.data.selectedClient === clients.data.clients[0].id,
      steps: ['getClients', 'selectClient', 'verifyProfile']
    };
  }
});
```

### Multiple Tests
```javascript
const testSuite = [
  {
    name: 'Test 1',
    async test({ api }) {
      // Test logic here
      return { passed: true };
    }
  },
  {
    name: 'Test 2', 
    async test({ api }) {
      // Test logic here
      return { passed: true };
    }
  }
];

const summary = await testHarness.runTests(testSuite, {
  stopOnFailure: false,
  showSummary: true
});
```

## 🔧 API Reference

### testHarness.runTest(testDefinition)

Run a single test with automatic authentication.

**Parameters:**
- `testDefinition.name` (string) - Test name for display
- `testDefinition.test` (function) - Async test function
- `testDefinition.testUser` (string, optional) - User ID for testing
- `testDefinition.options` (object, optional) - Additional options

**Test Context:**
Your test function receives:
- `api` - Pre-configured axios client with authentication
- `token` - The Firebase token being used
- `userId` - The user ID for this test
- `config` - Test configuration object
- `options` - Any options passed to the test

**Return Value:**
Your test function must return an object with:
- `passed` (boolean) - Whether the test passed
- `data` (any, optional) - Test result data
- `message` (string, optional) - Success message
- `reason` (string, optional) - Failure reason

### testHarness.runTests(tests, options)

Run multiple tests in sequence.

**Parameters:**
- `tests` (array) - Array of test definition objects
- `options.stopOnFailure` (boolean) - Stop on first failure
- `options.showSummary` (boolean) - Show summary at end

### Quick Helper Functions

```javascript
import { quickApiTest, testUserProfile, testUserClients } from './testing/testHarness.js';

// Quick API endpoint test
await quickApiTest('Health Check', '/api/clients/test');

// Common user tests
await testUserProfile();
await testUserClients();
```

## 🛠️ Configuration

The test harness uses sensible defaults but can be configured:

```javascript
import { testConfig } from './testing/config.js';

// Current configuration
console.log(testConfig.API_BASE_URL);     // http://localhost:5001
console.log(testConfig.DEFAULT_TEST_UID); // fjXv8gX1CYWBvOZ1CS27j96oRCT2
console.log(testConfig.DEBUG_REQUESTS);   // true in development
```

### Environment Variables

- `TEST_API_BASE_URL` - Override API base URL
- `TEST_DEBUG` - Enable request debugging
- `TEST_VERBOSE` - Enable verbose logging
- `NODE_ENV` - Environment detection

## 🎯 Common Patterns

### Testing Authentication
```javascript
await testHarness.runTest({
  name: 'Authentication Test',
  async test({ api, token, userId }) {
    // Token and userId are automatically provided
    const response = await api.get('/api/user/profile');
    
    return {
      passed: response.data.userId === userId,
      token: token.substring(0, 20) + '...' // Don't log full tokens
    };
  }
});
```

### Error Handling
```javascript
await testHarness.runTest({
  name: 'Error Handling Test',
  async test({ api }) {
    try {
      await api.get('/api/nonexistent');
      return { passed: false, reason: 'Should have thrown error' };
    } catch (error) {
      return { 
        passed: error.response?.status === 404,
        actualStatus: error.response?.status
      };
    }
  }
});
```

### Data Validation
```javascript
await testHarness.runTest({
  name: 'Data Structure Test',
  async test({ api }) {
    const response = await api.get('/api/user/clients');
    const data = response.data;
    
    const hasRequiredFields = data.clients && 
                             Array.isArray(data.clients) &&
                             data.clients.every(c => c.id && c.name);
    
    return {
      passed: hasRequiredFields,
      clientCount: data.clients?.length || 0,
      sampleClient: data.clients?.[0] || null
    };
  }
});
```

## 🏃‍♂️ Running Examples

```bash
# Basic usage examples
node backend/testing/examples/basicUsageExample.js

# User endpoints testing
node backend/testing/examples/userEndpointsExample.js

# Multiple tests example
node backend/testing/examples/multipleTestsExample.js
```

## ⚠️ Requirements

1. **Backend must be running** on `http://localhost:5001` (configurable)
2. **Firebase Admin SDK** must be initialized (already done in SAMS backend)
3. **Test user must exist**: `fjXv8gX1CYWBvOZ1CS27j96oRCT2` (default test UID)
4. **ES Modules support** (already enabled in SAMS backend)

## 🐛 Troubleshooting

### "Backend not healthy" Error
```
❌ Backend health check failed: connect ECONNREFUSED ::1:5001
💡 Make sure the backend is running with: npm run dev
```
**Solution:** Start the backend with `npm run dev` in the backend directory.

### "Token generation failed" Error
```
❌ Token generation failed: Firebase Admin not initialized
```
**Solution:** Make sure you're running from the backend directory where Firebase Admin is initialized.

### Import Errors
```
SyntaxError: Cannot use import statement outside a module
```
**Solution:** Make sure your `package.json` has `"type": "module"` (already set in SAMS backend).

### "Test must return an object" Error
```
❌ Test must return an object with at least { passed: boolean }
```
**Solution:** Always return `{ passed: true/false }` from your test functions.

## 🎉 Migration from Old Test Scripts

### Before (Old Way)
```javascript
// 30+ lines of auth setup, token generation, axios configuration...
const customToken = await admin.auth().createCustomToken(testUid);
const response = await fetch('http://localhost:5001/api/user/profile', {
  headers: { 'Authorization': `Bearer ${customToken}` }
});
// Manual error handling, parsing, etc.
```

### After (New Way)
```javascript
import { testHarness } from './testing/testHarness.js';

await testHarness.runTest({
  name: 'Test User Profile',
  async test({ api }) {
    const response = await api.get('/api/user/profile');
    return { passed: response.data.success };
  }
});
```

**Result:** 30+ lines → 8 lines, zero auth complexity!

## 📊 Success Metrics

This test harness should achieve:
- ✅ **Zero authentication setup** for test agents
- ✅ **90%+ reduction** in test boilerplate code  
- ✅ **30+ minute time savings** per test agent session
- ✅ **Standardized testing approach** across all agents
- ✅ **No more token generation confusion**

---

## 🤝 For Test Agents

**Your new workflow:**

1. Import the test harness
2. Write your test logic (focus on what you're testing, not authentication)
3. Run your tests
4. Done!

**Never again worry about:**
- Firebase token generation
- API key management
- Authentication headers
- Base URL configuration
- Error handling boilerplate
- ES modules vs CommonJS confusion

Just focus on testing your endpoint logic!