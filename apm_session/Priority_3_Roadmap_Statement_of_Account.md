---
priority: Priority 3 - Statement of Account Report
strategy: Foundation-First Approach
total_effort: 16-20 hours (3 tasks)
manager_agent: Approved
date: 2025-10-10
---

# Priority 3: Statement of Account Report - Three-Step Roadmap

## Strategic Overview

**Goal:** Deliver professional Statement of Account reports with detailed breakdown of bills, penalties, and quarterly collection support.

**Strategy:** Build foundation correctly FIRST to prevent rework

**Why This Approach:** Statement of Account pulls data from transactions collection. Without proper data structures in place, the report would either:
1. Show incomplete information (missing penalty breakdown)
2. Require complex data transformation logic
3. Need immediate rework after foundation tasks complete

---

## Three-Step Dependency Chain

### Priority 3a: Water Bills Split Transactions (4-5 hours) ✅ APPROVED

**Purpose:** Create allocation breakdown in transactions for penalty visibility

**Why First:**
- Statement of Account reads from transactions collection
- Report MUST show penalties as separate line items
- Without split allocations, report cannot display detailed breakdown
- Doing later = immediate rework of Statement of Account

**Implementation:**
- Apply HOA Dues `allocations[]` pattern to Water Bills
- Separate base charges from penalties in transaction structure
- Enable "-Split-" category for multi-allocation transactions

**Deliverable:** Water Bills transactions with detailed allocation breakdown

**Status:** Task assignment created and approved by Manager Agent

**File:** `/apm_session/Memory/Task_Assignments/Active/Task_Assignment_Water_Bills_Split_Transactions.md`

---

### Priority 3b: HOA Dues Quarterly Collection (4-5 hours) ⏳ NEXT

**Purpose:** Add quarterly view logic for AVII client

**Why Second:**
- AVII client uses quarterly billing (MTC uses monthly)
- Statement of Account needs quarterly display for AVII reports
- Without quarterly logic, AVII reports won't show correct view
- Doing later = rework Statement of Account for quarterly support

**Implementation:**
- Quarterly display/grouping when `config.feeStructure.duesFrequency == "quarterly"`
- Data still stored monthly (display logic only)
- Fiscal calendar integration for quarter periods
- Partial payment tracking across quarters

**Deliverable:** HOA Dues quarterly view with fiscal calendar support

**Status:** Ready for task assignment after Priority 3a completion

---

### Priority 3c: Statement of Account Report (8-10 hours) 🎯 GOAL

**Purpose:** Professional client-branded reports with complete data

**Why Third:**
- Now has clean split transaction data (from 3a)
- Now has quarterly collection support (from 3b)
- Can pull complete information from transactions without transformation
- No immediate rework needed

**Implementation:**
- ReportEngine and template system
- Client branding integration
- Payment status tracking
- Penalty visibility (using split allocations from 3a)
- Quarterly view support (using quarterly logic from 3b)
- Bilingual template foundation

**Deliverable:** Production-ready Statement of Account reports for MTC and AVII

**Status:** Ready for task assignment after Priority 3a and 3b completion

---

## Dependency Visualization

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Priority 3: Statement of Account Report               │
│                                                         │
│  Total Effort: 16-20 hours                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
                        ▲
                        │
                        │ Uses data from
                        │
        ┌───────────────┴───────────────┐
        │                               │
        │                               │
┌───────┴────────┐              ┌──────┴───────┐
│                │              │              │
│  Priority 3a   │              │ Priority 3b  │
│                │              │              │
│  Water Bills   │              │ HOA Dues     │
│  Split Trans   │              │ Quarterly    │
│                │              │              │
│  (4-5 hrs)     │              │  (4-5 hrs)   │
│                │              │              │
└────────────────┘              └──────────────┘
      │                               │
      │                               │
      ├─ Penalty breakdown            ├─ Quarterly view
      ├─ Allocation structure         ├─ Fiscal calendar
      └─ Transaction detail           └─ Partial payments
