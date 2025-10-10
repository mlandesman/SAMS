# Cursor APM Integration Guide

**Last Updated**: October 8, 2025  
**Purpose**: Ensure Cursor's APM always sees your issues, enhancements, and technical debt

---

## How Cursor APM Discovers Your Work

Cursor's Autonomous Programming Manager (APM) discovers work items through several mechanisms:

### 1. `.cursorrules` File (Primary Method)
- ✅ **Always loaded**: Cursor reads this file at the start of every session
- ✅ **Custom instructions**: Tell Cursor where to look for issues
- ✅ **Context aware**: Provide constraints and patterns to follow
- ✅ **Technical debt awareness**: Highlight critical issues to avoid

**Your `.cursorrules` file includes:**
- Links to tracking documents
- Critical technical debt items
- Development constraints (ES6 modules, timezone, etc.)
- Testing requirements
- Common pitfalls to avoid

### 2. GitHub Issues (Secondary Method)
- ✅ **Scannable**: Cursor can search and read GitHub issues
- ✅ **Referenceable**: Mention issue numbers like "#42" in prompts
- ✅ **Structured**: Labels and priorities are visible
- ✅ **Active work**: Keep this list focused on current sprint

**GitHub integration features:**
- Search issues by label: `@github find all high-priority bugs`
- Reference in commits: `Fixed #42: Client logos not appearing`
- Link to code: Issues can reference specific files/lines
- Automation: GitHub Actions can auto-label or assign

### 3. Markdown Files in Workspace (Context Method)
- ✅ **Always accessible**: Part of your workspace
- ✅ **Rich context**: Detailed information and history
- ✅ **Searchable**: Cursor can grep/search these files
- ✅ **Version controlled**: Changes tracked with your code

**Key files Cursor can access:**
- `PROJECT_TRACKING_MASTER.md` - Overall status
- `TECHNICAL_DEBT.md` - Items to be aware of
- `docs/issues 2/open/*.md` - Detailed issue specs
- `docs/enhancements/*.md` - Enhancement specifications

---

## Making Issues Visible to Cursor

### Method 1: Reference in Prompts (Most Direct)

```
"Work on the client logos issue from PROJECT_TRACKING_MASTER.md"
"Check TECHNICAL_DEBT.md for any issues with water bills before I start"
"Look at GitHub issue #42 and fix it"
"What are the high priority items from my tracking documents?"
```

### Method 2: Update `.cursorrules` (For Persistent Issues)

When you have critical issues or constraints that should ALWAYS be visible:

```markdown
## Critical Active Issues
- ISSUE-20250807_1450: Client logos not appearing (HIGH)
- TD-002: Units List Management has multiple bugs (PRODUCTION BLOCKER)

## Areas Currently Broken
- Water Bills payment tracking disabled (TD-001)
- Mobile app needs full refactor (TD-016)
```

**When to update `.cursorrules`:**
- Critical production issues
- Breaking technical debt
- New development constraints
- Changed patterns or standards

### Method 3: GitHub Labels for Priority

Create and use consistent labels:

```bash
# Create labels if needed
gh label create "critical" --color "d73a4a" --description "Drop everything"
gh label create "high-priority" --color "ff9800" --description "Address ASAP"
gh label create "medium-priority" --color "ffc107" --description "Schedule soon"
gh label create "low-priority" --color "4caf50" --description "Backlog"
gh label create "technical-debt" --color "795548" --description "Code cleanup"
gh label create "blocked" --color "9e9e9e" --description "Waiting on dependency"
```

Cursor can then search: `@github show all critical issues`

---

## Workflow for New Issues

### When You Discover an Issue

**Decision Tree:**

```
Is this blocking you RIGHT NOW?
├─ Yes → Create GitHub Issue with "critical" label
└─ No → Continue...

Will you work on this this week/month?
├─ Yes → Create GitHub Issue with appropriate priority
└─ No → Continue...

Is this technical debt (code that needs cleanup)?
├─ Yes → Add to TECHNICAL_DEBT.md with trigger conditions
└─ No → Continue...

Is this a future enhancement idea?
├─ Yes → Add to PROJECT_TRACKING_MASTER.md backlog
└─ No → Maybe just fix it now?
```

