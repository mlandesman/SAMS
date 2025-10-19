---
task_id: WB-Implementation-0A-Credit-Endpoint
priority: 🚨 CRITICAL (Foundation for Payment and Delete Fixes)
agent_type: Implementation Agent
status: Ready for Assignment
created: 2025-10-15
approved_by: Manager Agent + Product Manager (Michael)
estimated_effort: 2-3 hours
memory_log_path: apm_session/Memory/Task_Completion_Logs/Task_0A_Credit_Balance_Endpoint_2025-10-15.md
blocks:
  - Task 1: Penalty Calculation (uses /credit for integration)
  - Task 2: Payment Issues (uses /credit for reads/writes)
  - Task 3: Delete Reversal (uses /credit for reversal)
testing_required: Backend API testing (testHarness)
validation_source: MICHAEL_VALIDATION_CHECKLIST.md (Section 3)
---

# IMPLEMENTATION TASK 0A: Create Credit Balance REST Endpoint

## 🎯 MISSION: Create Clean API for Credit Balance Operations

**YOU ARE IMPLEMENTING NEW INFRASTRUCTURE**

This task creates a new `/credit` REST endpoint that provides clean separation between Water Bills (and future modules) and the underlying credit balance storage. This is **foundational work** that unblocks Tasks 1, 2, and 3.

---

## 📖 CONTEXT FROM PRODUCT MANAGER

### Michael's Architectural Decision

**Problem Identified:**
> "The Credit Balance is used in multiple, distinct modules so it should be accessible without 'passing through' another domain-specific endpoint. Should not need to go to /hoadues/ to get credit for paying a waterbill."

**Solution Approved:**
> "Suggest we create a new location for the data and a new endpoint /credit with its own endpoints (get, update, etc)."

**Hybrid Approach:**
> "A hybrid option would be to make a new endpoint /credit and just have it point to the current location in Dues and then move it later so our code would remain intact when we move the storage location."

**Why This Works:**
- Water Bills code uses `/credit` from day 1
- Future storage migration: Only backend changes, no frontend changes
- HOA Dues continues working unchanged
- Clean architectural separation

---

## 🎯 TASK OBJECTIVES

### Primary Goal
Create a complete REST API for credit balance operations that **currently points to HOA Dues storage** but provides clean abstraction for future migration.

### Success Criteria
- [ ] All 4 REST endpoints working (`GET`, `POST`, history operations)
- [ ] Backend routes to existing HOA Dues location (no data migration)
- [ ] Test with backend API calls (testHarness)
- [ ] No changes to HOA Dues code required
- [ ] Documentation complete for future storage migration
- [ ] Memory Log with implementation details

---

## 📋 IMPLEMENTATION REQUIREMENTS

### Endpoint Specifications

#### 1. GET /credit/:clientId/:unitId
**Purpose:** Retrieve current credit balance for a unit

**Request:**
```
GET /credit/AVII/203
```

**Response:**
```json
{
  "clientId": "AVII",
  "unitId": "203",
  "creditBalance": 50000,
  "creditBalanceDisplay": "$500.00",
  "lastUpdated": "2025-10-15T10:30:00Z"
}
```

**Current Implementation:**
- Route to: `clients/{clientId}/hoaDues/units/{unitId}`
- Read: `creditBalance` field
- Format: Amount in cents

---

#### 2. POST /credit/:clientId/:unitId
**Purpose:** Update credit balance (add or subtract)

**Request:**
```json
POST /credit/AVII/203
{
  "amount": -10000,
  "transactionId": "2025-10-15_123456_789",
  "note": "Water Bills Payment - Unit 203",
  "source": "waterBills"
}
```

**Response:**
```json
{
  "success": true,
  "clientId": "AVII",
  "unitId": "203",
  "previousBalance": 50000,
  "newBalance": 40000,
  "amountChange": -10000,
  "transactionId": "2025-10-15_123456_789"
}
```

**Current Implementation:**
- Update: `clients/{clientId}/hoaDues/units/{unitId}/creditBalance`
- Add entry to: `creditHistory` array
- Validate: New balance cannot be negative (configurable)

---

#### 3. GET /credit/:clientId/:unitId/history
**Purpose:** Retrieve credit balance history

**Request:**
```
GET /credit/AVII/203/history?limit=10
```

