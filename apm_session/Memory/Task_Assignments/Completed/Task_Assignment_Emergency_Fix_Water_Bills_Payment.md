---
task_ref: "GitHub Issue #21 - Water Bills Payment currentYear Bug"
agent_assignment: "Agent_Emergency_Fix"
memory_log_path: "apm_session/Memory/Task_Completion_Logs/Emergency_Fix_Water_Bills_Payment_2025-10-12.md"
execution_type: "single-step"
dependency_context: false
ad_hoc_delegation: false
priority: 🚨 CRITICAL
github_issue: "#21"
---

# APM Task Assignment: Emergency Fix - Water Bills Payment currentYear Bug

## Task Reference
**GitHub Issue:** #21 - Unable to save Water Bills payment  
**Priority:** 🚨 CRITICAL - Production Blocker  
**Agent:** Agent_Emergency_Fix  
**Type:** Emergency bug fix

## Context

### Critical Production Bug
Water bills payment functionality is completely broken with error:

```
Error recording water payment: ReferenceError: currentYear is not defined
at WaterPaymentsService.recordPayment 
(backend/services/waterPaymentsService.js:206:55)
```

### Impact
- **Cannot save water bills payments** - CRITICAL functionality broken
- **Production blocker** - Affects AVII client water billing workflow
- **Immediate fix required** - Users cannot process water payments

### Root Cause Discovery
This bug was **previously fixed** in commit ea88f12 (Oct 10, 2025) as part of Priority 3a (Water Bills Split Transactions):
```
Fix: Changed currentYear to fiscalYear variable
```

**What Happened:**
- Priority 3a was implemented on feature branch `feature/water-bills-split-transactions`
- Feature branch was never merged to main
- Bug fix never made it to production
- Code on feature branch is now 99,000+ lines diverged from main (Firebase migration happened)
- Cannot safely merge the old feature branch

**Current State:**
- Bug exists at line 206 in `waterPaymentsService.js`
- Variable `currentYear` is undefined
- Should be `fiscalYear` (or similar valid variable)

## Objective
Emergency fix to resolve the `currentYear is not defined` error in `waterPaymentsService.js` line 206, restoring water bills payment functionality immediately.

## Git Workflow

**IMPORTANT:** Emergency fix on dedicated branch.

### Branch Setup
1. **Create new branch:** `git checkout -b hotfix/water-bills-currentyear-bug`
2. **Work on this branch exclusively** for this task
3. **Commit changes** with clear emergency fix message
4. **Push branch** when complete: `git push origin hotfix/water-bills-currentyear-bug`

### Commit Message Format
```
Hotfix: Fix currentYear undefined error in water bills payment

- Changed currentYear to fiscalYear at line 206
- Restores water bills payment functionality
- Emergency fix for production blocker

Fixes #21
```

**This is an emergency fix - fast-track review and merge recommended.**

## Detailed Instructions

**Complete all items in one response:**

