---
description: SAMS Worker pre-completion quality gate before Task Report submission
---

# SAMS Worker Completion Wrapper

Run this BEFORE generating your Task Report (which the Manager picks up via `/apm-5-check-reports`). This wrapper layers SAMS-specific quality checks on top of the native v1.0.0 Task Report flow.

## Step 1 — Automated Quality Gate (MANDATORY)

```bash
bash /Users/michael/Projects/SAMS/scripts/pre-pr-checks.sh main
```

Catches: `new Date()` timezone violations, dead/unused files, navigation targets without matching routes, CommonJS in frontend code.

**Fix all reported issues before proceeding.** If the script is missing, **HALT and ask Michael** — do not skip.

## Step 2 — Manual Code Review (review `git diff main...HEAD`)

These are the issues BugBot repeatedly catches and automated linting misses. Review the FULL branch diff for each pattern:

| Check | What to look for | Why |
| :--- | :--- | :--- |
| **Dead files** | Files created in this branch that are no longer imported. Common after design pivots. | Most BugBot issues in Sprint MOBILE-OWNER-V1 were dead code. |
| **Unused imports** | `import Foo from './Foo'` where `Foo` is never referenced in the file body. | Bundle bloat, future-reader confusion. |
| **State reset on context change** | Components using `useSelectedUnit()`, `useAuth()`, or similar context — does local state (loaded data, PDF URLs, dropdown selections, error messages) reset when the context value changes? Look for missing `useEffect` cleanup. | Stale data from previous unit/client displays after switching. |
| **Data unit mismatches in fallbacks** | `const value = sourceA?.field ?? sourceB?.field` — are both sources in the same units (pesos vs centavos, date object vs string)? | Values display 100x too large or "Invalid Date" until preferred source loads. |
| **Role/permission alignment** | Every `navigate('/route')` — can the user who SEES the clickable element also ACCESS that route? Cross-reference with `RoleProtectedRoute` wrappers in `App.jsx`. | Admin clicks card and gets "You don't have permission." |
| **Orphaned route references** | `navigate('/old-route')` pointing to renamed/removed routes. Check all `navigate()` calls against current `App.jsx` `<Route>` definitions. | Click leads to catch-all `/auth` redirect. |

## Step 3 — Standard Validation Checklist

- [ ] All acceptance criteria met
- [ ] Code tested with real data (`backend/testing/testHarness.js` or equivalent — not code-review only)
- [ ] No `new Date()` in production paths (use `getNow()` from DateService)
- [ ] No MCP tools in production code (testing only)
- [ ] Pre-PR quality gate passed with zero issues
- [ ] Manual review completed for all six patterns above
- [ ] Memory Log updated at the path the Manager assigned (`.apm/memory/stage-NN/task-NN-NN.log.md` for v1.0.0 sessions, or the path supplied in your Task Prompt for active SAMS-Docs/Sprint_Management work)

## Step 4 — Generate Task Report

Now produce your Task Report following the v1.0.0 Worker Task Report format. The Manager will read it via `/apm-5-check-reports`. The report should include:

- **Task ID and name**
- **Status:** complete / blocked / partial
- **Deliverables produced** (file paths and one-line description each)
- **Acceptance criteria validation** (each criterion + how it was met)
- **Test evidence** (what you ran, what passed, links to test output if any)
- **Implementation decisions** (what you decided and why, especially deviations)
- **Known limitations / follow-ups** (if any)
- **Handoff notes for Manager review** (specific areas to scrutinize)

## Step 5 — Confirmation

State to Michael:

> "Pre-completion quality gate passed. Manual review complete. Task Report ready. Run `/apm-5-check-reports` in the Manager conversation to deliver."

Do NOT claim "complete" until Michael or the Manager Agent has confirmed the report.