**Response:**
```json
{
  "clientId": "AVII",
  "unitId": "203",
  "currentBalance": 40000,
  "history": [
    {
      "date": "2025-10-15T10:30:00Z",
      "amount": -10000,
      "balance": 40000,
      "transactionId": "2025-10-15_123456_789",
      "note": "Water Bills Payment - Unit 203",
      "source": "waterBills"
    },
    {
      "date": "2025-10-10T14:20:00Z",
      "amount": 50000,
      "balance": 50000,
      "transactionId": "2025-10-10_140000_001",
      "note": "HOA Overpayment",
      "source": "hoaDues"
    }
  ]
}
```

**Current Implementation:**
- Read: `clients/{clientId}/hoaDues/units/{unitId}/creditHistory`
- Sort: Most recent first
- Limit: Optional (default 50)

---

#### 4. POST /credit/:clientId/:unitId/history
**Purpose:** Add credit history entry (for historical records or corrections)

**Request:**
```json
POST /credit/AVII/203/history
{
  "amount": 5000,
  "date": "2025-10-01T12:00:00Z",
  "transactionId": "2025-10-01_120000_001",
  "note": "Credit adjustment - correction",
  "source": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "entryAdded": true,
  "newBalance": 45000
}
```

**Current Implementation:**
- Append to: `creditHistory` array
- Update: `creditBalance` field
- Validate: Date format, required fields

---

## 📁 FILES TO CREATE

### 1. Backend Routes (NEW)
**File:** `backend/routes/creditRoutes.js`

**Structure:**
```javascript
import express from 'express';
import { CreditController } from '../controllers/creditController.js';

const router = express.Router();
const creditController = new CreditController();

// Credit balance operations
router.get('/:clientId/:unitId', creditController.getCreditBalance);
router.post('/:clientId/:unitId', creditController.updateCreditBalance);

// Credit history operations
router.get('/:clientId/:unitId/history', creditController.getCreditHistory);
router.post('/:clientId/:unitId/history', creditController.addCreditHistoryEntry);

export default router;
```

**Requirements:**
- ES6 modules (import/export, NOT require)
- Proper error handling
- Input validation
- Authentication middleware (use existing patterns)

---

### 2. Backend Controller (NEW)
**File:** `backend/controllers/creditController.js`

**Structure:**
```javascript
import { CreditService } from '../services/creditService.js';

export class CreditController {
  constructor() {
    this.creditService = new CreditService();
  }

  getCreditBalance = async (req, res) => {
    try {
      const { clientId, unitId } = req.params;
      
      // Input validation
      if (!clientId || !unitId) {
        return res.status(400).json({ error: 'clientId and unitId required' });
      }

      const creditData = await this.creditService.getCreditBalance(clientId, unitId);
      
      res.status(200).json(creditData);
    } catch (error) {
      console.error('Error getting credit balance:', error);
      res.status(500).json({ error: error.message });
    }
  };

  updateCreditBalance = async (req, res) => {
    try {
      const { clientId, unitId } = req.params;
      const { amount, transactionId, note, source } = req.body;
      
      // Input validation
      if (!amount || !transactionId || !note || !source) {
        return res.status(400).json({ 
          error: 'amount, transactionId, note, and source are required' 
        });
      }

      const result = await this.creditService.updateCreditBalance(
        clientId, 
        unitId, 
        amount, 
        transactionId, 
        note, 
        source
      );
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Error updating credit balance:', error);
      res.status(500).json({ error: error.message });
    }
  };

  getCreditHistory = async (req, res) => {
    try {
      const { clientId, unitId } = req.params;
      const limit = parseInt(req.query.limit) || 50;
      
      const history = await this.creditService.getCreditHistory(clientId, unitId, limit);
      
      res.status(200).json(history);
    } catch (error) {
      console.error('Error getting credit history:', error);
      res.status(500).json({ error: error.message });
    }
  };

  addCreditHistoryEntry = async (req, res) => {
    try {
      const { clientId, unitId } = req.params;
      const { amount, date, transactionId, note, source } = req.body;
      
      // Input validation
      if (!amount || !date || !transactionId || !note || !source) {
        return res.status(400).json({ 
          error: 'amount, date, transactionId, note, and source are required' 
        });
      }

      const result = await this.creditService.addCreditHistoryEntry(
        clientId, 
        unitId, 
        amount, 
        date, 
        transactionId, 
        note, 
        source
      );
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Error adding credit history entry:', error);
      res.status(500).json({ error: error.message });
    }
  };
}
```

