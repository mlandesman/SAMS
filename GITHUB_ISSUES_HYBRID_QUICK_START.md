# GitHub Issues Hybrid System - Quick Start Guide
**Created:** October 9, 2025  
**Status:** Active tracking system

---

## 🎯 SYSTEM OVERVIEW

**Hybrid Approach:**
- **GitHub Issues** → Active work (current sprint/week)
- **.apm/Implementation_Plan.md** → Comprehensive tracking (all priorities)
- **apm_session/Implementation_Plan.md** → APM framework document (detailed task specs)

---

## 🚨 CURRENT CRITICAL ISSUES

### GitHub Issue #7 - Production Purge/Import BROKEN
**URL:** https://github.com/mlandesman/SAMS/issues/7  
**Priority:** 1 - IMMEDIATE  
**Status:** 🔴 OPEN

### GitHub Issue #8 - Water Bills Code Reversion
**URL:** https://github.com/mlandesman/SAMS/issues/8  
**Priority:** 2 - HIGH  
**Status:** 🔴 OPEN

---

## 📖 HOW TO USE THE HYBRID SYSTEM

### When You Think of Something New

**Decision Tree:**
```
New idea/issue?
├─ Critical bug in production? → Create GitHub Issue + label "bug"
├─ Need to fix this week? → Create GitHub Issue
├─ Good idea for later? → Add to .apm/Implementation_Plan.md backlog
└─ Technical debt discovered? → Add to .apm/Implementation_Plan.md
```

### When Starting Work

