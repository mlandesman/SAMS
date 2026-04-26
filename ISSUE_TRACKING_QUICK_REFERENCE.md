# Issue Tracking Quick Reference Card

**Print this or keep it handy!**

---

## 🎯 Where Does This Go?

| Situation | Action | Command/Location |
|-----------|--------|------------------|
| 🚨 Production broken | GitHub Issue + `critical` label | `gh issue create --label critical,bug` |
| 🔥 Work on this week | GitHub Issue + priority label | `gh issue create --label bug,high-priority` |
| 💡 Good idea for later | Add to sprint/backlog tracker | Edit `SAMS-Docs/Agile/Sprint_Groups.md` |
| 🧩 Messy code found | Add to technical debt | Edit `TECHNICAL_DEBT.md` |
| ⚡ Quick fix (< 15 min) | Just fix it | `git commit -m "Quick fix: ..."` |

---

## 🛠️ Common Commands

### GitHub Issues
```bash
# List open issues
gh issue list

# Create bug
gh issue create --title "[BUG] ..." --label bug,high-priority

# Create enhancement
gh issue create --title "[ENHANCEMENT] ..." --label enhancement

# Close issue
gh issue close 42 --comment "Fixed it!"

# Search issues
gh issue list --label critical
gh issue list --label high-priority --state open
```

### Sync Helper
```bash
# Run interactive menu
./scripts/sync-issues.sh

# Quick options:
# 1 = List GitHub issues
# 4 = Show all high priority
# 5 = Weekly summary
# 6 = Quick bug entry
```

### Search Markdown
```bash
# Find open issues
grep -r "Status.*OPEN" docs/issues\ 2/open/

# Find high priority
grep -Ei "high|priority|current sprint|next sprint" SAMS-Docs/Agile/Sprint_Groups.md

# Find technical debt
grep "Priority: High" TECHNICAL_DEBT.md
```

---

## 📋 Weekly Checklist

### Monday (Planning)
- [ ] Run `./scripts/sync-issues.sh` → option 5 (weekly summary)
- [ ] Review `SAMS-Docs/Agile/Sprint_Groups.md` backlog
- [ ] Promote 3-5 items to GitHub Issues for this week
- [ ] Update `.cursorrules` if new critical constraints

### Friday (Wrap-up)
- [ ] Close completed GitHub Issues
- [ ] Update `SAMS-Docs/Agile/Sprint_Groups.md` and `SAMS-Docs/Agile/Roadmap_and_Timeline.md`
- [ ] Move resolved issues to resolved/ folder
- [ ] Add any new technical debt to `TECHNICAL_DEBT.md`

---

## 💬 Cursor Prompts

```
"What are the high priority issues from SAMS-Docs/Agile/Sprint_Groups.md?"
"Check TECHNICAL_DEBT.md before I work on water bills"
"Work on GitHub issue #42"
"Show me open critical issues"
"What technical debt should I know about?"
```

---

## 🏷️ GitHub Labels

| Label | When to Use | Color |
|-------|-------------|-------|
| `critical` | Production broken, work NOW | 🔴 Red |
| `high-priority` | This week | 🟠 Orange |
| `medium-priority` | Next sprint | 🟡 Yellow |
| `low-priority` | Backlog | 🟢 Green |
| `bug` | Something broken | 🔴 Red |
| `enhancement` | New feature | 🔵 Blue |
| `technical-debt` | Code cleanup | 🟤 Brown |
| `blocked` | Waiting on something | ⚫ Gray |

---

## 📁 Key Files

| File | Purpose | Update When |
|------|---------|-------------|
| `.cursorrules` | Cursor's context | Critical changes, weekly review |
| `SAMS-Docs/Agile/Sprint_Groups.md` | Sprint and backlog view | After each issue, weekly planning |
| `TECHNICAL_DEBT.md` | Code debt tracking | Discover debt, resolve debt |
| `docs/issues 2/open/` | Active issue details | Create/resolve issues |
| `scripts/sync-issues.sh` | Helper tool | Weekly planning |

---

## 🚦 Decision Tree

```
New Issue/Idea?
│
├─ Blocking production? → GitHub Issue (critical)
├─ Work this week? → GitHub Issue (priority label)
├─ Technical debt? → TECHNICAL_DEBT.md
├─ Future enhancement? → SAMS-Docs/Agile/Sprint_Groups.md
└─ Quick fix? → Just fix it now
```

---

## 🔍 Quick Searches

### Find high priority work:
```bash
gh issue list --label high-priority,critical
grep -Ei "high|priority|current sprint|next sprint" SAMS-Docs/Agile/Sprint_Groups.md
```

### Check what's broken:
```bash
grep "broken\|disabled\|do not" .cursorrules -i
grep "Business Impact: High" TECHNICAL_DEBT.md
```

### Weekly stats:
```bash
./scripts/sync-issues.sh  # Choose option 5
```

---

## 🎯 Git Commit Messages

```bash
# Reference issue
git commit -m "Fix client logos not displaying

Updated branding service to properly fetch URLs.
Tested with MTC and AVII.

Fixes #42"

# Multiple issues
git commit -m "Refactor units list management

- Fixed data consistency (#45)
- Added row highlighting (#46)
- Fixed save functionality (#47)"

# Technical debt
git commit -m "Clean up error handling in controllers

Standardized error middleware pattern.
Resolves TD-017."
```

---

## ⚠️ Remember

- ✅ Keep GitHub Issues under 20 active items
- ✅ Update `.cursorrules` when critical issues arise
- ✅ Always check `TECHNICAL_DEBT.md` before starting work
- ✅ Weekly sync ritual prevents lost issues
- ✅ Reference issues in commits for traceability

---

## 🆘 Emergency Troubleshooting

**Cursor doesn't see my issues?**
→ Check `.cursorrules` is up-to-date
→ Explicitly mention files: "Check SAMS-Docs/Agile/Sprint_Groups.md and Roadmap_and_Timeline.md"

**Can't find an issue?**
→ Run: `./scripts/sync-issues.sh` → option 4

**Too many issues?**
→ Archive old ones, keep GitHub under 20 active

**GitHub CLI not working?**
→ `gh auth status` and `gh auth login` if needed

---

**Full Documentation:**
- `ISSUE_TRACKING_SYSTEM_SETUP.md` - Complete setup guide
- `docs/ISSUE_TRACKING_WORKFLOW.md` - Detailed workflows
- `docs/CURSOR_APM_INTEGRATION.md` - APM integration details

---

**Print this card and keep it handy!** 📄