**Requirements:**
- Follow existing controller patterns
- Comprehensive error handling
- Input validation before calling service
- Proper HTTP status codes

---

### 3. Backend Service (NEW)
**File:** `backend/services/creditService.js`

**Structure:**
```javascript
import admin from 'firebase-admin';
const db = admin.firestore();

export class CreditService {
  
  /**
   * Get current credit balance for a unit
   * CURRENT: Points to HOA Dues location
   * FUTURE: Will point to new storage location
   */
  async getCreditBalance(clientId, unitId) {
    try {
      // CURRENT IMPLEMENTATION: Read from HOA Dues
      const duesRef = db.collection('clients').doc(clientId)
        .collection('hoaDues').doc('units')
        .collection('units').doc(unitId);
      
      const doc = await duesRef.get();
      
      if (!doc.exists) {
        return {
          clientId,
          unitId,
          creditBalance: 0,
          creditBalanceDisplay: '$0.00',
          lastUpdated: null
        };
      }
      
      const data = doc.data();
      const creditBalance = data.creditBalance || 0;
      
      return {
        clientId,
        unitId,
        creditBalance,
        creditBalanceDisplay: this._formatCurrency(creditBalance),
        lastUpdated: data.lastUpdated || null
      };
    } catch (error) {
      console.error(`Error getting credit balance for ${clientId}/${unitId}:`, error);
      throw error;
    }
  }

  /**
   * Update credit balance (add or subtract)
   * CURRENT: Updates HOA Dues location
   * FUTURE: Will update new storage location
   */
  async updateCreditBalance(clientId, unitId, amount, transactionId, note, source) {
    try {
      // CURRENT IMPLEMENTATION: Update HOA Dues
      const duesRef = db.collection('clients').doc(clientId)
        .collection('hoaDues').doc('units')
        .collection('units').doc(unitId);
      
      const doc = await duesRef.get();
      let currentBalance = 0;
      let creditHistory = [];
      
      if (doc.exists) {
        const data = doc.data();
        currentBalance = data.creditBalance || 0;
        creditHistory = data.creditHistory || [];
      }
      
      const newBalance = currentBalance + amount;
      
      // Validation: Credit balance cannot be negative (optional - check config)
      if (newBalance < 0) {
        throw new Error(`Insufficient credit balance. Current: ${currentBalance}, Requested: ${amount}`);
      }
      
      // Add history entry
      const historyEntry = {
        date: admin.firestore.Timestamp.now(),
        amount,
        balance: newBalance,
        transactionId,
        note,
        source
      };
      
      creditHistory.push(historyEntry);
      
      // Update Firestore
      await duesRef.set({
        creditBalance: newBalance,
        creditHistory,
        lastUpdated: admin.firestore.Timestamp.now()
      }, { merge: true });
      
      return {
        success: true,
        clientId,
        unitId,
        previousBalance: currentBalance,
        newBalance,
        amountChange: amount,
        transactionId
      };
    } catch (error) {
      console.error(`Error updating credit balance for ${clientId}/${unitId}:`, error);
      throw error;
    }
  }

  /**
   * Get credit history
   * CURRENT: Reads from HOA Dues location
   * FUTURE: Will read from new storage location
   */
  async getCreditHistory(clientId, unitId, limit = 50) {
    try {
      // CURRENT IMPLEMENTATION: Read from HOA Dues
      const duesRef = db.collection('clients').doc(clientId)
        .collection('hoaDues').doc('units')
        .collection('units').doc(unitId);
      
      const doc = await duesRef.get();
      
      if (!doc.exists) {
        return {
          clientId,
          unitId,
          currentBalance: 0,
          history: []
        };
      }
      
      const data = doc.data();
      const creditBalance = data.creditBalance || 0;
      const creditHistory = data.creditHistory || [];
      
      // Sort by date (most recent first)
      const sortedHistory = creditHistory
        .sort((a, b) => b.date.toMillis() - a.date.toMillis())
        .slice(0, limit);
      
      return {
        clientId,
        unitId,
        currentBalance: creditBalance,
        history: sortedHistory.map(entry => ({
          date: entry.date.toDate().toISOString(),
          amount: entry.amount,
          balance: entry.balance,
          transactionId: entry.transactionId,
          note: entry.note,
          source: entry.source
        }))
      };
    } catch (error) {
      console.error(`Error getting credit history for ${clientId}/${unitId}:`, error);
      throw error;
    }
  }

  /**
   * Add credit history entry (manual or correction)
   * CURRENT: Updates HOA Dues location
   * FUTURE: Will update new storage location
   */
  async addCreditHistoryEntry(clientId, unitId, amount, date, transactionId, note, source) {
    try {
      // CURRENT IMPLEMENTATION: Update HOA Dues
      const duesRef = db.collection('clients').doc(clientId)
        .collection('hoaDues').doc('units')
        .collection('units').doc(unitId);
      
      const doc = await duesRef.get();
      let currentBalance = 0;
      let creditHistory = [];
      
      if (doc.exists) {
        const data = doc.data();
        currentBalance = data.creditBalance || 0;
        creditHistory = data.creditHistory || [];
      }
      
      const newBalance = currentBalance + amount;
      
      // Add history entry
      const historyEntry = {
        date: admin.firestore.Timestamp.fromDate(new Date(date)),
        amount,
        balance: newBalance,
        transactionId,
        note,
        source
      };
      
      creditHistory.push(historyEntry);
      
      // Update Firestore
      await duesRef.set({
        creditBalance: newBalance,
        creditHistory,
        lastUpdated: admin.firestore.Timestamp.now()
      }, { merge: true });
      
      return {
        success: true,
        entryAdded: true,
        newBalance
      };
    } catch (error) {
      console.error(`Error adding credit history entry for ${clientId}/${unitId}:`, error);
      throw error;
    }
  }

  /**
   * Helper: Format currency
   */
  _formatCurrency(cents) {
    const dollars = cents / 100;
    return `$${dollars.toFixed(2)}`;
  }
}
```