1. **Check GitHub Issues** for assigned/prioritized work (#7, #8 are current)
2. **Read apm_session/Implementation_Plan.md** for detailed task specifications
3. **Check .apm/Implementation_Plan.md** for overall context
4. **Read .cursorrules** to ensure you know critical constraints
5. **Start work** with full context

### When Finishing Work

1. **Close GitHub Issue** with resolution notes
2. **Update .apm/Implementation_Plan.md:**
   - Move from Open to Resolved
   - Update metrics
   - Add to Recently Resolved section
3. **Update apm_session/Implementation_Plan.md** if priorities changed
4. **Move markdown file** from `docs/issues 2/open/` to `resolved/` (if exists)

---

## 🛠️ TOOLS AVAILABLE

### sync-issues.sh Script
**Location:** `scripts/sync-issues.sh`

**Usage:**
```bash
./scripts/sync-issues.sh
```

**Options:**
1. List open GitHub Issues
2. List open issues from markdown files
3. Create GitHub Issue from markdown file
4. Show high-priority items (all sources)
5. Show weekly summary
6. Create quick bug issue
7. Create quick enhancement issue

**Fixed:** macOS compatibility, updated to use .apm/Implementation_Plan.md

### Command Line Quick Commands

**List Open Issues:**
```bash
gh issue list --state open
```

**List by Priority:**
```bash
gh issue list --label bug
gh issue list --label enhancement
gh issue list --label high-priority
```

**Create Quick Bug:**
```bash
gh issue create --title "[BUG] Description" --label bug
```

**View Specific Issue:**
```bash
gh issue view 7
gh issue view 8
```

---

## 📋 CURRENT TRACKING STRUCTURE

### GitHub Issues (2 Open)
- **Issue #7:** Production Purge/Import BROKEN (Priority 1)
- **Issue #8:** Water Bills Code Reversion (Priority 2)

### .apm/Implementation_Plan.md
**Sections:**
- 🚨 **CRITICAL ISSUES** (2 Open) - Linked to GitHub #7, #8
- 🔥 **HIGH PRIORITY ISSUES** (0 Open - reclassified to LOW)
- 🟡 **MEDIUM PRIORITY ISSUES** (3 Open - deferred with workarounds)
- 🟢 **LOW PRIORITY ISSUES** (Various deferred items)
- 🚀 **ENHANCEMENTS** (Tracked, promoted to GitHub when ready)
- 📋 **PRIORITY EXECUTION ROADMAP** (Priorities 1-15)

### apm_session/Implementation_Plan.md
**Structure:**
- ✅ **COMPLETED PROJECTS** - Historical reference
- 🚨 **CRITICAL PRODUCTION ISSUES** - Priorities 1-2 (GitHub #7, #8)
- 📊 **CORE FEATURES** - Priorities 3-7
- ⏭️ **NEXT TIER PRIORITIES** - Priorities 8-15
- 🛠️ **DEFERRED ISSUES** - Low priority with workarounds

---

## 🔄 WEEKLY WORKFLOW

### Monday Planning
1. **Review GitHub Issues** - Close completed, re-prioritize
2. **Update .apm/Implementation_Plan.md** - Metrics, sprint priorities
3. **Sync with Implementation_Plan.md** - Adjust if priorities changed
4. **Promote items** from markdown backlog to GitHub Issues for this week

### Daily Development
1. **Work from GitHub Issues** (#7, #8 first)
2. **Reference Implementation_Plan.md** for detailed specs
3. **Update as you go** - commit messages reference issue numbers
4. **Close when done** - update all three documents

### End of Week
1. **Archive resolved items** - Move markdown files to `resolved/`
2. **Update metrics** - Total issues, completion rate
3. **Plan next week** - Promote new items to GitHub

---

## 📝 QUICK REFERENCE TEMPLATES

### Create GitHub Bug
```bash
gh issue create \
  --title "[BUG] Short description" \
  --label "bug" \
  --body "**Description:** What's broken
**Impact:** How it affects system
**Steps to Reproduce:** 
**Expected vs Actual:** 
**Files Affected:**"
```

### Create GitHub Enhancement
```bash
gh issue create \
  --title "[ENHANCEMENT] Short description" \
  --label "enhancement" \
  --body "**User Story:** As a [role], I want [feature] so that [benefit]
**Business Value:** Why this matters
**Acceptance Criteria:**
- [ ] Criteria 1
- [ ] Criteria 2"
```

### Add to .apm/Implementation_Plan.md
```markdown
### ISSUE-XXX: Descriptive Title
- **Module**: [Module Name]
- **Status**: 🔴 OPEN / 📋 BACKLOG
- **Priority**: CRITICAL / HIGH / MEDIUM / LOW
- **Description**: What needs to be done
- **Impact**: How it affects the system
- **Estimated Effort**: X sessions
- **Task ID**: ISSUE-YYYYMMDD_HHMM
- **GitHub Issue**: #XX (if created)
```

---

## ✅ BEST PRACTICES

### Do's
- ✅ Create GitHub Issues for THIS WEEK's work only
- ✅ Keep GitHub Issues list focused (< 10 open issues ideal)
- ✅ Use .apm/Implementation_Plan.md for comprehensive backlog
- ✅ Reference issue numbers in commit messages (`Fix #7`, `Closes #8`)
- ✅ Update both systems when closing issues
- ✅ Keep Implementation_Plan.md synchronized with priorities

### Don'ts
- ❌ Don't create GitHub Issues for distant future work
- ❌ Don't let GitHub Issues pile up (50+ = too many)
- ❌ Don't skip updating .apm/Implementation_Plan.md
- ❌ Don't reference TECHNICAL_DEBT.md (archived!)
- ❌ Don't ignore the Priority 1-15 roadmap in Implementation_Plan.md

---

## 🎯 CURRENT PRIORITY ORDER

**Use this as your guide:**

**Immediate (This Week):**
1. Fix Production Purge/Import (Issue #7)
2. Investigate Water Bills Reversion (Issue #8)

**After Critical Fixes:**
3. Statement of Account Report - Phase 1
4. HOA Quarterly Collection
5. HOA Penalty System
6. Budget Module
7. Monthly Transaction Reports
8. HOA Autopay from Credit Balance
9. Digital Receipts Production Polish
10. Propane Tanks Module

**See apm_session/Implementation_Plan.md for complete Priorities 1-15**

---

## 📞 TROUBLESHOOTING

### Script Errors
**Problem:** `TECHNICAL_DEBT.md: No such file or directory`  
**Solution:** File archived - script updated to use .apm/Implementation_Plan.md

**Problem:** `date: illegal option -- d`  
**Solution:** macOS compatibility fixed - script now uses `-v` flag

**Problem:** Labels not found (critical, high-priority, etc.)  
**Solution:** Create labels first OR script will work with just "bug" label

### Label Creation (Optional)
```bash
gh label create critical --description "Drop everything and fix" --color "d73a4a"
gh label create high-priority --description "Address soon" --color "e99695"
gh label create medium-priority --description "Schedule for upcoming sprint" --color "fbca04"
gh label create low-priority --description "Backlog" --color "0e8a16"
gh label create technical-debt --description "Code that needs refactoring" --color "d4c5f9"
```

---

## 📁 FILE LOCATIONS

### Current Active Documents
- `apm_session/Implementation_Plan.md` - APM framework document
- `.apm/Implementation_Plan.md` - Comprehensive tracking
- `.cursorrules` - Critical constraints and GitHub links
- `scripts/sync-issues.sh` - Sync helper script

### Archives (Don't Use for Active Work)
- `apm_session/Memory/Archive/` - All historical documents
- `TECHNICAL_DEBT.md` - **ARCHIVED** (in Obsolete_Root_Documents_2025_10_09/)
- `Tasks Order.rtf` - **ARCHIVED** (in Obsolete_Root_Documents_2025_10_09/)

---

**System Status:** ✅ OPERATIONAL  
**GitHub Integration:** ✅ ACTIVE  
**Next Action:** Work on Issue #7 or #8

