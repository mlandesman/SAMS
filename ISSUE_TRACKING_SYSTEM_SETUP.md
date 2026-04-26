# Issue Tracking System Setup Complete

**Date**: October 8, 2025  
**System**: Hybrid GitHub Issues + Markdown Tracking  
**Optimized for**: Solo developer using Cursor with GitHub

---

## 🎯 What I've Set Up For You

You now have a **hybrid tracking system** that combines the best of both worlds:

### ✅ GitHub Issues (Active Work)
- Templates for bugs, enhancements, and technical debt
- Consistent labeling system
- Integration with Cursor's APM
- Perfect for current sprint work

### ✅ Markdown System (Long-term Tracking)
- Your existing `SAMS-Docs/Agile/Sprint_Groups.md`, `SAMS-Docs/Agile/Roadmap_and_Timeline.md`, and `TECHNICAL_DEBT.md`
- Comprehensive historical record
- Rich context and documentation
- No external dependencies

### ✅ Cursor Integration
- `.cursorrules` file ensures Cursor always has context
- References to your tracking documents
- Critical technical debt highlighted
- Development constraints documented

### ✅ Helper Tools
- Interactive sync script for weekly management
- GitHub issue templates
- Workflow documentation

---

## 📁 Files Created/Modified

### Core Configuration
- ✅ `.cursorrules` - Cursor reads this on every session
  - References tracking documents
  - Highlights critical technical debt
  - Provides development constraints

### GitHub Templates
- ✅ `.github/ISSUE_TEMPLATE/bug_report.md`
- ✅ `.github/ISSUE_TEMPLATE/enhancement.md`
- ✅ `.github/ISSUE_TEMPLATE/technical_debt.md`

### Documentation
- ✅ `docs/ISSUE_TRACKING_WORKFLOW.md` - Your workflow guide
- ✅ `docs/CURSOR_APM_INTEGRATION.md` - How Cursor sees your issues

### Tools
- ✅ `scripts/sync-issues.sh` - Interactive helper script (executable)

---

## 🚀 How to Start Using This System

### Immediate Actions (Do Today)

**1. Set up GitHub CLI (if not installed)**
```bash
# Install GitHub CLI
# Mac: brew install gh
# Linux: See https://cli.github.com/

# Authenticate
gh auth login

# Verify it works
gh issue list
```

**2. Create labels in your GitHub repo**
```bash
gh label create "critical" --color "d73a4a" --description "Drop everything and fix"
gh label create "high-priority" --color "ff9800" --description "Address ASAP"
gh label create "medium-priority" --color "ffc107" --description "Schedule soon"
gh label create "low-priority" --color "4caf50" --description "Backlog"
gh label create "technical-debt" --color "795548" --description "Code cleanup needed"
gh label create "blocked" --color "9e9e9e" --description "Waiting on dependency"
```

**3. Test the system**
```bash
# Try the sync helper
./scripts/sync-issues.sh

# Create your first GitHub issue from current work
gh issue create \
  --title "[BUG] Client Logos Not Appearing" \
  --body "From SAMS-Docs/Agile/Sprint_Groups.md - logos uploaded but not displayed" \
  --label bug,high-priority
```

**4. Verify Cursor integration**
- Open Cursor
- Start a new chat
- Say: "What are the high priority issues from SAMS-Docs/Agile/Sprint_Groups.md?"
- Cursor should reference your tracking documents

---

## 📋 Your Weekly Workflow

### Monday (Planning Day)

**1. Review and Triage (15 minutes)**
```bash
# Run the sync helper
./scripts/sync-issues.sh
# Choose option 5: Show weekly summary

# Or manually:
gh issue list --state open
gh issue list --state closed --search "closed:>=$(date -d '7 days ago' +%Y-%m-%d)"
```

**2. Prioritize for the Week**
- Look at `SAMS-Docs/Agile/Sprint_Groups.md` backlog
- Promote items you'll work on to GitHub Issues
- Update priorities if needed

**3. Update `.cursorrules` (if needed)**
- Add any new critical constraints
- Update technical debt warnings
- Remove resolved blockers

### During the Week (As You Work)

**When you think of something new:**
```
Is it urgent/this week? → Create GitHub Issue
Is it future work? → Add to SAMS-Docs/Agile/Sprint_Groups.md
Is it technical debt? → Add to TECHNICAL_DEBT.md
```