**CRITICAL NOTES:**
- All functions currently point to HOA Dues location
- Comments indicate "CURRENT" vs "FUTURE" implementation
- When storage migrates, only these functions change
- No calling code needs updates

---

## 📁 FILES TO MODIFY

### 1. Main Backend Router
**File:** `backend/server.js` or equivalent main router

**Add:**
```javascript
import creditRoutes from './routes/creditRoutes.js';

// Credit balance operations (domain-independent)
app.use('/credit', creditRoutes);
```

**Location:** Add with other route registrations

---

### 2. API Documentation (if exists)
**File:** `backend/README.md` or API docs

**Add:**
```markdown
## Credit Balance API

Domain-independent credit balance operations.

### Endpoints

- `GET /credit/:clientId/:unitId` - Get current credit balance
- `POST /credit/:clientId/:unitId` - Update credit balance
- `GET /credit/:clientId/:unitId/history` - Get credit history
- `POST /credit/:clientId/:unitId/history` - Add credit history entry

### Current Implementation

All endpoints currently route to HOA Dues storage location:
`clients/{clientId}/hoaDues/units/{unitId}`

Future migration will move storage to:
`clients/{clientId}/units/{unitId}/credit`

No code changes will be required when migration occurs.
```

---

## 🧪 TESTING REQUIREMENTS

### Backend API Testing (Primary)

**Use testHarness or direct API calls**

**Test 1: Get Credit Balance (No Existing Data)**
```bash
GET /credit/AVII/999
Expected: creditBalance = 0, success
```

**Test 2: Get Credit Balance (Existing HOA Dues Data)**
```bash
GET /credit/AVII/203
Expected: Returns actual credit balance from HOA Dues
```

**Test 3: Update Credit Balance (Add Credit)**
```bash
POST /credit/AVII/203
Body: {
  "amount": 10000,
  "transactionId": "TEST_001",
  "note": "Test credit addition",
  "source": "test"
}
Expected: previousBalance + 10000 = newBalance
```

**Test 4: Update Credit Balance (Subtract Credit)**
```bash
POST /credit/AVII/203
Body: {
  "amount": -5000,
  "transactionId": "TEST_002",
  "note": "Test credit deduction",
  "source": "test"
}
Expected: previousBalance - 5000 = newBalance
```

**Test 5: Get Credit History**
```bash
GET /credit/AVII/203/history?limit=5
Expected: Returns last 5 entries, sorted newest first
```

