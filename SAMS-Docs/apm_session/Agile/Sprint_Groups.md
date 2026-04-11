# Features and Enhancements Groupings
*What tasks and issues go together logically or are codependent.*

## Active Sprint Categories

### 🧹 Sprint BUG-SWEEP-STABILIZATION (Post BANK-RECON) — in progress
*Risk-first regression sweep after BANK-RECON before broad deploy confidence sign-off.*

| # | Title | Priority | Status |
|---|-------|----------|--------|
| **272** | Owner/Manager names missing in HOA Dues + List Management (NRM regression) | critical | ✅ COMPLETE (reviewed Apr 11, 2026; ready to close) |
| **271** | Bank transfer fee/IVA duplicate application on edit | critical | Next in queue |
| **275** | Temp password email mismatch risk due to HTML-dangerous characters | high | Planned |
| **260** | Water mini graph clipping/period issue in SoA | medium | Planned |
| **274** | Mobile admin lost Currency Exchange tool | medium | Planned |

**Theme**: Stabilization and regression cleanup (no net-new feature scope)  
**Status**: Active — #272 completed; continue one-at-a-time priority execution

---

### 🐛 Sprint BUGFIX-ONBOARD: Owner Onboarding Bug Fixes (6-8 hours)
*Fix bugs that degrade the owner onboarding experience before expanding MTC/AVII deployments*

| # | Title | Priority | Est |
|---|-------|----------|-----|
| **246** | Adding Owner/Manager only shows users already assigned to that ClientId | bug | 2h |
| **231** | Adding a new user role for a new client doesn't grant access | bug | 2h |
| **260** | Water Consumption Mini Graph scrolls off page in SoA | bug | 1h |
| **251** | Mobile PWA SoA has two paths with different experiences | bug | 1-2h |
| **254** | checkExchangeRatesHealth uses new Date() (DateService violation) | tech-debt | 0.5h |

**Theme**: Eliminate bugs that block or confuse unit owners during onboarding  
**Risk**: Low — individual bug fixes, no shared engine changes  
**Dependencies**: None  
**Status**: Planned — **NEXT SPRINT** (roadmap position 13)

---

### 🏦 Sprint BANK-RECON: Bank Reconciliation System (19-27 hours)
*CSV/XLSX import, automated matching, reconciliation UI, and statement acceptance — ScotiaBank + BBVA*

| Task | Title | Priority | Est |
|------|-------|----------|-----|
| RECON-1 | Data model: `clearedDate` on transactions, reconciliation session collection | high | 2h |
| RECON-2 | ScotiaBank CSV parser (no header, 14 columns, reference-number grouping) | high | 3-4h |
| RECON-3 | BBVA XLSX parser (single-row transactions, no normalization needed) | high | 2-3h |
| RECON-4 | Scotia normalization engine (group by reference number, sum amounts) | high | 2-3h |
| RECON-5 | Deterministic matching algorithm (pre-filter, normalize, exact, date-drift, fee-adjusted) | high | 4-5h |
| RECON-6 | Reconciliation UI (enhance existing Reconcile Accounts modal — session setup, side-by-side, resolution actions) | high | 4-6h |
| RECON-7 | Statement acceptance, locking, reconciliation report PDF generation | medium | 2-3h |

