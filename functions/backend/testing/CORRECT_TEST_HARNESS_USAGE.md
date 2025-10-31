# CORRECT Test Harness Usage Instructions

**CRITICAL**: It's `runTests` NOT `runSuite`

## ⚠️ THREE IAs HAVE MADE THE SAME ERROR

The test harness method is called `runTests`, not `runSuite`. This has caused multiple implementation failures.

## ✅ CORRECT Usage

### Basic Test Structure
```javascript
import { testHarness, createApiClient, tokenManager } from './testHarness.js';

// Define your tests
const tests = [
  {
    name: 'Test Name',
    test: async (api) => {
      // Your test logic here
      const response = await api.get('/endpoint');
      if (!response.data) {
        throw new Error('Expected data');
      }
      return response.data;
    }
  }
];

// Run tests - USE runTests NOT runSuite!
async function runAllTests() {
  const results = await testHarness.runTests(tests);
  console.log('Test Results:', results);
}

runAllTests().catch(console.error);
```

### For Water Bills Testing
```javascript
import { testHarness, createApiClient } from '../testing/testHarness.js';

const waterBillsTests = [
  {
    name: 'Generate Bills for Month',
    test: async (api) => {
      // Test bill generation
      const response = await api.post('/api/clients/AVII/water/bills/generate', {
        year: 2026,
        month: 0
      });
      
      if (!response.data.bills) {
        throw new Error('No bills generated');
      }
      
      // Verify calculations
      const unit101 = response.data.bills.units['101'];
      if (!unit101) {
        throw new Error('Unit 101 bill not found');
      }
      
      // Check rate calculation (consumption * 50 pesos)
      const expectedAmount = unit101.consumption * 50.00;
      if (Math.abs(unit101.baseAmount - expectedAmount) > 0.01) {
        throw new Error(`Incorrect calculation: expected ${expectedAmount}, got ${unit101.baseAmount}`);
      }
      
      return response.data;
    }
  },
  {
    name: 'Fetch Water Config',
    test: async (api) => {
      const response = await api.get('/api/clients/AVII/config/waterBilling');
      
      if (!response.data) {
        throw new Error('Config not found');
      }
      
      if (response.data.ratePerM3 !== 5000) {
        throw new Error(`Wrong rate: ${response.data.ratePerM3}`);
      }
      
      return response.data;
    }
  }
];

// RUN THE TESTS - CORRECT METHOD NAME
async function testWaterBills() {
  console.log('Testing Water Bills Phase 2...');
  
  try {
    // IT'S runTests NOT runSuite!!!
    const results = await testHarness.runTests(waterBillsTests);
    
    // Check results
    const failed = results.filter(r => r.status === 'failed');
    if (failed.length > 0) {
      console.error('❌ Tests failed:', failed);
      process.exit(1);
    }
    
    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('Test execution error:', error);
    process.exit(1);
  }
}

// Execute
testWaterBills();
```

## 🔴 COMMON MISTAKES

### WRONG - This will fail
```javascript
// ❌ WRONG - No such method
await testHarness.runSuite(tests);

// ❌ WRONG - Missing await
testHarness.runTests(tests);

// ❌ WRONG - Wrong import
import testHarness from './testHarness.js';
```

### RIGHT - This works
```javascript
// ✅ CORRECT - Right method name
await testHarness.runTests(tests);

// ✅ CORRECT - With options
await testHarness.runTests(tests, {
  stopOnFailure: true,
  showSummary: true
});

// ✅ CORRECT - Proper import
import { testHarness } from './testHarness.js';
```

## 📋 Test Harness Methods

### Available Methods:
- `runTests(tests, options)` - Run multiple tests
- `runTest(testDefinition)` - Run single test
- `ensureBackendHealth()` - Check backend is running
- `showSummary()` - Display test summary

### NOT Available:
- ❌ `runSuite` - DOES NOT EXIST
- ❌ `execute` - DOES NOT EXIST
- ❌ `run` - DOES NOT EXIST

## 🎯 For Implementation Agents

1. **Import correctly**: `import { testHarness } from './testHarness.js'`
2. **Use correct method**: `await testHarness.runTests(tests)`
3. **Actually run the tests**: Don't just write them
4. **Check results**: Verify tests pass before claiming success

## 💡 Quick Test Template

Save this as `testMyFeature.js`:
```javascript
import { testHarness } from '../testing/testHarness.js';

const tests = [
  {
    name: 'My Test',
    test: async (api) => {
      const response = await api.get('/my/endpoint');
      if (!response.data) throw new Error('Failed');
      return response.data;
    }
  }
];

// RUN WITH runTests!!!
testHarness.runTests(tests)
  .then(() => console.log('✅ Done'))
  .catch(err => {
    console.error('❌ Failed:', err);
    process.exit(1);
  });
```

Then run: `node testMyFeature.js`

---

**REMEMBER**: It's `runTests` not `runSuite`. This single error has caused 3 IA failures.