**Test 6: Verify HOA Dues Still Works**
```bash
GET /hoadues/AVII/203 (or equivalent HOA endpoint)
Expected: Credit balance accessible via old endpoint still
```

**Test 7: Error Handling**
```bash
POST /credit/AVII/203
Body: { "amount": 100 } (missing required fields)
Expected: 400 Bad Request with error message
```

---

## ✅ SUCCESS CRITERIA

### Functional Requirements
- [ ] All 4 endpoints respond correctly
- [ ] GET operations return accurate data from HOA Dues
- [ ] POST operations update HOA Dues correctly
- [ ] Credit history maintains proper order
- [ ] Input validation prevents bad data

### Technical Requirements
- [ ] ES6 modules (no CommonJS)
- [ ] Proper error handling
- [ ] Follows existing code patterns
- [ ] No changes to HOA Dues code
- [ ] No breaking changes to existing functionality

### Testing Requirements
- [ ] All 7 backend tests pass
- [ ] HOA Dues functionality unaffected
- [ ] Can read credit via new endpoint
- [ ] Can update credit via new endpoint
- [ ] Error cases handled gracefully

### Documentation Requirements
- [ ] Code comments explain current vs future implementation
- [ ] Memory Log documents implementation details
- [ ] API endpoints documented
- [ ] Migration path documented

---

## 🚨 CRITICAL CONSTRAINTS

### From Product Manager (Michael)

1. **No Data Migration**
   - Do NOT move data from HOA Dues
   - Endpoint points to existing location
   - Storage migration is separate future project

2. **No HOA Dues Changes**
   - HOA Dues code continues working unchanged
   - Can still access credit via old HOA endpoint
   - No breaking changes

3. **Strong Consistency**
   - Credit balance must always be accurate
   - No temporary staleness acceptable
   - Operations must be atomic

4. **Backend Testing Focus**
   - 90% backend API testing
   - Use testHarness primarily
   - UI testing minimal (just form validation)

---

## 📝 MEMORY LOG REQUIREMENTS

**File:** `apm_session/Memory/Task_Completion_Logs/Task_0A_Credit_Balance_Endpoint_2025-10-15.md`

### Must Include

1. **Implementation Summary**
   - What was created
   - Where files are located
   - How endpoints work

2. **Current vs Future Architecture**
   - Document that endpoints currently point to HOA Dues
   - Explain migration path
   - Note that no code changes needed when migrated

3. **Testing Results**
   - All 7 test cases documented
   - Results for each test
   - HOA Dues verification

4. **Integration Notes**
   - How Tasks 1, 2, 3 will use this endpoint
   - What they should call
   - What they should NOT call (old HOA Dues endpoints)

5. **Next Steps**
   - Ready for Task 1 (Penalty Calculation)
   - Ready for Task 2 (Payment Issues)
   - Ready for Task 3 (Delete Reversal)

---

## 🎯 COMPLETION CHECKLIST

- [ ] Created creditRoutes.js with 4 routes
- [ ] Created creditController.js with 4 operations
- [ ] Created creditService.js with current HOA Dues integration
- [ ] Updated main router to include /credit routes
- [ ] Tested GET credit balance (existing and non-existing)
- [ ] Tested POST credit balance (add and subtract)
- [ ] Tested GET credit history
- [ ] Tested POST credit history entry
- [ ] Verified HOA Dues still works via old endpoint
- [ ] Tested error handling
- [ ] Created Memory Log with implementation details
- [ ] Documented migration path for future
- [ ] NO changes made to HOA Dues code
- [ ] NO data migration performed

---

## 🚀 READY FOR ASSIGNMENT

**Task Type:** Implementation (New Infrastructure)  
**Complexity:** MEDIUM - New endpoint, existing storage  
**Risk:** LOW - No data migration, no breaking changes  
**Estimated Duration:** 2-3 hours  
**Blocks:** Tasks 1, 2, 3 (all need /credit endpoint)

**Testing Approach:** Backend API calls (testHarness)  
**Hard Stop:** Test all 7 cases before proceeding to Task 1

---

**Manager Agent Sign-off:** October 15, 2025  
**Product Manager Approved:** Michael Landesman  
**Status:** Ready for Implementation Agent Assignment  
**Priority:** 🚨 CRITICAL - Foundation for all remaining work

