---
task_id: CRITICAL-WB-Payment-Deletion-Issues
priority: 🚨 CRITICAL (Production Blocker - Multiple Data Integrity Issues)
agent_type: Implementation Agent (Analysis-First Approach)
status: BLOCKED - Requires Architectural Review
created: 2025-10-14
approved_by: Manager Agent
approval_date: 2025-10-14
estimated_effort: 6-8 hours (Analysis: 2-3 hrs, Implementation: 3-4 hrs, Testing: 1-2 hrs)
memory_log_path: apm_session/Memory/Task_Completion_Logs/CRITICAL_Water_Bills_Payment_Deletion_Issues_2025-10-15.md
github_issue: https://github.com/mlandesman/SAMS/issues/26
dependencies: 
  - Priority 1: Water Bills Split Transactions (COMPLETE)
  - Water Bills Surgical Updates (COMPLETE)
blocks:
  - Production deployment of Water Bills system
  - Priority 3: HOA Penalties
  - Priority 4: Statement of Account Report
---

# CRITICAL TASK: Water Bills Payment & Deletion Process Issues

## 🚨 CRITICAL STATUS - PRODUCTION BLOCKER

**DO NOT PROCEED WITH ASSUMPTIONS**  
**ANALYSIS-FIRST APPROACH REQUIRED**

---

## Summary

Implementation Agent correctly identified fundamental issues with Water Bills payment and deletion process flow during Priority 1B testing. Product Manager (Michael) discovered **7 additional critical issues** during testing. The entire payment/deletion/penalty process requires architectural review before implementation continues.

---

## Background Context

### What Was Attempted (Priority 1B)
**Task:** Add surgical penalty recalculation trigger to Water Bills cascade delete  
**Implementation Agent Status:** BLOCKED (correctly stopped work)  
**Reason:** Discovered fundamental process flow and data integrity issues

**Agent's Handover:**
- Created blocker documentation: `docs/Priority_1B_BLOCKED_Manager_Review_Required.md`
- Updated memory log to BLOCKED status
- Preserved all test results
- Correctly stopped rather than proceeding with uncertain assumptions

### What Was Discovered
During testing, Implementation Agent found:
- Data structures not matching expected state
- API endpoints not working as expected
- Process flow needing clarification
- Uncertainty about correct implementation approach

**Critical Decision:** Agent stopped and requested Manager Agent review (CORRECT CHOICE)

---

## 🔥 CRITICAL ISSUES DISCOVERED (Product Manager Testing)

### Issue 1: Credit Balance Not Updated Until Reload
**Status:** 🔴 CRITICAL - Data Integrity  
**Symptom:** Credit used during Water Bills payment not updated in HOA Dues record until page reload  
**Impact:** Credit balance shows incorrect amount after payment  
**Additional Issue:** Hover comment shows "MANUAL ADJUSTMENT" and "[object Object]" in text  
**Expected:** Credit balance should update immediately after payment  
**Testing:** Unit 203 (or others) - make payment using credit, check HOA Dues credit balance

---

### Issue 2: Bill Amounts Not Cleared After Payment
**Status:** 🔴 CRITICAL - Display Logic  
**Symptom:** After payment, bill marked as "Paid" but amounts still shown in table  
**Impact:** Looks like money still owed when it's actually paid  
**Expected:** Paid bills should show $0 due or be cleared from "unpaid" view  
**Testing:** Unit 203 - pay bill, verify amounts cleared from table

---

### Issue 3: Due Amount Still Shows After Refresh/Recalc
**Status:** 🔴 CRITICAL - Calculation Logic  
**Symptom:** After full Refresh recalc and data reload, still shows Due amount  
**Impact:** Incorrect outstanding balance display  
**Expected:** Refresh should recalculate correctly showing $0 due if paid  
**Testing:** Unit 203 - pay bills, do full refresh, reload, check Due amount

---

### Issue 4: "NOBILL" Error Prevents Payment (Units 202 & 204)
**Status:** 🔴 CRITICAL - Payment Blocking  
**Symptom:** Units with no current usage but overdue amounts show "NOBILL" and cannot make payment  
**Impact:** Cannot accept payments for past-due bills without current usage  
**Business Logic:** Should allow payment of past due amounts regardless of current usage  
**Expected:** Payment modal should work for overdue bills (even without new consumption)  
**Testing:** Unit 202, Unit 204 - verify have overdue amounts, try to make payment

---