**When you start working:**
- Check `.cursorrules` for constraints
- Check `TECHNICAL_DEBT.md` to avoid broken areas
- Reference issue in Cursor: "Work on #42"

**When you finish work:**
```bash
# Close the issue
gh issue close 42 --comment "Fixed by implementing proper logo URL fetching"

# Update SAMS-Docs/Agile/Sprint_Groups.md (and Roadmap_and_Timeline.md if needed)
# Move from Open to Resolved section
# Update metrics

# Commit with reference
git commit -m "Fix client logo display

Fixes #42"
```

### Friday (Wrap-up)

**Quick review (5 minutes)**
- Any issues need priority adjustment?
- Any technical debt discovered this week?
- Update `SAMS-Docs/Agile/Sprint_Groups.md` and `SAMS-Docs/Agile/Roadmap_and_Timeline.md`

---

## 🎯 Decision Guide: Where Does This Go?

Use this flowchart every time you discover something:

```
New Issue/Enhancement/Debt Discovered
│
├─ Is it blocking production RIGHT NOW?
│  └─ YES → GitHub Issue with "critical" label
│
├─ Will I work on this THIS WEEK?
│  └─ YES → GitHub Issue with appropriate priority
│
├─ Is it technical debt (code needing cleanup)?
│  └─ YES → Add to TECHNICAL_DEBT.md with:
│     - Description and code locations
│     - Trigger for when to fix it
│     - Priority and effort estimate
│
├─ Is it a future enhancement?
│  └─ YES → Add to SAMS-Docs/Agile/Sprint_Groups.md
│     - In appropriate section (ENHANCEMENTS)
│     - With priority and effort estimate
│
└─ Is it quick to fix right now?
   └─ YES → Just fix it and commit
```

---

## 🔍 Example Scenarios

### Scenario 1: You discover a production bug

**What to do:**
```bash
# Create GitHub Issue immediately
gh issue create \
  --title "[BUG] HOA Dues not saving for AVII units" \
  --body "Users report HOA dues changes aren't persisting. Affects AVII only." \
  --label bug,critical

# Work on it right away
# In Cursor: "Fix issue #XX about HOA dues not saving"

# When done:
gh issue close XX --comment "Fixed - was missing clientId in API call"
git commit -m "Fix HOA dues persistence for AVII

API call was missing required clientId parameter.
Tested with both MTC and AVII.

Fixes #XX"

# Update SAMS-Docs/Agile/Sprint_Groups.md (and Roadmap_and_Timeline.md if needed)
# Move to Recently Resolved section
```

### Scenario 2: You have a great enhancement idea

**What to do:**
```markdown
# Add to SAMS-Docs/Agile/Sprint_Groups.md under enhancements/backlog

### ENHANCEMENT-017: Bulk Unit Import from CSV
- **Module**: Frontend Desktop - Unit Management
- **Status**: 📋 BACKLOG
- **Priority**: ⚠️ MEDIUM
- **User Story**: As an administrator, I want to import multiple units 
  from a CSV file so that I can onboard new clients faster.
- **Business Value**: Reduces client onboarding time from hours to minutes
- **Effort**: 🟡 Medium (3-8 hours)
- **Task ID**: ENH-20251008_1145
- **Dependencies**: None
- **Notes**: Consider using existing import framework from user imports
```

**Later, when ready to work on it:**
```bash
# Promote to GitHub Issue
gh issue create \
  --title "[ENHANCEMENT] Bulk Unit Import from CSV" \
  --body-file docs/enhancements/ENHANCEMENT_BULK_UNIT_IMPORT_20251008_1145.md \
  --label enhancement,medium-priority
```

### Scenario 3: You discover messy code

**What to do:**
```markdown
# Add to TECHNICAL_DEBT.md

### **TD-017: Inconsistent Error Handling in Backend Controllers**
**Category:** Code Quality  
**Priority:** Medium  
**Created:** 2025-10-08  
**Context:** Discovered during HOA dues bug fix

**Description:**
Backend controllers use mix of error handling patterns:
- Some use try/catch with res.status()
- Some throw errors expecting middleware
- Some return error objects
- Inconsistent error messages to frontend

**Code Locations:**
- backend/controllers/hoaDues.js - Lines 45, 89, 123
- backend/controllers/transactions.js - Lines 67, 102
- backend/controllers/units.js - Multiple locations

**Cleanup Required:**
- Standardize on middleware error handling pattern
- Create error utility functions
- Update all controllers to use consistent pattern
- Add error handling documentation
- Test error scenarios

**Trigger for Cleanup:** Next backend refactoring sprint or when 
error handling bugs cause production issues

**Estimated Cleanup Effort:** 2-3 Implementation Agent sessions

**Business Impact:** Medium - Inconsistent error handling makes 
debugging difficult and may hide issues from users
```

