---
description: SAMS Manager review of Worker Task Report with auto-archive workflow
---

# SAMS Manager Review Wrapper

Run after `/apm-5-check-reports` has delivered a Worker Task Report. This wrapper layers SAMS-specific code-quality verification and auto-archiving on top of the native v1.0.0 Manager review.

## Step 1 — Automated Quality Gate (MANDATORY before approval)

```bash
bash /Users/michael/Projects/SAMS/scripts/pre-pr-checks.sh main
```

Catches: `new Date()` timezone violations, dead/unused files, orphaned imports, navigation targets without matching routes, CommonJS in frontend code.

**Do NOT approve a report or merge a PR until this passes.** If the script is missing, **HALT and ask Michael.**

## Step 2 — Targeted Code Review (review `git diff main...HEAD`)

Review the full branch diff for these specific patterns — issues BugBot repeatedly catches and automated linting misses:

| Check | What to look for | Why |
| :--- | :--- | :--- |
| **Dead files** | Files created in this branch no longer imported by anything. | Most BugBot issues in Sprint MOBILE-OWNER-V1 were dead code. |
| **Unused imports** | `import Foo from './Foo'` where `Foo` is never referenced. | Bundle size, reader confusion. |
| **State reset on context change** | Components using `useSelectedUnit()`, `useAuth()`, etc. — does local state reset when context value changes? Missing `useEffect` cleanup? | Stale data after switching unit/client. |
| **Data unit mismatches in fallbacks** | `sourceA?.field ?? sourceB?.field` — same units across both sources? | 100x value errors, "Invalid Date." |
| **Role/permission alignment** | Every `navigate('/route')` — does the user who SEES the element have permission to ACCESS the route? Check `RoleProtectedRoute` in `App.jsx`. | Admin click → permission denied. |
| **Orphaned route references** | `navigate('/old-route')` pointing to renamed/removed routes. | Click → catch-all `/auth` redirect. |

## Step 3 — Functional & Documentation Review

- Does the implementation meet the Task Prompt's acceptance criteria?
- Does it integrate properly with adjacent components?
- Are edge cases handled?
- Is the Worker's Task Report complete and accurate?
- Are decisions documented?
- Is the Memory Log entry complete?

## Step 4 — Issue One of Three Verdicts

### APPROVED
- Task fully meets requirements
- All quality gates pass
- No outstanding issues
- **TRIGGERS AUTO-ARCHIVE WORKFLOW (Step 6)**

### MINOR REVISIONS
- Small improvements required, non-blocking
- Issue follow-up Task Prompt via Message Bus
- **NO archive**

### MAJOR REVISIONS
- Requirements not met or significant rework needed
- Issue revised Task Prompt via Message Bus
- **NO archive**

## Step 5 — Write Manager Review

Structure:

```markdown
## Task Review: [Task ID] — [Task Name]

### Summary
[Outcome in 1-2 sentences]

### Strengths
- [What was done well]

### Areas for Improvement
- [Specific issues, if any]

### Verdict
[APPROVED | MINOR REVISIONS | MAJOR REVISIONS]

### Next Steps
- [Specific actions, who handles them]
```

Save the review to:
- For v1.0.0 sessions: `.apm/memory/stage-NN/` alongside the Worker's Task Log, OR the location specified in the active sprint's Bootstrap document
- For SAMS-Docs/Sprint_Management workflow: `/Users/michael/Projects/SAMS/SAMS-Docs/Sprint_Management/Memory/Reviews/Manager_Review_<Sprint>_<Date>.md`

## Step 6 — AUTO-ARCHIVE WORKFLOW (APPROVED reviews only — MANDATORY)

When verdict is APPROVED and Michael has confirmed working code:

### 6a. Commit, Push, Merge

- Verify all task code is committed and pushed
- If not, ask Michael whether to commit/push now
- Ask whether to merge into `main` and merge if approved
- Ask whether to delete or keep the branch

### 6b. Changelog Entry (MANDATORY)

```bash
node /Users/michael/Projects/SAMS/scripts/updateChangelogPending.js --type <type> --issues "<issue_numbers>" --text "<description>"
```

Types:
- `feat` — new feature or enhancement
- `fix` — bug fix
- `maint` — refactor / cleanup
- `perf` — performance improvement

Examples:

```bash
node scripts/updateChangelogPending.js --type feat --issues "158" --text "Changelog display in About modal"
node scripts/updateChangelogPending.js --type fix --issues "115,60" --text "Fixed reconcile accounts sign flip and water service checks"
node scripts/updateChangelogPending.js --type feat --text "Document upload in payment controller"
```

