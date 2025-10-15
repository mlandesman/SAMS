# Git Workflow for Water Bills Complete Fix

## Branch Information

**Branch Name:** `feature/water-bills-issues-0-7-complete-fix`

**Strategy:** Single combined feature branch for all 4 tasks (all-or-nothing merge)

**Created:** October 15, 2025

---

## Current Status

### ✅ Committed to Feature Branch

**Commit 1: Task 0A Implementation**
- Files: creditService.js, creditController.js, creditRoutes.js, testCreditEndpoint.js
- Modified: backend/index.js (route registration)
- Tests: 6/6 passing
- Memory Log: Task_0A_Credit_Balance_Endpoint_2025-10-15.md

**Commit 2: Documentation**
- 3 Investigation reports (Phases 1, 2, 3)
- 4 Task assignments (0A, 1, 2, 3)
- Michael's validation checklist
- 18 investigation documents in docs/investigations/

---

## Workflow Rules for Implementation Agents

### Before ANY Code Changes:

1. **Verify Feature Branch:**
   ```bash
   git branch
   # Should show: * feature/water-bills-issues-0-7-complete-fix
   ```

2. **If on wrong branch, STOP:**
   ```bash
   # DO NOT PROCEED - Contact Manager Agent
   ```

3. **Check clean state:**
   ```bash
   git status
   # Avoid version.json files (auto-generated, ignore them)
   ```

---

## Commit Guidelines

### Commit Frequency:
- **After each major component** (don't wait until task complete)
- **After tests pass** (checkpoint working state)
- **Before major refactoring** (safety net)

### Commit Message Format:
```
<type>(water-bills): <description>

- Bullet point details
- What changed
- What was tested

Task: WB-Implementation-<number>
Status: <Complete/In Progress>
```

### Types:
- `feat`: New feature (new endpoint, new function)
- `fix`: Bug fix (fixing Issues 1-7)
- `refactor`: Code restructuring (no behavior change)
- `test`: Adding/modifying tests
- `docs`: Documentation only

### Examples:
```bash
# Good commits:
git commit -m "feat(water-bills): Add penalty calc to nightly build

- Integrate _applyPenaltiesToMonth into calculateYearSummary
- Update lastPenaltyUpdate timestamp
- Tests: Penalties now > $0 for overdue bills

Task: WB-Implementation-1-Penalty
Status: In Progress"

git commit -m "fix(water-bills): Credit balance updates immediately

- Updated waterPaymentsService to use /credit endpoint
- Removed HOA Dues context dependency
- Tests: Credit updates without page reload

Task: WB-Implementation-2-Payment
Fixes: Issue 1"

git commit -m "test(water-bills): Add penalty calculation test suite

- 5 backend API tests added
- All tests passing
- Coverage: nightly build, surgical update, penalty formula

Task: WB-Implementation-1-Penalty"
```

---

## Files to AVOID Committing

### Auto-Generated (ignore):
- `frontend/mobile-app/version.json`
- `frontend/sams-ui/public/version.json`
- `frontend/sams-ui/version.json`
- `shared/version.json`

### If accidentally staged:
```bash
git restore --staged <file>
```

---

## Merge Strategy

### When All 4 Tasks Complete:

1. **Final Testing on Feature Branch**
   - Run complete test suite
   - Test with fresh AVII data
   - Verify all 8 issues resolved

2. **Create Pull Request**
   - Title: "Water Bills Complete Fix - Issues 0-7"
   - Description: Summary of all fixes
   - Link to investigation documents
   - Test results

3. **Code Review by Product Manager**
   - Michael reviews PR
   - Approves or requests changes

4. **Merge to Main**
   ```bash
   # Only after approval
   git checkout main
   git merge feature/water-bills-issues-0-7-complete-fix --no-ff
   git push origin main
   ```

5. **Deploy to Production**
   - Follow QUICK_DEPLOY_GUIDE.md
   - Monitor logs
   - Verify issues resolved

---

## Recovery Procedures

### If Need to Restart:
```bash
# Stash current work
git stash save "Task X checkpoint"

# Switch to main
git checkout main

# Return to feature branch
git checkout feature/water-bills-issues-0-7-complete-fix

# Restore work
git stash pop
```

### If Feature Branch Corrupted:
```bash
# Create new feature branch from last good commit
git checkout -b feature/water-bills-issues-0-7-complete-fix-v2 <commit-hash>

# Cherry-pick specific commits
git cherry-pick <commit-hash>
```

---

## Current Branch State

```
main (clean, up to date with origin)
  ↓
feature/water-bills-issues-0-7-complete-fix (2 commits)
  ├─ 8ff1d38: feat(water-bills): Add /credit REST endpoint (Task 0A)
  └─ 8912614: docs(water-bills): Add investigation reports and task assignments
  
Next: Task 1 implementation
```

---

## Communication

### Before Starting Each Task:
- Confirm on feature branch
- Pull latest changes (if working with multiple agents)
- Check for conflicts

### After Completing Each Task:
- Commit with descriptive message
- Update Memory Log
- Push to remote (if using remote tracking)

### If Stuck:
- **DO NOT** commit broken code
- **DO NOT** switch branches with uncommitted changes
- **DO** contact Manager Agent for guidance

---

## Success Criteria for Merge

All must be true before merging to main:

- [ ] All 4 tasks (0A, 1, 2, 3) complete
- [ ] All backend tests passing
- [ ] All 8 issues (0-7) resolved and verified
- [ ] Memory Logs complete for each task
- [ ] No regressions in HOA Dues or other modules
- [ ] Product Manager approval
- [ ] Clean commit history (logical, well-documented)

---

**Current Status:** Task 0A complete and committed ✅  
**Next:** Task 1 - Penalty Calculation Integration  
**Branch:** `feature/water-bills-issues-0-7-complete-fix`
