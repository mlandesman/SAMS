---
task_ref: "GitHub Issues #22 + #11 - Water Bills Aggregated Data Architecture"
agent_assignment: "Agent_Water_Performance"
memory_log_path: "apm_session/Memory/Task_Completion_Logs/Water_Bills_Aggregated_Data_Architecture_2025-10-12.md"
execution_type: "multi-step"
dependency_context: false
ad_hoc_delegation: false
priority: 🔥 HIGH
github_issues: "#22, #11"
estimated_effort: "6-9 hours (3 tasks)"
---

# APM Task Assignment: Water Bills Aggregated Data Architecture

## Task Reference
**GitHub Issues:** #22 (Cache Invalidation), #11 (Slow Loading)  
**Priority:** 🔥 HIGH - Performance & UX Critical  
**Agent:** Agent_Water_Performance  
**Strategic Value:** Solves two problems with one architectural improvement

## Context

### Current Performance Problem
**From logs - Loading 3 months of bills takes 10 seconds:**
- Penalty recalculation runs for every load
- Carryover calculation is O(n²) - each month recalculates ALL previous months
- Month 2 recalcs months 0-1
- Month 3 recalcs months 0-2
- Month 11 recalcs months 0-10 (exponential slowdown)
- Estimated 12 months: 30-40+ seconds

