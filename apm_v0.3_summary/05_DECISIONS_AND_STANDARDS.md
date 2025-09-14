# SAMS Architectural Decisions and Standards
*Critical decisions and standards established in APM v0.3 for v0.4 continuation*

## Overview

This document captures all major architectural decisions, technical standards, and conventions established during APM v0.3 development. These decisions were made after careful consideration of alternatives and have proven successful in production. The v0.4 system should maintain these standards unless there is a compelling reason to change.

## Architectural Decisions Record (ADR)

### ADR-001: Multi-Tenant Architecture via Client Isolation

**Status**: Accepted and Validated in Production

**Context**: Need to support multiple HOA/property management clients with complete data isolation and independent configurations.

**Decision**: Implement client isolation at the collection level using Firestore path structure `/clients/{clientId}/...`

**Rationale**:
- Complete data segregation prevents cross-client data leaks
- Scalable to hundreds of clients without performance impact
- Simplifies backup and recovery per client
- Enables client-specific configurations and features

**Alternatives Considered**:
1. Single collection with client field filtering - Rejected due to security risks
2. Separate databases per client - Rejected due to operational complexity
3. Tenant ID in every document - Rejected due to query complexity

**Implications**:
- All queries must include clientId in path
- Cannot easily query across clients (by design)
- Client switching requires new query context

```javascript
// Standard implementation
const getClientData = async (clientId, collection) => {
  return await db.collection(`clients/${clientId}/${collection}`).get();
};
```

### ADR-002: Email-Based User Document IDs

**Status**: Accepted and Critical for Authentication

**Context**: Firebase Auth UIDs can change or become inconsistent, causing user lookup failures.

**Decision**: Use email addresses as document IDs in the users collection.

**Rationale**:
- Email addresses are unique and immutable identifiers
- Eliminates UID mismatch issues between Firebase Auth and Firestore
- Simplifies user lookups and reduces query complexity
- Maintains consistency across password resets and account recovery

**Implementation**:
```javascript
// User document creation
const createUser = async (email, userData) => {
  const docId = email.toLowerCase().replace(/\./g, '_');
  await db.collection('users').doc(docId).set(userData);
};
```

**Implications**:
- Email changes require document migration
- Document IDs use underscore instead of dots
- Case-insensitive email handling required

### ADR-003: Monetary Values Stored as Integers (Cents)

**Status**: Accepted and Mandatory

**Context**: Floating-point arithmetic causes rounding errors in financial calculations.

**Decision**: Store all monetary values as integers representing cents.

**Rationale**:
- Eliminates floating-point precision errors
- Simplifies financial calculations
- Industry standard for financial systems
- Consistent across all currencies

**Implementation**:
```javascript
// Conversion utilities
const dollarsToCents = (dollars) => Math.round(dollars * 100);
const centsToDollars = (cents) => cents / 100;

// Storage format
transaction: {
  amount: 10000,  // $100.00 stored as 10000 cents
  // Display: formatCurrency(10000) => "$100.00"
}
```

### ADR-004: Firestore Timestamps for All Dates

**Status**: Accepted as Standard

**Context**: Need consistent date/time handling across different timezones and systems.

**Decision**: Use Firestore Timestamp objects for all date/time fields.

**Rationale**:
- Native Firestore type with built-in timezone handling
- Consistent serialization/deserialization
- Proper ordering in queries
- Automatic server timestamp support

**Implementation**:
```javascript
import { Timestamp } from 'firebase/firestore';

// Creating timestamps
const now = Timestamp.now();
const specific = Timestamp.fromDate(new Date('2025-01-01'));

// Standard fields
document: {
  created: Timestamp.now(),
  updated: Timestamp.now(),
  date: Timestamp.fromDate(userDate)
}
```

### ADR-005: Denormalized Reference Data

**Status**: Accepted for Performance

**Context**: Frequent JOIN-like operations severely impact query performance.

**Decision**: Denormalize frequently accessed reference data (vendor names, category names) within transactions.

**Rationale**:
- Dramatically improves read performance
- Reduces number of document reads (cost savings)
- Simplifies query logic
- Acceptable trade-off for slightly increased storage