```

---

## Why Foundation-First Approach

### Option A: Build Foundation First (RECOMMENDED - Michael's Choice)
**Path:** 3a → 3b → 3c  
**Total:** ~16-20 hours  
**Rework:** Zero  

**Pros:**
- ✅ Statement of Account uses clean data structures
- ✅ No immediate rework needed
- ✅ Report shows complete information from day 1
- ✅ Penalty breakdown properly displayed
- ✅ Quarterly view works for AVII
- ✅ Foundation built correctly once

**Cons:**
- Takes longer to reach first report
- More upfront planning required

---

### Option B: Report First, Foundation Later (NOT RECOMMENDED)
**Path:** 3c → 3a → 3b → 3c (rework)  
**Total:** ~20-25 hours (includes rework)  
**Rework:** 4-5 hours  

**Pros:**
- Get to first report faster

**Cons:**
- ❌ Report shows incomplete data initially
- ❌ Penalties not broken down separately
- ❌ AVII quarterly view doesn't work
- ❌ Immediate rework required after 3a and 3b
- ❌ More total time due to rework
- ❌ Technical debt created

---

## Business Value Progression

### After Priority 3a (Water Bills Split Transactions)
**Immediate Benefits:**
- Water Bills transactions show detailed breakdown
- Penalties visible as separate line items in UI
- Consistent transaction structure across HOA and Water Bills
- Foundation for reporting ready

**Enables:**
- Better transaction analysis
- Penalty tracking and visibility
- Consistent data patterns

---

### After Priority 3b (HOA Dues Quarterly Collection)
**Immediate Benefits:**
- AVII client can view HOA Dues quarterly
- Fiscal calendar integration working
- Partial payment tracking across quarters
- Foundation for quarterly reporting ready

**Enables:**
- Quarterly billing for AVII client
- Flexible billing frequency per client
- Data-driven client configuration

---

### After Priority 3c (Statement of Account Report)
**Complete Benefits:**
- ✅ Professional client-branded reports
- ✅ Penalty breakdown shown separately
- ✅ Quarterly view for AVII clients
- ✅ Monthly view for MTC clients
- ✅ Payment status tracking
- ✅ Bilingual template foundation
- ✅ Google Sheets replacement
- ✅ Foundation for ALL future reports

**Enables:**
- Monthly transaction reports
- Budget vs Actual reports
- Custom report generation
- Automated report delivery

---

## Timeline Estimates

### Aggressive Schedule
- **Day 1:** Priority 3a - Water Bills Split Transactions (4-5 hours)
- **Day 2:** Priority 3b - HOA Dues Quarterly Collection (4-5 hours)
- **Days 3-4:** Priority 3c - Statement of Account Report (8-10 hours)
- **Total:** 3-4 working days

### Realistic Schedule
- **Week 1:** Priority 3a complete
- **Week 2:** Priority 3b complete
- **Week 3:** Priority 3c complete
- **Total:** 3 weeks with testing and review

### Conservative Schedule
- **Sprint 1:** Priority 3a (with buffer for issues)
- **Sprint 2:** Priority 3b (with buffer for issues)
- **Sprint 3-4:** Priority 3c (larger task, more buffer)
- **Total:** 4 sprints/sessions

---

## Success Metrics

### Priority 3a Success
- [ ] Water Bills transactions have `allocations[]` array
- [ ] Penalties appear as separate allocations
- [ ] Transaction category shows "-Split-" when multiple allocations
- [ ] UI displays split transaction breakdown
- [ ] Import creates proper split transactions

### Priority 3b Success
- [ ] HOA Dues table shows quarterly view for AVII
- [ ] Monthly view still works for MTC
- [ ] Fiscal calendar determines quarter periods
- [ ] Partial payments tracked across quarters
- [ ] Configuration-driven (data-driven architecture)

### Priority 3c Success (COMPLETE GOAL)
- [ ] Professional PDF reports generated
- [ ] Client branding properly applied
- [ ] Penalties shown as separate line items (using 3a)
- [ ] Quarterly view works for AVII (using 3b)
- [ ] Monthly view works for MTC
- [ ] Payment status accurately reflected
- [ ] Email delivery working
- [ ] Foundation proven for future reports

---

## Risk Assessment

### Risks if Foundation Built First (Low Risk)
- ⚠️ Takes longer to reach first report (3 tasks vs 1)
- ⚠️ More upfront effort required

**Mitigation:** Clear task assignments, proven patterns, manageable scope

---

### Risks if Report Built First (High Risk)
- 🚨 Immediate rework required after foundation tasks
- 🚨 Report shows incomplete data initially
- 🚨 Technical debt from data transformation logic
- 🚨 More total time due to rework (4-5 extra hours)
- 🚨 User confusion from changing report format

**Mitigation:** Don't do this approach

---

## Manager Agent Recommendations

### Approved Approach ✅
**Build Foundation First:** Priority 3a → 3b → 3c

**Reasoning:**
1. **Prevents Rework:** Foundation built correctly once
2. **Clean Data:** Report uses proper data structures
3. **Complete Information:** All details available from day 1
4. **Total Time:** Less overall time (no rework)
5. **Quality:** Higher quality implementation
6. **Maintainability:** Cleaner code, easier to maintain

### Quality Gates
**Each task must pass Manager Agent review before next task starts:**
- Priority 3a: Must verify penalty separation in allocations
- Priority 3b: Must verify quarterly view logic correct
- Priority 3c: Must verify reports use clean data without transformation

---

## Current Status

### Completed ✅
- Priority 1: Import System (all components)
- Priority 2: Water Bills Code Recovery
- Water Bills Transaction Linking (enables split transactions)

### In Progress 🔄
- Priority 3a: Task assignment created and approved by Manager Agent
- Ready for Implementation Agent assignment tomorrow

### Next Up ⏳
- Priority 3b: Ready for task assignment after 3a completion
- Priority 3c: Ready for task assignment after 3b completion

---

## Key Decisions

### Decision 1: Foundation-First Approach ✅
**Decided:** Build split transactions and quarterly logic BEFORE Statement of Account  
**Reason:** Prevents immediate rework, provides clean data structures  
**Decision Maker:** Michael (Product Manager)  
**Date:** October 10, 2025

### Decision 2: Three-Task Sequence ✅
**Decided:** 3a (Split) → 3b (Quarterly) → 3c (Report)  
**Reason:** Each task enables the next, proper dependency order  
**Decision Maker:** Michael + Manager Agent  
**Date:** October 10, 2025

### Decision 3: Penalty Separation is Critical ✅
**Decided:** Penalties must be separate allocations, not combined with base charge  
**Reason:** Statement of Account MUST show penalties as separate line items  
**Decision Maker:** Business requirement  
**Date:** October 10, 2025

---

**Manager Agent:** Ready to execute Priority 3a tomorrow  
**Product Manager Approval:** ✅ Confirmed  
**Path Forward:** Clear and well-defined  
**Estimated Completion:** 3-4 weeks (realistic schedule)