### Issue 5: Delete Transaction Does Not Restore Credit Balance
**Status:** 🔴 CRITICAL - Cascade Delete  
**Symptom:** Deleting Water Bills payment transaction does not put credit balance back  
**Impact:** Credit balance corruption after deletions  
**Expected:** Credit balance should be restored to pre-payment state  
**Related:** This was the original Priority 1B task objective  
**Testing:** Unit 203 - create payment with credit, delete transaction, verify credit restored

---

### Issue 6: Delete Does Not Mark Bills Unpaid (Even After Refresh)
**Status:** 🔴 CRITICAL - Cascade Delete  
**Symptom:** Deleting payment doesn't mark bills as unpaid, even after full Refresh recalc  
**Impact:** Bills show as paid when payment doesn't exist  
**Expected:** Delete should immediately mark bills unpaid and recalculate  
**Related:** Original Priority 1B task objective  
**Testing:** Unit 203 - create payment, delete, verify bills marked unpaid

---

### Issue 7: lastPenaltyUpdate Not Updating During Surgical Recalc
**Status:** 🔴 CRITICAL - Surgical Update Logic  
**Symptom:** `lastPenaltyUpdate` shows old date "2025-10-11T04:41:34.116Z" even after paying and deleting  
**Impact:** Penalties not being recalculated surgically OR field not being updated  
**Business Logic:** Field indicates penalties only calculated on 11th day (bill date + grace period)  
**Expected:** Surgical process (payment/deletion) should recalculate AND update lastPenaltyUpdate  
**Testing:** Check aggregatedData lastPenaltyUpdate before/after payment/deletion

---

## 📋 ARCHITECTURAL REVIEW REQUIRED

### Critical Questions That Need Answers

**1. Payment Process Flow**
- What is the complete end-to-end payment flow?
- Where does credit balance get updated (HOA Dues document)?
- When should surgical recalc trigger?
- What should surgical recalc update (penalties, amounts, status, dates)?

**2. Deletion Process Flow**
- What is the complete end-to-end deletion flow?
- What needs to be reversed (bills, credit, penalties, timestamps)?
- When should surgical recalc trigger after deletion?
- How to ensure complete data reversal?

**3. Penalty Calculation Process**
- When are penalties calculated?
- What triggers penalty recalculation?
- What is `lastPenaltyUpdate` field for?
- Should surgical recalc update lastPenaltyUpdate?

**4. Data Structure Integration**
- How do Water Bills and HOA Dues share credit balance?
- What fields in aggregatedData need updating?
- What fields in bill documents need updating?
- How does surgical update interact with all of this?

**5. Display vs Calculation**
- Why do amounts still show after payment?
- What should "Paid" bills display?
- How should refresh/recalc work?
- What's the difference between surgical update and full recalc?

---

## 🔍 ANALYSIS-FIRST APPROACH

### Phase 1: Comprehensive Process Documentation (2-3 hours)

**DO NOT CODE YET - ANALYZE FIRST**

#### Step 1.1: Document Water Bills Payment Flow
**Objective:** Map complete end-to-end payment process

**Areas to Analyze:**
1. **Frontend Payment Modal** → What data is sent?
2. **waterPaymentsService.recordPayment()** → What happens?
3. **transactionsController.createTransaction()** → How is transaction created?
4. **Credit Balance Update** → When/where does it update HOA Dues?
5. **Bill Document Update** → What fields change?
6. **Surgical Recalc Trigger** → When does updateAggregatedDataAfterPayment() get called?
7. **aggregatedData Update** → What fields are updated?

**Deliverable:** Flow diagram showing every step with file/function references

#### Step 1.2: Document Water Bills Deletion Flow
**Objective:** Map complete end-to-end deletion process

**Areas to Analyze:**
1. **Frontend Delete Trigger** → From Transactions View
2. **transactionsController.deleteTransaction()** → What happens?
3. **executeWaterBillsCleanupWrite()** → Current implementation
4. **Credit Balance Reversal** → Where/how does it happen?
5. **Bill Document Reversal** → What fields should change back?
6. **Surgical Recalc After Delete** → Should it trigger? How?
7. **aggregatedData Update** → What needs to change?

**Deliverable:** Flow diagram showing every step, identifying MISSING steps

#### Step 1.3: Document HOA Dues Cascade Delete Pattern
**Objective:** Understand reference implementation for comparison

**Reference:** `backend/controllers/transactionsController.js`
- `executeHOADuesCleanupWrite()` (lines 1003-1177)