**Implementation**:
```javascript
// Denormalized transaction structure
transaction: {
  vendorId: 'ven_123',
  vendorName: 'ABC Company',     // Denormalized
  categoryId: 'cat_456',
  categoryName: 'Utilities',     // Denormalized
  accountId: 'acc_789',
  accountName: 'Operating'       // Denormalized
}
```

**Update Strategy**:
- Batch update when reference data changes
- Accept eventual consistency for name changes
- Critical IDs remain source of truth

### ADR-006: Role-Based Access Control (RBAC)

**Status**: Accepted and Proven Secure

**Context**: Need flexible permission system supporting multiple user types and access levels.

**Decision**: Implement hierarchical RBAC with SuperAdmin > Admin > Owner > Manager roles.

**Roles Definition**:
```javascript
const roles = {
  superAdmin: {
    level: 0,
    description: 'System-wide access',
    capabilities: ['*']
  },
  admin: {
    level: 1,
    description: 'Client-wide access',
    capabilities: ['manage_client', 'manage_users', 'manage_data']
  },
  owner: {
    level: 2,
    description: 'Unit owner access',
    capabilities: ['view_own_data', 'make_payments', 'view_documents']
  },
  manager: {
    level: 3,
    description: 'Unit manager access',
    capabilities: ['view_unit_data', 'submit_requests']
  }
};
```

### ADR-007: API-First Architecture

**Status**: Accepted as Foundation

**Context**: Need to support multiple frontends (web, mobile, future native apps).

**Decision**: All data operations go through REST API, no direct Firebase access from frontend.

**Rationale**:
- Centralized business logic and validation
- Consistent security enforcement
- Platform-agnostic backend
- Easier testing and monitoring

**Implementation**:
```javascript
// No direct Firebase in frontend
// ❌ WRONG
const data = await firebase.firestore().collection('users').get();

// ✅ CORRECT
const data = await apiClient.get('/api/users');
```

### ADR-008: Progressive Web App for Mobile

**Status**: Accepted and Deployed

**Context**: Need mobile access without maintaining separate native apps.

**Decision**: Implement PWA with offline support instead of native mobile apps.

**Rationale**:
- Single codebase for all platforms
- Instant updates without app store approval
- Lower development and maintenance cost
- Native-like features through web APIs

**Key Features**:
- Service worker for offline support
- Web app manifest for installation
- Push notifications
- Camera access for receipts

### ADR-009: Account-Based Balance System

**Status**: Accepted to Replace Month-End Snapshots

**Context**: Month-end snapshot system was inaccurate and complex.

**Decision**: Calculate balances in real-time from transaction history.

**Rationale**:
- Always accurate balances
- No snapshot maintenance required
- Supports historical balance queries
- Simpler reconciliation process

**Implementation**:
```javascript
const calculateBalance = async (accountId, asOfDate = new Date()) => {
  const transactions = await getTransactions(accountId, { 
    endDate: asOfDate 
  });
  
  return transactions.reduce((balance, tx) => {
    return tx.type === 'income' 
      ? balance + tx.amount 
      : balance - tx.amount;
  }, 0);
};
```

### ADR-010: Fiscal Year Configuration

**Status**: Accepted with Flexibility

**Context**: Different clients have different fiscal year start months.

**Decision**: Store fiscal year start month as number (1-12) in client configuration.

**Rationale**:
- Simple numeric configuration
- Easy calculation of fiscal periods
- Supports any month as fiscal year start
- Backward compatible with calendar year (month = 1)

**Implementation**:
```javascript
client.settings: {
  fiscalYearStartMonth: 10,  // October start
  // Fiscal Year 2025 = Oct 2024 to Sep 2025
}
```

## Critical Implementation Requirements

### ES Module Exports (MANDATORY)

**CRITICAL**: All backend controllers and services MUST use ES6 module syntax. CommonJS exports will break the system.

```javascript
// ✅ CORRECT - ES6 Module Syntax (REQUIRED)
export const getUserById = async (req, res) => { /* ... */ };
export const updateUser = async (req, res) => { /* ... */ };
export default userController;

// ❌ WRONG - CommonJS (WILL BREAK)
module.exports = {
  getUserById,
  updateUser
};

// ❌ WRONG - Mixed exports (WILL BREAK)
exports.getUserById = async (req, res) => { /* ... */ };
```