### Examples

**Example 1: Production Bug**
```bash
# Create GitHub Issue immediately
gh issue create \
  --title "[BUG] Payment processing fails for AVII client" \
  --body "Users cannot process payments. Error in console..." \
  --label bug,critical

# Cursor will see this issue immediately
# You can reference: "Fix #47 urgently"
```

**Example 2: Enhancement Idea**
```markdown
# Add to PROJECT_TRACKING_MASTER.md under Enhancements
### ENHANCEMENT-016: Dark Mode Support
- **Module**: Frontend - UI/UX
- **Status**: 📋 BACKLOG
- **Priority**: 🚀 FUTURE
- **Business Value**: Better user experience in evening
- **Effort**: 🟡 Medium (3-8 hours)
```

**Example 3: Technical Debt Discovered**
```markdown
# Add to TECHNICAL_DEBT.md
### **TD-017: Hardcoded Exchange Rate in Old Components**
**Category:** Code Quality
**Priority:** Low
**Created:** 2025-10-08
**Context:** Found during enhancement work

**Description:**
Several old components have hardcoded USD/MXN exchange rate of 20.0
instead of using the exchange rate service.

**Code Locations:**
- frontend/sams-ui/src/components/old/Calculator.jsx line 45
- frontend/sams-ui/src/utils/currencyHelper.js line 12

**Cleanup Required:**
- Replace hardcoded values with exchangeRateService
- Test with current rates
- Remove TODO comments

**Trigger for Cleanup:** Next time those components are modified

**Estimated Cleanup Effort:** 1 hour
```

---

## Best Practices for APM Integration

### 1. Keep `.cursorrules` Updated
**Do:**
- ✅ Add critical constraints (ES6 modules, timezone rules)
- ✅ Link to tracking documents
- ✅ Highlight production blockers
- ✅ Document testing requirements

**Don't:**
- ❌ List every single issue (too noisy)
- ❌ Duplicate what's in tracking docs
- ❌ Leave outdated information
- ❌ Make it too long (keep under 100 lines)

### 2. Use Descriptive Titles
**Good:**
```
[BUG] Client logos don't display in client selector after upload
[ENHANCEMENT] Add confetti animation for 100% HOA collection
[DEBT] Replace CommonJS modules with ES6 in backend/utils
```

**Bad:**
```
Fix logo thing
Make it better
Clean up code
```

### 3. Label Consistently
**Suggested label scheme:**
- `critical` - Production broken, work now
- `high-priority` - Important, this week
- `medium-priority` - Schedule for next sprint
- `low-priority` - Nice to have
- `bug` - Something broken
- `enhancement` - New feature
- `technical-debt` - Code cleanup
- `blocked` - Waiting on something
- `documentation` - Docs only

### 4. Reference in Commits
```bash
git commit -m "Fix client logo display issue

- Updated branding service to properly fetch logo URLs
- Fixed caching issue in client selector
- Tested with both MTC and AVII logos

Fixes #47"
```

This creates a traceable link between code changes and issues.

### 5. Weekly Sync Ritual
**Every Monday (or your planning day):**

1. **Review GitHub Issues**
   ```bash
   gh issue list --state open
   ```

2. **Update `.cursorrules`** if needed
   - Remove resolved critical issues
   - Add new blockers
   - Update technical debt highlights

3. **Sync with Master Tracker**
   - Update `PROJECT_TRACKING_MASTER.md` status
   - Move resolved items
   - Promote backlog items to GitHub if working on them

4. **Check Technical Debt Triggers**
   - Review `TECHNICAL_DEBT.md`
   - Check if any cleanup triggers occurred
   - Schedule debt work if needed

---

## Using the Sync Helper Script

The `scripts/sync-issues.sh` script helps manage your hybrid system:

```bash
# Run the interactive menu
./scripts/sync-issues.sh
```