Entries are added with `version: "pending"`. The deploy script (`deploySams.sh`) finalizes pending → actual version.

If the script is missing, **HALT and ask Michael.**

### 6c. Sprint Archive Directory

Operational sprint archives live at `/Users/michael/Projects/SAMS/SAMS-Docs/Sprint_Management/Sprint_Archive/<Sprint_Name>_<Date>/`.

```bash
cd /Users/michael/Projects/SAMS/SAMS-Docs/Sprint_Management/Sprint_Archive
mkdir -p "<Sprint_Name>_<Date>/Task_Assignments"
mkdir -p "<Sprint_Name>_<Date>/Completion_Logs"
mkdir -p "<Sprint_Name>_<Date>/Reviews"
mkdir -p "<Sprint_Name>_<Date>/Test_Results"
```

Example: `Sprint_UPC_CREDIT_FIX_2026-04-22/`

### 6d. Move Task Assignments to Archive (MOVE — prevents new-agent confusion)

```bash
cd /Users/michael/Projects/SAMS/SAMS-Docs/Sprint_Management
mv Tasks/Task_<Sprint>*.md Sprint_Archive/<Sprint_Name>_<Date>/Task_Assignments/
```

Why MOVE: leaving task assignments in the active `Tasks/` folder causes new agents to assume work is incomplete.

### 6e. Copy Completion Logs to Archive (COPY — keep originals)

```bash
cp Memory/Task_Completion_Logs/<Sprint>*_Complete*.md Sprint_Archive/<Sprint_Name>_<Date>/Completion_Logs/
```

### 6f. Copy Manager Reviews to Archive (COPY — keep originals)

```bash
cp Memory/Reviews/Manager_Review_<Sprint>*.md Sprint_Archive/<Sprint_Name>_<Date>/Reviews/
```

### 6g. Move Sprint Bootstrap(s) to Archive (MOVE)

```bash
mv Manager_Bootstraps/Manager_Bootstrap_Prompt_Sprint_<Sprint>*.md Sprint_Archive/<Sprint_Name>_<Date>/
mv Manager_Bootstraps/Manager_Bootstrap_Addendum_Sprint_<Sprint>*.md Sprint_Archive/<Sprint_Name>_<Date>/  # if exists
```

### 6h. Create Archive README

In `Sprint_Archive/<Sprint_Name>_<Date>/README.md`, document:
- What was accomplished (deliverables, metrics)
- Why it's archived (sprint complete and merged)
- Production code locations affected
- Archive contents inventory
- References to Sprint_Groups.md entry and any GitHub issues closed

### 6i. Update Sprint_Groups.md and Roadmap

- `/Users/michael/Projects/SAMS/SAMS-Docs/Agile/Sprint_Groups.md` — move the sprint from "Active" or "In Progress" section to "Completed" section at bottom; add completion notes, technical debt left behind, link to Sprint_Archive entry
- `/Users/michael/Projects/SAMS/SAMS-Docs/Agile/Roadmap_and_Timeline.md` — update as needed

### 6j. Append Archive Log Entry

Create or append `/Users/michael/Projects/SAMS/SAMS-Docs/Sprint_Management/Memory/ARCHIVE_LOG_<YYYY-MM-DD>.md`:
- What was archived
- Where it moved to
- Why it was archived
- Files MOVED vs COPIED

### 6k. Update GitHub Issues

If GitHub issues were linked to this sprint, update or close them.

### 6l. Auto-Archive Checklist

- [ ] Changelog entry added via `updateChangelogPending.js`
- [ ] Sprint archive directory created with subdirs
- [ ] Task Assignments MOVED to archive
- [ ] Completion Logs COPIED to archive
- [ ] Manager Reviews COPIED to archive
- [ ] Sprint Bootstrap(s) MOVED to archive
- [ ] Archive README created
- [ ] `SAMS-Docs/Agile/Sprint_Groups.md` updated (sprint moved to Completed)
- [ ] `SAMS-Docs/Agile/Roadmap_and_Timeline.md` updated if applicable
- [ ] Archive log entry written
- [ ] GitHub issues updated if applicable

**ALL boxes checked before declaring "Auto-Archive Complete."**

## Step 7 — Confirmation

State to Michael:

> "Review verdict: [APPROVED | MINOR | MAJOR]. [If APPROVED:] Auto-archive workflow [complete | in progress]. Sprint_Groups.md updated. Awaiting next sprint or task."
