# Task Assignment: Create Credit Balance CRUD API

**Task ID:** WB-Create-Credit-CRUD-API  
**Agent:** Implementation_Agent_Credit_API  
**Priority:** 🚨 CRITICAL  
**Estimated Duration:** 2-3 hours  
**Created:** October 16, 2025  
**Branch:** `feature/water-bills-issues-0-7-complete-fix`

---

## 🎯 Mission

Create proper CRUD API endpoints for credit balance operations to eliminate direct Firestore access violations. Task 3 agent is currently bypassing the API layer and accessing credit balance directly, which violates architectural principles and security requirements.

---

## 🚨 Problem Statement

### The Architecture Violation
**Task 3 agent is using direct Firestore access:**
```javascript
// WRONG - Direct Firestore access (bypassing API layer)
const duesData = await db.collection('clients').doc(clientId)
  .collection('projects').doc('hoaDues').get();
const creditBalance = duesData.data().creditBalance;
```

**Should be using proper API endpoints:**
```javascript
// CORRECT - API endpoint with authentication/logging
const response = await fetch(`/api/credit/clients/${clientId}/balance`);
const { creditBalance } = await response.json();
```

### Impact
- **Security risk** - No proper access controls or authentication
- **Architecture violation** - Direct DB access bypassing API layer
- **Maintenance nightmare** - Multiple modules accessing credit balance directly
- **Migration blocker** - When credit balance moves location, every module breaks
- **Task 3 blocked** - Agent needs proper API access to complete delete reversal

---

## 🔍 Current State Analysis

### Existing Credit Endpoint
**File:** `backend/routes/credit.js` (created yesterday)
**Current functionality:** Basic credit balance access for Water Bills
**Missing:** Full CRUD operations for credit balance management

### Task 3 Agent Requirements
**Agent is waiting for:**
1. **Read credit balance** - GET current balance for a client
2. **Update credit balance** - PUT new balance after payment/deletion
3. **Add credit history** - POST history entries for audit trail
4. **Read credit history** - GET history for transaction reversals

---

## 📋 Required API Endpoints

### 1. GET Credit Balance
**Endpoint:** `GET /api/credit/clients/{clientId}/balance`
**Purpose:** Read current credit balance for a client
**Response:**
```json
{
  "clientId": "AVII",
  "creditBalance": 2714.95,
  "currency": "MXN",
  "lastUpdated": "2025-10-16T16:33:32.959Z"
}
```

### 2. PUT Credit Balance
**Endpoint:** `PUT /api/credit/clients/{clientId}/balance`
**Purpose:** Update credit balance (for payments, reversals, etc.)
**Request:**
```json
{
  "creditBalance": 2714.95,
  "transactionId": "2025-10-15_190205_169",
  "reason": "payment_reversal",
  "description": "Transaction deletion - credit restored"
}
```

### 3. POST Credit History Entry
**Endpoint:** `POST /api/credit/clients/{clientId}/history`
**Purpose:** Add entry to credit history for audit trail
**Request:**
```json
{
  "transactionId": "2025-10-15_190205_169_reversal",
  "type": "credit_restored",
  "amount": 2156.17,
  "description": "from Transaction Deletion",
  "balanceBefore": 4871.12,
  "balanceAfter": 2714.95
}
```

### 4. GET Credit History
**Endpoint:** `GET /api/credit/clients/{clientId}/history`
**Purpose:** Get credit history for transaction reversals
**Query params:** `?transactionId=xxx` (optional filter)
**Response:**
```json
{
  "clientId": "AVII",
  "history": [
    {
      "id": "uuid",
      "timestamp": "2025-10-16T16:33:32.959Z",
      "transactionId": "2025-10-15_190205_169",
      "type": "credit_used",
      "amount": 2156.17,
      "description": "Water Bills payment",
      "balanceBefore": 4871.12,
      "balanceAfter": 2714.95
    }
  ]
}
```

---

## 🛠️ Implementation Requirements

### Phase 1: Extend Existing Credit Route (1 hour)

**File:** `backend/routes/credit.js`

**Add functions:**
1. **GET balance endpoint** - Read current credit balance
2. **PUT balance endpoint** - Update credit balance with validation
3. **POST history endpoint** - Add credit history entries
4. **GET history endpoint** - Retrieve credit history