**PRD**: `Agile/PRDs/SAMS_Reconciliation_PRD_v2_Simplified.md` (authoritative scope) + `PRDs/SAMS_Reconciliation_PRD_v1_1.md` section 7 (matching algorithm detail)  
**Theme**: Replace manual line-by-line bank statement comparison with automated matching  
**Risk**: MEDIUM (adds `clearedDate` field to transactions, new reconciliation collection)  
**Dependencies**: none (delivered ahead of prior sequence due to operational priority)  
**Status**: ✅ COMPLETE (PR #268, merged to `main` April 10, 2026)

**Key Design Decisions**:
- Transactions get ONE new field: `clearedDate` (null = uncleared, date = cleared)
- Match map lives in reconciliation session, NOT on individual transactions
- Existing "Reconcile Accounts" modal enhanced — not greenfield UI
- Two clearing paths: auto-matched (CSV import) and manually justified (admin marks with reason)
- Bank is ALWAYS right — SAMS corrected to match bank, never vice versa
- Both recording eras handled: pre-Dec 2025 (bank fees as separate transactions) and post-Dec 2025 (fees in split total)
- Scotia normalization groups by reference number BEFORE matching (primary pattern, not edge case)
- Statement acceptance = locking event; must balance to $0 difference before accepting
- Reconciliation report PDF generated on acceptance, stored alongside bank statement PDF

**Reference Data**: Sample ScotiaBank CSV + PDF at `~/Desktop/Scotiabank Recon/`. AVII account structure in `test-results/AVII.json`.

---

### 🔧 Sprint DEBT-1: Tech Debt Interlude (4-6 hours)
*Clean up accumulated tech debt between major features*

| # | Title | Priority | Est |
|---|-------|----------|-----|
| **220** | Replace payment-type credit reversal checks with metadata flag | tech-debt | 2h |
| **223** | Credit Balance History modal UI improvements | bug | 1-2h |
| **166** | Refactor email services to use shared reportEmailUtils | tech-debt | 1-2h |

**Theme**: Code quality and consistency  
**Risk**: Low  
**Dependencies**: After BANK-RECON  
**Status**: Planned — roadmap interlude after sprint 14

---

### 🏗️ Sprint UC-LITE: Non-HOA Client Support (3-4h investigate + 8-12h implement)
*Enable non-HOA clients (single-unit owners, portfolio managers) on SAMS*

| Task | Title | Priority | Est |
|------|-------|----------|-----|
| UC-INV-1 | Create test non-HOA client in dev, configure activities without HOADues/WaterBills | high | 1h |
| UC-INV-2 | Trace all code paths: dashboard, transactions, budgets, reports, UPC | high | 2-3h |
| UC-INV-3 | Document what breaks and what works; scope UC-LITE fixes | high | 1h |
| UC-LITE-1 | Fix identified HOA assumptions (dashboard cards, BvA, UPC skip logic) | high | 4-6h |
| UC-LITE-2 | Test with Karyn's portfolio data model (3 houses, 4 condos) | high | 2-3h |
| UC-LITE-3 | Integration testing, regression check | medium | 2-3h |

**Epic**: #54 — Unified Multi-Asset Client Architecture  
**Theme**: Extend SAMS from HOA-only to support single-unit and portfolio clients  
**Risk**: MEDIUM (may reveal structural HOA assumptions requiring larger refactor)  
**Dependencies**: After DEBT-1; `hasActivity()` in `clientFeatures.js` already gates features  
**Status**: Planned — roadmap position 15-16  
**Escalation**: If investigation reveals structural issues beyond activity gating, escalate to full UC epic (#200-#206)

**Real clients waiting**: Karyn (3 houses + 4 condos, full management), Wilfredo/Monica (2 condos)

---

### 🔧 Sprint DEBT-2: Bug/Polish Pass (4-6 hours)
*Address accumulated bugs and quality-of-life improvements*

| # | Title | Priority | Est |
|---|-------|----------|-----|
| **169** | Enhance or eliminate auditLog functionality | tech-debt | 2h |
| **214** | Prompt for sending SoA after posting a payment | enhancement | 1-2h |
| **96** | Dashboard Account Balances Card — deduct Credit Balances | enhancement | 1-2h |
| TBD | Bugs surfaced by owner feedback during onboarding | varies | TBD |

**Theme**: Quality of life improvements  
**Risk**: Low  
**Dependencies**: After UC-LITE  
**Status**: Planned — roadmap interlude after sprint 15-16

---

### 📊 Sprint REPORTS-V2: Formalized Board & Owner Reports (10-14 hours)
*Replace CSV-export-and-manipulate with repeatable, branded reports*

| Task | Title | Priority | Est |
|------|-------|----------|-----|
| RPT-1 | Board Report: financial summary, collection rates, budget status, project status, bank balances | high | 4-5h |
| RPT-2 | Owner Report: account status, payment history, upcoming charges | high | 3-4h |
| RPT-3 | PDF generation with Sandyland branding | medium | 2-3h |
| RPT-4 | On-demand + scheduled delivery options | medium | 2-3h |

**Theme**: Professional, repeatable financial reporting for board meetings and owner communications  
**Risk**: Low (read-only reports, no engine changes)  
**Dependencies**: After DEBT-2  
**Status**: Planned — roadmap position 17

---

### 🏗️ Sprint PROJECT-VIEWS: Better Special Project Presentation (4-6 hours)
*Improve project lifecycle visibility with filtered views*

| Task | Title | Priority | Est |
|------|-------|----------|-----|
| PV-1 | Proposed / Active / Completed tabs with lifecycle filtering | medium | 2-3h |
| PV-2 | Project timeline/progress visualization | medium | 2-3h |

**Theme**: Better project visibility — data exists from PM-Finance sprints, this is presentation work  
**Risk**: Low (frontend-only)  
**Dependencies**: After REPORTS-V2  
**Status**: Planned — roadmap position 18

---

### 🗳️ Sprint VOTING-ADV: Advanced Voting + Committee Filters (6-8 hours)
*Email reminders, scheduled closing, and committee-based vote filtering*

| Task/# | Title | Priority | Est |
|--------|-------|----------|-----|
| N1 | Email notifications: Reminders at 1d/close | medium | 2h |
| N2 | Scheduled close: Cloud Function to auto-close at deadline | medium | 2h |
| **207** | Committee-based vote filtering (board, vigilance, budget committee) | medium | 4h |
| **198** | Voting module subsets for sending vote requests | medium | 2h |

**Theme**: Automation, notifications, and committee-scoped voting  
**Risk**: Low-Medium (#207 requires committee membership data model)  
**Dependencies**: Polling-1 complete  
**Status**: Planned — roadmap position 19

**Note**: Mobile voting screens no longer needed — email links work on any device. #207 adds the ability to restrict polls to specific committees (Board, Vigilance, Budget) rather than all units. WhatsApp integration hooks (N3) deferred until Meta unblocks.

---

### 📱 Sprint D: PWA/Mobile Enhancements — ✅ COMPLETE
*Mobile app improvements*

| # | Title | Priority | Est | Status |
|---|-------|----------|-----|--------|
| **184** | Consolidate duplicate databaseFieldMappings.js and currencyUtils | tech-debt | 2h | ✅ D1 COMPLETE (PR #236, March 12) |
| **109** | PWA Mobile Install Flow (iOS + Android) | enhancement | 2h | ✅ D2 COMPLETE (PR #237, March 12) |
| **133** | PWA unit information dashboard | enhancement | 2h | ❌ CANCELLED → Converted to Sprint NRM (tech debt #133 with expanded scope) |
| **176** | Budget Dashboard Card redesign — live budget data for mobile | enhancement | 2h | Deprioritized → Sprint G backlog |
| NEW | Projects card — live project status data for mobile dashboard | enhancement | 2h | Deprioritized → Sprint G backlog |
| NEW | Vote Needed card — show open polls requiring user action on mobile dashboard | enhancement | 3h | Deprioritized → Sprint G backlog |
| **51** | PWA Balance Card expandable | enhancement | 1h | ✅ Already implemented (compact card shows all accounts) |
| **47** | Refactor PWA Dashboard layout cards | medium | 2h | ✅ Closed — implemented in MOBILE-OWNER-V1 |

**Theme**: Mobile experience improvements  
**Status**: ✅ Sprint Complete (March 12, 2026). D1 and D2 done. D3 converted to standalone Sprint NRM. Remaining cards deprioritized to Sprint G.  
**Note**: #132, #147, #193 closed in Sprint MOBILE-OWNER-V1. Budget card (#176), Projects card, and Vote Needed card carried forward to Sprint G backlog.  

---

### ✅ Sprint NRM: Normalize Unit-User References — COMPLETE (PR #240, March 14, 2026)
*Refactored unit owner/manager storage from denormalized name/email copies to UID-based references*

| Task | Title | Priority | Est | Actual | Status |
|------|-------|----------|-----|--------|--------|
| NRM1 | Data migration script — `owners[{name,email}]` → `owners[{userId}]` | high | 4h | 3h | ✅ COMPLETE |
| NRM2 | Backend API — resolve user data at query time from `users` collection | high | 4h | 3h | ✅ COMPLETE |
| NRM3 | Backend service consumers (11 files) + sync logic refactor | high | 6h | 4h | ✅ COMPLETE |
| NRM4 | Desktop frontend — `UnitFormModal` sends only `{userId}` | high | 4h | 1h | ✅ COMPLETE |
| NRM5 | Mobile frontend — `UnitReport` tappable phone links | medium | 3h | 1h | ✅ COMPLETE |
| NRM6 | Transition verification — pre-PR checks, builds, diff review | medium | 4h | 1h | ✅ COMPLETE |
| NRM7 | Mobile PWA Unit Directory — admin contact list with phone/email | medium | 3h | 2h | ✅ COMPLETE |

**Issue**: #133 (converted from PWA unit info dashboard to tech debt)  
**Theme**: Data normalization — single source of truth for user data  
**Estimated**: 28h | **Actual**: ~15h | **Quality**: ⭐⭐⭐⭐⭐  
**Key result**: 17 files changed (+665/-331), `updateUserNameInUnits` deleted, 4 BugBot rounds, 0 regressions  
**Risk**: HIGH (touches unit CRUD across all three codebases + requires data migration)  
**Dependencies**: None — should be done before beta user deployment  
**Status**: Planned — next priority after Sprint D  

**Why Now**: Unit owner/manager arrays currently store `{name, email}` copies instead of `{userId}` references. This creates two sources of truth that will diverge as users update profiles. Phone numbers are inaccessible from unit queries. The sync mechanism (`addPersonToUnit`, `syncUnitAssignments`, `updateUserNameInUnits`) uses fragile string matching. Must fix before external users are on the system.

**Migration Strategy**:
1. Write migration script: match `owners[].email` → `users` collection → write `owners[].userId`
2. Backend API supports both formats during transition (has `userId` → resolve; has `name`/`email` → use as-is)
3. After migration verified, remove legacy format support

---

### ✅ Sprint 235: Project Assessment Bypass + Flag Cleanup — COMPLETE (PR #241, March 14, 2026)
*Reserve-funded projects bypass special assessment billing, feature flag cleanup, PDF caching fix*

**Issues**: #235 ✅ CLOSED, #197 ✅ CLOSED  
**PR**: #241 (merged March 14, 2026) — 10 files changed, +526/-21 lines  
**Quality**: ⭐⭐⭐⭐  
**Deliverables**: `noAssessmentRequired` flag on project model, pre-query filters in UPC/SoA/BvA, "Reserve Funded" chip + "No Assessment Required" checkbox in desktop UI, enable-polls-flag.js script, bid comparison PDF cache-busting fix  
**BugBot**: 2 rounds — sanitize boolean fix applied; UnitAssessmentsTable milestone tracking noted as known limitation (see #242)

---

### ✅ Sprint 242: Separate Assessment vs Vendor Payment Milestones — COMPLETE (PR #243, March 14, 2026)
*Decouple unit assessment billing schedule from vendor payment execution milestones. Add Assessment Collection Dialog on project approval.*

| Task | Title | Priority | Est | Status |
|------|-------|----------|-----|--------|
| 242-1 | Data model: Add `assessmentSchedule[]` (with `label`, `targetDate`, `status`) separate from `installments[]` (vendor milestones). Add `milestoneIndex` to vendor payment recording. Handle locking amounts on save. | high | 3-4h | ✅ COMPLETE |
| 242-2 | Backend: Update `billMilestone()` to use `assessmentSchedule[]`. Ensure vendor payment endpoint forwards `milestoneIndex`. | high | 1h | ✅ COMPLETE |
| 242-3A | Frontend: New `AssessmentCollectionDialog` — pops on bid selection (auto-approve). Admin chooses: No Assessment Required, 100% Upfront, or Split Phases with advisory target dates. | high | 2-3h | ✅ COMPLETE |
| 242-3B | Frontend: Trigger dialog from `handleProjectUpdateFromBids` in ProjectsView when project becomes approved. Remove `noAssessmentRequired` checkbox from ProjectFormModal. | high | 1h | ✅ COMPLETE |
| 242-3C | Frontend: Rename "Installment Schedule" → "Vendor Payment Milestones". Add "Assessment Schedule" section with target dates and Bill buttons. | medium | 1h | ✅ COMPLETE |
| 242-3D | Frontend: Add milestone selector dropdown to VendorPaymentsTable. Fix UnitAssessmentsTable "Next Milestone" to use assessmentSchedule/vendorPayments. | medium | 1h | ✅ COMPLETE |
| 242-4 | Testing: Verify dialog flow, assessment billing, vendor payments, backward compat, BugBot fixes | high | 1h | ✅ COMPLETE |

**Issue**: #242  
**Theme**: Assessment milestones (funding) and vendor milestones (execution) are distinct workflows.  
**Status**: ✅ COMPLETE — PR #243 approved. BugBot fixes: transaction delete vendor_N lookup, duplicate assessment lock, payment fallback doc ID chain.

---

### 📱 Sprint MOBILE-OWNER-UX: Mobile Owner UX Refactor (18-24 hours)
*Refactor mobile PWA for unit owners/managers: focused 3-card dashboard, bottom tab nav, sub-dashboards, self-service profile*

| Task | Title | Priority | Est |
|------|-------|----------|-----|
| MOB-1 | Bottom tab navigation for owners (Home, My Unit, HOA, More). Update PWANavigation + Layout for role-based tabs. | high | 2-3h |
| MOB-2 | 3-card main dashboard: Unit Status (amount due, days past due), HOA Status (bank balances + month-over-month trend, collection rate, polls, projects), Exchange Rates (USD-MXN prominent). | high | 3-4h |
| MOB-3 | Unit Sub-Dashboard: account summary, payment info (no "grace period"), fee schedule, recent transactions (full transparency), stored statements. | high | 4-5h |
| MOB-4 | HOA Sub-Dashboard: financial health (bank balances + trend via asOfDate endpoint), collection rate %, active polls, active projects, budget summary. | high | 4-5h |
| MOB-5 | More menu + route cleanup. New routes guarded for unitOwner role. | medium | 1-2h |
| MOB-6 | Polish + integration testing. Both MTC and AVII clients. Admin/maintenance regression. | high | 2-3h |
| MOB-7 | Fix self-service profile: restore `PUT /email` and `PUT /password` backend routes to active `user.js`, fix API paths in `UserProfileManager.jsx` (use `config.api.baseUrl + /auth/user/...`), add duplicate email validation. | high | 1-2h |

**Issue**: #244  
**Theme**: Owner-facing mobile experience — focused dashboard, self-service data, field-ready  
**Risk**: LOW — mobile-only changes, minimal backend (restoring existing route logic). All existing endpoints.  
**Dependencies**: Sprint MOBILE-OWNER-V1 ✅, Sprint NRM ✅  
**Status**: ✅ COMPLETE (PR #245, merged March 18, 2026)

**Key Design Decisions**:
- Exchange rates HIGH prominence (reduces payment errors)
- "Days past due" wording (never "grace period")
- HOA card headline = bank balances (not collection rate) with month-over-month trend
- Collection rate: percentage only, no individual names
- Full transaction transparency for owners
- Self-service email change safe post-NRM (unit references use UIDs, not emails)

---

### 📱 Sprint MOBILE-ADMIN-UX: Admin Mobile UX Refactor (20-27 hours)
*Restructure admin mobile experience: focused dashboard, transactions view, UPC payment received, budget detail*

| Task | Title | Priority | Est |
|------|-------|----------|-----|
| ADM-1 | Dashboard restructure: 3-card layout (Account Balances w/ MoM trend, Collection Status w/ past-due expand, Exchange Rates). Bottom nav: Home, Transactions, Record Payment, Add Expense. Hamburger: Unit Directory, Budget, About. | high | 3-4h |
| ADM-2 | Sub-dashboard: enhanced Past Due Units (tap for SoA preview), Water Bills Past Due (conditional), Polls/Projects summary (reuse `usePollsProjects`). | high | 2-3h |
| ADM-3 | Admin Transactions view: all-units transactions from `/clients/:clientId/transactions`, year filter, type filter (Income/Expense/All), expandable rows with split allocations. | high | 4-5h |
| ADM-4 | UPC Payment Received (mobile): step-based flow (Select Unit -> Review Bills/Preview -> Enter Payment -> Confirm). Port `unifiedPaymentAPI.js` to mobile auth. Mobile-friendly penalty waiver (toggle, not right-click). | high | 8-10h |
| ADM-5 | Budget Detail view: FY period, % elapsed, YTD budget vs actual, variance. Accessible from hamburger or Budget card tap. | medium | 1-2h |
| ADM-6 | Keep existing Add Expense: no changes to ExpenseForm/useExpenseForm. | — | 0h |
| ADM-7 | Integration + BugBot: polish, regression testing (both MTC and AVII), BugBot cycle until clean. | high | 2-3h |

**Issue**: #247  
**Theme**: Admin-facing mobile experience — field-ready dashboard, transaction review, payment recording  
**Risk**: HIGH for ADM-4 (UPC form complexity), MEDIUM for ADM-3 (large result sets), LOW for ADM-1/2/5  
**Dependencies**: Sprint MOBILE-OWNER-UX ✅ (shared hooks, patterns, SoA context)  
**Status**: ✅ COMPLETE — deployed v1.18.0, March 19, 2026

**Reusable from Owner Sprint**:
- `usePriorMonthBalance`, `usePollsProjects`, `useHoaConfig`, `useBudgetStatus`, `useDashboardData` hooks
- `CompactCard`/`ExpandableCard` components
- `TransactionsList.jsx` as template (needs all-units + filtering adaptation)
- Backend endpoints: no backend changes needed (all endpoints exist)

**Key Files to Create**: `components/admin/AdminDashboard.jsx`, `components/admin/AdminTransactions.jsx`, `components/admin/RecordPayment.jsx`, `components/admin/BudgetDetail.jsx`, `services/unifiedPaymentAPI.js`  
**Key Files to Modify**: `Dashboard.jsx`, `PWANavigation.jsx`, `Layout.jsx`, `App.jsx`

---

### ✅ Sprint MOBILE-TX-UX: Mobile Transaction UX Polish (9-13 hours) — COMPLETE
*Fiscal-year-aware transaction filters, search, attachment viewing, budget expand*

| Task | Title | Priority | Est | Status |
|------|-------|----------|-----|--------|
| MTX-1 | Owner TransactionsList — text search, vendor/category/unit filters, date range presets, type toggle, year chips | high | 3-4h | ✅ COMPLETE |
| MTX-2 | Admin AdminTransactions — text search, vendor/category/unit filters, date range presets | high | 2-3h | ✅ COMPLETE |
| MTX-3 | Transaction attachment viewing — paperclip in detail, DocumentViewer integration, single-doc shortcut | high | 2-3h | ✅ COMPLETE |
| MTX-4 | Fix double-negative sign on expense amounts | medium | 0.5h | ✅ COMPLETE |
| MTX-5 | Budget "More" — show all categories instead of top 5 | medium | 1-2h | ✅ COMPLETE |

**Issue**: #258 (closed)
**PR**: #259 (merged March 29, 2026)
**Theme**: Mobile transaction experience — filters, search, attachments, budget expand
**Risk**: LOW — mobile-only changes, no backend modifications
**Dependencies**: Sprint MOBILE-ADMIN-UX ✅, Sprint MOBILE-OWNER-UX ✅
**Status**: ✅ COMPLETE — PR #259 merged March 29, 2026

**Post-Review Revisions**: Fiscal year per-client config (`resolveFiscalYearStartMonth`), year chips moved into filter accordion, attachment UI (paperclip in detail only, single-doc direct open), single-dialog pattern (no aria-hidden warnings), `clientFeatures` logs to `console.debug`, split transaction allocation-aware filtering.
**Architecture**: Local `dateUtils.js` (Luxon, no server DateService in bundle) per MA instruction.
**Archive**: `SAMS-Docs/apm_session/Memory/Archive/Sprint_MOBILE_TX_UX_2026-03-29/`

---

### ⚙️ Sprint E: Admin & Settings (6-8 hours)
*System administration features*

| # | Title | Priority | Est |
|---|-------|----------|-----|
| **182** | Realignment of Settings, List Management and Admin activities | medium | 2h |
| **106** | Client-specific backup in Settings | medium | 2h |
| **102** | Admin client for non-client activities | low | 2h |
| **50** | Administration bulk operations | medium | 2h |
| **159** | HOA Dues Owner functionality | medium | 2h |

**Theme**: Administrative tools for system management  
**Risk**: Low  
**Dependencies**: None  
**Note**: #194 (Sort Users by last name) completed and closed (Mar 1, 2026)  

---

### 📱 Sprint MOBILE-OWNER-V1: Mobile Owner PWA (6-8 hours) — ✅ COMPLETE
*Read-only mobile PWA for non-admin unit owners*

| # | Title | Priority | Status |
|---|-------|----------|--------|
| **132** | PWA add hamburger menu | enhancement | ✅ CLOSED |
| **147** | PWA show recent transactions | backlog | ✅ CLOSED |
| **193** | Finish Mobile/PWA SoA and Current Account Status | enhancement | ✅ CLOSED |

**Theme**: Mobile owner experience — read-only dashboard, transactions, SoA for unit owners  
**Risk**: Low (mobile-only changes, no backend modifications, no financial logic)  
**Dependencies**: Sprint B4 artifacts (dashboard-summary endpoint, useUnitAccountStatus pattern)  
**Status**: ✅ Sprint Complete (Feb 27, 2026)  
**PR**: Pending  
**Branch**: `feature/mobile-owner-v1` (18 commits)

**Deliverables**:
- SelectedUnitContext with localStorage persistence and multi-unit support
- useUnitAccountStatus hook (port of desktop hook, same dashboard-summary endpoint)
- Hamburger menu with role-based navigation, unit selector in drawer, unitId chip in AppBar
- Original card-grid Dashboard restored for all users (Balance, HOA Dues, Exchange Rates, Budget, My Account, Payment Due, Projects, About)
- Payment Due card uses unit-specific amountDue (not HOA-wide aggregate), dollar amount prominent
- Balance card shows Bank + Cash rows
- Current Status tab (renamed from SoA): unit summary, YTD total, payment calendar, unit-specific transactions
- Transactions tab: fiscal year transactions from /transactions endpoint with date/vendor/amount, tap-to-expand
- Statement of Account tab: stored PDF browser (Firestore metadata, deduplicated) + on-demand PDF generation with English/Spanish toggle
- Centavos-to-pesos fix, date object formatting fix, timezone compliance (no new Date())
- propertyAccess fallback fix in SelectedUnitContext and RoleProtectedRoute

**Future Enhancements** (for Sprint D or Sprint G):
- **Budget card**: Replace "On Track" placeholder with live budget data (#176)
- **Projects card**: Replace "Coming soon" with live project status data
- **Vote Needed card**: New card when there is an open poll requiring user action

**Files Changed**: ~20 files, +2,000/-800 lines (all in `frontend/mobile-app/src/`)

---

### ⏸️ Sprint WA: WhatsApp Business Notifications — PAUSED (partial backend)
*Payment confirmations, poll alerts, task reminders via WhatsApp Business Cloud API — **on hold** until Meta / WhatsApp Business setup unblocks*

| Task | Title | Priority | Est | Status |
|------|-------|----------|-----|--------|
| WA-1 | WhatsApp webhook endpoint (GET verification + POST handler) | medium | 2h | ✅ In code (PR #253) |
| WA-2 | Parse inbound messages + status updates, Firestore logging | medium | 2-3h | ✅ In code (PR #253) |
| WA-3 | Phone matching, STOP detection, opt-out handling | medium | 1-2h | ✅ In code (PR #253) |
| WA-4 | Firebase Hosting rewrites, secrets, deployment | medium | 1h | ✅ In code (where applicable) |
| WA-5 | Meta / WhatsApp Business app & phone — live templates, production sends | medium | TBD | ⏸️ **Blocked externally** (not a SAMS code defect) |

**Issue**: #178 — **remains partial** until Meta side completes; do not treat as closed for end-to-end WhatsApp.  
**Theme**: Communication channel — eventual replacement for parts of the digital-receipts story  
**Risk**: **High calendar risk** — third-party console work burned multi-day capacity (Mar 18–20, 2026); same class of risk when resumed  
**Dependencies**: Meta Business Manager / WhatsApp Business account verification and policy steps (tracked outside Cursor)  
**Status**: ⏸️ **PAUSED** — March 20, 2026 PO decision after ~2 days blocked on Meta. Webhook verification path proven in code; **full scaffolding and module wiring deferred** to a future sprint after unblock.  
**Archive**: `Memory/Archive/WhatsApp_Webhook_WA-BACKEND_2026-03-19/` (historical completion log for PR #253 merge; **operational “done” not claimed**)

**Why WhatsApp** (unchanged intent):
- Payment confirmations, poll alerts, project-related notices
- **Not production-live** for owners until Meta + WA-FRONTEND + module triggers land

---

### 🐛 Sprint B4: User-Level UI Fix ✅ COMPLETE
*Fix non-admin user experience to enable beta tester distribution*

| # | Title | Priority | Status |
|---|-------|----------|--------|
| **195** | Desktop UI needs to adjust for User level (non-admin content) | bug | ✅ CLOSED |

**Theme**: Non-admin users can already log in with username/password — fix what they see  
**Status**: ✅ Sprint Complete + Stretch + Bugbot fixes (Feb 24–25, 2026)  
**PR**: #199 (merged to main Feb 25, 2026)  
**Branch**: `fix/sprint-b4-user-level-ui`  
**Deliverables (Core)**:
- Unit selector with multi-unit dropdown and per-client localStorage persistence
- Transactions/HOA Dues view-only for non-admin (CRUD gated, Reconcile hidden)
- Budgets: non-admin sees only Budget vs Actual (Create Vote/Poll hidden)
- Reports: Statement of Account unit selector filtered to authorized units
- Balance bar display-only for non-admin (prevents recalc errors)
- Backend `accounts.view` and `transactions.view` for unitOwner/unitManager
- System error lookup tools (`show-system-error.js`, `getSystemErrorByDocId.js`)

**Deliverables (Stretch — Feb 25)**:
- Unit Account Status dashboard card (SoA-backed balance, dues-based next payment, YTD progress)
- Owner name(s) in ActivityActionBar title
- Lightweight `dashboard-summary` endpoint (skips HTML/projects/utility graph)
- Reusable `useUnitAccountStatus` hook for Sprint D mobile PWA
- DateService compliance (`createDate`, `formatForFrontend().iso`) and UTC fix

**Quality Rating**: ⭐⭐⭐⭐⭐  
**Archive**: `SAMS-Docs/apm_session/Memory/Archive/Sprint_B4_User_Level_UI_2026-02-24/`

---

### 📊 Sprint Recon: Bank Reconciliation Tools ✅ COMPLETE
*Historical balance lookup for monthly account reconciliation*

| # | Title | Priority | Est |
|---|-------|----------|-----|
| **188** | Account balance on a given date — historical running balance view | enhancement | 4-6h |

**Status**: ✅ Sprint Complete (Feb 26, 2026)  
**PR**: #208 (merged to main)  
**Archive**: `SAMS-Docs/apm_session/Memory/Archive/Sprint_Recon_Historical_Balance_2026-02-26/`

---

### 🏗️ Sprint UC: Unified Client Architecture (24-30 hours)
*Issue #54: expand user/client types beyond HOA to include non-HOA clients under one model*

**Epic:** #54 — Unified Multi-Asset Client Architecture (HOA + non-HOA clients: SingleUnit + Portfolio)
**PRD:** `Agile/Sprints/Sprint_UC_PRD.md`
**Epic Document:** `Agile/Sprints/Sprint_UC_Epic_Document.md`

| Sprint | Issues | Focus | Est |
|--------|--------|-------|-----|
| UC-1 | #200, #204 | Data Model Alignment + Project Alignment | 4-6h |
| UC-2 | #201, #203 | Budget Engine Refactor + Validation Layer | 8-10h |
| UC-3 | #202, #205 | Reporting Engine Refactor + UI Updates | 8-10h |
| UC-4 | #206 | Regression Testing + Edge Case Hardening | 4-6h |

**Theme**: Extend SAMS from HOA-only to unified multi-client architecture. Support non-HOA clients (SingleUnit + Portfolio) and HOA clients (MTC/AVII) under one structural model. No client-type branching — all clients are structurally identical.
**Risk**: HIGH (modifies budget engine, BvA reporting, and adds HOA Dues feature-gating)
**Dependencies**: Should wait until Projects (PM-Finance), Polling enhancements, and Mobile/PWA are stable.
**Status**: Planned — roadmap position after Sprint D, PM-Finance, and Polling enhancements.

**Key Changes:**
- Budget model gains nullable `unitId` (dedicated + pool budgets)
- Categories gain `isBudgeted` boolean
- HOA Dues gated behind activities config (like WaterBills)
- UPC skipped for non-HOA clients (deposits are just deposits)
- BvA reporting gets 4 modes: Full Rollup, Unit-Specific, Shared-Only, Hybrid
- `clientType` expanded with `'Portfolio'`, `'SingleUnit'` for display only

---

### 🔐 Sprint PASSKEY-AUTH: Passkey-Only Authentication
*WebAuthn passkey authentication for all users — prerequisite for mobile app deployment*

| Task | Title | Priority | Est | Status |
|------|-------|----------|-----|--------|
| PK1 | Backend: WebAuthn endpoints + credential storage (SimpleWebAuthn) | high | 4h | ✅ DONE |
| PK2 | Frontend: Passkey login/registration UI (mobile + desktop) | high | 4h | ✅ DONE (PR #229) |
| PK3 | Admin: Passkey management, invite UI, password reset removal | high | 5h | ✅ DONE (PR #230) |
| PK4 | Testing & Stabilization: Cleanup, orphan removal, pre-PR checks | medium | 2h | ✅ DONE (PR #232) |

**Execution Order**: PK1 → PK2 → PK3 → PK4

**Theme**: Replace email/password authentication with passkey-only (WebAuthn) before enabling external users
**Issue**: #189
**Risk**: MEDIUM (modifies authentication — core security layer)
**Total Estimate**: ~15 hours (actual)
**Status**: ✅ **COMPLETE** — Merged to main (PR #233, March 10, 2026)
**Branch**: `feature/passkey-auth` (merged)

**Architecture**:
- SimpleWebAuthn (server + browser) for FIDO2/WebAuthn challenge/verification
- Firebase Admin `createCustomToken(uid)` → frontend `signInWithCustomToken()` for session
- Credentials stored at `/users/{uid}/passkeys/{credentialId}` in Firestore
- No password fallback — passkey is the sole authentication method
- Recovery: Admin revokes credentials → re-invites → user registers new passkey
- Admin bootstrap: existing admin registers passkey while authenticated with current email/password

**Key Decisions**:
- Email-first flow: user enters email → server sends challenge → biometric → session
- Discoverable credentials supported for returning users (browser passkey picker)
- `/users/{uid}` documents remain canonical — no structural changes to user model
- Firebase Auth users created on-demand via custom token (most users don't have Auth accounts yet)

---

### 📊 Sprint BUDGET-PROJ: Budget Projection Graphs (6-8 hours)
*Year-end projections and trend analysis for budget planning*

| Task/# | Title | Priority | Est |
|--------|-------|----------|-----|
| **165** | Budget Projection & Runway Graphs — year-end projection based on YTD actuals vs budget | medium | 4-5h |
| BP-1 | Trend analysis / variance forecasting | medium | 2-3h |

**Theme**: "Where we are" is ready; "where we'll likely end up" is currently manual  
**Risk**: Low (read-only visualization, no engine changes)  
**Dependencies**: After VOTING-ADV  
**Status**: Planned — roadmap position 20

---

### 📋 Sprint TASK-MGMT: Task Assignment & Tracking (16-24 hours)
*New module for scheduled and one-off maintenance tasks*

| Task | Title | Priority | Est |
|------|-------|----------|-----|
| TM-0 | PRD creation (no existing PRD) | high | 3-4h |
| TM-1 | Data model: tasks, assignments, schedules | high | 2-3h |
| TM-2 | Backend: task CRUD, assignment, completion, notifications | high | 4-6h |
| TM-3 | Mobile-first UI for maintenance workers | high | 4-6h |
| TM-4 | Admin UI for task creation and tracking | medium | 3-4h |
| TM-5 | Integration testing | medium | 2-3h |

**Theme**: Task assignment, communication, and completion tracking for maintenance workers  
**Risk**: MEDIUM (new module, requires PRD design phase)  
**Dependencies**: After BUDGET-PROJ  
**Status**: Planned — roadmap position 21  
**Serves**: Both HOA maintenance (meter readings, drain cleaning, pump maintenance) and property management (Karyn's houses/condos)

---

### 🔮 Sprint G: Future Features (Backlog)
*Larger features for future consideration*

| # | Title | Priority | Est |
|---|-------|----------|-----|
| **157** | In-App Bug Reporting → GitHub Issues | feature | 6-8h |
| **138** | Bulk Edit for Transactions | backlog | 4h |
| **148** | Water Bill Post-Payment Correction | backlog | 3h |
| **121** | Config Setting allowPartialPayments | backlog | 2h |
| **53** | Manual Account Adjustments | enhancement | 4h |
| **68** | Budget Entry Calculator | low | 2h |
| **176** | Budget Dashboard Card redesign | enhancement | 2h |
| **238** | iPad/tablet screen set | far-future | TBD |

**Theme**: New capabilities requiring design decisions  
**Risk**: Varies  
**Dependencies**: Requires planning before implementation  
**Note**: #238 (iPad/tablet) is far-future backlog — no current iPad users, but foldable phone trends may increase relevance over time  

---

### 🐛 Backlog: Low-Priority Bugs & Tech Debt
*Issues with manual workarounds or no user impact — address opportunistically*

| # | Title | Priority | Next Deadline | Notes |
|---|-------|----------|---------------|-------|
| **231** | Adding a new user role for a new client doesn't grant access | low | None | `propertyAccess` map not updated when assigning user to a second client. Manual workaround available via Firebase Console. Address in a future cleanup sprint. |
| **79** | HTTP 502 timeout on Email All completion | low | None | Cosmetic — emails send successfully, just shows error at end. Workaround: dismiss error. Fix: make endpoint return immediately, rely on polling. |
| **12** | Transaction Link Not Found modal needs formatting | low | None | Custom error modal needed instead of raw Node error. No functional impact. |
| **122** | Convert email to Gmail OAuth | low | None | App passwords still supported, no deprecation date. OAuth adds complexity without current benefit. #171 (Error Monitor) catches auth failures proactively. Revisit if Google announces deprecation. |
| **169** | Enhance or eliminate auditLog functionality | low | None | Decision needed: either build UI to use audit data or eliminate the writes. No current consumer. |
| **166** | Refactor email services to use shared reportEmailUtils | low | None | Tech debt cleanup. Multiple email services have inline implementations that should use shared utilities from Polling-1. |

**Theme**: Known issues that don't block operations  
**Status**: Deprioritized — only address if convenient or deadline approaches

---

### 💰 Sprint PM-Finance-Next: Project Financial Cycle
*Complete the billing, payment, and reporting pipeline for Special Assessments*

| Task | Title | Priority | Est | Status |
|------|-------|----------|-----|--------|
| PM5A | Allocation Engine v2 — per-bid allocations, ownership locking | medium | 3h | ✅ DONE |
| PM5B | Installment Schedule UI — milestone-based on bid revisions | medium | 3h | ✅ DONE |
| PM5C | Unit Assessments Grid — two-level display (summary + milestone) | medium | 3h | ✅ DONE |
| PM5D | Lock Amounts + Bill Milestone — lock amountCentavos at approval, billMilestone endpoint | medium | 4h | ✅ DONE |
| PM6 | Statement of Account Integration — project charges in SoA | high | 4h | ✅ DONE |
| PM8 | Vendor Payment CRUD + Project Financial Summary — atomic transaction pattern, reversal | high | 5h | ✅ DONE |
| PM7 | UPC Payment Integration — accept payments for project assessments | high | 5h | ✅ DONE |
| PM8B | BvA Special Assessments — populate COLLECTIONS + EXPENDITURES in Budget vs Actual | medium | 3h | ✅ DONE |
| PM8C | Project Lifecycle Data — status dates, life expectancy, BvA FY filtering | medium | 3h | ✅ DONE |
| PM5E | Adjustment Milestones — insert price change milestones for cost overruns/credits | low | 3h | ⏳ DEFERRED |
| PM9 | Stabilization & Regression — modal cleanup, code dedup, end-to-end regression | medium | 4h | ✅ DONE |

**Execution Order**: PM5A → PM5B → PM5C → PM5D → PM6 → PM8 → PM7 → PM8B → PM8C → PM5E → PM9

**Theme**: Complete the financial cycle for Special Projects  
**Risk**: HIGH (modifies UPC and Statement of Account — core engines)  
**Total Estimate**: ~38 hours  
**Status**: ✅ **COMPLETE** — All tasks done (PRs #215, #218, #219, #221, #224, #225, #226). PM5E deferred to future sprint.

**Key Architecture Decisions**:
- Bill subcollection at `clients/{clientId}/projects/{projectId}/bills/{milestoneIndex}` mirrors water bills pattern
- Milestone amounts locked (centavos) at project approval; percentages kept as metadata
- Billing is manual admin action (Bill button on Installment Schedule)
- Transaction metadata stores `projectId` and `milestoneIndex` for atomic reversal in `deleteTransaction`
- PM8B separated from PM8: BvA report population (PM8B) vs vendor tracking + financial summary (PM8)
- PM8 reordered before PM7: vendor payments are independent of UPC, establishes the atomic transaction pattern for project payments
- Vendor payments follow UPC batch pattern: `createTransaction` in batch mode + `project.vendorPayments[]` cross-reference + `deleteTransaction` reversal

**Requirements Document**: `Agile/sprints/SAMS_Special_Projects.md`  
**Implementation Plan**: `Agile/sprints/Sprint_PM_Implementation_Plan.md`  
**Task Assignments**: `Memory/Task_Assignments/PM-Finance-Next_Task_PM*`

---

## Completed Sprints Archive

### ⏸️ WA-BACKEND (WhatsApp webhook code) — merged, **not** end-to-end complete
*PR #253 merged March 19, 2026 — webhook GET/POST, Firestore logging, opt-out scaffolding in repo*

**Honest outcome**: Code merged; **Meta / WhatsApp Business setup blocked** (external). **Sprint WA paused** March 20, 2026 — see active **Sprint WA** section above. **WA-FRONTEND** (#178 remainder) and “wire to all communications modules” **deferred** until Meta unblocks.  
**Do not communicate** “WhatsApp is live” to stakeholders — only “webhook code exists.”  
**Archive**: `SAMS-Docs/apm_session/Memory/Archive/WhatsApp_Webhook_WA-BACKEND_2026-03-19/`

---

### 📊 Sprint Recon: Bank Reconciliation Tools ✅ COMPLETE
*Historical balance lookup for monthly account reconciliation*

| # | Title | Priority | Status |
|---|-------|----------|--------|
| **188** | Account balance on a given date — historical running balance view | enhancement | ✅ CLOSED |

**Theme**: Operational tooling — enables monthly bank reconciliation workflow  
**Status**: ✅ Sprint Complete (Feb 26, 2026)  
**PR**: #208 (merged to main)  
**Branch**: `feature/sprint-recon-historical-balance`  
**Deliverables**:
- Admin-only right-click historical lookup on Transactions status bar
- Refresh-before-lookup flow to reduce stale-balance risk
- As-of date historical reconstruction with metadata (`latestKnownTransactionDate`, rollback count)
- Bugbot follow-up fixes: tooltip gating parity, reverse/forward routing parity, stale-result clearing

**Archive**: `SAMS-Docs/apm_session/Memory/Archive/Sprint_Recon_Historical_Balance_2026-02-26/`

---

### 🐛 Sprint B3-Fix: Production Stabilization ✅ COMPLETE
*Restored production data integrity and access control before new features*

| # | Title | Priority | Status |
|---|-------|----------|--------|
| **191** | Error Getting Menu Items for Non-Admin users | P0 - Critical | ✅ CLOSED |
| **190** | Production Users out of Sync with Firebase Auth | P0 - Critical | ✅ CLOSED |
| **186** | Split transaction edit double-converts pesos to centavos | P1 - High | ✅ CLOSED |
| **187** | Bank fee checkbox ignored when manual split exists | P2 - Medium | ✅ CLOSED |
| **43** | Client Management tab returns 404 | P2 - Medium | ✅ CLOSED |

**Theme**: Bug fixes, data reconciliation, and permissions cleanup  
**Status**: ✅ Sprint Complete (Feb 21, 2026)  
**PR**: #192 (merged to main)  
**Branch**: `fix/sprint-b3-stabilization`  
**Deliverables**:
- Firestore/Storage security rules updated for `propertyAccess` with `clientAccess` backward compat
- `updateTransaction` allocation amount conversion added (pesos→centavos)
- Bank fee checkbox works with existing manual splits
- Client Management API path corrected
- Auth reconciliation script (`scripts/reconcile-auth-users.js`) — run in prod
- Edit User Global Role dropdown cleaned up (removed unitOwner/unitManager)
- Role case fix in reports.js and email.js (`'Admin'` → `'admin'`)

**Files Changed**: 9 files, +665/-130 lines  
**Commits**: 3 atomic commits  
**Quality Rating**: Tested in Dev (#43, #186, #187), verified in Prod (#190, #191)

---

### 🛡️ Sprint EM: System Error Monitor ✅ COMPLETE
*Centralized error capture and SuperAdmin dashboard alerts*

| # | Title | Priority | Status |
|---|-------|----------|--------|
| **171** | System Error Monitor — Dashboard Error Capture & Alert System | medium | ✅ CLOSED |

**Theme**: Operational monitoring — catch errors before they become problems  
**Status**: ✅ Sprint Complete + Deployed as v1.13.0 (Feb 16, 2026)  
**PR**: #185 (merged to main) + 3 post-merge fixes committed to main  
**Deliverables**:
- Enhanced `logError()` with fire-and-forget Firestore persistence
- RED Dashboard card (SuperAdmin) with StatusBar integration
- Frontend error capture: API interceptor, React ErrorBoundary, window handlers
- System Errors admin tab in Settings
- Email transporter health check at startup

**Files Changed**: 25 files, +1,376/-61 lines  
**Quality Rating**: ⭐⭐⭐⭐⭐  
**Archive**: `SAMS-Docs/apm_session/Memory/Archive/Sprint_EM_System_Error_Monitor_2026-02-16/`

---

### 💰 Sprint CX: Currency Conversion Discipline ✅ COMPLETE
*Enforce strict centavos/pesos conversion rules across entire codebase*

| # | Title | Priority | Status |
|---|-------|----------|--------|
| **181** | Enforce strict centavos/pesos conversion discipline | high | ✅ CLOSED |
| **180** | Bank fee uses centavos instead of pesos during edit | high | ✅ CLOSED |
| **179** | Transaction edit confirmation modal crash | medium | ✅ CLOSED |

**Theme**: Data integrity — eliminate all manual `* 100` and `/ 100` outside utility functions  
**Status**: ✅ Sprint Complete (Feb 15, 2026)  
**PR**: #183  
**Deliverables**:
- Fixed bank fee data corruption (100x inflation on amount and allocations)
- Fixed transaction edit confirmation modal crash (null file.type/size)
- Removed heuristic centavos detection (guessed unit by value magnitude)
- Removed 4 duplicate `centavosToPesos()` + 3 `roundCurrency()` definitions
- Replaced all manual `/100` and `*100` with shared utilities in production code
- `databaseFieldMappings.dollarsToCents/centsToDollars` now delegate to `currencyUtils`
- Added `roundCentavos()` and `roundPesos()` to shared utilities
- JSDoc annotations on `createTransaction`, `recordDuesPayment`, `createReconciliationAdjustments`
- Read-only verification script confirmed 1017/1017 Firestore amounts correct

**Files Changed**: 24 files, +464/-195 lines  
**Commits**: 6 atomic commits  
**Quality Rating**: ⭐⭐⭐⭐⭐

**Audit Report**: `SAMS-Docs/SAMS Guides/Centavos_Pesos_Audit_2026-02-14.md`

---

### 🏗️ Sprint F: Infrastructure & Tech Debt ✅ COMPLETE
*Code quality, architecture improvements, and dev tooling*

| # | Title | Priority | Status |
|---|-------|----------|--------|
| **124** | Year-End Centavos 100x bug | bug | ✅ CLOSED |
| **52** | Budget Dashboard Card no data | bug | ✅ CLOSED |
| **146** | Eliminate single-language statement path | cleanup | ✅ CLOSED |
| **63** | Upgrade firebase-admin v11→v13 | tech-debt | ✅ CLOSED |
| **155** | Local mobile testing via network | tech-debt | ✅ CLOSED |

**Theme**: Code quality, security, and maintainability  
**Status**: ✅ Sprint Complete (Feb 6, 2026)  
**PRs**: #172, #173, #174, #175, #177  
**Deliverables**:
- Year-end close centavos double-conversion fixed (before AVII June 2026 deadline)
- Budget Dashboard Card now shows real data with correct field mappings
- Statement generation always uses efficient dual-language path (-74 lines)
- firebase-admin upgraded from v11.11.1 to v13.6.1
- Mobile app testable from phone via local network (CORS + --host + env var)
- Dev restore script enhanced: purge before import, storage sync with delete
- Prod/Dev logo data corrected (cross-bucket reference issue identified and fixed)

**Additional work (not in original scope)**:
- #122 (Gmail OAuth) researched and deferred — no deprecation date
- #171 (System Error Monitor) issue created for future sprint
- #176 (Budget Card redesign) issue created for future sprint
- #168 (Middleware logging) closed — completed in prior sprint
- Restore script `restore-dev-from-prod.sh` improved with purge + storage sync
- Logo cross-bucket reference bug discovered and fixed in both Prod and Dev

---

### 🧹 Sprint Cleanup-1: UI Polish & Code Hygiene ✅ COMPLETE
*Visual consistency, reduced logging noise, no financial logic changes*

| # | Title | Priority | Status |
|---|-------|----------|--------|
| **160** | SAMS UI inconsistent layouts across modules | tech-debt | ✅ CLOSED |
| **167** | ListManagement table headers not consistently sticky | tech-debt | ✅ CLOSED |
| **97** | Confirmation Modal aesthetics | low | ✅ CLOSED |
| **84** | Dashboard backdrop scroll fix | tech-debt | ✅ CLOSED |
| **154** | Reduce chattiness (console.log cleanup) | tech-debt | ✅ CLOSED |
| **164** | Relocate Budget vs Actual report to Budgets tab | quick-win | ✅ CLOSED |
| **168** | Middleware logging noise (Priority 1) | perf | ✅ CLOSED |

**Theme**: UI consistency and code hygiene — preparing for bigger efforts  
**Status**: ✅ Sprint Complete (Feb 5, 2026)  
**Branch**: `feature/cleanup-1-ui-polish` → merged to `main` (PR #170)  
**Deliverables**:
- ActionBar positioning standardized across all 9 views (Transactions pattern)
- Sticky headers working consistently in all ListManagement tabs
- Confirmation Modal standardized to Sandyland theme
- Dashboard backdrop fixed (gradient stays while scrolling)
- Budget vs Actual button added to Budgets tab
- Centralized `logger.js` utility with LOG_LEVEL filtering
- 850+ console statements converted across 33 backend files
- Console output reduced from 100+ lines to <10 lines per operation
- Backend startup reduced to 2 clean lines (was 15+)
- CORS spam, Security Event spam, and duplicate logs eliminated

**Files Changed**: 59 files, +1,483/-1,278 lines  
**Commits**: 26 atomic commits  
**Quality Rating**: ⭐⭐⭐⭐⭐

**First Sprint Using Branch/PR Discipline**: Established new engineering workflow with feature branches, PRs, and merge-to-main process.

---

### 🗳️ Sprint Polling-1: Complete Voting System ✅ COMPLETE
*Backend + Admin UI + Email Link Voting — Full solution without mobile app*

| Task | Title | Priority | Status |
|------|-------|----------|--------|
| V1 | Backend: Poll CRUD, token generation, response handling | high | ✅ COMPLETE |
| V2 | Admin UI: Poll management in List Management, creation wizard | high | ✅ COMPLETE |
| V3 | Email Link Voting: Public voting page, token validation | high | ✅ COMPLETE |
| V4 | Integration: Dashboard card, Project/Budget linking | medium | ✅ COMPLETE |

**Theme**: Complete voting system with email link voting (no Firebase Auth for owners)  
**Status**: ✅ Sprint Complete (Feb 3, 2026)  
**Branch**: `feature/voting-and-polling` → merged to `main`  
**Commit**: `1df12e6`  
**Deliverables**:
- `polls` collection with `responses` subcollection
- Admin UI: List Management > Polls section, 4-step creation wizard
- Email link voting: Public page, token-based auth (no login required)
- Results calculation (simple + weighted by ownership %)
- Project linking with pre-populated poll context
- Dashboard status card
- Spanish translation support (DeepL integration)
- Bid comparison PDF generation for votes

**Files Created**: 15 new files (~4,000 lines)  
**Files Modified**: 10+ files (~2,900 lines)  
**Total Impact**: 46 files changed, 6,902 insertions, 170 deletions  
**Quality Rating**: ⭐⭐⭐⭐⭐

**Known Limitations** (Phase 2):
- Email notifications not yet implemented (token generation works)
- Scheduled auto-close not implemented (manual close only)
- Public voting page is English-only UI (content is bilingual)

**Design Document**: `Agile/sprints/Sprint_Polling_Design_Document.md`

---

### 📋 Sprint CL1: Changelog Feature ✅ COMPLETE
*User-facing changelog with deploy integration*

| # | Title | Priority | Status |
|---|-------|----------|--------|
| **158** | Add Changelog Feature to About Modal | medium | ✅ CLOSED (Jan 28) |

**Theme**: Visibility into recent changes for troubleshooting  
**Status**: ✅ Sprint Complete (Jan 28, 2026)  
**Deliverables**:
- ChangelogDisplay component in About modal with color-coded types
- Curated changelog.json with 556 entries from git history
- updateChangelogPending.js script for adding entries during reviews
- finalizeChangelog.js script for version stamping at deploy
- transformChangelog.js for regenerating from seed data
- Updated manager-review-enhanced command with changelog step
- deploySams.sh auto-finalizes pending changelog on version bump

**Files Created**: 5 new scripts, 1 component  
**Commit**: `8989fca`

---

### 🐛 Sprint B2: General Bug Fixes #1 ✅ COMPLETE
*Minor bugs affecting efficiency and UX*

| # | Title | Priority | Status |
|---|-------|----------|--------|
| **115** | Reconcile Accounts negating positive value | high | ✅ CLOSED (Jan 28) |
| **60** | MTC calling /water routes and failing | medium | ✅ CLOSED (Jan 28) |
| **156** | Standardize to new Display Date format | medium | ✅ CLOSED (Jan 28) |
| **108** | Add "maintenance" role to Create/Edit User | low | ✅ CLOSED (Jan 28) |

**Theme**: Minor bugs and UX improvements  
**Status**: ✅ Sprint Complete (Jan 28, 2026)  
**Deliverables**:
- Adjustment transactions preserve sign when editing
- Water service checks prevent API errors for non-water clients
- Date format standardized to dd-MMM-yy across all reports
- Maintenance role available in user management  
**Files Modified**: 14 files  
**Commit**: `137b8a0`

---

### 💧 Sprint W1: Water Bills Quarterly UI ✅ COMPLETE
*Complete the quarterly billing UI refactor for AVII*

| # | Title | Priority | Status |
|---|-------|----------|--------|
| **105** | Water Bills quarterly UI refactor (105B) | high | ✅ CLOSED (Jan 27) |

**Theme**: Complete quarterly billing UI for AVII client  
**Status**: ✅ Sprint Complete (Jan 27, 2026)  
**Deliverables**:
- Quarterly bills display in Water Bills tab table (not just minimal generator)
- Quarter selector (Q1-Q4) with table display
- Generate button integrated with table view
- History tab grid layout re-enabled for quarterly clients
- Monthly breakdown values display correctly in History grid
**Analysis Finding**: No structural mismatch existed — UI bypass was intentional from Task 105A  
**Files Modified**: `WaterBillsList.jsx`, `WaterHistoryGrid.jsx`  
**Quality Rating**: ⭐⭐⭐⭐⭐  
**Follow-up**: Additional UI polish may be needed (new enhancement issues TBD)

---

### 📎 Sprint U1: Document Upload for UPC ✅ COMPLETE
*Enable document attachment in UPC payment workflow*

| # | Title | Priority | Status |
|---|-------|----------|--------|
| **153** | Add document upload in UPC | high | ✅ CLOSED (Jan 24) |

**Theme**: Self-documenting Unit Deposits with documented transfers  
**Status**: ✅ Sprint Complete (Jan 24, 2026)  
**Deliverables**:
- Document upload UI in UPC modal
- Document upload before payment recording
- Backend integration for document storage
- Transaction edit fixes (type preservation, document preservation)
**Files Modified**: 9 files, ~274 lines added  
**Quality Rating**: ⭐⭐⭐⭐⭐

---

### 🔧 Sprint A: Quick Wins & UI Polish ✅ COMPLETE
*Low-risk, high-visibility improvements*

| # | Title | Priority | Status |
|---|-------|----------|--------|
| **152** | Transaction Log needs to show cents (centavos) | quick-win | ✅ CLOSED (Jan 20) |
| **145** | Clean up About modal for production | cleanup | ✅ CLOSED (Jan 20) |
| **134** | Hide inactive vendors from pulldowns | low | ✅ CLOSED (Jan 20) |
| **110** | Client Selector should show full client name | medium | ✅ CLOSED (Jan 20) |

**Theme**: Minor UI fixes that improve user experience  
**Status**: ✅ Sprint Complete (Jan 19, 2026)  
**Note**: Issue #52 moved to Sprint B (Critical Bug Fixes) as UI bug  

---

### 📊 Sprint C1: Water Consumption Report - Issue #129 ✅ COMPLETE
*Customer-facing report with Statement-quality formatting*

| # | Title | Priority | Est |
|---|-------|----------|-----|
| **129** | Water Consumption Report - Phase 1B: Single Unit Report | **HIGH** | 6-8h |

**Theme**: Transform validated script logic into customer-facing report  
**Risk**: Medium (must match Statement quality, handle edge cases)  
**Dependencies**: Data integrity resolved ✅  
**Deliverables**:
- Single unit report UI integration
- HTML format (matching Statement quality)
- PDF format (matching Statement quality)
- CSV export
- Email delivery option
- Monthly consumption with meter readings and dates
- Bilingual support (English/Spanish)

**Phase 2 (All Units)**: Deferred to next sprint  
**Phase 3 (Trend Analysis)**: Stretch goal

---

### 📊 Sprint C: Other Reports & Analytics ✅ COMPLETE
*Reporting enhancements and data visibility*

| # | Title | Priority | Status |
|---|-------|----------|--------|
| **94** | Export CSV/PDF for Filtered Transactions | medium | ✅ CLOSED (Jan 20) |
| **56** | Finish Credit Balance context menu | high | ✅ CLOSED (Jan 20) |
| **52** | Budget Dashboard Card no data | bug | → Moved to Sprint A |
| **129** | Phase 2: All Units Report | medium | 3-4h |
| **129** | Phase 3: Trend Analysis (stretch) | backlog | 2-3h |

**Theme**: Better visibility into financial and operational data  
**Status**: ✅ Sprint Complete (Jan 20, 2026)  
**Note**: Issue #52 moved to Sprint A (Quick Wins) as UI bug fix  

---

## Notes

1. **Sprint AUTO-STMT**: ✅ COMPLETE (Mar 19) - Automated monthly SoA generation: #249 — PR #250
12. **Production v1.19.1** (Mar 20, 2026): SoA **email** preamble fix #255 — PDF/data were always correct; email body had double-counted credit; now uses closing balance only.
13. **Sprint WA / WA-BACKEND**: ⏸️ PAUSED (Mar 20, 2026) — webhook code in main (PR #253); Meta/WhatsApp Business setup blocked externally (not a code defect); WA-FRONTEND deferred until unblock.
2. **Sprint EM**: ✅ COMPLETE (Feb 16) - System Error Monitor: #171 — PR #185
2. **Sprint CX**: ✅ COMPLETE (Feb 15) - Currency discipline: #181, #180, #179 — PR #183
2. **Sprint F**: ✅ COMPLETE (Feb 6) - Tech debt: #124, #52, #146, #63, #155 — PRs #172-#177
2. **Sprint Cleanup-1**: ✅ COMPLETE (Feb 5) - UI consistency + logging cleanup, 59 files changed, PR #170 merged
2. **Sprint Polling-1**: ✅ COMPLETE (Feb 3) - Complete voting system with email link voting merged to main
3. **Sprint CL1**: ✅ COMPLETE (Jan 28) - Issue #158 Changelog Feature merged to main
4. **Sprint B2**: ✅ COMPLETE (Jan 28) - Issues #115, #60, #156, #108 closed and merged
5. **Sprint W1**: ✅ COMPLETE (Jan 27) - Issue #105 Water Bills Quarterly UI closed and merged
6. **Sprint U1**: ✅ COMPLETE (Jan 24) - Issue #153 Document Upload for UPC merged to main
7. **Sprint A**: ✅ COMPLETE (Jan 19) - All 4 UI polish issues closed and merged
8. **Sprint C1**: ✅ COMPLETE (Jan 22) - Issue #129 Water Consumption Report merged to main
9. **Sprint C**: ✅ COMPLETE (Jan 20) - Issues #94 and #56 closed and merged
10. **Sprint PM (PM1-4)**: ✅ COMPLETE (Jan 29) - Projects CRUD, Bids, Documents merged to main
11. **Sprint B3**: ⏸️ DEPRIORITIZED (Feb 1) - Moved to Low-Priority Backlog; manual workarounds exist

---

## Key Context for Future Reviews

**System Usage**: SAMS is currently a single-user system (Michael only). Mobile app not yet deployed to unit owners. "Users" receive output (reports) only. Hotfixes = moving code from dev to prod for personal use, not user-impacting deployments.

**Sprint Prioritization Driver**: Real-world operational deadlines, not theoretical best practices. Accelerated features (like Projects) are driven by immediate data collection needs, not rushed timelines.

**Core Engine Caution**: UPC and Statement of Account are the two main engines. Any sprints touching these (PM-Finance, future billing features) should wait for stability periods.

---

## Document Maintenance

**Manager Agents**: Update this document when:
- Sprint status changes (started → completed)
- Issues are added, moved between sprints, or closed
- New sprints are created or reprioritized

**Sync with**: `Roadmap_and_Timeline.md` for sprint sequence

---

*Created: January 21, 2026*  
*Updated: April 11, 2026 — Sprint BUG-SWEEP-STABILIZATION active; Issue #272 ✅ complete and manager-reviewed. Sprint BANK-RECON remains complete (PR #268) with scheduler auth guard follow-up complete (PR #270). Next execution item: #271.*  
*Last Review: April 10, 2026*
