# Task Assignment: Simple /clients Domain Migration

## Mission
Convert `/api/clients/*` routes to `/clients/*` domain pattern using mass search-and-replace approach. Treat `/clients` as a standard domain route like `/auth`, `/water`, `/comm`.

## Strategic Context
**Problem:** Implementation Agent confusion from `/api/clients/*` vs other domain patterns
**Solution:** Standardize `/clients` as domain route (same pattern as existing domains)
**Approach:** Simple mass search-and-replace (NOT architectural restructuring)

## Critical Success Criteria
- ✅ **Keep all existing business logic unchanged**
- ✅ **Maintain all current data flows and Firestore paths**  
- ✅ **Preserve authentication and security patterns**
- ✅ **Only change URL patterns from `/api/clients` to `/clients`**

## Phase 1: Backend Route Updates

### 1.1 Main Route Mount Point
**File:** `backend/index.js`
**Current:** Line 84 - `app.use('/api/clients', clientRoutes);`
**Change to:** `app.use('/clients', clientRoutes);`

### 1.2 Email Route Mount Point  
**File:** `backend/index.js`
**Current:** Line 88 - `app.use('/api/clients/:clientId/email', emailRoutes);`
**Change to:** `app.use('/clients/:clientId/email', emailRoutes);`

### 1.3 Update Route Comments
**Update comment:** "Client domain (same pattern as /auth, /water, /comm)"

## Phase 2: Frontend Mass Search-and-Replace

### 2.1 Desktop Frontend Files
**Directory:** `frontend/sams-ui/src/`

**Search Pattern:** `/api/clients`
**Replace With:** `/clients`

**Files to Update (from analysis):**
- `api/client.js` (lines 32, 71)
- `api/categories.js` 
- `utils/fetchClients.js` (line 30)
- All other files containing `/api/clients`

### 2.2 Mobile Frontend Files  
**Directory:** `frontend/mobile-app/src/`

**Search Pattern:** `/api/clients`
**Replace With:** `/clients`

**Files to Update:**
- `api/waterAPI.js`
- `services/api.js`
- All other files containing `/api/clients`

## Phase 3: Testing & Verification

### 3.1 Basic Functionality Test
- [ ] Client selection works
- [ ] Water Bills page loads
- [ ] Transactions page accessible
- [ ] Navigation functions properly

### 3.2 Domain Route Consistency Check
- [ ] `/clients` works same as `/auth`, `/water`, `/comm`
- [ ] No `/api/api/` double-prefix errors
- [ ] Cross-domain calls function (HOA dues calling client data)

## Implementation Guidelines

### DO:
- ✅ Use global search-and-replace tools
- ✅ Maintain exact same business logic
- ✅ Keep all existing authentication patterns
- ✅ Preserve all Firestore data paths
- ✅ Test after each major change

### DO NOT:
- ❌ Change business logic or data flows
- ❌ Restructure authentication patterns
- ❌ Modify Firestore collection structures  
- ❌ Reorganize controllers or middleware
- ❌ Create new domain architectures

## Expected Results

**Before:**
```
/api/clients/{id}/transactions  ← Confusing mixed pattern
/water/{id}/bills              ← Clean domain pattern  
/auth/permissions              ← Clean domain pattern
```

**After:**
```
/clients/{id}/transactions     ← Clean domain pattern
/water/{id}/bills              ← Clean domain pattern  
/auth/permissions              ← Clean domain pattern
```

## Success Metrics
- [ ] All existing functionality preserved
- [ ] No `/api/api/` double-prefix errors
- [ ] Implementation Agent confusion eliminated
- [ ] Consistent domain route patterns across system
- [ ] Split Transactions Implementation Agent can proceed without route confusion

## Timeline
**Expected:** 1-2 Implementation Agent sessions
**Phase 1:** 30 minutes (backend route changes)
**Phase 2:** 1-2 hours (frontend mass search-and-replace)
**Phase 3:** 30 minutes (testing and verification)

---

*This simple approach treats `/clients` as a standard domain route, eliminating Implementation Agent confusion while preserving all existing functionality.*