### Scenario 4: Cursor suggests working on broken code

**Problem:** Cursor suggests implementing water bill payments, but TD-001 says it's disabled.

**Solution:**
```markdown
# Update .cursorrules to make it more prominent:

## Areas Currently Broken - Do Not Work On

### Water Bills Payment Tracking (TD-001)
- **Status**: DISABLED in v2 implementation
- **What works**: Meter reading storage
- **What doesn't work**: Payment tracking, bill generation, balance calculation
- **Code location**: backend/services/projectsService.js lines 138-155
- **Do not**: Try to implement payment features until Phase 2 approval
- **Instead**: Focus on meter reading functionality only

### Mobile App (TD-016)
- **Status**: Needs complete refactor
- **What works**: Basic viewing (mostly)
- **What doesn't work**: Data sync with new backend, authentication patterns
- **Do not**: Make mobile-specific changes without desktop refactor first
- **Instead**: Focus on desktop web app
```

Now when Cursor suggests water bill work, it knows the constraints.

---

## 🛠️ Using the Sync Helper

The `scripts/sync-issues.sh` script provides an interactive menu:

```bash
./scripts/sync-issues.sh
```

**Menu options:**
1. **List open GitHub Issues** - See active work
2. **List open issues from markdown** - See backlog
3. **Create GitHub Issue from markdown** - Promote item
4. **Show high-priority items** - All sources at once
5. **Show weekly summary** - Quick status overview
6. **Create quick bug issue** - Fast bug entry
7. **Create quick enhancement issue** - Fast enhancement entry

**When to use it:**
- Weekly planning: Option 5 (weekly summary)
- Promoting backlog: Option 3 (markdown to GitHub)
- Quick triage: Options 1 and 2 (compare active vs backlog)
- Fast entry: Options 6 and 7 (quick creation)

---

## 📊 Measuring Success

Your system is working well when:

### ✅ Nothing Gets Lost
- Every issue is either in GitHub or markdown tracking
- Weekly sync ensures alignment
- Closed issues moved to resolved sections

### ✅ Cursor Has Context
- `.cursorrules` is up-to-date
- Can answer: "What are my high priority items?"
- Knows about technical debt and constraints
- Doesn't suggest working on broken systems

### ✅ You Feel In Control
- Quick decision: GitHub or markdown?
- Easy weekly planning ritual
- Clear view of active vs backlog
- Historical context preserved

### ✅ Low Maintenance
- 15 minutes on Monday for planning
- 5 minutes on Friday for wrap-up
- Natural workflow during the week
- Helper script automates common tasks

---

## 🔧 Customization Options

### If you want more automation:

**1. GitHub Actions** (auto-label, auto-close stale)
```yaml
# .github/workflows/stale.yml
name: Close stale issues
on:
  schedule:
    - cron: '0 0 * * *'
jobs:
  stale:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/stale@v4
        with:
          days-before-stale: 60
          days-before-close: 7
          stale-issue-label: 'stale'
```

**2. Webhook Integration** (Slack/Discord notifications)
```yaml
# When critical issues are created, notify you
on:
  issues:
    types: [opened, labeled]
  if: contains(github.event.issue.labels.*.name, 'critical')
  notify: webhook_url
```

### If you want less tooling:

**Minimal version:**
- Keep markdown files only
- Update `.cursorrules` to reference them
- Skip GitHub Issues entirely
- Use `grep` to search: `grep -r "Priority.*HIGH" docs/`

### If you want more structure:

**Add milestones:**
```bash
gh milestone create "Sprint 2025-10" --description "October Sprint"
gh issue create --milestone "Sprint 2025-10" ...
```

**Add projects:**
```bash
gh project create --owner @me --title "SAMS Roadmap"
# Add issues to project for kanban view
```

---

## 📖 Documentation Reference

**Read these guides for details:**

1. **`docs/ISSUE_TRACKING_WORKFLOW.md`**
   - Complete workflow documentation
   - Decision trees and examples
   - Template formats
   - Migration strategy

2. **`docs/CURSOR_APM_INTEGRATION.md`**
   - How Cursor discovers your issues
   - Best practices for APM integration
   - Troubleshooting guide
   - Advanced automation options