**Current Cache Problem (Issue #22):**
- Payment saves to database
- Cache remains stale (shows unpaid)
- User must switch clients to force reload
- Risk of duplicate payment

### Root Cause: On-Demand Aggregation
Every load triggers full 12-month aggregation with penalty recalculation:
```
Frontend → Backend API → waterDataService aggregator
  → Fetch all 12 bill documents
  → Calculate carryover for each month (O(n²))
  → Calculate penalties
  → Return aggregated object
  → Frontend caches in sessionStorage
```

### Architectural Solution: Pre-Aggregated Data
Write aggregated data to Firestore once, read it quickly:
```
Calculation (once) → Write to aggregatedData document
Frontend → Read aggregatedData (< 1 second)
After Payment → Surgical update to aggregatedData
Nightly (future) → Recalculate penalties
```

**Document Location (Product Manager Decision):**
```
/clients/{clientId}/projects/waterBills/bills/aggregatedData
```

Single document containing point-in-time snapshot, fully rewritten when needed.

## Objective
Implement pre-aggregated data architecture for water bills to eliminate O(n²) performance issues (Issue #11) and enable surgical cache updates after payments (Issue #22).

## Git Workflow

**IMPORTANT:** This is an architectural enhancement requiring careful testing.

### Branch Setup
1. **Create new branch:** `git checkout -b feature/water-bills-aggregated-data`
2. **Work on this branch exclusively** for all 3 tasks
3. **Commit incrementally** after each task completion
4. **Push branch** when all tasks complete

### Commit Message Pattern
```
Task 1: feat: Add Firestore write to water bills aggregator

Task 2: feat: Change frontend to read from aggregatedData document  

Task 3: feat: Add surgical update after water bills payment
```

**DO NOT merge to main** - push branch and await review after all tasks complete.

## Detailed Instructions

**Complete in 3 exchanges, one task per response. AWAIT USER CONFIRMATION before proceeding to each subsequent task.**

---

### Task 1: Backend Aggregator Write Mode (3-4 hours)

**Objective:** Modify existing backend aggregator to write aggregated results to Firestore document.

**Current Behavior:**
- Backend aggregates data on-demand
- Returns aggregated object to frontend
- Frontend caches in sessionStorage
- No persistence of aggregated results

**New Behavior:**
- Backend aggregates data (same logic)
- **Writes results to Firestore** `/clients/{clientId}/projects/waterBills/bills/aggregatedData`
- Returns aggregated object to frontend
- Frontend caches (still valuable for immediate re-reads)

#### Implementation Steps:

**1. Locate Backend Aggregator:**
- Find `waterDataService.js` or similar aggregation service
- Identify the function that builds the 12-month aggregated data
- This is the function currently called by the API endpoint

**2. Add Firestore Write After Aggregation:**

```javascript
// After aggregation completes (currently returns result)
const aggregatedData = {
  fiscalYear: year,
  clientId: clientId,
  units: unitDataObject, // The full aggregated structure
  lastCalculated: admin.firestore.FieldValue.serverTimestamp(),
  calculationTimestamp: Date.now(),
  monthsIncluded: 12
};

// Write to Firestore
const aggregatedDataRef = db
  .collection('clients').doc(clientId)
  .collection('projects').doc('waterBills')
  .collection('bills').doc('aggregatedData');

await aggregatedDataRef.set(aggregatedData);

console.log('✅ Aggregated data written to Firestore:', cacheKey);

// Return the data (existing behavior preserved)
return result;
```

**3. Update Trigger Points:**
- **Client change:** Already triggers aggregation - will now also write
- **Manual refresh:** Already triggers aggregation - will now also write  
- **After payment:** Task 3 will handle surgical update

**4. Add Metadata:**
Include useful metadata in the document:
```javascript
{
  _metadata: {
    lastCalculated: serverTimestamp(),
    calculationTimestamp: Date.now(),
    fiscalYear: year,
    clientId: clientId,
    billsProcessed: billDocumentCount,
    unitsProcessed: unitCount
  },
  // ... aggregated data
}
```

**5. Verification:**
- [ ] Aggregation logic unchanged (no calculation changes)
- [ ] Firestore write added after aggregation
- [ ] Document path correct: `/clients/{clientId}/projects/waterBills/bills/aggregatedData`
- [ ] Existing return behavior preserved
- [ ] Metadata included for debugging

**Files to Modify:**
- `backend/services/waterDataService.js` (primary aggregator)
- `backend/controllers/waterBillsController.js` (if endpoint needs update)

**Testing:**
- Trigger aggregation (change client in UI or call endpoint)
- Check Firebase Console for aggregatedData document
- Verify document contains full aggregated structure
- Confirm API still returns data correctly

**Deliverable:** Backend writes aggregated data to Firestore after calculation

**AWAIT USER CONFIRMATION before proceeding to Task 2**

---

### Task 2: Frontend Read from aggregatedData (2-3 hours)

**Objective:** Change frontend to read from pre-calculated aggregatedData document instead of triggering expensive backend aggregation.

**Current Behavior:**
- Frontend calls: GET `/water/clients/{clientId}/data/{year}`
- Backend aggregates on-demand (slow)
- Frontend caches result in sessionStorage

**New Behavior:**
- Frontend calls: GET `/water/clients/{clientId}/aggregatedData`
- Backend reads document (fast - < 1 second)
- Frontend caches result in sessionStorage

#### Implementation Steps:

**1. Create New Backend Read Endpoint:**

Add to `backend/controllers/waterBillsController.js`:
```javascript
// GET /water/clients/:clientId/aggregatedData
// Fast read from pre-calculated document
router.get('/clients/:clientId/aggregatedData', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const aggregatedDataRef = db
      .collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('bills').doc('aggregatedData');
    
    const doc = await aggregatedDataRef.get();
    
    if (!doc.exists) {
      // Fallback: Trigger calculation if aggregatedData doesn't exist
      console.log('⚠️ aggregatedData not found, triggering calculation...');
      // Call existing aggregation function
      const aggregatedData = await waterDataService.getAggregatedData(clientId, year);
      return res.json(aggregatedData);
    }
    
    const data = doc.data();
    console.log('✅ Read aggregatedData from Firestore (fast path)');
    
    res.json({
      success: true,
      data: data.units || data, // Handle metadata wrapper if present
      metadata: data._metadata
    });
  } catch (error) {
    console.error('Error reading aggregatedData:', error);
    res.status(500).json({ error: error.message });
  }
});
```

**2. Add Route:**
Add to `backend/routes/water.js`:
```javascript
router.get('/clients/:clientId/aggregatedData', ...);
```

**3. Update Frontend API Call:**

Modify `frontend/sams-ui/src/api/waterAPI.js` with **timestamp-based cache validation** (no TTL):
```javascript
// Change getAggregatedData() method
async getAggregatedData(clientId, year) {
  const cacheKey = `water_bills_${clientId}_${year}`;
  
  // STEP 1: Check sessionStorage cache
  let cachedData = null;
  let cachedTimestamp = null;
  
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      cachedData = parsed.data;
      cachedTimestamp = parsed.calculationTimestamp; // From aggregatedData metadata
      console.log('💧 WaterAPI found cached data from:', new Date(cachedTimestamp));
    }
  } catch (error) {
    console.error('Cache read error:', error);
  }
  
  // STEP 2: Read from aggregatedData document (always check for freshness)
  const token = await this.getAuthToken();
  const response = await fetch(
    `${this.baseUrl}/water/clients/${clientId}/aggregatedData`, // Changed endpoint
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  const result = await handleApiResponse(response);
  const serverTimestamp = result?.metadata?.calculationTimestamp;
  
  // STEP 3: Compare timestamps - use cache only if still fresh
  if (cachedData && cachedTimestamp && serverTimestamp) {
    if (cachedTimestamp >= serverTimestamp) {
      // Cache is fresh - use it
      console.log('✅ WaterAPI cache is fresh, using cached data');
      return { data: cachedData };
    } else {
      console.log('🔄 WaterAPI cache stale, using server data');
    }
  }
  
  // STEP 4: Cache the fresh server result
  if (result?.data) {
    try {
      const cacheData = { 
        data: result.data, 
        calculationTimestamp: serverTimestamp,
        cachedAt: Date.now()
      };
      sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log('💧 WaterAPI saved fresh data to cache');
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }
  
  return result;
}
```

**Benefits of Timestamp-Based Validation:**
- ✅ No arbitrary TTL expiration
- ✅ Cache only refreshes when data actually changes
- ✅ Multi-user safe (if another user makes payment, timestamp updates)
- ✅ Perfect for "static most of the month, burst activity" usage pattern
- ✅ Self-healing (always checks freshness)

**Cache Invalidation Events:**
- Payment made → aggregatedData timestamp updates → cache refreshes
- New bills generated → aggregatedData recalculated → cache refreshes
- Another user changes data → aggregatedData timestamp newer → cache refreshes
- **No time-based expiration** - only data-change based

**4. Verification:**
- [ ] New backend endpoint created
- [ ] Endpoint reads from aggregatedData document
- [ ] Fallback to calculation if document missing
- [ ] Frontend calls new endpoint
- [ ] sessionStorage caching still works
- [ ] Load time < 1 second (test with existing aggregatedData from Task 1)

**Files to Modify:**
- `backend/controllers/waterBillsController.js` - New read endpoint
- `backend/routes/water.js` - Add route
- `frontend/sams-ui/src/api/waterAPI.js` - Change endpoint URL

**Testing:**
- Verify aggregatedData document exists (from Task 1)
- Load water bills in UI
- Measure load time (should be < 1 second)
- Verify data displays correctly
- Test fallback if document missing

**Deliverable:** Frontend reads from pre-calculated aggregatedData with fast load times

**AWAIT USER CONFIRMATION before proceeding to Task 3**

---

### Task 3: Payment Surgical Update (1-2 hours)

**Objective:** After water bills payment, surgically update the aggregatedData document without full recalculation, enabling immediate UI refresh.

**Current Problem:**
- Payment saves to database
- aggregatedData document is stale
- UI shows old data (unpaid bills)
- User must switch clients to trigger recalculation

**New Behavior:**
- Payment saves to database
- **Surgical update to aggregatedData**
- Frontend cache invalidated
- UI immediately shows paid bills

#### Implementation Steps:

**1. Add Surgical Update to Payment Service:**

In `backend/services/waterPaymentsService.js`, after payment recorded successfully:

```javascript
// After payment is recorded to database
console.log('✅ Water payment recorded successfully');

// SURGICAL UPDATE: Update aggregatedData document
try {
  const aggregatedDataRef = db
    .collection('clients').doc(clientId)
    .collection('projects').doc('waterBills')
    .collection('bills').doc('aggregatedData');
  
  const aggregatedDoc = await aggregatedDataRef.get();
  
  if (aggregatedDoc.exists) {
    const aggregatedData = aggregatedDoc.data();
    
    // Update the specific unit's month data with payment info
    billPayments.forEach(billPayment => {
      const monthIndex = billPayment.monthIndex; // or extract from billId
      const unitKey = unitId;
      
      if (aggregatedData.units && aggregatedData.units[unitKey]) {
        const unitData = aggregatedData.units[unitKey];
        if (unitData.months && unitData.months[monthIndex]) {
          // Update bill status
          unitData.months[monthIndex].status = billPayment.fullyPaid ? 'paid' : 'partial';
          
          // Add payment to payments array
          if (!unitData.months[monthIndex].payments) {
            unitData.months[monthIndex].payments = [];
          }
          unitData.months[monthIndex].payments.push({
            amount: billPayment.amountPaid,
            baseChargePaid: billPayment.baseChargePaid,
            penaltyPaid: billPayment.penaltyPaid,
            date: paymentDate,
            transactionId: transactionId,
            reference: paymentReference,
            method: paymentMethod,
            recordedAt: new Date().toISOString()
          });
        }
      }
    });
    
    // Update credit balance if changed
    if (aggregatedData.units[unitId].creditBalance !== undefined) {
      aggregatedData.units[unitId].creditBalance = newCreditBalance;
    }
    
    // Update timestamp
    aggregatedData._metadata.lastUpdated = admin.firestore.FieldValue.serverTimestamp();
    aggregatedData._metadata.lastUpdateType = 'payment';
    
    // Write updated document back
    await aggregatedDataRef.set(aggregatedData);
    console.log('✅ aggregatedData surgically updated after payment');
  } else {
    console.log('⚠️ aggregatedData document not found, will be created on next load');
  }
} catch (error) {
  console.error('❌ Error updating aggregatedData:', error);
  // Don't fail the payment if cache update fails
}

return result; // Return payment success
```

**2. Frontend Cache Invalidation:**

After payment success in `WaterBillsContext.jsx` `recordPayment()`:

```javascript
// After API call succeeds
const response = await waterAPI.recordPayment(...);

// Invalidate sessionStorage cache to force fresh read
const cacheKey = `water_bills_${selectedClient.id}_${selectedYear}`;
sessionStorage.removeItem(cacheKey);
console.log('🗑️ Cleared cache after payment:', cacheKey);

// Refresh data (will read from updated aggregatedData)
await fetchWaterData(selectedYear);

return response;
```

**3. Verification:**
- [ ] Payment saves to database (existing functionality)
- [ ] aggregatedData document updated with payment
- [ ] Specific unit/month updated (not full recalc)
- [ ] sessionStorage cache invalidated
- [ ] UI refreshes automatically
- [ ] Paid bills show as paid immediately
- [ ] No client switching required

**Files to Modify:**
- `backend/services/waterPaymentsService.js` - Add surgical update
- `frontend/sams-ui/src/context/WaterBillsContext.jsx` - Cache invalidation (may already be there)

**Testing:**
- Make water bills payment
- **Verify UI immediately shows bill as paid** (no client switching)
- Check Firebase Console - aggregatedData should have updated data
- Verify sessionStorage cache cleared
- Test multiple payments
- Verify no performance regression

**Deliverable:** Immediate UI update after payment with surgical aggregatedData modification

**AWAIT USER CONFIRMATION after Task 3 completion**

---

## Overall Expected Output

### After All 3 Tasks Complete:

**Performance:**
- ✅ Load time: 10 seconds → < 1 second (90%+ improvement)
- ✅ Payment update: Immediate UI refresh
- ✅ Scalability: Constant performance regardless of month count

**Functionality:**
- ✅ Faster dashboard loading
- ✅ Faster water bills view loading
- ✅ Immediate payment reflection in UI
- ✅ No client switching workaround needed

**Architecture:**
- ✅ Pre-aggregated data document
- ✅ Fast document reads instead of expensive calculations
- ✅ Surgical updates after payments
- ✅ Foundation for nightly maintenance (Task 4 - future)

### Files Modified (Estimated):
1. `backend/services/waterDataService.js` - Add Firestore write
2. `backend/controllers/waterBillsController.js` - New read endpoint
3. `backend/routes/water.js` - Add route
4. `frontend/sams-ui/src/api/waterAPI.js` - Change endpoint
5. `backend/services/waterPaymentsService.js` - Surgical update
6. `frontend/sams-ui/src/context/WaterBillsContext.jsx` - Cache invalidation (may already exist)

### Success Criteria:
- Water bills load in < 1 second (vs 10+ seconds)
- Payments immediately visible in UI
- No O(n²) carryover recalculation on load
- aggregatedData document created and maintained
- Issues #22 and #11 resolved

## Testing & Validation

### Performance Testing
1. **Before Fix Baseline:**
   - Measure load time with current system
   - Document O(n²) behavior in logs

2. **After Task 1+2:**
   - Measure load time with aggregatedData reads
   - Should be < 1 second
   - Verify data accuracy (matches old aggregation)

3. **After Task 3:**
   - Make payment
   - Verify UI updates immediately
   - No client switching needed
   - Measure any performance impact

### Functional Testing
1. **Data Accuracy:**
   - Compare aggregatedData with on-demand aggregation
   - Verify all 12 months correct
   - Check carryover calculations
   - Validate penalties

2. **Payment Flow:**
   - Make single bill payment
   - Make multi-bill payment
   - Test overpayment scenario
   - Test with credit balance

3. **Cache Behavior:**
   - Verify sessionStorage still caches
   - Confirm invalidation after payment
   - Test cache expiration (30 min)

### Edge Cases
- [ ] aggregatedData document missing (fallback works)
- [ ] Payment fails (aggregatedData not corrupted)
- [ ] Multiple rapid payments
- [ ] Client with no water bills
- [ ] Year transition scenarios

## Business Impact

### Issue #22 Resolution
- ✅ Immediate UI feedback after payment
- ✅ No workaround (client switching) needed
- ✅ Prevents duplicate payment risk
- ✅ Professional UX

### Issue #11 Resolution
- ✅ 90%+ load time improvement
- ✅ Dashboard loads faster
- ✅ Water bills view loads faster
- ✅ Scalable as months accumulate

### Combined Value
- Solves two problems with one architectural change
- Foundation for nightly maintenance (future)
- Better user experience
- Lower Firestore costs (fewer reads on every load)

## Future Enhancement (Task 4 - Optional)

**Nightly Maintenance Cloud Function:**
- Schedule: 2 AM Mexico City time
- Process: Recalculate aggregatedData for all clients with water bills
- Expand: Can include HOA Dues penalty recalculation
- Benefit: Data always fresh without user interaction

**This can be deferred** - aggregatedData updates on client change and after payments.

## Memory Logging
Upon completion, you **MUST** log work in: `apm_session/Memory/Task_Completion_Logs/Water_Bills_Aggregated_Data_Architecture_2025-10-12.md`

Follow `apm/prompts/guides/Memory_Log_Guide.md` instructions.

**Include in log:**
- **Branch name:** `feature/water-bills-aggregated-data`
- **Commit hashes:** Record all 3 task commits
- Performance measurements (before/after load times)
- Files modified with descriptions
- aggregatedData document structure
- Testing results for all 3 tasks
- Any challenges encountered
- Recommendations for Task 4 (nightly function)

---

**Manager Agent Note:** This is a high-value architectural improvement that solves two problems (Issues #22 and #11) with one solution. The existing aggregation logic stays the same - we're just changing WHERE it writes and HOW we read it. Priority 0 from Implementation Plan aligns with this work. Take time to test thoroughly - this impacts a critical business workflow.

