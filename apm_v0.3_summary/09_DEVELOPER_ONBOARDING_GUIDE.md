# SAMS Developer Onboarding Guide
*Everything you need to start developing on SAMS v0.4*

## Welcome to SAMS Development

This guide will get you productive on the Sandyland Asset Management System (SAMS) within your first day. SAMS is a production multi-tenant property management system currently serving two HOA communities with comprehensive financial tracking, water billing, and document management.

---

## 🚀 Quick Start (First Hour)

### 1. Access Requirements
```bash
# You will need access to:
- GitHub repository (request from Michael)
- Firebase Console (sams-project)
- Vercel Dashboard (for deployments)
- Google Drive (Sandyland folder for documents)
```

### 2. Local Development Setup
```bash
# Clone the repository
git clone [repository-url]
cd SAMS

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local with provided credentials

# Start development servers
npm run dev:frontend   # Frontend on http://localhost:3000
npm run dev:backend    # Backend on http://localhost:5001
```

### 3. Test Your Setup
```bash
# Run the test harness to verify authentication
cd backend
node testHarness.js

# You should see successful test results
```

---

## 📚 Essential Reading Order

Read these documents in this specific order for best understanding:

1. **00_MASTER_CATALOG.md** - Overview of all documentation
2. **01_ARCHITECTURE_AND_STRUCTURE.md** - System design and components
3. **05_DECISIONS_AND_STANDARDS.md** - Coding standards and critical requirements
4. **04_LESSONS_LEARNED.md** - What to avoid (MUST READ before coding)
5. **08_OPEN_ISSUES_AND_ENHANCEMENTS.md** - Current work items

---

## ⚠️ CRITICAL: Before You Write Any Code

### Mandatory Requirements

#### 1. ES6 Module Exports ONLY
```javascript
// ✅ CORRECT - You MUST use this
export const myFunction = async (req, res) => { };
export default controller;

// ❌ WRONG - This WILL break the system
module.exports = { myFunction };  // DO NOT USE
exports.myFunction = () => { };   // DO NOT USE
```

#### 2. Test Harness for Authentication Testing
```javascript
// ✅ CORRECT method name
await testHarness.runTests(tests);

// ❌ WRONG - This method doesn't exist
await testHarness.runSuite(tests);  // Will fail
```

#### 3. Always Use Utility Functions
```javascript
// Date handling - ALWAYS normalize to America/Cancun
import { normalizeDate } from '../utils/timestampUtils.js';
import { getMexicoDate } from '../utils/timezone.js';

// Currency - ALWAYS store as cents
import { dollarsToCents, centsToDollars } from '../utils/currency.js';

// Fiscal Year - ALWAYS use utilities
import { getFiscalYear, getCurrentFiscalMonth } from '../utils/fiscalYearUtils.js';
```

#### 4. Never Use Reserved Keywords
```javascript
// ❌ CATASTROPHIC - This crashed production on July 5-6
export const delete = async () => { };  // 'delete' is reserved!

// ✅ CORRECT
export const deleteItem = async () => { };
```

---

## 🏗️ Project Structure

```
SAMS/
├── frontend/
│   ├── sams-ui/           # Desktop web application (React + Vite)
│   └── mobile-app/        # Mobile PWA
├── backend/
│   ├── controllers/       # API endpoint handlers
│   ├── services/          # Business logic
│   ├── utils/             # Utility functions (USE THESE!)
│   ├── middleware/        # Auth and validation
│   └── testHarness.js     # Testing with real auth
├── scripts/
│   ├── client-onboarding/ # Data import scripts
│   └── sams-deploy/       # Deployment scripts (BROKEN - don't use)
└── apm_v0.3_summary/      # All documentation
```

---

## 🔑 Key Concepts to Understand

### 1. Multi-Tenant Architecture
- Each client (MTC, AVII) has completely isolated data
- All queries must include clientId: `/clients/{clientId}/...`
- Never allow cross-client data access

### 2. Domain-Specific APIs
```javascript
// Water Bills uses clean domain URLs
GET /water/clients/:clientId/bills/generate
GET /water/clients/:clientId/readings/:year/:month

// Traditional resources use REST patterns
GET /api/clients/:clientId/transactions
POST /api/clients/:clientId/transactions
```

### 3. Firebase Structure
```
/clients/{clientId}/
  ├── transactions/      # Financial records
  ├── units/            # Property units
  ├── vendors/          # Suppliers
  ├── categories/       # Transaction categories
  ├── accounts/         # Bank accounts
  ├── projects/
  │   └── waterBills/   # Water billing system
  │       ├── bills/
  │       ├── meters/
  │       └── readings/
  └── config/           # Client settings
```

### 4. Authentication Flow
1. Firebase Auth handles login
2. User document uses email as ID (not UID)
3. Backend validates every request
4. Role-based permissions (SuperAdmin > Admin > Owner > Manager)

---

## 🛠️ Development Workflow

### Daily Development Process
1. Check **08_OPEN_ISSUES_AND_ENHANCEMENTS.md** for priorities
2. Create feature branch: `git checkout -b feature/your-feature`
3. Write code following standards in **05_DECISIONS_AND_STANDARDS.md**
4. Test with testHarness.js for backend changes
5. Create PR with description of changes
6. Deploy to production after review

### Testing Your Code
```bash
# Backend testing with real authentication
cd backend
node testHarness.js

# Frontend testing
npm run test

# Check for issues
npm run lint
```

### Common Development Tasks

