# Roadmap and Timeline

*Sprint sequencing with deadlines and dependencies*

---

## Production Status: v1.21.0
**Deployed:** April 13, 2026 | **Prior:** v1.19.1 (Mar 20). v1.21.0 includes BANK-RECON, BUGFIX-ONBOARD sweep items, and post-deploy stabilization/hotfix follow-through merged on `main`. Apr 14 follow-up validated backup exports in production and identified final UX/timeout hardening tasks.
**Merged After v1.21.0 (deployment pending next release tag):** Backend localization closeout (#315, PR #317) and desktop non-admin localization parity (#316, PR #320).

### Core Capabilities (Complete)
- ✅ Double-entry accounting (expenses, deposits, splits)
- ✅ HOA Dues collection with UPC payment allocation
- ✅ Statement of Account (PDF, CSV, Email)
- ✅ Water Bills with quarterly billing (AVII) — Full UI Complete
- ✅ Budget Management and Budget vs Actual reporting
- ✅ Year-End Processing (MTC 2025 complete)
- ✅ Document storage for Expense Entries
- ✅ Mobile/PWA for Maintenance Workers and Admin Expense Entry
- ✅ Dashboard cards for client status overview
- ✅ Water Consumption Report (Issue #129)
- ✅ Projects Module with Bids, Documents, and Financial Lifecycle (PM1-9)
- ✅ System Error Monitor with centralized error capture (Sprint EM)
- ✅ Passkey authentication (WebAuthn) — Face ID, Touch ID, fingerprint login
- ✅ Admin passkey management — invite, list, revoke credentials
- ✅ Normalized unit-user references — UID-based storage, single source of truth for user data
- ✅ Mobile PWA Unit Directory — admin contact list with tappable phone/email
- ✅ Mobile Owner/Manager UX — 3-card dashboard, sub-dashboards, self-service profile, SoA single source of truth
- ✅ Mobile Admin UX — field-ready dashboard, transactions, UPC payment recording, budget detail
- ✅ Digital Receipts — transaction-based receipt generation and email delivery
- ✅ Project assessment bypass — reserve-funded projects skip special assessment billing
- ✅ Assessment vs vendor milestone separation — independent billing and payment tracking
- ✅ Automated monthly statements — nightly scheduler generates SoA PDFs (EN+ES) for all units on 1st of month
- ✅ Mobile transaction UX — fiscal-year-aware filters, text search, attachment viewing, budget expand
- ✅ Bank Reconciliation system — ScotiaBank CSV + BBVA XLSX import, deterministic matching, reconciliation workflow, and statement acceptance (PR #268)
- ✅ Desktop non-admin localization parity — backend companion contract carry-through to desktop shared surfaces with accepted residual tracking (#318 deferred, #319 carry-forward; PR #320)

---

## Hard Deadlines

| Deadline | Issue | Description |
|----------|-------|-------------|
| ~~**March 15, 2026**~~ | ~~#105~~ | ~~Water Bills quarterly display fix~~ ✅ COMPLETE (Jan 27) |
| ~~**~30 days**~~ | ~~Polling-1~~ | ~~Vote recording for upcoming project approvals~~ ✅ COMPLETE (Feb 3) |
| ~~**July 2026**~~ | ~~#124~~ | ~~Year-End 100x centavos bug~~ ✅ Fixed in Sprint F (#124) + systemic cleanup in Sprint CX (#181) |
| **TBD** | #122 | Gmail OAuth (before Google deprecates app passwords) |

---

## Sprint Sequence

### 📋 Upcoming Sprints

| Order | Sprint | Theme | Est | Key Issues/Tasks |
|-------|--------|-------|-----|------------------|
| ~~1~~ | ~~**MOBILE-OWNER-V1**~~ | ~~Mobile Owner PWA~~ | ~~6-8h~~ | ~~#132, #147, #193~~ ✅ COMPLETE (Feb 27, 2026) |
| ~~2~~ | ~~**PM-Finance**~~ | ~~Project Financial Integration~~ | ~~~38h~~ | ~~PM5–PM9~~ ✅ COMPLETE (Mar 9, 2026) |
| ~~3~~ | ~~**PASSKEY-AUTH**~~ | ~~Passkey Authentication~~ | ~~~15h~~ | ~~#189, PK1–PK4~~ ✅ COMPLETE (Mar 10, 2026) |
| ~~4~~ | ~~**D**~~ | ~~PWA/Mobile Enhancements~~ | ~~12-16h~~ | ~~#184, #109~~ ✅ COMPLETE (Mar 12, 2026) |
| ~~5~~ | ~~**NRM**~~ | ~~Normalize Unit-User References~~ | ~~16-24h~~ | ~~#133 [DEBT]~~ ✅ COMPLETE (Mar 14, 2026, PR #240, ~15h actual) |
| ~~6~~ | ~~**235**~~ | ~~Project Assessment Bypass + Flag Cleanup~~ | ~~8-10h~~ | ~~#235, #197~~ ✅ COMPLETE (PR #241, March 14, 2026) |
| ~~7~~ | ~~**242**~~ | ~~Separate Assessment vs Vendor Milestones~~ | ~~8-10h~~ | ~~#242~~ ✅ COMPLETE (PR #243, March 14, 2026) |
| ~~8~~ | ~~**MOBILE-OWNER-UX**~~ | ~~Mobile Owner UX Refactor~~ | ~~18-24h~~ | ~~#244~~ ✅ COMPLETE (PR #245, March 18, 2026) |
| ~~9~~ | ~~**MOBILE-ADMIN-UX**~~ | ~~Admin Mobile UX Refactor~~ | ~~20-27h~~ | ~~#247~~ ✅ COMPLETE (deployed v1.18.0, March 19, 2026) |
| ~~10~~ | ~~**AUTO-STMT**~~ | ~~Automated Monthly Statements~~ | ~~4-6h~~ | ~~#249~~ ✅ COMPLETE (PR #250, merged March 19, 2026) |
| ~~11~~ | ~~**WA-BACKEND**~~ | ~~WhatsApp Backend (code only)~~ | ~~6-8h~~ | ~~#178 (partial)~~ ⏸️ **PAUSED** — PR #253 merged Mar 19; **Meta/WhatsApp Business blocked** externally (Mar 20, 2026); not E2E complete |
| ~~12~~ | ~~**MOBILE-TX-UX**~~ | ~~Mobile Transaction UX Polish~~ | ~~9-13h~~ | ~~#258~~ ✅ COMPLETE (PR #259, merged March 29, 2026) |
| ~~13~~ | ~~**BUGFIX-ONBOARD / BUG-SWEEP-STABILIZATION**~~ | ~~Owner onboarding + post-recon regression fixes~~ | ~~6-8h + sweep~~ | ~~#272, #271, #275, #260, #274, #246, #231, #251, #254~~ ✅ COMPLETE |
| ~~14~~ | ~~**BANK-RECON**~~ | ~~Bank Reconciliation System~~ | ~~19-27h~~ | ~~ScotiaBank CSV + BBVA XLSX import, automated matching, reconciliation UI, statement acceptance (PRD v2.1)~~ ✅ COMPLETE (PR #268, Apr 10, 2026) |
| ~~14.5~~ | ~~**PROD-STABILIZATION-1**~~ | ~~Post-Recon Production Confidence~~ | ~~4-6h~~ | ~~#288, #96, #273, #266~~ ✅ COMPLETE (PRs #298, #301, #302) |
| ~~15~~ | ~~**BUDGET-PROJ-1**~~ | ~~Fiscal Year Projection Baseline (design-first)~~ | ~~4-6h~~ | ~~#165 phase A/B/C (design sign-off, baseline implementation, validation)~~ ✅ COMPLETE (PR #304, Apr 14, 2026) |
| ~~16~~ | ~~**UPC-CREDIT-FIX**~~ | ~~Credit-balance allocation write-back bug~~ | ~~4-8h (diagnosis-heavy)~~ | ~~#308 — production hotfix, blocker~~ ✅ COMPLETE Apr 22, 2026 — data-only reconciliation, no runtime code changed; follow-ups #310, #311 |
| ~~17~~ | ~~**LOCALIZATION-DESKTOP-NONADMIN**~~ | ~~Desktop non-admin localization parity~~ | ~~4-8h~~ | ~~Carry PR #314/#317 localized backend contract into desktop non-admin views and list-management UX (#316); residual carry-forward tracked in #319~~ ✅ COMPLETE (PR #320, merged Apr 27, 2026; #318 deferred, #319 carry-forward) |
| **18 (NEXT)** | **UC-LITE** | Non-HOA Client Support | 3-4h + 8-12h | Investigate + fix HOA assumptions; onboard first non-HOA 2-property client path (Epic #54 lite) |
| --- | **PROD-BACKUP-STABILIZATION** | Backup reliability follow-up | 3-5h | Async backup trigger/polling follow-up + #303 timezone display correction (queued unless promoted by production risk) |
| --- | **DEBT-1** | Tech Debt Interlude | 4-6h | #220, #223, #166 |
| --- | **DEBT-2** | Bug/Polish Pass | 4-6h | #169, #214, #96, owner feedback bugs |
| 19 | **REPORTS-V2** | Board & Owner Reports | 10-14h | Formalized PDF reports replacing CSV exports; Sandyland branding |
| 20 | **PROJECT-VIEWS** | Better Project Presentation | 4-6h | Proposed/Active/Completed tabs; timeline visualization |
| 21 | **VOTING-ADV** | Advanced Voting | 6-8h | #207 committee filters, #198 vote subsets, email reminders, auto-close |
| 22 | **BUDGET-PROJ-2** | Budget Projection Diagnostics Expansion | 6-8h | Follow-on to #165 baseline: category isolation presets, scenario/trend overlays, narrative polish |
| 23 | **TASK-MGMT** | Task Assignment & Tracking | 16-24h | New module: PRD + Phase 1; maintenance tasks, mobile-first |
| 24 | **ADMIN-SETTINGS** | Admin & Settings (Sprint E) | 6-8h | #182, #106, #102, #50, #159 |

**Deferred**: DOC-LIB (after Sprint 24), WA-FRONTEND (when Meta unblocks), UC Full Refactor (only if UC-LITE reveals structural issues), Credit Auto-Pay #90 (after Bank Recon), iPad #238 (far future), Gmail OAuth #122 (no deprecation date).

**Current Focus**: APM v1.0.1 base setup documentation/coordination workstream is complete (no production-feature deployment in that effort), backend localization sprint closeout was completed on Apr 24, 2026, and **LOCALIZATION-DESKTOP-NONADMIN** is now complete/merged (PR #320). Feature sprint queue now advances to **UC-LITE** (next). **PROD-BACKUP-STABILIZATION** and **DEBT-1** remain queued unless promoted by risk. WhatsApp remains **paused**.

**Budget Sprint Clarification:** `BUDGET-PROJ-1` and `BUDGET-PROJ` were overlapping labels. The roadmap now treats them as a phased sequence for the same problem space: **BUDGET-PROJ-1** = baseline projection engine and runway chart, **BUDGET-PROJ-2** = optional diagnostics/polish after baseline validation.

**Schedule Note (Apr 13, 2026 — PROD-STAB closed):** PR #302 merged for issue `#266` (canonical `canLogin` login-eligibility contract and cleanup of legacy `loginEnabled` handling). This closes PROD-STABILIZATION-1.

**Schedule Note (Apr 14, 2026 — Backup validation + follow-up queue):** Production backup run now completes Firestore export after IAM correction (runtime SA + Firestore SA permissions validated; artifacts confirmed in `gs://sams-shared-backups/...`). Remaining operator-facing gap is synchronous HTTP behavior and timestamp rendering mismatch. Added **PROD-BACKUP-STABILIZATION** queue and opened issue `#303` for timezone display correction.

**Schedule Note (Apr 14, 2026 — Priority flip to Budget Projection):** PO moved **BUDGET-PROJ-1** ahead of backup follow-up. Sprint goal is design-first: confirm projection math, assumptions, and visualization contract for `#165` before implementation.

**Schedule Note (Apr 24, 2026 — BACKEND-LOCALIZATION sprint closeout):** Backend localization contract + endpoint parity session completed and archived. Scope included additive EN/ES companion behavior across read paths (transactions/reports/polls/projects), persisted category `name_es` strategy + backfill support, transactions list/detail parity closure, and Spanish diacritic polish (`Depósito`, `Crédito`, `Penalización`). Branch `feat/flag-design-and-localized-reads` was pushed and changelog pending entry added.

**Schedule Note (Apr 25, 2026 — #315 merged and rollout-ready):** PR #317 merged to `main` with persisted transaction notes localization finalization, runtime transaction read-path DeepL removal, strict backfill guardrails (no English fallback writes to `notes_es`), and legacy transfer-fee note suffix cleanup in expense/reconciliation paths. Production deployment should occur before running the production backfill script.

**Schedule Note (Apr 25, 2026 — Between-sprint reset):** PO set the next two strategic sprints to (1) **LOCALIZATION-DESKTOP-NONADMIN** first (carry PR #314/#317 value to desktop non-admin UX, including #316) and (2) **UC-LITE** second (first non-HOA onboarding path). **PROD-BACKUP-STABILIZATION** and **DEBT-1** remain queued; `#309` and `#307` are interrupt-class only if reproduced during active sprint execution.

**Schedule Note (Apr 26, 2026 — Localization residual carry-forward):** Stage work progressed through desktop localization residual fix pass; accepted session pause with remaining residual scope explicitly tracked as Tech Debt issue **#319**. `/unit-report` remains deferred under enhancement **#318** because route is currently inaccessible/unfinished.

**Schedule Note (Apr 27, 2026 — Localization sprint merge closeout):** Sprint **LOCALIZATION-DESKTOP-NONADMIN** (`#316`) merged to `main` via PR #320 after quality-gate and BugBot remediation passes. Carry-forward governance remains: residual scope tracked in **#319**, `/unit-report` deferred under **#318**, and one feature-flag/category-form BugBot item accepted as non-blocking for this release. Changelog pending entry for `#316` is in `main` and ready for deployment finalization.

**Schedule Note (Apr 22, 2026 — UPC-CREDIT-FIX ✅ COMPLETE):** Resolution: data-only reconciliation; no runtime code changed. Both initial diagnoses (writer-side cache corruption per Bootstrap; single-class import miss per Addendum) were proved wrong during the diagnostic loop. Final root cause: small import-era miscounts of `credit_added` ledger entries from the December 2025 Google-Sheet→Firestore migration's text-parsing scripts, sitting dormant for months until the Apr 20 unit 202 payment was the first to depend on the credit ledger to fully cover a bill. Fix: PO posted two reconciliation entries via existing Credit Balance UI (AVII 202 +$0.14, AVII 103 +$99.88, both Dev + Prod) using the Edit-modal Source dropdown to set `source` outside the SoA Account Activity whitelist. Audit script written by IA (`auditCreditLedgerVsSoA.js`) flagged 10/20 units divergent but 8 were by-design false positives (SoA visual application of credit against future-window charges); script deleted at sprint close pending #311's enhancement. Branch `fix/308-credit-ledger-soa-reconciliation` deleted (no merge to main). Issue #308 closed. Follow-up GH issues: #310 (UI dropdown enhancement), #311 (SoA-vs-ledger dual-derivation documentation + invariant check). Historical sequence note: the later Apr 25-27 updates superseded the temporary "backup sprint active next" ordering.

**Schedule Note (Apr 21, 2026 — UPC-CREDIT-FIX inserted as ACTIVE):** Production blocker `#308` discovered: when UPC uses credit balance to complete a payment, the affected billing document persists with `status: 'partial'` and a `paidAmount` short of `totalAmount`, while the SoA and UPC Preview both correctly show zero owed. Manager Bootstrap Prompt at `SAMS-Docs/Sprint_Management/Manager_Bootstraps/Manager_Bootstrap_Prompt_Sprint_UPC_CREDIT_FIX_2026-04-21.md`. PROD-BACKUP-STABILIZATION and DEBT-1 pushed back one slot. (Both Bootstrap and the subsequent Bootstrap Addendum diagnoses turned out to be wrong — see Apr 22 close-out note above for the actual root cause.)

**Schedule Note (Apr 14, 2026 — BUDGET-PROJ-1 complete):** PR #304 merged to `main` and issue `#165` closed. Deliverable shipped: Budget vs Actual mode toggle (`YTD` vs `Projected FY-End`), projected variance basis alignment across preview/export, and supporting variance math tests.

**Schedule Note (Apr 10, 2026 — BANK-RECON + Auth Guard Merge)**: Sprint BANK-RECON ✅ COMPLETE and merged (PR #268). Immediate follow-on fix merged (PR #270) to unify scheduler account guard behavior across auth and user-management paths. Historical sequence note: this projected ordering was later superseded by Apr 13-27 sprint outcomes.

**Schedule Note (Apr 11, 2026 — BUG-SWEEP progress)**: One-at-a-time execution completed #272, #271, #275, and #260. Issue #260 (water mini-graph clipping) merged via PR #292. Next bug-sweep target: #274.

**Schedule Note (Mar 29, 2026 — Roadmap Reset)**: Scrum review with Co-Product Owner reset the entire roadmap. DOC-LIB deprioritized (Google Drive works, no user demand). WhatsApp remains paused (Meta blocked). Bank Reconciliation added at position 14 (biggest daily time drain, PRD v2.0 ready). UC-LITE added at positions 15-16 (real non-HOA clients: Karyn 3 houses + 4 condos, Wilfredo/Monica 2 condos). Bug/debt interlude sprints (DEBT-1, DEBT-2) inserted between major features. Reports, Project Views, Advanced Voting, Budget Projections, Task Management sequenced by operational value. Historical sequence note: this was a planning baseline and is superseded by the current sprint table and Apr 2026 completion notes.

**Schedule Note (Mar 29, 2026 — Sprint MOBILE-TX-UX)**: Sprint MOBILE-TX-UX ✅ COMPLETE (PR #259, 21 files, +1768/-105). Fiscal-year-aware transaction filters (vendor, category, unit, date presets), text search, attachment viewing with single-doc shortcut, budget "More" expand, double-negative fix, console cleanup. Revisions after MA review: fiscal year per-client config, year chips into filter accordion, attachment UI refinement (paperclip in detail only, single-doc direct open), aria-hidden fix (single dialog pattern). Split transaction allocation-aware category/unit matching (desktop parity). #258 closed.

**Schedule Note (Mar 19, 2026 — Sprint AUTO-STMT Complete)**: Automated monthly statement generation merged (PR #250, 10 commits). Nightly scheduler TASK 5 generates prior-month SoA PDFs (EN+ES) for all units on 1st of each month. 40 PDFs in 398s. Deterministic doc IDs prevent duplicates. 6 BugBot issues fixed (month mismatch, fiscal year boundary, error isolation). Ready for functions-only deploy before April 1.

**Schedule Note (Mar 20, 2026 — WhatsApp paused + v1.19.1)**: PO shut down Meta/WhatsApp Business console work after ~2 days blocked — **external dependency**, not SAMS code. Webhook verification works in code (PR #253); **channel not production-live**. **Sprint WA** marked paused in `Sprint_Groups.md`. **v1.19.1** deployed: SoA **email** body fix #255 (credit double-count in preamble only; statement PDF/data were correct).

**Schedule Note (Mar 19, 2026 — Sprint Planning)**: Scrum review reprioritized roadmap: (1) Sprint AUTO-STMT (4-6h, deadline Apr 1) — monthly scheduled SoA generation for mobile app. (2) Sprint WA-BACKEND (6-8h) — WhatsApp Cloud API backend in code (later: Meta blockage invalidated “platform ready” assumption). (3) Sprint DOC-LIB (17-25h) — parked, PRD template created. WhatsApp split: WA-BACKEND vs WA-FRONTEND. Mobile PWA resting during beta testing.

**Schedule Note (Mar 19, 2026 — v1.18.0 Deployed)**: Production deployment of v1.18.0 includes Sprint MOBILE-ADMIN-UX (#247), Sprint MOBILE-OWNER-UX (#244), Digital Receipt restoration, mobile role label fix, and propertyAccess role bug fix. Both Owner and Admin mobile UX fully operational. Beta users testing.

**Schedule Note (Mar 18, 2026 — Hotfixes)**: Three hotfixes committed directly to main ahead of production deployment: (1) Digital Receipt re-enabled — Send Receipt button was permanently disabled due to `.unit` vs `.unitId` field name mismatch in TransactionsView; client name resolved from `basicInfo`; allocations array now used for "For" field; receipt layout no longer clips footer. (2) Mobile role label — title bar chip showed "Owner" for all users; now correctly shows "Manager" when the selected unit's assignment role is `unitManager`. (3) `propertyAccess` role bug — `addUnitRoleAssignment` was hardcoding `role: 'user'`; now derives from actual unit assignment role.

**Mobile PWA Future Enhancements** (carry to Sprint G):
- Budget card: live budget data integration (#176)
- Projects card: live project status data
- Vote Needed card: new card for open polls requiring user action

**Schedule Note (Mar 14, 2026 — Sprint 242)**: Sprint 242 ✅ COMPLETE (PR #243). Assessment milestones decoupled from vendor payment milestones. AssessmentCollectionDialog pops on bid selection. Bill doc IDs: assessment_N, vendor_N, legacy N. Vendor status derived from vendorPayments. BugBot fixes: transaction delete vendor_N lookup, duplicate assessment lock, payment fallback doc ID chain. 16 files changed (+632/-128).

**Schedule Note (Mar 14, 2026 — Scrum Review)**: Sprint NRM ✅ COMPLETE. Roadmap amended: Sprint 235 (Project Assessment Bypass) inserted at position 6 — business decision that first project uses reserve funds, not special assessment billing. #211 closed (manual fix). #194 removed from Sprint E (closed). #231 placed in backlog (manual workaround). #238 added to Sprint G far-future. Feature flags `projects` and `polls` can be enabled — deferred only because PO is traveling, not due to technical issues. `projectPaymentsInUPC` remains OFF pending #235 resolution.

**Schedule Note (Mar 14, 2026 — NRM)**: Sprint NRM ✅ COMPLETE (PR #240, ~15h actual vs 28h estimated). Unit documents now store `{userId}` references only — all 11+ backend services resolve user data at query time. `updateUserNameInUnits` sync function deleted. Mobile Unit Directory added. 17 files changed (+665/-331). 4 BugBot rounds, 0 regressions. Manual testing confirmed. #133 closed.

**Schedule Note (Mar 12, 2026)**: Sprint D ✅ COMPLETE (D1 PR #236, D2 PR #237). D3 investigation revealed unit documents store denormalized owner/manager data (`{name, email}` copies instead of `{userId}` references). PO decision: stop D3, convert #133 to tech debt with expanded scope, create standalone Sprint NRM. Must fix before beta deployment — one truth, not two.

**Schedule Note (Mar 10, 2026)**: Sprint PASSKEY-AUTH ✅ COMPLETE (PR #233, 41 files, +2,537/-782 lines). WebAuthn passkey authentication deployed. Password login retained as fallback for admin bootstrap. Sprint PM-Finance-Next also completed (PRs #215–#226) on Mar 9. #189 closed. Sprint sequence renumbered — Sprint D (PWA/Mobile) now next, ahead of WhatsApp, since passkey auth unblocks external user deployment.

**Schedule Note (Feb 25, 2026)**: Sprint B4 merged to main. Added Epic #54 (Unified Client Architecture) with 7 child issues (#200-#206) as Sprint UC. Scope is explicit expansion beyond HOA to include non-HOA client types (SingleUnit and Portfolio). Placed after WA, D, PM-Finance, and Polling enhancements per PO decision — system needs stable Projects, Budgets, and Statements before onboarding portfolio clients. PM-Finance moved ahead of Polling-2 per priority alignment.

**Schedule Note (Feb 21, 2026)**: Sprint B3-Fix completed and merged (PR #192). All 5 bugs closed. Production stabilized. Reprioritized: Sprint B4 (#195 user-level UI) and Sprint Recon (#188 historical balance) moved ahead of WhatsApp. #49 closed — superseded by #189 (Passkey auth).

---

### ⏸️ Intentionally Deferred

| Item | Reason | Review Trigger |
|------|--------|----------------|
| ~~PM-Finance (PM5-9)~~ | ~~Touches UPC and SoA core engines~~ | ✅ COMPLETE (Mar 9, 2026) |
| #90 Credit Auto-Pay | Monitoring via email override | Q2 2026 |
| Sprint B3 bugs (#124, #52) | Manual workarounds exist, no user impact | ✅ #124 fixed in Sprint F, #52 fixed in Sprint F |
| #231 New user role grant | Manual workaround via Firebase Console | Future cleanup sprint |

---

## Recent Hotfix Log

| Version | Date | Issue | Notes |
|---------|------|-------|-------|
| v1.19.1 | Mar 20, 2026 | #255 | SoA email preamble: credit balance was double-counted in HTML body; PDF unchanged — now single Balance Due from closing balance |
| v1.11.1 | Jan 30, 2026 | SoA skip logic for non-WaterBills clients | Agent shortcut caused edge case bug |
| v1.11.2 | Jan 31, 2026 | SoA fix for water-only payments | Edge case: water bill payment without HOA Dues |

**Lesson Learned**: Changes to conditional logic in shared services (statementDataService.js) have broader blast radius. Test edge cases with both MTC (no water) and AVII (quarterly water).

---

## Sprint Completion Log

| Sprint | Completed | Issues Closed |
|--------|-----------|---------------|
| LOCALIZATION-DESKTOP-NONADMIN | Apr 27, 2026 | #316 complete (PR #320 merged): desktop non-admin localization parity closed with #318 deferred and #319 carry-forward governance |
| ISSUE-315 localization closeout | Apr 25, 2026 | #315 complete (PR #317 merged): persisted `notes_es` read/write contract finalized, runtime transaction DeepL reads removed, strict backfill behavior enforced |
| BACKEND-LOCALIZATION | Apr 24, 2026 | APM Task 2.1–2.7 complete (contract, rollout guard, endpoint parity, persisted category propagation, transactions parity + polish) |
| BUDGET-PROJ-1 | Apr 14, 2026 | #165 complete (PR #304 merged) |
| PROD-STABILIZATION-1 | Apr 13, 2026 | #288 + #96 (PR #298), #273 (PR #301), #266 (PR #302) — sprint complete |
| BUGFIX-ONBOARD / BUG-SWEEP (partial) | Apr 11, 2026 | #260 complete (SoA water mini-graph clipping fix merged in PR #292) |
| BUGFIX-ONBOARD / BUG-SWEEP (partial) | Apr 11, 2026 | #275 complete (temp-password HTML-safe charset merged in PR #291) |
| BUGFIX-ONBOARD / BUG-SWEEP (partial) | Apr 11, 2026 | #271 complete (duplicate bank fee/IVA edit-path fix merged in PR #290) |
| BUGFIX-ONBOARD / BUG-SWEEP (partial) | Apr 11, 2026 | #272 complete (owner/manager label regression fixed; PR #285 superseded/closed during cleanup) |
| v1.19.1 production deploy | Mar 20, 2026 | #255 SoA email preamble credit fix; affirms v1.19.0 feature set in production |
| WA-BACKEND (WhatsApp webhook — code only, paused) | Mar 19–20, 2026 | #178 partial — PR #253 merged; Meta/WhatsApp Business **blocked**; E2E not claimed |
| MOBILE-ADMIN-UX (Admin Mobile UX Refactor) | Mar 19, 2026 | #247 — 7 tasks (ADM-1–ADM-7), ~21h, deployed v1.18.0 |
| Hotfixes (Digital Receipt, Role Label, propertyAccess) | Mar 18, 2026 | Direct to main — Digital Receipt re-enabled, mobile role label fix, propertyAccess role bug |
| MOBILE-OWNER-UX (Mobile Owner UX Refactor) | Mar 18, 2026 | #244 (PR #245) — 7 tasks (MOB-1–MOB-7), ~19h, shared hooks refactor |
| 242 (Separate Assessment vs Vendor Milestones) | Mar 14, 2026 | #242 (PR #243) — 7 tasks, 16 files, +632/-128 lines |
| 235 (Project Assessment Bypass + Flag Cleanup) | Mar 14, 2026 | #235, #197 (PR #241) — 5 tasks, 10 files, +526/-21 lines |
| NRM (Normalize Unit-User References) | Mar 14, 2026 | #133 (PR #240) — 7 tasks (NRM1-NRM7), 17 files, ~15h |
| D (PWA/Mobile Enhancements) | Mar 12, 2026 | #184 (PR #236), #109 (PR #237). D3 (#133) → Sprint NRM |
| PASSKEY-AUTH (Passkey Authentication) | Mar 10, 2026 | #189 — PR #233 (PK1–PK4) |
| PM-Finance-Next (Project Financial Cycle) | Mar 9, 2026 | PM5–PM9 — PRs #215–#226 |
| MOBILE-OWNER-V1 (Mobile Owner PWA) | Feb 27, 2026 | #132, #147, #193 |
| Recon (Bank Reconciliation Tools) | Feb 26, 2026 | #188 — PR #208 |
| B4 (User-Level UI Fix) | Feb 24, 2026 | #195 — PR #199 |
| B3-Fix (Production Stabilization) | Feb 21, 2026 | #191, #190, #186, #187, #43 — PR #192 |
| EM (System Error Monitor) | Feb 16, 2026 | #171 — PR #185 |
| CX (Currency Conversion Discipline) | Feb 15, 2026 | #181, #180, #179 — PR #183 |
| F (Infrastructure & Tech Debt) | Feb 6, 2026 | #124, #52, #146, #63, #155 — PRs #172-#177 |
| Cleanup-1 (UI Polish & Code Hygiene) | Feb 5, 2026 | #160, #167, #97, #84, #154, #164, #168 — PR #170 |
| Polling-1 (Complete Voting System) | Feb 3, 2026 | V1-V4: Backend, Admin UI, Email Link, Integration |
| PM (Project Management PM1-4) | Jan 29, 2026 | Projects module, Bids, Documents |
| CL1 (Changelog Feature) | Jan 28, 2026 | #158 |
| B2 (General Bug Fixes #1) | Jan 28, 2026 | #115, #60, #156, #108 |
| W1 (Water Bills Quarterly UI) | Jan 27, 2026 | #105 |
| U1 (Document Upload) | Jan 24, 2026 | #153 |
| A (Quick Wins) | Jan 19, 2026 | #152, #145, #134, #110 |
| C1 (Water Report) | Jan 22, 2026 | #129 |
| C (Reports) | Jan 20, 2026 | #94, #56 |

---

## Key Context for Prioritization

**System Usage**: SAMS is primarily used by Michael (admin). Passkey authentication is now deployed, unblocking mobile app deployment to unit owners. External users will authenticate via passkey invites.

**Sprint Timing Driver**: Real-world operational deadlines drive priority, not theoretical best practices. Features are accelerated when immediate data collection needs arise (e.g., Projects for collecting proposals).

**Core Engine Caution**: UPC (transaction journal) and Statement of Account (billing/notification) are the two main engines. Sprints touching these require stability periods first.

---

## Document Maintenance

**Manager Agents**: Update this document when:
- Sprint status changes (started, completed)
- Issues are added, moved, or closed
- Deadlines are identified or changed

**Sync with**: `Sprint_Groups.md` for detailed issue lists

---

*Last Updated: April 28, 2026 — Performed reality-alignment pass: added merged-after-v1.21.0 visibility for #315/#316, expanded core capabilities with BANK-RECON and desktop localization parity, added #316 completion row, and marked stale sequence notes as historical/superseded where current table now differs.*

*Previous Update: April 25, 2026 — Added #315 merge closeout (PR #317) with deploy-before-backfill sequencing note, and appended Sprint Completion Log entry for persisted transaction notes localization finalization.*

*Previous Update: April 22, 2026 — Marked Sprint UPC-CREDIT-FIX ✅ COMPLETE. #308 closed; resolution was data-only reconciliation, no runtime code changed. Filed follow-up GH #310 (UI dropdown enhancement) and #311 (SoA-vs-ledger dual-derivation documentation + invariant check). Advanced PROD-BACKUP-STABILIZATION to active position; DEBT-1 next behind it. Added Apr 22 Schedule Note.*

*Previous Update: April 15, 2026 — Marked BUDGET-PROJ-1 complete (PR #304), closed issue #165, advanced active focus to DEBT-1, and retained PROD-BACKUP-STABILIZATION as deferred.*