**Analyze:**
1. How does it identify months to reverse?
2. How does it reverse credit balance?
3. What fields does it update?
4. What does it NOT do (e.g., penalties)?
5. What can be applied to Water Bills?

**Deliverable:** Pattern documentation for Water Bills implementation

#### Step 1.4: Trace Surgical Recalc Integration
**Objective:** Understand when/where surgical update should trigger

**Analyze:**
1. **After Payment:** Where is updateAggregatedDataAfterPayment() called?
2. **After Delete:** Should it be called? Where?
3. **What It Does:** What fields does surgical update modify?
4. **lastPenaltyUpdate:** Should surgical update modify this field?
5. **Cache Invalidation:** How does it trigger UI refresh?

**Deliverable:** Surgical update integration design

---

### Phase 2: Issue Root Cause Analysis (1-2 hours)

**For each of the 7 issues, determine:**

#### Issue Analysis Template
```markdown
### Issue X: [Description]

**Root Cause:** [What's actually broken]

**Current Code:** [What the code does now]

**Expected Code:** [What it should do]

**Fix Location:** [File and function to modify]

**Fix Approach:** [How to fix it]

**Testing:** [How to verify fix]
```

**Deliverable:** Complete root cause analysis for all 7 issues

---

### Phase 3: Implementation Design (1 hour)

**DO NOT CODE - DESIGN ONLY**

**Create implementation plan showing:**
1. **Order of fixes** - Which issues to fix first (dependencies)
2. **Code changes** - Specific files and functions to modify
3. **Testing strategy** - How to verify each fix
4. **Rollback plan** - How to recover if issues found

**Deliverable:** Implementation design document for Manager Agent approval

---

## 📊 FRESH DATA FOR TESTING

### Data Purge & Reload (Tonight)
**Action:** Product Manager will purge and reload AVII data overnight  
**Purpose:** Clean slate for testing tomorrow  
**Benefit:** No corrupted test data from today's experiments  
**Ready:** Fresh AVII data available tomorrow morning

### Testing Strategy (Tomorrow)
**With fresh data:**
1. Test payment flow (verify all 7 issues)
2. Test deletion flow (verify reversal)
3. Test surgical recalc (verify penalties update)
4. Test credit balance (verify integration with HOA Dues)

---

## 🎯 CRITICAL SUCCESS CRITERIA

### Analysis Phase Success
- ✅ Complete payment flow documented (every step)
- ✅ Complete deletion flow documented (every step)
- ✅ HOA Dues pattern analyzed and compared
- ✅ All 7 issues root cause identified
- ✅ Implementation design approved by Manager Agent

### Implementation Phase Success (After Analysis)
- ✅ Credit balance updates immediately after payment
- ✅ Paid bills clear amounts from display
- ✅ Refresh shows correct outstanding balances
- ✅ Can pay overdue bills without current usage ("NOBILL" fixed)
- ✅ Delete restores credit balance
- ✅ Delete marks bills unpaid (immediate, not after refresh)
- ✅ lastPenaltyUpdate field updated during surgical recalc

### Production Readiness
- ✅ All 7 issues resolved
- ✅ Payment process working correctly
- ✅ Deletion process working correctly
- ✅ Credit balance integration working
- ✅ Surgical recalc triggering properly
- ✅ Data integrity maintained
- ✅ Fresh AVII data tested successfully

---

## 📁 REFERENCE DOCUMENTS

### Implementation Agent Blocker Documentation
- **File:** `docs/Priority_1B_BLOCKED_Manager_Review_Required.md`
- **Contents:** Test results, questions, issues discovered, implementation details

### Analysis Documents Created
- **File:** `docs/Priority_1B_Water_Bills_Cascade_Delete_Analysis.md`
- **File:** `docs/Priority_1B_Water_Bills_Testing_Guide.md`

### Test Results
- **File:** `test-results/water-bills-cascade-delete-results.json`
- **File:** `test-cascade-delete-output.log`

### Code Under Review
- **File:** `backend/controllers/transactionsController.js` (lines 894-940)
- **Backup:** `backend/controllers/transactionsController.js.backup-2025-10-15`

---

## 🔬 ANALYSIS APPROACH FOR TOMORROW

### Step 1: Read Implementation Agent's Blocker Documentation
**File:** `docs/Priority_1B_BLOCKED_Manager_Review_Required.md`  
**Purpose:** Understand what agent discovered, questions raised

### Step 2: Trace Complete Payment Flow
**Start:** Frontend payment modal  
**End:** UI refresh after payment  
**Document:** Every function call, every data update

