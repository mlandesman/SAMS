# Roadmap and Timeline

*Sprint sequencing with deadlines and dependencies*

---

## Production Status: v1.18.0
**Deployed:** March 19, 2026 | **Sprints MOBILE-OWNER-UX + MOBILE-ADMIN-UX + Hotfixes**

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
| 10 | **AUTO-STMT** | Automated Monthly Statements | 4-6h | NEW — Scheduled Cloud Function: generate SoA for all units on 1st of month, both languages, store + index. **Deadline: before Apr 1** |
| 11 | **WA-BACKEND** | WhatsApp Backend Integration | 6-8h | #178 (partial) — Service, webhook, Firestore logging, send endpoint. No frontend. |
| 12 | **DOC-LIB** | HOA Document Library | 17-25h | NEW — Admin + unit-level user uploads, access-controlled document storage (PRD parked) |
| 13 | **WA-FRONTEND** | WhatsApp Frontend + Module Integration | 4-6h | #178 (remainder) — Admin UI, content templates, module triggers |
| 14 | **Polling-2+** | Notifications + Committee Filters | 6-8h | Polling-2 tasks + #207 (committee-based vote filtering) |
| 15 | **E** | Admin & Settings | 6-8h | #182, #106, #102, #50, #159 |
| 16 | **UC** | Unified Client Architecture | 24-30h | Epic #54 — expand beyond HOA to non-HOA client types (#200-#206) |
| 17 | **G** | Future Features | TBD | #157, #138, #148, #121, #96, #53, #68, #165, #176, #238 |

**Current Focus**: Sprint AUTO-STMT — Automated Monthly Statement Generation. Must deploy before April 1, 2026 to generate March statements. Then Sprint WA-BACKEND — WhatsApp backend integration (service, webhook, logging). DOC-LIB PRD parked for future planning. v1.18.0 deployed. Beta users actively testing mobile apps.

**Schedule Note (Mar 19, 2026 — Sprint Planning)**: Scrum review reprioritized roadmap: (1) Sprint AUTO-STMT (4-6h, deadline Apr 1) — monthly scheduled SoA generation for mobile app. (2) Sprint WA-BACKEND (6-8h) — WhatsApp Cloud API backend only (Meta platform already configured, cURL verified). (3) Sprint DOC-LIB (17-25h) — parked, PRD template created. WhatsApp sprint split into WA-BACKEND (service/webhook/logging) and WA-FRONTEND (UI/templates/triggers). Mobile PWA resting during beta testing.

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
| v1.11.1 | Jan 30, 2026 | SoA skip logic for non-WaterBills clients | Agent shortcut caused edge case bug |
| v1.11.2 | Jan 31, 2026 | SoA fix for water-only payments | Edge case: water bill payment without HOA Dues |

**Lesson Learned**: Changes to conditional logic in shared services (statementDataService.js) have broader blast radius. Test edge cases with both MTC (no water) and AVII (quarterly water).

---

## Sprint Completion Log

| Sprint | Completed | Issues Closed |
|--------|-----------|---------------|
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

*Last Updated: March 19, 2026 — Roadmap reprioritized: AUTO-STMT (monthly statements, deadline Apr 1) → WA-BACKEND (WhatsApp service/webhook) → DOC-LIB (parked). WhatsApp split into backend + frontend sprints. v1.18.0 deployed with all mobile UX.*