### Test Harness Usage (MANDATORY for Testing)

When testing with actual data, the test harness MUST be used for authentication:

```javascript
// ✅ CORRECT - Use runTests method
import { testHarness, createApiClient } from './testHarness.js';

const tests = [
  {
    name: 'Test Name',
    test: async (api) => {
      const response = await api.get('/endpoint');
      if (!response.data) throw new Error('Expected data');
      return response.data;
    }
  }
];

await testHarness.runTests(tests);  // ✅ CORRECT method name

// ❌ WRONG - This method doesn't exist
await testHarness.runSuite(tests);  // Will cause failure
```

### Utility Functions (MANDATORY)

All date, currency, and fiscal year operations MUST use the provided utility functions:

```javascript
// Date/Timezone Utilities (REQUIRED)
import { normalizeDate } from '../utils/timestampUtils.js';
import { getMexicoDate } from '../utils/timezone.js';

// Always normalize dates to America/Cancun timezone
const normalizedDate = normalizeDate(inputDate);
const mexicoDate = getMexicoDate();

// Currency Conversion (REQUIRED)
import { dollarsToCents, centsToDollars } from '../utils/currency.js';

// Always store as cents
const amountInCents = dollarsToCents(100.50);  // 10050
const displayAmount = centsToDollars(10050);   // 100.50

// Fiscal Year Calculations (REQUIRED)
import { getFiscalYear, getCurrentFiscalMonth } from '../utils/fiscalYearUtils.js';

const fiscalYear = getFiscalYear(date, clientConfig);
const fiscalMonth = getCurrentFiscalMonth(clientConfig);
```

## Coding Standards

### JavaScript/Node.js Standards

#### Naming Conventions
```javascript
// Files: kebab-case
user-controller.js
transaction-service.js

// Classes: PascalCase
class UserController {}
class TransactionService {}

// Functions/Variables: camelCase
const getUserById = () => {};
let transactionCount = 0;

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
const API_TIMEOUT = 5000;

// Private methods: underscore prefix
class Service {
  _privateMethod() {}
  publicMethod() {}
}
```

#### Async/Await Pattern
```javascript
// Always use async/await over promises
// ✅ CORRECT
const fetchData = async () => {
  try {
    const result = await apiCall();
    return result;
  } catch (error) {
    handleError(error);
  }
};

// ❌ AVOID
const fetchData = () => {
  return apiCall()
    .then(result => result)
    .catch(error => handleError(error));
};
```

#### Error Handling
```javascript
// Consistent error structure
class AppError extends Error {
  constructor(message, statusCode, errorCode) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
  }
}

// Standard error responses
const errorResponse = {
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid input data',
    details: {
      field: 'email',
      reason: 'Invalid format'
    }
  }
};
```

### React/Frontend Standards

#### Component Structure
```javascript
// Functional components only (no class components)
const Component = ({ prop1, prop2 }) => {
  // Hooks at the top
  const [state, setState] = useState();
  const context = useContext(AppContext);
  
  // Event handlers
  const handleClick = () => {};
  
  // Render helpers
  const renderItem = (item) => {};
  
  // Main render
  return (
    <div>
      {/* JSX content */}
    </div>
  );
};

// Props validation
Component.propTypes = {
  prop1: PropTypes.string.required,
  prop2: PropTypes.number
};
```

#### State Management
```javascript
// Context for global state
const AppContext = createContext();

// Local state for component-specific data
const [localState, setLocalState] = useState();

// Avoid prop drilling beyond 2 levels
// Use context or state management library
```

### CSS/Styling Standards

#### Naming Convention
```css
/* BEM Methodology */
.block {}
.block__element {}
.block--modifier {}

/* Example */
.transaction-card {}
.transaction-card__header {}
.transaction-card--highlighted {}
```

#### Mobile-First Approach
```css
/* Base mobile styles */
.container {
  padding: 1rem;
}

/* Tablet and up */
@media (min-width: 768px) {
  .container {
    padding: 2rem;
  }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .container {
    padding: 3rem;
  }
}
```