### Step 3: Trace Complete Deletion Flow
**Start:** Delete button in Transactions View  
**End:** UI refresh after deletion  
**Document:** Every function call, every reversal step

### Step 4: Compare with HOA Dues Pattern
**Reference:** HOA Dues cascade delete (working correctly)  
**Identify:** What Water Bills is missing

### Step 5: Root Cause Analysis
**For each of 7 issues:**
- Identify where code breaks
- Document expected behavior
- Design fix approach

### Step 6: Create Implementation Design
**Present to Manager Agent for approval BEFORE coding**

---

## 💡 CRITICAL INSIGHTS FROM PRODUCT MANAGER

### Quote from Michael:
> "I have found a long list of challenges with Bill Payment, Penalty Calculation and Deletion."

**Translation:** This is not just a "cascade delete" issue - it's fundamental problems with:
- Payment process
- Penalty calculation
- Deletion process
- Data integrity across all three

### Implementation Agent's Wisdom:
> "Rather than push forward with potentially wrong assumptions, this needs proper architectural review."

**This is the RIGHT call.** Better to stop and analyze than code blindly.

---

## 🗓️ OVERNIGHT PREPARATION

### Product Manager Action (Tonight)
**Task:** Purge and reload AVII data  
**Purpose:** Clean slate for tomorrow's testing  
**Benefit:** No corrupted test data, fresh start  
**Status:** Will be ready tomorrow morning

### Manager Agent Action (Tomorrow Morning)
**Task:** Review all documentation and create analysis task  
**Focus:** Process flow understanding BEFORE coding  
**Approach:** Analysis-first, no assumptions

### Implementation Agent Action (Tomorrow)
**Phase 1:** Analysis only (2-3 hours)  
**Phase 2:** Design review with Manager Agent  
**Phase 3:** Implementation after approval

---

## 📋 DETAILED ISSUE CATALOG

### Issue 1: Credit Balance Not Updated Until Reload
**Category:** Credit Balance Integration  
**Severity:** 🔴 CRITICAL

**Description:**
- Water Bills payment uses credit balance
- Credit amount not reflected in HOA Dues record until page reload
- Hover comment shows "MANUAL ADJUSTMENT" instead of proper description
- Hover text contains "[object Object]" (data formatting issue)

