> **DEPRECATED (APM v1.0.1):** This command was authored for APM v0.5 and references retired vocabulary (Manager Agent / Implementation Agent). Use `/apm-1-initiate-planner`, `/apm-2-initiate-manager`, or `/apm-3-initiate-worker` instead. Body retained below for reference.

---
description: Initialize a SAMS Worker on top of v1.0.0 APM (passes worker-id through)
argument-hint: <worker-id>  e.g. frontend-agent
---

# SAMS Worker Initiation Wrapper

This wrapper layers SAMS-specific guardrails on top of the native v1.0.0 APM Worker initiation.

## Step 1 — Native v1.0.0 Worker Init

Run the standard APM v1.0.0 Worker initiation, passing through the worker identifier supplied to this wrapper:

`/apm-3-initiate-worker $ARGUMENTS`

This loads the v1.0.0 Worker role, the Rules file (`AGENTS.md` or Cursor rules), the Spec, the Plan, the Tracker, and your assigned Task Prompt from `.apm/bus/<worker-id>/task.md`.

If a Worker Handoff Log exists for this worker, the native command auto-detects it. No separate handover step needed.

## Step 2 — SAMS Critical Reading (MANDATORY before any code)

After native init completes, read these in order:

1. **Sprint planning context** (current operational state):
   - `/Users/michael/Projects/SAMS/SAMS-Docs/Agile/Sprint_Groups.md` — current sprint definitions, archived sprint summaries, Product Owner decisions
   - `/Users/michael/Projects/SAMS/SAMS-Docs/Agile/Roadmap_and_Timeline.md` — sprint sequence, production status, schedule notes
   - `/Users/michael/Projects/SAMS/.apm/archives/session-2026-04-21-001/Implementation_Plan.md` — historical Implementation Plan (pre-v1.0.0). Once the v1.0.0 Planner has produced `.apm/spec.md` and `.apm/plan.md`, those supersede this archive.

2. **SAMS coding guidelines** (always):
   - `/Users/michael/Projects/SAMS/.apm/SAMS Guides/CRITICAL_CODING_GUIDELINES.md`

3. **SAMS domain guides** (read selectively per task — full list at `/Users/michael/Projects/SAMS/SAMS-Docs/SAMS Guides/`):
   - `/Users/michael/Projects/SAMS/SAMS-Docs/SAMS Guides/INDEX_Accounting_Payments_Billing.md` — START HERE for any task touching accounting, billing, payments, credit balances, SoA, UPC, water bills, HOA dues, or bank reconciliation. Contains the Pattern Catalog of recurring symptom shapes with `gh issue list` search commands.
   - **If your task touches the financial domain**, you MUST also read `/Users/michael/Projects/SAMS/SAMS-Docs/SAMS Guides/SAMS Accounting & Payment Architecture – Statement of Account and UPC.md` in full, with special attention to §2 (Multiple Projections, Not Multiple Truths) and the "Handling Discrepancies" section.
   - Other guides as task requires: `Date_Handling_Guide.md`, `Centavos_Pesos_Audit_2026-02-14.md`, `Bank_Reconciliation_Matching_Logic.md`, `Firebase_Hosting_Route_Requirements.md`, `Feature_Flag_Requirements.md`, `Deployment_Guide.md`, `System_Error_Lookup_Tools.md`, `Version_System_Management_Guide.md`, `WhatsApp_Integration_Guide.md`.

## Step 3 — Prior Art Search (MANDATORY for financial-domain tasks)

Before writing code for any task touching accounting, billing, payments, credit balances, SoA, UPC, water bills, HOA dues, or bank reconciliation:

```bash
gh issue list --repo mlandesman/SAMS --state all --search "[2-4 keywords describing the symptom]" --limit 30
```

Read any closed issue whose title or body resembles the current symptom. If a prior issue classified this defect class as "data issue, not math issue" per the Accounting & Payment Architecture doc, do NOT propose a code fix — STOP and escalate to the Manager for a data-reconciliation approach.

## Step 4 — Fail-Fast Clean Environment Preflight (MANDATORY)

```bash
bash /Users/michael/Projects/SAMS/scripts/assert-clean-ready.sh
```

If this fails, **STOP** and clean the environment. No task work allowed until clean.

If the script itself is missing, **HALT and ask Michael how to proceed.** Do not skip.

## Step 5 — Branch Creation

```bash
bash /Users/michael/Projects/SAMS/scripts/start-task-branch.sh <branch-name> [--push]
```

If the script is missing, **HALT and ask Michael.**

## Step 6 — SAMS Working Rules (override generic suggestions)

1. **DO NOT GUESS OR ASSUME.** If unsure, ask Michael.
2. **STAY WITHIN YOUR SCOPE.** Frontend tasks do not modify working backend endpoints without explicit permission. Backend code is locked unless explicitly opened.
3. **VERIFY BEFORE USING.** Do not assume import names or endpoint signatures — open the files and verify.
4. **TEST WITH REAL DATA.** Use `/backend/testing/testHarness.js` or equivalent live-token harness. Do not declare success from code review alone.
5. **NO FALSE SUCCESS CLAIMS.** Only claim completion with documented test evidence to show Michael, or after Michael has manually verified.
6. **NO `new Date()`** in production code — use `getNow()` from DateService.
7. **NO MCP tools in production code** — testing only.

## Step 7 — Confirmation

State to Michael:

> "Worker `<worker-id>` initialized. Native v1.0.0 init complete. SAMS critical docs read. Clean-env preflight passed. Branch created at `<branch-name>`. Awaiting confirmation to begin task."

Then await explicit go-ahead before any code changes.