### API Standards

#### RESTful Endpoints
```javascript
// Standard CRUD operations
GET    /api/clients/{clientId}/resources     // List
GET    /api/clients/{clientId}/resources/{id} // Get one
POST   /api/clients/{clientId}/resources     // Create
PUT    /api/clients/{clientId}/resources/{id} // Update
DELETE /api/clients/{clientId}/resources/{id} // Delete

// Action endpoints
POST   /api/clients/{clientId}/resources/{id}/action
```

#### Request/Response Format
```javascript
// Request headers
{
  'Content-Type': 'application/json',
  'Authorization': 'Bearer {token}',
  'X-Client-ID': 'clientId'
}

// Success response
{
  data: {
    // Response data
  },
  meta: {
    page: 1,
    total: 100,
    timestamp: '2025-01-01T00:00:00Z'
  }
}

// Error response
{
  error: {
    code: 'ERROR_CODE',
    message: 'Human readable message',
    details: {}
  }
}
```

### Database Standards

#### Collection Naming
```javascript
// Plural, lowercase
users
transactions
units
vendors
categories

// Subcollections maintain parent reference
/clients/{clientId}/transactions
/clients/{clientId}/units/{unitId}/dues
```

#### Document Structure
```javascript
// Required metadata fields
{
  // Business fields
  ...businessData,
  
  // Audit fields (required)
  created: Timestamp,
  createdBy: string,
  updated: Timestamp,
  lastModifiedBy: string,
  
  // Soft delete (if applicable)
  deleted: boolean,
  deletedAt: Timestamp,
  deletedBy: string,
  
  // Migration tracking (if migrated)
  migrationSource: string,
  migrationDate: Timestamp,
  originalId: string
}
```

### Testing Standards

#### Test Structure
```javascript
describe('Component/Module Name', () => {
  // Setup
  beforeEach(() => {
    // Test setup
  });
  
  // Teardown
  afterEach(() => {
    // Cleanup
  });
  
  describe('Feature/Method', () => {
    it('should do expected behavior', () => {
      // Arrange
      const input = prepareInput();
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

#### Coverage Requirements
```javascript
// Minimum coverage targets
{
  statements: 80,
  branches: 75,
  functions: 80,
  lines: 80
}
```

### Security Standards

#### Authentication
```javascript
// JWT token validation
const validateToken = async (token) => {
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded;
  } catch (error) {
    throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
  }
};

// Password requirements
const passwordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true
};
```

#### Data Sanitization
```javascript
// Input validation
const sanitizeInput = (input) => {
  return validator.escape(input.trim());
};

