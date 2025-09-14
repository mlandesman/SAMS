# SAMS Quick Reference Card
*Print this and keep it handy*

## 🔴 CRITICAL - MUST DO

```javascript
// ES6 MODULES ONLY
export const function = () => {}  ✅
module.exports = {}               ❌ BREAKS!

// TEST HARNESS METHOD
testHarness.runTests(tests)      ✅
testHarness.runSuite(tests)      ❌ DOESN'T EXIST!

// ALWAYS USE UTILS
normalizeDate(date)               ✅ Required
dollarsToCents(amount)            ✅ Required
getFiscalYear(date, config)       ✅ Required
```

## 📁 Project Structure
```
/frontend/sams-ui/        → Desktop app
/frontend/mobile-app/     → Mobile PWA
/backend/controllers/     → API handlers
/backend/utils/          → MUST USE THESE!
/backend/testHarness.js  → Test with auth
```

## 🌐 API Patterns
```javascript
// Water Bills (Domain-specific)
GET /water/clients/:clientId/bills/generate
GET /water/clients/:clientId/readings/:year/:month

// Traditional REST
GET /api/clients/:clientId/transactions
POST /api/clients/:clientId/transactions
```

## 🔥 Firebase Structure
```
/clients/{clientId}/
  ├── transactions/
  ├── units/
  ├── vendors/
  ├── categories/
  ├── accounts/
  ├── projects/
  │   └── waterBills/
  │       ├── bills/     → Generated bills
  │       ├── meters/    → Meter configs
  │       └── readings/  → Monthly readings
  └── config/
```

## 👤 User Roles
```
SuperAdmin → All clients, all access
Admin      → One client, full access
Owner      → Own unit data only
Manager    → Assigned units only
```

## 💰 Money & Dates
```javascript
// Money ALWAYS in cents
const cents = Math.round(dollars * 100);
const dollars = cents / 100;

// Dates ALWAYS normalized
import { normalizeDate } from '../utils/timestampUtils.js';
const date = normalizeDate(inputDate);  // America/Cancun
```

## 🐛 Common Issues

| Problem | Solution |
|---------|----------|
| Date off by one day | Use `normalizeDate()` |
| Cannot find module | Use ES6 imports not require |
| Auth fails in test | Use testHarness.js |
| Inactive payment methods | Filter by `status === 'active'` |
| Test fails with runSuite | Use `runTests()` instead |

## 🚀 Commands
```bash
npm run dev:frontend      # Start frontend (:3000)
npm run dev:backend       # Start backend (:5001)
node testHarness.js       # Test with real auth
npm run lint              # Check code style
npm test                  # Run tests
```

## ⚠️ NEVER DO
- ❌ Use `delete` as function name (reserved!)
- ❌ Refactor > 10 files at once
- ❌ Use CommonJS exports
- ❌ Skip utility functions
- ❌ Make direct Firebase calls from frontend
- ❌ Create cross-client queries
- ❌ Use sams-deploy CLI (broken)

## 📚 Documentation
1. **01_ARCHITECTURE** - System design
2. **02_DATA_MODELS** - Field specs
3. **04_LESSONS_LEARNED** - What not to do
4. **05_DECISIONS** - Standards & patterns
5. **08_OPEN_ISSUES** - Current work

## 🔧 Test Harness Template
```javascript
import { testHarness } from './testHarness.js';

const tests = [
  {
    name: 'My Test',
    test: async (api) => {
      const response = await api.get('/endpoint');
      if (!response.data) throw new Error('Failed');
      return response.data;
    }
  }
];

await testHarness.runTests(tests);
```

## 🏢 Production Clients
- **MTC**: 1,477 docs, 10 users, $414k transactions
- **AVII**: 249 docs, 12 water meters, $86k transactions

## 🆘 Help
- Docs: `/apm_v0.3_summary/`
- Issues: `08_OPEN_ISSUES_AND_ENHANCEMENTS.md`
- Examples: Look at existing controllers

---
*Keep this reference handy - it will save you time!*