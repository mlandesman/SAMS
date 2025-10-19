# 🚀 IMPLEMENTATION AGENT - START HERE

## Welcome, Implementation Agent!

You've been assigned to work on the **Water Bills Complete Fix** project. This document tells you exactly what to do first.

---

## ⚠️ CRITICAL: Read This First

### You Are Working On:
**Feature Branch:** `feature/water-bills-issues-0-7-complete-fix`

**DO NOT work on `main` branch!**

---

## 📋 Which Task Are You Assigned To?

### **Task 1: Penalty Calculation Integration** (3-4 hours)
**Status:** Ready to start immediately  
**Priority:** 🚨 CRITICAL - Root cause  
**Read:** `apm_session/Memory/Task_Assignments/Active/READY_FOR_ASSIGNMENT_Task_1.md`

### **Task 2: Payment Issues Resolution** (4-5 hours)
**Status:** Ready after Task 1 complete  
**Priority:** 🔥 HIGH - Critical payment issues  
**Read:** `apm_session/Memory/Task_Assignments/Active/READY_FOR_ASSIGNMENT_Task_2.md`

### **Task 3: Delete Reversal Implementation** (2-3 hours)
**Status:** Ready after Tasks 1 & 2 complete  
**Priority:** 🔥 HIGH - Financial integrity  
**Read:** `apm_session/Memory/Task_Assignments/Active/READY_FOR_ASSIGNMENT_Task_3.md`

---

## 🔀 Step 1: Verify Git Setup (MANDATORY)

```bash
# Check current branch
git branch

# Should show: * feature/water-bills-issues-0-7-complete-fix
# If not, you're on the WRONG branch!
```

**If on wrong branch:**
```bash
git checkout feature/water-bills-issues-0-7-complete-fix
```

**If branch doesn't exist, STOP and contact Manager Agent**

---

## 📖 Step 2: Read Required Documents

### For ALL Tasks:
1. **Git Workflow** (5 min read)
   - `docs/GIT_WORKFLOW_FOR_WATER_BILLS_FIX.md`
   - Explains branch strategy, commit guidelines, merge process

2. **Your Task Assignment** (10 min read)
   - Task 1: `apm_session/Memory/Task_Assignments/Active/READY_FOR_ASSIGNMENT_Task_1.md`
   - Task 2: `apm_session/Memory/Task_Assignments/Active/READY_FOR_ASSIGNMENT_Task_2.md`
   - Task 3: `apm_session/Memory/Task_Assignments/Active/READY_FOR_ASSIGNMENT_Task_3.md`

3. **Detailed Task Instructions** (20 min read)
   - Task 1: `apm_session/Memory/Task_Assignments/Active/Task_1_Penalty_Calculation_Integration.md`
   - Task 2: `apm_session/Memory/Task_Assignments/Active/Task_2_Payment_Issues_Resolution.md`
   - Task 3: `apm_session/Memory/Task_Assignments/Active/Task_3_Delete_Reversal_Implementation.md`

### Optional But Helpful:
4. **Investigation Reports** (if you want deeper context)
   - Phase 1: `docs/investigations/Phase_1_Penalty_Calculation_Flow_Diagram.md`
   - Phase 2: `docs/investigations/Phase_2_Payment_Cascade_Flow_Diagram.md`
   - Phase 3: `docs/investigations/Phase_3_Delete_Reversal_Flow_Diagram.md`

---

## 🧪 Step 3: Set Up Testing Environment

### ⚠️ CRITICAL: You MUST Use testHarness for API Testing

**WHY:**
- All API endpoints require Firebase authentication tokens
- Direct calls (axios, fetch, curl) will FAIL with 401/403 errors
- testHarness automatically handles authentication for you
- It provides the auth context needed for live data access

### Backend Server:
```bash
cd backend
npm start
# Should start on port 5001
```

### Test Harness (REQUIRED for API calls):
```bash
# From backend directory
cd backend

# Use testHarness for ALL API endpoint testing
node testing/testHarness.js

# Or create task-specific test file
node testing/testTask1Penalties.js
```

**DO NOT try to call endpoints directly - they require auth tokens!**

### Fresh AVII Data:
- Already loaded in Dev environment
- Client: AVII
- Test Unit: 203 (or any unit with overdue bills)