3. **`.cursorrules`**
   - Cursor's configuration
   - Critical constraints
   - Links to tracking docs
   - Technical debt highlights

---

## 🎓 Learning Resources

**GitHub CLI:**
- Official docs: https://cli.github.com/manual/
- Issue management: `gh issue --help`
- Label management: `gh label --help`

**Cursor:**
- `.cursorrules` documentation: (in Cursor docs)
- APM features: (in Cursor settings)

**Markdown Best Practices:**
- Keep hierarchical (##, ###)
- Use checkboxes for tasks
- Link between documents
- Date your updates

---

## 🚦 Next Steps

### Right Now (5 minutes)
1. ✅ Install/authenticate GitHub CLI
2. ✅ Create labels in your repo
3. ✅ Test `./scripts/sync-issues.sh`
4. ✅ Verify Cursor can read `.cursorrules`

### This Week (30 minutes)
1. ✅ Create GitHub Issues for your current sprint work
   - Client logos issue (ISSUE-20250807_1450)
   - Units List Management (ISSUE-20250726_0927)
   - Any other high-priority items
2. ✅ Update `SAMS-Docs/Agile/Sprint_Groups.md` (and roadmap when sequencing changes) to reflect GitHub issues
3. ✅ Try working on an issue with Cursor: "Fix #XX"

### Next Week (Ongoing)
1. ✅ Follow weekly workflow
2. ✅ Adjust system based on what works for you
3. ✅ Update `.cursorrules` as you discover patterns
4. ✅ Keep markdown docs as historical record

---

## ❓ Questions & Troubleshooting

### "Do I need to migrate all my existing issues to GitHub?"

**No.** Start fresh with new work. Only create GitHub Issues for:
- Items you're working on this week/month
- Critical production issues
- High priority items needing immediate attention

Keep everything else in your markdown files until you're ready to work on it.

### "What if I don't want to use GitHub Issues?"

That's fine! Keep using markdown exclusively and:
- Update `.cursorrules` more frequently
- Reference markdown files in your Cursor prompts
- Use `grep` to search your tracking docs
- Skip the GitHub templates and sync script

### "What if I have 50+ backlog items?"

Perfect use case for hybrid system:
- Keep all backlog items in `SAMS-Docs/Agile/Sprint_Groups.md`
- Create GitHub Issues for the 5-10 you'll work on next
- Promote items from backlog to GitHub as needed
- Keeps your active issues list clean and focused

### "How do I handle urgent production issues?"

```bash
# Create issue immediately
gh issue create \
  --title "[CRITICAL] Production down - API not responding" \
  --body "Details..." \
  --label critical,bug

# Work on it
# Reference in Cursor: "Fix critical issue #XX"

# When resolved:
gh issue close XX
git commit -m "Emergency fix for API timeout

Fixes #XX"

# Update SAMS-Docs/Agile/Sprint_Groups.md (and Roadmap_and_Timeline.md if sequencing changed)
# Add to Recently Resolved section
```

### "The sync script doesn't work"

Check requirements:
```bash
# Need GitHub CLI
which gh

# Need authentication
gh auth status

# Need bash
which bash

# Make sure it's executable
chmod +x scripts/sync-issues.sh
```

---

## 🎉 Summary

You now have a production-ready issue tracking system that:

- ✅ **Works with Cursor's APM** - Via `.cursorrules` and GitHub integration
- ✅ **Preserves your markdown system** - Historical context maintained
- ✅ **Prevents lost issues** - Clear place for everything
- ✅ **Scales with you** - Start simple, add complexity if needed
- ✅ **Requires minimal maintenance** - 20 minutes/week
- ✅ **Flexible** - Adjust to your workflow

**Your tracking system:**
- GitHub Issues = Active work (this sprint)
- SAMS-Docs/Agile/Sprint_Groups.md = Big picture + backlog
- TECHNICAL_DEBT.md = Things to be aware of
- .cursorrules = Make Cursor aware of it all

**Your workflow:**
- Think of something → Decide where it goes
- Weekly planning → Sync systems
- During work → Cursor has full context
- Nothing falls through the cracks

---

**Welcome to your new issue tracking system!** 🚀

Questions? Issues? Create a GitHub issue about the tracking system itself. 😄

---

**Setup completed by**: Cursor AI  
**Date**: October 8, 2025  
**System status**: ✅ Ready to use