**Testing Steps:**
1. Check Unit 203 (or any unit) HOA Dues credit balance
2. Make Water Bills payment using credit
3. Check HOA Dues credit balance IMMEDIATELY (don't reload)
4. **Expected:** Credit reduced by amount used
5. **Actual:** Credit unchanged until reload
6. Hover over credit history entry
7. **Expected:** Proper description (e.g., "Water Bills Payment - Unit 203")
8. **Actual:** "MANUAL ADJUSTMENT" with "[object Object]"

**Root Cause Hypothesis:**
- Credit balance update not within same transaction scope?
- Update happening but UI not refreshing?
- Credit history entry missing proper description field?

---

### Issue 2: Bill Amounts Not Cleared After Payment
**Category:** Display Logic  
**Severity:** 🔴 CRITICAL

**Description:**
- After payment, bill status changes to "Paid"
- But amounts (Due, Current Charge, Penalties) still shown in table
- Makes it look like money still owed

**Testing Steps:**
1. Find Unit 203 with unpaid bills
2. Make payment for bills
3. Check Water Bills table
4. **Expected:** Paid bills show $0 or removed from unpaid view
5. **Actual:** Status says "Paid" but amounts still displayed

**Root Cause Hypothesis:**
- Bill document fields not cleared (paidAmount, basePaid, penaltyPaid)?
- Display logic showing totalAmount instead of remainingAmount?
- aggregatedData not updated after payment?

---

### Issue 3: Due Amount Shows After Refresh/Recalc
**Category:** Calculation Logic  
**Severity:** 🔴 CRITICAL

**Description:**
- After full Refresh (recalculate all) and reload
- Still shows Due amount in table for paid bills

**Testing Steps:**
1. Pay bills for Unit 203
2. Click Refresh button (full recalculation)
3. Reload browser page
4. Check Water Bills table
5. **Expected:** Due amount = $0 for paid bills
6. **Actual:** Still shows Due amount

**Root Cause Hypothesis:**
- Full recalc not reading payment data correctly?
- aggregatedData calculation logic flawed?
- Bill status not properly reflected in aggregation?

---

### Issue 4: "NOBILL" Error for Overdue Without Current Usage
**Category:** Payment Logic  
**Severity:** 🔴 CRITICAL - Blocks Payments

**Description:**
- Units 202 & 204 have overdue amounts (past due bills)
- But no current month usage
- System shows "NOBILL" message
- Cannot make payment

**Testing Steps:**
1. Check Unit 202 or 204
2. Verify has overdue amount (past months)
3. Verify no current month usage
4. Try to make payment
5. **Expected:** Can pay overdue bills
6. **Actual:** "NOBILL" error, payment modal doesn't work

**Root Cause Hypothesis:**
- Payment modal checking for current bill only?
- Should allow payment of ANY unpaid bills (current or past)?
- Logic incorrectly blocking overdue-only scenarios?

---

### Issue 5: Delete Transaction - Credit Balance Not Restored
**Category:** Cascade Delete - Credit Integration  
**Severity:** 🔴 CRITICAL

**Description:**
- Delete Water Bills payment transaction
- Credit balance (in HOA Dues) not restored to pre-payment state

**Testing Steps:**
1. Note Unit 203 credit balance (e.g., $500)
2. Make Water Bills payment using $100 credit
3. Verify credit reduced to $400
4. Delete the payment transaction
5. **Expected:** Credit balance restored to $500
6. **Actual:** Credit still shows $400 (not restored)

**Root Cause Hypothesis:**
- executeWaterBillsCleanupWrite() not reversing credit changes?
- Credit history entry not being processed for reversal?
- Integration with HOA Dues credit system broken?

**Related Code:**
- Lines 1233-1271 in transactionsController.js
- Attempts credit reversal through HOA controller
- May have bugs in implementation

---

### Issue 6: Delete Transaction - Bills Not Marked Unpaid
**Category:** Cascade Delete - Bill Status  
**Severity:** 🔴 CRITICAL

**Description:**
- Delete Water Bills payment transaction
- Bills remain marked as "Paid"
- Even after full Refresh recalculation
- Bills should immediately return to "Unpaid" status

**Testing Steps:**
1. Pay Unit 203 June bill
2. Verify bill marked "Paid"
3. Delete payment transaction
4. **Expected:** Bill immediately marked "Unpaid"
5. **Actual:** Bill still shows "Paid"
6. Do full Refresh recalc
7. **Expected:** Bill now shows "Unpaid"
8. **Actual:** Bill STILL shows "Paid"

**Root Cause Hypothesis:**
- executeWaterBillsCleanupWrite() not updating bill status correctly?
- Bill fields not being cleared (paidAmount, basePaid, penaltyPaid)?
- Surgical recalc not triggering after delete?
- Full recalc not reading bill payment data correctly?

**Critical:** This suggests the entire cascade delete implementation may be flawed

---

### Issue 7: lastPenaltyUpdate Field Not Updating
**Category:** Surgical Update - Timestamp Management  
**Severity:** 🔴 CRITICAL

**Description:**
- `lastPenaltyUpdate` field shows old date: "2025-10-11T04:41:34.116Z"
- Stays same date even after:
  - Making payments
  - Deleting payments
  - Surgical recalculation
- Indicates penalties NOT being recalculated OR timestamp not updating

**Business Logic Context:**
- Penalties only calculated after grace period (typically 11th day)
- `lastPenaltyUpdate` tracks when penalties were last calculated
- Surgical recalc should update this timestamp

**Testing Steps:**
1. Check aggregatedData for Unit 203
2. Note lastPenaltyUpdate value
3. Make payment (should trigger surgical recalc)
4. Check lastPenaltyUpdate
5. **Expected:** Updated to current timestamp
6. **Actual:** Still shows old date (2025-10-11)
7. Delete payment
8. Check lastPenaltyUpdate
9. **Expected:** Updated to current timestamp
10. **Actual:** Still shows old date

**Root Cause Hypothesis:**
- Surgical update (updateAggregatedDataAfterPayment) not updating lastPenaltyUpdate?
- Surgical update not actually recalculating penalties?
- Field update missing from surgical update logic?

**Critical Implication:**
If lastPenaltyUpdate not updating, surgical recalc may not be working at all, or it's calculating but not storing the timestamp.

---

## 🎯 TOMORROW'S TASK STRUCTURE

### Morning Session: Analysis Phase (2-3 hours)

**Implementation Agent Responsibilities:**
1. **Read all blocker documentation** from today's agent
2. **Trace payment flow** end-to-end (document every step)
3. **Trace deletion flow** end-to-end (document every step)
4. **Compare with HOA Dues** cascade delete pattern
5. **Analyze each of 7 issues** to find root causes
6. **Create implementation design** showing fixes for all issues
7. **Present to Manager Agent** for review and approval

**DO NOT CODE until Manager Agent approves design**

### Afternoon Session: Implementation Phase (3-4 hours)

**After Manager Agent approval:**
1. Implement fixes for all 7 issues
2. Test with fresh AVII data
3. Verify surgical recalc working
4. Verify credit balance integration
5. Verify cascade delete complete
6. Document all changes

### Evening Session: Verification (1-2 hours)

**Product Manager Testing:**
1. Test payment flow (all scenarios)
2. Test deletion flow (verify complete reversal)
3. Test edge cases (overdue without current, credit scenarios)
4. Approve for production or identify additional issues

---

## ⚠️ CRITICAL CONSTRAINTS

### DO NOT Proceed Without:
1. ❌ Complete process flow documentation
2. ❌ Root cause analysis for all 7 issues
3. ❌ Implementation design approved by Manager Agent
4. ❌ Clear understanding of correct behavior

### DO Proceed With:
1. ✅ Analysis-first approach
2. ✅ Questions to Manager Agent when uncertain
3. ✅ Fresh AVII test data (after overnight purge/reload)
4. ✅ Systematic testing of each fix

---

## 📚 REFERENCE MATERIALS

### Completed Work (Reference Only)
- Priority 1: Water Bills Split Transactions - Pattern to maintain
- Water Bills Surgical Updates - Function to integrate
- HOA Dues Cascade Delete - Pattern to follow

### Code Under Review
- `backend/controllers/transactionsController.js`
  - Lines 872-891: Water Bills cleanup call site
  - Lines 1180-1277: executeWaterBillsCleanupWrite (current implementation)
  - Lines 1003-1177: executeHOADuesCleanupWrite (reference pattern)

### Analysis Documents
- `docs/Priority_1B_BLOCKED_Manager_Review_Required.md` (from today's agent)
- `docs/Priority_1B_Water_Bills_Cascade_Delete_Analysis.md` (partial)
- `docs/Priority_1B_Water_Bills_Testing_Guide.md` (partial)

---

## 🚨 PRODUCTION BLOCKER STATUS

**Cannot Deploy To Production Until:**
- ✅ All 7 issues resolved
- ✅ Payment flow working correctly end-to-end
- ✅ Deletion flow working correctly end-to-end
- ✅ Credit balance integration verified
- ✅ Surgical recalc verified working
- ✅ Data integrity confirmed with fresh data

**Impact:**
- Priority 1 (Split Transactions) cannot go to production
- Priority 2 (Quarterly Display) blocked by Priority 1B
- Priority 3 (Penalties) blocked by Priority 1B
- Priority 4 (Statement of Account) blocked by all above

**Timeline Impact:**
- Foundation chain on hold until Priority 1B resolved
- Estimated delay: 1-2 days (analysis + implementation + testing)

---

## 💬 IMPLEMENTATION AGENT INSTRUCTIONS

### Tomorrow Morning Start:

1. **Read This Document** completely
2. **Read Blocker Documentation** from previous agent
3. **Create Analysis Plan** showing approach
4. **Present to Manager Agent** for approval
5. **Begin analysis** only after approval
6. **DO NOT CODE** until analysis complete and approved

### Critical Mindset:
- **Analysis first, code later**
- **Ask questions** when uncertain
- **Document everything** you discover
- **Stop and ask** if you hit blockers

### Success Definition:
**Manager Agent says:** "I understand the complete flow, I agree with your root cause analysis, I approve your implementation design - proceed with coding."

**NOT:** "I think I know what to do, let me try this approach."

---

**Manager Agent Approval:** This CRITICAL task is READY FOR ASSIGNMENT tomorrow morning with fresh AVII test data. Analysis-first approach mandatory.

**Estimated Total Effort:** 6-8 hours (Analysis: 2-3, Implementation: 3-4, Testing: 1-2)  
**Priority:** 🚨 CRITICAL - Blocks all foundation work and production deployment  
**Approach:** ANALYSIS-FIRST - No coding without approved design

---

**Created:** October 14, 2025, 11:00 PM  
**For:** Tomorrow (October 15, 2025) post-golf session  
**Fresh Data:** AVII purged and reloaded overnight  
**Status:** Ready for deep analysis and systematic resolution