#### Adding a New API Endpoint
```javascript
// 1. Create controller function (controllers/yourController.js)
export const myEndpoint = async (req, res) => {
  const { clientId } = req.params;
  // Implementation
};

// 2. Add route (routes/yourRoutes.js)
router.get('/clients/:clientId/resource', authenticate, authorize, myEndpoint);

// 3. Test with testHarness
const tests = [{
  name: 'Test new endpoint',
  test: async (api) => {
    const response = await api.get('/clients/AVII/resource');
    // Assertions
  }
}];
```

#### Working with Dates
```javascript
// ALWAYS normalize dates to Mexico timezone
import { normalizeDate } from '../utils/timestampUtils.js';

const normalizedDate = normalizeDate(userInputDate);
// This prevents the "date off by one day" bug
```

#### Handling Money
```javascript
// ALWAYS store amounts as cents (integers)
const amountInCents = Math.round(dollarAmount * 100);

// Display formatting
const display = (amountInCents / 100).toFixed(2);
```

---

## 🔥 Current Production Status

### Live Clients
1. **MTC** - 1,477 documents, 10 users, $414,234.12 in transactions
2. **AVII** - 249 documents, 12 water meters, $86,211.73 in transactions

### Known Issues (See 08_OPEN_ISSUES_AND_ENHANCEMENTS.md)
- **HIGH**: Units List Management has multiple UI issues
- **MEDIUM**: Date normalization needed in several places
- **MEDIUM**: PropertyAccess map not created for new users

### Active Features
- ✅ Multi-tenant security
- ✅ Transaction management
- ✅ HOA dues tracking
- ✅ Water billing (AVII)
- ✅ Document management
- ✅ Mobile PWA

---

## 📞 Getting Help

### Resources
1. **Documentation**: `/apm_v0.3_summary/` folder has everything
2. **Code Examples**: Look at existing controllers for patterns
3. **Test Harness**: Use for testing all backend changes

### Common Problems & Solutions

#### "Cannot find module" Error
```bash
# You're probably using CommonJS syntax
# Change: const x = require('...')
# To: import x from '...'
```

#### Dates Saving Wrong Day
```javascript
// You forgot to normalize the date
const date = normalizeDate(inputDate);
```

#### Authentication Failing in Tests
```bash
# Use the test harness, not direct API calls
node testHarness.js
```

#### Payment Methods Showing Inactive
```javascript
// Filter for active status
paymentMethods.filter(pm => pm.status === 'active')
```

---

## 🚨 DO NOT DO THESE THINGS

1. **DO NOT** refactor more than 10 files at once (caused catastrophic failure)
2. **DO NOT** use CommonJS exports (breaks the system)
3. **DO NOT** use reserved keywords as function names
4. **DO NOT** bypass utility functions for dates/money
5. **DO NOT** make direct Firebase calls from frontend
6. **DO NOT** create cross-client queries
7. **DO NOT** deploy without testing
8. **DO NOT** use the sams-deploy CLI (it's broken)

---

## 📋 First Week Checklist

### Day 1
- [ ] Local environment running
- [ ] Successfully run testHarness.js
- [ ] Read architecture documentation
- [ ] Understand multi-tenant structure

### Day 2-3
- [ ] Read all numbered documents (01-08)
- [ ] Fix one LOW priority issue
- [ ] Understand authentication flow
- [ ] Learn utility functions

### Day 4-5
- [ ] Implement one small enhancement
- [ ] Test with real data
- [ ] Create first PR
- [ ] Deploy to production

### End of Week 1
- [ ] Comfortable with codebase structure
- [ ] Understand domain-specific APIs
- [ ] Can debug common issues
- [ ] Ready for larger features

---

## 🎯 Quick Reference

### Import Patterns
```javascript
// Controllers
import { transactionController } from '../controllers/transactionController.js';

// Services
import waterBillsService from '../services/waterBillsService.js';

// Utils (ALWAYS use these)
import { normalizeDate } from '../utils/timestampUtils.js';
import { dollarsToCents } from '../utils/currency.js';
import { getFiscalYear } from '../utils/fiscalYearUtils.js';

// Middleware
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/clientAuth.js';
```

### API URL Patterns
```javascript
// Domain-specific (Water Bills)
/water/clients/:clientId/bills/generate
/water/clients/:clientId/readings/:year/:month

// Traditional REST
/api/clients/:clientId/transactions
/api/clients/:clientId/units
/api/clients/:clientId/vendors
```

### Testing Commands
```bash
npm run test              # Run all tests
npm run lint              # Check code style
node testHarness.js       # Test with real auth
npm run dev:frontend      # Start frontend
npm run dev:backend       # Start backend
```

---

## 📝 Notes for Success

1. **Read the Lessons Learned** - Seriously, it will save you from repeating costly mistakes
2. **Use the test harness** - It's the only way to test with real authentication
3. **Follow the standards** - They exist for good reasons learned through pain
4. **Ask questions** - Better to ask than to break production
5. **Start small** - Fix a low priority issue first to learn the codebase
6. **Document your changes** - Future you will thank present you

Welcome to the team! You're working on a system that manages real money for real communities. Take pride in your work, be careful with changes, and always test thoroughly.

---

## Appendix: Environment Variables

```bash
# .env.local template
NODE_ENV=development
PORT=5001

# Firebase Admin SDK
FIREBASE_PROJECT_ID=sams-project
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@sams-project.iam.gserviceaccount.com

# Frontend
VITE_API_URL=http://localhost:5001
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=sams-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sams-project

# Email Service (if testing emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```