**Features:**
1. List open GitHub Issues
2. List open issues from markdown files  
3. Create GitHub Issue from markdown file (promote to active)
4. Show high-priority items from all sources
5. Show weekly summary
6. Create quick bug issue
7. Create quick enhancement issue

**Use cases:**
- Weekly planning: "Show me everything high priority"
- Quick triage: "What's open in GitHub vs markdown?"
- Promotion: "This backlog item is now active - create GitHub Issue"
- Summary: "How many issues closed this week?"

---

## Cursor Commands for Issue Management

### Searching Your Issues

```
"Show me all high priority issues from my tracking system"
"What technical debt should I be aware of?"
"Find all issues related to water bills"
"What's in the PROJECT_TRACKING_MASTER backlog?"
```

### Working on Issues

```
"Work on GitHub issue #42"
"Fix the client logos issue from PROJECT_TRACKING_MASTER.md"
"Address TD-002 from TECHNICAL_DEBT.md"
"Implement ENHANCEMENT-007 task management system"
```

### Creating Issues

```
"Create a GitHub issue for this bug with high priority"
"Add this to TECHNICAL_DEBT.md as a medium priority item"
"Document this in PROJECT_TRACKING_MASTER as a future enhancement"
```

### Status Checks

```
"What's the status of issue #42?"
"Show me recently resolved issues"
"What percentage of critical issues are closed?"
"Give me a summary of open issues"
```

---

## Troubleshooting

### "Cursor doesn't see my issues"

**Check:**
1. Is `.cursorrules` present and up-to-date?
2. Are GitHub issues labeled correctly?
3. Is the tracking document mentioned in `.cursorrules`?
4. Try explicitly mentioning the file: "Check PROJECT_TRACKING_MASTER.md"

### "Too many issues, Cursor is overwhelmed"

**Solution:**
1. Keep GitHub Issues to 10-20 active items max
2. Use labels to filter: "Show only critical issues"
3. Keep `.cursorrules` focused on top 5-10 critical items
4. Archive old resolved issues

### "Issues keep getting lost"

**Solution:**
1. Run `./scripts/sync-issues.sh` weekly
2. Update master tracker after resolving each issue
3. Use GitHub issue references in commits
4. Set up weekly planning ritual

### "Cursor keeps suggesting work on broken systems"

**Solution:**
1. Update `.cursorrules` with broken systems:
   ```markdown
   ## Currently Broken - Do Not Work On
   - Water Bills payment tracking (TD-001) - disabled
   - Mobile app (TD-016) - needs full refactor
   ```
2. Add warnings in TECHNICAL_DEBT.md
3. Close stale GitHub Issues that reference broken systems

---

## Advanced: GitHub Actions Integration

For automation enthusiasts, you can set up GitHub Actions:

```yaml
# .github/workflows/issue-sync.yml
name: Issue Sync

on:
  issues:
    types: [opened, closed, labeled]

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Check for critical labels
        if: contains(github.event.issue.labels.*.name, 'critical')
        run: echo "::warning::Critical issue created - prioritize immediately"
```

This can:
- Auto-label issues based on keywords
- Notify when critical issues are opened
- Auto-close stale issues
- Generate weekly summaries

---

## Summary

**The system you now have:**

1. **`.cursorrules`** → Always loaded, provides context and constraints
2. **GitHub Issues** → Active work (10-20 items), visible to APM
3. **PROJECT_TRACKING_MASTER.md** → Comprehensive view, backlog, history
4. **TECHNICAL_DEBT.md** → Detailed debt tracking with triggers
5. **`sync-issues.sh`** → Helper script for weekly management

**The workflow:**
- 💭 Think of something → Decide: GitHub (active) or Markdown (backlog)?
- 🛠️ Start work → Cursor sees it through `.cursorrules` or GitHub
- ✅ Finish work → Close GitHub Issue, update Master Tracker
- 📅 Weekly → Sync systems, promote backlog to GitHub, update `.cursorrules`

**The result:**
- Nothing gets lost
- Cursor always has context
- Clear view of active vs backlog work
- Historical record preserved
- Flexible and maintainable

---

**Questions? Issues with the system itself?**
Update this document or create an issue! (Meta, right?)