---

## 💻 Step 4: Start Implementation

### Recommended Flow:

1. **Read** your task assignment completely
2. **Verify** you understand the problem and solution
3. **Locate** the files you need to modify
4. **Implement** changes incrementally
5. **Test** each change as you go
6. **Commit** at logical checkpoints

### Commit Often:
```bash
# After each working component
git add <files>
git commit -m "feat(water-bills): <what you did>

- Detail 1
- Detail 2

Task: WB-Implementation-<number>
Status: In Progress"
```

---

## 📝 Step 5: Create Memory Log

**When task complete, create:**
- Task 1: `apm_session/Memory/Task_Completion_Logs/Task_1_Penalty_Calculation_Integration_2025-10-15.md`
- Task 2: `apm_session/Memory/Task_Completion_Logs/Task_2_Payment_Issues_Resolution_2025-10-15.md`
- Task 3: `apm_session/Memory/Task_Completion_Logs/Task_3_Delete_Reversal_Implementation_2025-10-15.md`

**Must include:**
- What you implemented
- Test results (all tests must pass)
- Before/after evidence
- Any issues encountered

---

## ✅ Step 6: Report Completion

### Use `/manager-review-enhanced` command

Include:
- Task number and name
- Duration (actual vs estimated)
- All test results
- Memory Log location
- Commit hash
- Any blockers or issues

---

## 🚨 Critical Rules

### DO:
- ✅ Work on feature branch
- ✅ Read all documentation first
- ✅ Test thoroughly (backend API focus)
- ✅ Commit frequently
- ✅ Create Memory Log
- ✅ Report completion to Manager Agent

### DO NOT:
- ❌ Work on main branch
- ❌ Skip reading documentation
- ❌ Skip testing
- ❌ Claim success without evidence
- ❌ Create new cron jobs (add to existing)
- ❌ Guess or assume - ask if unclear

---

## 📊 Success Metrics

### Task 1:
- All units show penalties > $0 (not $0)
- `penaltiesApplied` = true
- 5 backend tests pass

### Task 2:
- Credit updates immediately (no reload)
- Paid bills show $0 due
- Can pay overdue without current usage
- 4 backend tests pass

### Task 3:
- Delete fully reverses payment
- Credit balance correct after delete
- Bills marked unpaid
- 5 backend tests pass

---

## 📞 Need Help?

### If Stuck:
1. Review investigation documents in `docs/investigations/`
2. Check code references in detailed task instructions
3. Ask Manager Agent for clarification
4. **DO NOT** guess or proceed if uncertain

### Common Issues:
- **Wrong branch:** `git checkout feature/water-bills-issues-0-7-complete-fix`
- **Missing files:** `git pull` to get latest changes
- **Test failures:** Check backend logs, review investigation docs
- **Commit errors:** Check git workflow document

---

## 🎯 Your Goal

Make Water Bills **"rock solid"** so it can be the reference implementation for HOA Dues and other modules.

**Timeline:**
- Task 1: 3-4 hours
- Task 2: 4-5 hours
- Task 3: 2-3 hours
- **Total: 9-12 hours** across all 3 tasks

---

## 📁 Key File Locations

### Task Assignments:
- `apm_session/Memory/Task_Assignments/Active/READY_FOR_ASSIGNMENT_Task_*.md`
- `apm_session/Memory/Task_Assignments/Active/Task_*_*.md`

### Investigations:
- `docs/investigations/Phase_*_*.md`

### Git Workflow:
- `docs/GIT_WORKFLOW_FOR_WATER_BILLS_FIX.md`

### Code to Modify:
- **Task 1:** `backend/services/waterDataService.js`
- **Task 2:** `backend/services/waterPaymentsService.js`, frontend files
- **Task 3:** `backend/services/transactions/transactionsCleanupService.js`

### Tests:
- `backend/testing/testHarness.js`
- Create task-specific test files as needed

---

**Good luck! You've got comprehensive documentation, clear requirements, and proven patterns to follow. Make Water Bills rock solid! 🚀**

---

**Manager Agent:** APM Manager Agent  
**Product Manager:** Michael Landesman  
**Created:** October 15, 2025  
**Feature Branch:** feature/water-bills-issues-0-7-complete-fix