### 1. Locate the Exact Error
Find line 206 in `backend/services/waterPaymentsService.js`:
- Identify the exact line with `currentYear` reference
- Understand the context (what's the code trying to do?)
- Check surrounding lines for clues about correct variable name

### 2. Identify Correct Variable Name
Look for the fiscal year variable in the function:
- Check function parameters for fiscal year
- Look for earlier variable declarations (e.g., `fiscalYear`, `year`, etc.)
- Check if there's a calculation that determines fiscal year
- Verify the variable is actually available in scope

### 3. Apply the Fix
Replace `currentYear` with the correct variable:

**Common fixes (use appropriate one):**
```javascript
// Option A: If fiscalYear variable exists
currentYear → fiscalYear

// Option B: If year variable exists
currentYear → year

// Option C: If needs to be calculated from date
const fiscalYear = getFiscalYear(date, fiscalYearStartMonth);
```

### 4. Check for Other Instances
Search for any other `currentYear` references in the file:
```bash
grep -n "currentYear" backend/services/waterPaymentsService.js
```

If found, evaluate each:
- Same bug? → Fix it
- Different usage? → Verify it's correct

### 5. Quick Verification
After fix:
- [ ] Variable is defined before use
- [ ] Variable name matches function context
- [ ] No other `currentYear` references exist (or all are correct)
- [ ] Code logic makes sense

## Expected Output

### Deliverables
1. **Fixed File:** `backend/services/waterPaymentsService.js` with `currentYear` bug resolved
2. **Verification:** Confirmed no other instances of the bug exist
3. **Memory Log:** Brief documentation at specified path

### Success Criteria
- Water bills payment no longer throws `currentYear is not defined` error
- Variable reference is correct and in scope
- No other occurrences of the bug
- Code committed and pushed to hotfix branch

## Testing & Validation

**This is an EMERGENCY FIX - testing must be fast but thorough:**

### Code Review Testing
1. **Variable Scope Check:**
   - Verify the replacement variable exists in function scope
   - Confirm it has the correct fiscal year value
   
2. **Logic Verification:**
   - Ensure the fix makes sense in context
   - Check that fiscal year calculation is correct

### Manual Testing (If Possible)
**Recommended but not blocking:**
- Test water bills payment in Dev environment
- Verify payment saves successfully
- Check transaction is created correctly

**If testing not immediately available:**
- Document the fix clearly
- Code review is sufficient for emergency deployment
- Product Manager will test after merge

## Files to Check

### Primary File (Must Fix)
- `backend/services/waterPaymentsService.js` - Line 206 (approximately)

### Related Files (Check if time permits)
- `functions/backend/services/waterPaymentsService.js` - May have same bug if file exists
- Any other water payment related services

### Reference (Do NOT merge from this)
- Feature branch: `feature/water-bills-split-transactions`
- Commit ea88f12: Shows the original fix (reference only)

## Business Impact

### Why This Is Critical
- **Production Blocker:** Water bills payments completely broken
- **Revenue Impact:** Cannot record water bill payments
- **Client Service:** AVII client cannot process water billing
- **User Frustration:** Core functionality unavailable

### Post-Fix Impact
- Water bills payments functional again
- Users can record payments
- AVII client water billing workflow restored
- Foundation preserved for Priority 3a full implementation

## Important Notes

### This is an Emergency Fix, Not Priority 3a
**What this fix DOES:**
- ✅ Resolves immediate `currentYear` bug
- ✅ Restores water bills payment functionality
- ✅ Unblocks production workflow

**What this fix DOES NOT do:**
- ❌ Implement full Priority 3a (Water Bills Split Transactions)
- ❌ Add allocations[] array to water bills
- ❌ Separate penalties as distinct line items
- ❌ Enable detailed breakdown for Statement of Account

**After this fix:**
- Water bills payments will work
- Priority 3a will still need full implementation (separate task)
- This buys time to properly implement Priority 3a against current codebase

### Historical Context
The bug was introduced when Priority 3a code (which included the fix) was not merged to main. We're now fixing just the bug without the full Priority 3a feature implementation.

## Memory Logging
Upon completion, you **MUST** log work in: `apm_session/Memory/Task_Completion_Logs/Emergency_Fix_Water_Bills_Payment_2025-10-12.md`

Follow `apm/prompts/guides/Memory_Log_Guide.md` instructions.

**Include in log:**
- **Branch name:** `hotfix/water-bills-currentyear-bug`
- **Commit hash:** Record the git commit SHA
- Exact line number and change made
- Variable name used as replacement
- Any other instances found and fixed
- Verification steps completed
- Whether manual testing was possible
- Recommendation for Priority 3a full implementation timing

---

**Manager Agent Note:** This is a surgical emergency fix. Focus only on resolving the `currentYear` bug. Do not attempt to implement Priority 3a features. Get water bills working again, then we'll properly implement Priority 3a as a separate task against the current codebase.

