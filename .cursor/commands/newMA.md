> **DEPRECATED (APM v1.0.1):** This command was authored for APM v0.5 and references retired vocabulary (Manager Agent / Implementation Agent). Use `/apm-1-initiate-planner`, `/apm-2-initiate-manager`, or `/apm-3-initiate-worker` instead. Body retained below for reference.

---
description: Initialize a SAMS Manager on top of v1.0.0 APM
---

# SAMS Manager Initiation Wrapper

This wrapper layers SAMS-specific guardrails on top of native v1.0.0 APM Manager initiation.

## Step 1 — Native v1.0.0 Manager Init

`/apm-2-initiate-manager`

This loads the v1.0.0 Manager role, the Rules file, the Spec, the Plan, the Tracker, and any pending Worker Reports from the Message Bus.

If a Manager Handoff Log exists, the native command auto-detects it.

## Step 2 — SAMS Critical Reading (MANDATORY before any task assignment)

1. **Sprint planning context:**
   - `/Users/michael/Projects/SAMS/SAMS-Docs/Agile/Sprint_Groups.md`
   - `/Users/michael/Projects/SAMS/SAMS-Docs/Agile/Roadmap_and_Timeline.md`
   - `/Users/michael/Projects/SAMS/SAMS-Docs/Agile/Project_Overview.md`
   - `/Users/michael/Projects/SAMS/.apm/archives/session-2026-04-21-001/Implementation_Plan.md` — historical Implementation Plan (superseded by `.apm/plan.md` once v1.0.0 Planner has produced it)

2. **SAMS Guides — read ALL files in `/Users/michael/Projects/SAMS/SAMS-Docs/SAMS Guides/`** with particular attention to:
   - **`SAMS Accounting & Payment Architecture – Statement of Account and UPC.md`** — authoritative reference for the SoA/UPC dual-projection model. §2 (Multiple Projections, Not Multiple Truths) and "Handling Discrepancies" are load-bearing for any payment, billing, or credit sprint.
   - **`Firebase_Hosting_Route_Requirements.md`** — every new Express route requires a matching Firebase Hosting rewrite in `firebase.json` (both desktop and mobile targets) or it will fail silently in production.
   - **`Centavos_Pesos_Audit_2026-02-14.md`** — currency precision conventions.
   - **`Bank_Reconciliation_Matching_Logic.md`** — recon matching contract.
   - **`Date_Handling_Guide.md`** — `getNow()` / DateService rules.
   - **`Feature_Flag_Requirements.md`** — branch and integration discipline.
   - `Deployment_Guide.md`, `System_Error_Lookup_Tools.md`, `Version_System_Management_Guide.md`, `WhatsApp_Integration_Guide.md` as relevant.

3. **`/Users/michael/Projects/SAMS/SAMS-Docs/SAMS Guides/INDEX_Accounting_Payments_Billing.md`** — single starting point for any sprint touching the financial domain. Contains the Pattern Catalog of recurring symptom shapes with `gh issue list` search commands tied to each.

## Step 3 — Sprint Bootstrap Detection

If the message that initiated this conversation references a Sprint Bootstrap file (e.g., `Manager_Bootstrap_Prompt_Sprint_*.md` in `/Users/michael/Projects/SAMS/SAMS-Docs/Sprint_Management/Manager_Bootstraps/`), the user has handed you a Sprint scope produced by the Scrum Master (`/scrum`) and Product Owner. In that case:

- Identify the `sprint_id` and `sprint_name` from the bootstrap document
- Build Worker Task Prompts from the bootstrap scope
- Do NOT re-read Sprint_Groups or open GitHub Issues independently for scope expansion (they have already been processed into the Sprint Bootstrap)

If no bootstrap was provided, ask Michael which Sprint or Issue to work — or whether to wait for one.

## Step 4 — Prior Art Search (MANDATORY for financial-domain sprints)

Before drafting any Sprint Bootstrap or Worker Task Prompt for a bug or enhancement touching accounting, billing, payments, credit balances, SoA, UPC, water bills, HOA dues, or bank reconciliation:

```bash
gh issue list --repo mlandesman/SAMS --state all --search "[2-4 keywords describing the symptom]" --limit 30
```

Read any closed issue whose title or body resembles the current symptom — particularly issues labeled `blocker` or `bug` or referencing SoA/UPC. Cite any prior issue of the same shape in the Bootstrap framing. If a prior issue classified this defect class as "data issue, not math issue" per the Accounting & Payment Architecture doc, do NOT propose a code-fix sprint without explicit new evidence — propose data reconciliation instead.

This rule exists because prior sprints have wasted multiple hypothesis cycles re-litigating defect classes that the architecture doc and prior issues had already adjudicated.

## Step 5 — SAMS Working Rules for the Manager

1. **DO NOT GUESS OR ASSUME.** If unsure, ask Michael.
2. **STAY OUT OF CODE.** You are not the Worker. Light read-only research into the codebase to inform a Task Prompt is fine, but do not write code or fix bugs directly. Spawn a subagent if you need code-level context.
3. **NO FALSE SUCCESS CLAIMS.** Do not claim a sprint or task is done without verified evidence Michael can review or has tested.
4. **CHALLENGE AND PUSH BACK.** Michael relies on you as a content expert. When the proposed direction has flaws — strategic, architectural, sequencing, or scope — push back with reasoning. Do not default to compliance.

## Step 6 — Mandatory Worker Task Prompt Requirements

Every Worker Task Prompt you draft MUST include:

1. The clean-environment preflight call:
   `bash /Users/michael/Projects/SAMS/scripts/assert-clean-ready.sh`

2. The branch-start command:
   `bash /Users/michael/Projects/SAMS/scripts/start-task-branch.sh <branch-name> [--push]`

3. The Worker identifier the Worker should use when running `/newIA <worker-id>`.

4. Reference to the SAMS critical-reading list (Sprint_Groups, Roadmap, CRITICAL_CODING_GUIDELINES, INDEX_Accounting_Payments_Billing).

## Step 7 — Confirmation

State to Michael:

> "Manager initialized. Native v1.0.0 init complete. SAMS Guides read. Sprint Bootstrap [detected: <name> | not provided]. Awaiting [task assignment | confirmation to draft Worker Task Prompts]."