// SQL injection prevention (even though using NoSQL)
const sanitizeQuery = (query) => {
  return query.replace(/[;'"`]/g, '');
};
```

### Documentation Standards

#### Code Comments
```javascript
/**
 * Calculate compound interest for water bill penalties
 * @param {number} principal - Base amount in cents
 * @param {number} rate - Monthly interest rate (e.g., 0.05 for 5%)
 * @param {number} months - Number of months
 * @returns {number} Total penalty amount in cents
 */
const calculatePenalty = (principal, rate, months) => {
  return Math.round(principal * Math.pow(1 + rate, months) - principal);
};
```

#### README Structure
```markdown
# Module Name

## Overview
Brief description of module purpose

## Installation
Steps to install/setup

## Usage
Code examples and common use cases

## API Reference
Detailed API documentation

## Testing
How to run tests

## Contributing
Guidelines for contributors
```

### Git Standards

#### Branch Naming
```bash
main           # Production branch
staging        # Pre-production testing
feature/xxx    # New features
fix/xxx        # Bug fixes
hotfix/xxx     # Emergency production fixes
release/x.x.x  # Release branches
```

#### Commit Messages
```bash
# Format: type(scope): message

feat(auth): add password reset functionality
fix(transactions): correct balance calculation
docs(api): update endpoint documentation
style(ui): improve mobile responsiveness
refactor(utils): optimize date formatting
test(units): add unit management tests
chore(deps): update dependencies
```

#### Pull Request Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
```

### Performance Standards

#### Response Time Targets
```javascript
// API response times (95th percentile)
const performanceTargets = {
  simple_read: 200,    // ms
  complex_query: 500,  // ms
  write_operation: 300, // ms
  bulk_operation: 2000 // ms
};
```

#### Frontend Performance
```javascript
// Core Web Vitals targets
const webVitals = {
  LCP: 2.5,  // Largest Contentful Paint (seconds)
  FID: 100,  // First Input Delay (milliseconds)
  CLS: 0.1   // Cumulative Layout Shift (score)
};
```

### Monitoring Standards

#### Logging Levels
```javascript
const logLevels = {
  error: 0,   // System errors requiring immediate attention
  warn: 1,    // Warning conditions
  info: 2,    // Informational messages
  debug: 3,   // Debug-level messages
  trace: 4    // Detailed trace information
};

// Structured logging
logger.info('User action', {
  userId: user.id,
  action: 'login',
  timestamp: new Date(),
  metadata: { ip: req.ip }
});
```

#### Metrics Collection
```javascript
// Key metrics to track
const metrics = {
  // Business metrics
  daily_active_users: 'count',
  transactions_created: 'count',
  payment_success_rate: 'percentage',
  
  // Technical metrics
  api_response_time: 'histogram',
  error_rate: 'percentage',
  database_query_time: 'histogram'
};
```

## Configuration Management

### Environment Variables
```bash
# Required environment variables
NODE_ENV=production
PORT=3000
DATABASE_URL=firebase://...
JWT_SECRET=xxx
API_KEY=xxx
CLIENT_URL=https://sams.sandyland.com.mx

# Naming convention: CATEGORY_SPECIFIC_NAME
FIREBASE_PROJECT_ID=xxx
FIREBASE_PRIVATE_KEY=xxx
SMTP_HOST=xxx
SMTP_PORT=587
```

### Feature Flags
```javascript
// Feature flag structure
const features = {
  WATER_BILLING: {
    enabled: true,
    rollout: 100,  // Percentage
    clients: ['MTC', 'AVII']
  },
  NEW_DASHBOARD: {
    enabled: false,
    rollout: 0,
    clients: []
  }
};
```

## Deployment Standards

### Build Process
```bash
# Standard build commands
npm run build:dev      # Development build
npm run build:staging  # Staging build
npm run build:prod     # Production build

# Build output structure
/dist
  /assets
    /js
    /css
    /images
  index.html
  manifest.json
  service-worker.js
```

### Deployment Checklist
```markdown
- [ ] All tests passing
- [ ] Code review approved
- [ ] Documentation updated
- [ ] Database migrations ready
- [ ] Environment variables configured
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured
- [ ] Stakeholders notified
```

## Data Standards

### Data Validation Rules
```javascript
// Email validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation (international)
const phoneRegex = /^\+?[1-9]\d{1,14}$/;

// Amount validation (cents)
const validateAmount = (amount) => {
  return Number.isInteger(amount) && amount >= 0 && amount <= 999999999;
};

// Date validation
const validateDate = (date) => {
  return date instanceof Timestamp || date instanceof Date;
};
```

### Data Privacy Standards
```javascript
// PII handling
const sensitiveFields = [
  'ssn',
  'taxId',
  'bankAccount',
  'creditCard'
];

// Always encrypt sensitive data
const encryptSensitive = (data) => {
  return crypto.encrypt(data, process.env.ENCRYPTION_KEY);
};

// Never log sensitive data
const sanitizeForLogging = (obj) => {
  const sanitized = { ...obj };
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  return sanitized;
};
```

## Conclusion

These architectural decisions and standards represent the cumulative learning and best practices established during APM v0.3 development. They have been validated in production and should be maintained in v0.4 unless there is a compelling technical or business reason to change them.

Key principles to maintain:
1. **Consistency** - Follow established patterns
2. **Simplicity** - Prefer simple solutions over complex ones
3. **Security** - Security considerations in every decision
4. **Performance** - Optimize for user experience
5. **Maintainability** - Write code for the next developer
6. **Testability** - Design for testing from the start
7. **Documentation** - Document decisions and deviations

These standards ensure code quality, system reliability, and team productivity while providing flexibility for future growth and evolution.