### Phase 2: Add Proper Authentication & Logging (30 min)

**Requirements:**
- **Authentication:** Verify user has access to client
- **Authorization:** Check user permissions for credit operations
- **Logging:** Log all credit balance changes for audit trail
- **Validation:** Validate request data and amounts

### Phase 3: Update Task 3 Agent Code (30 min)

**Replace direct Firestore access with API calls:**
- Update credit balance reads to use GET endpoint
- Update credit balance writes to use PUT endpoint
- Update credit history operations to use POST/GET endpoints

### Phase 4: Testing & Verification (30 min)

**Test scenarios:**
- Read credit balance via API
- Update credit balance via API
- Add credit history entry via API
- Verify Task 3 agent can complete delete reversal

---

## 📤 Deliverables

### 1. Extended Credit API
**File:** `backend/routes/credit.js`

**Must include:**
- All 4 CRUD endpoints
- Proper authentication and authorization
- Request/response validation
- Error handling and logging

### 2. Updated Task 3 Code
**File:** `backend/controllers/transactionsController.js`

**Replace direct Firestore access with API calls:**
```javascript
// Replace this pattern:
const duesData = await db.collection('clients').doc(clientId)
  .collection('projects').doc('hoaDues').get();

// With this pattern:
const response = await fetch(`/api/credit/clients/${clientId}/balance`);
const { creditBalance } = await response.json();
```

### 3. API Documentation
**File:** `backend/docs/credit-api.md`

**Must include:**
- Endpoint specifications
- Request/response examples
- Authentication requirements
- Error codes and handling

### 4. Test Suite
**File:** `backend/testing/testCreditAPI.js`

**Must verify:**
- All CRUD operations work correctly
- Authentication and authorization
- Error handling
- Integration with Task 3 agent

---

## 🎯 Success Criteria

**This task is complete when:**
1. ✅ All 4 credit CRUD endpoints are implemented
2. ✅ Proper authentication and logging in place
3. ✅ Task 3 agent can complete delete reversal using API
4. ✅ No direct Firestore access for credit operations
5. ✅ API documentation complete
6. ✅ Test suite passes
7. ✅ Task 3 agent unblocked and can continue

---

## 📚 Key Files

### Primary
- `backend/routes/credit.js` - Extend existing credit route
- `backend/controllers/transactionsController.js` - Update Task 3 agent code

### Reference
- `backend/routes/waterPayments.js` - API pattern reference
- `backend/routes/hoaPayments.js` - Authentication pattern reference

### Dependencies
- Existing credit route structure (created yesterday)
- Task 3 agent waiting for API endpoints

---

## 💡 Implementation Hints

### API Pattern
```javascript
// GET /api/credit/clients/{clientId}/balance
router.get('/clients/:clientId/balance', async (req, res) => {
  try {
    // Authentication check
    // Read credit balance from Firestore
    // Return formatted response
  } catch (error) {
    // Error handling and logging
  }
});
```

### Error Handling
```javascript
// Standard error responses
{
  "error": "UNAUTHORIZED",
  "message": "User not authorized to access client credit balance",
  "code": 401
}
```

### Logging
```javascript
// Log all credit balance changes
logger.info(`Credit balance updated: Client ${clientId}, Amount: ${amount}, Reason: ${reason}`);
```

---

## 🚦 Dependencies

**Prerequisites:**
- ✅ Existing credit route structure (created yesterday)
- ✅ Task 3 agent waiting for API endpoints
- ✅ Backend server running for testing

**Blocking:**
- ❌ Task 3 (Delete reversal) - BLOCKED until API endpoints available

**Integration Points:**
- Task 3 agent delete reversal logic
- Water Bills payment processing
- Credit balance audit trail

---

## 🔗 Future Considerations

**This API will support:**
- Future credit balance location migration (move out of hoaDues collection)
- HOA Dues refactoring to use same API
- Centralized credit balance management
- Consistent authentication and logging across all modules

**Note:** Focus on Water Bills first, HOA Dues refactoring can be done later as separate task.

---

**Remember:** Task 3 agent is waiting for these API endpoints. This is a blocking dependency for delete reversal completion.

**The goal:** Create proper API layer for credit balance operations, eliminating direct Firestore access violations and unblocking Task 3 agent.
