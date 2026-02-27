# Features and Enhancements Groupings
*What tasks and issues go together logically or are codependent.*

## Active Sprint Categories

### 🗳️ Sprint Polling-2+: Notifications, Automation & Committee Filters (6-8 hours)
*Email reminders, scheduled closing, and committee-based vote filtering*

| Task/# | Title | Priority | Est |
|--------|-------|----------|-----|
| N1 | Email notifications: Reminders at 1d/close | low | 2h |
| N2 | Scheduled close: Cloud Function to auto-close at deadline | low | 2h |
| N3 | WhatsApp integration hooks (when WhatsApp added) | backlog | 2h |
| **207** | Committee-based vote filtering (board, vigilance, budget committee) | medium | 4h |

**Theme**: Automation, notifications, and committee-scoped voting  
**Risk**: Low-Medium (#207 requires committee membership data model)  
**Dependencies**: Polling-1 complete  
**Status**: Planned — roadmap position after PM-Finance

**Note**: Mobile voting screens no longer needed — email links work on any device. #207 adds the ability to restrict polls to specific committees (Board, Vigilance, Budget) rather than all units.

---

### 📱 Sprint D: PWA/Mobile Enhancements (12-16 hours)
*Mobile app improvements*

| # | Title | Priority | Est |
|---|-------|----------|-----|
| **176** | Budget Dashboard Card redesign — live budget data for mobile | enhancement | 2h |
| NEW | Projects card — live project status data for mobile dashboard | enhancement | 2h |
| NEW | Vote Needed card — show open polls requiring user action on mobile dashboard | enhancement | 3h |
| **184** | Consolidate duplicate databaseFieldMappings.js and currencyUtils | tech-debt | 2h |
| **133** | PWA unit information dashboard | enhancement | 3h |
| **109** | PWA Mobile Install Flow (iOS + Android) | enhancement | 2h |
| **51** | PWA Balance Card expandable | enhancement | 1h |
| **47** | Refactor PWA Dashboard layout cards | medium | 2h |

**Theme**: Mobile experience improvements  
**Risk**: Medium (mobile-specific testing required)  
**Dependencies**: MOBILE-OWNER-V1 complete. #184 should be done before other mobile work (code cleanup prerequisite).  
**Note**: #132, #147, #193 closed in Sprint MOBILE-OWNER-V1. Budget card (#176), Projects card, and Vote Needed card carried forward from MOBILE-OWNER-V1 as future enhancements.  

---

### ⚙️ Sprint E: Admin & Settings (7-9 hours)
*System administration features*

| # | Title | Priority | Est |
|---|-------|----------|-----|
| **194** | Sort Users in List Management table by last name | low | 1h |
| **182** | Realignment of Settings, List Management and Admin activities | medium | 2h |
| **106** | Client-specific backup in Settings | medium | 2h |
| **102** | Admin client for non-client activities | low | 2h |
| **50** | Administration bulk operations | medium | 2h |
| **159** | HOA Dues Owner functionality | medium | 2h |

**Theme**: Administrative tools for system management  
**Risk**: Low  
**Dependencies**: None  

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

### 📱 Sprint WA: WhatsApp Business Notifications (6-8 hours)
*Payment confirmations, poll alerts, task reminders via WhatsApp Business Cloud API*

| # | Title | Priority | Est |
|---|-------|----------|-----|
| **178** | WhatsApp Business Notifications — Payment Reminders, Polls, Task Alerts | medium | 6-8h |

**Theme**: Communication channel — replaces digital receipts requirement with WhatsApp payment confirmations  
**Risk**: Medium (external dependency on Meta template approval)  
**Dependencies**: Meta/WhatsApp account setup complete (done outside SAMS in ChatGPT). No SAMS code yet.  
**Status**: Planned — deferred in favor of MOBILE-OWNER-V1

**Why WhatsApp**:
- Replaces the entire digital receipts feature requirement — payment confirmations sent via WhatsApp
- Supports Projects (bid notifications), Voting (poll alerts), and Payments (confirmation messages)
- Each integration point is production-driven: Projects needed data collection, Voting needed approval documentation, Payments next
- Meta app "SAMS Notifications" created, phone number available, templates designed — backend/frontend integration remaining

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

### 🔮 Sprint G: Future Features (Backlog)
*Larger features for future consideration*

| # | Title | Priority | Est |
|---|-------|----------|-----|
| **189** | Passkey-Only Authentication (Firebase Auth + WebAuthn) | feature | 8-12h |
| **157** | In-App Bug Reporting → GitHub Issues | feature | 6-8h |
| **138** | Bulk Edit for Transactions | backlog | 4h |
| **148** | Water Bill Post-Payment Correction | backlog | 3h |
| **121** | Config Setting allowPartialPayments | backlog | 2h |
| **96** | Dashboard Account Balances Card — deduct Credit Balances | enhancement | 2h |
| **53** | Manual Account Adjustments | enhancement | 4h |
| **68** | Budget Entry Calculator | low | 2h |
| **165** | Budget Projection & Runway Graphs | feature | 6-8h |
| **176** | Budget Dashboard Card redesign | enhancement | 2h |

**Theme**: New capabilities requiring design decisions  
**Risk**: Varies  
**Dependencies**: Requires planning before implementation  
**Note**: #189 (Passkey auth) supersedes #49 (Autologin/biometrics) — #49 closed and merged into #189. Passkeys provide native biometric UX. Firebase built-in support makes implementation straightforward when scheduled.  

---

### 🐛 Backlog: Low-Priority Bugs & Tech Debt
*Issues with manual workarounds or no user impact — address opportunistically*

| # | Title | Priority | Next Deadline | Notes |
|---|-------|----------|---------------|-------|
| **79** | HTTP 502 timeout on Email All completion | low | None | Cosmetic — emails send successfully, just shows error at end. Workaround: dismiss error. Fix: make endpoint return immediately, rely on polling. |
| **12** | Transaction Link Not Found modal needs formatting | low | None | Custom error modal needed instead of raw Node error. No functional impact. |
| **122** | Convert email to Gmail OAuth | low | None | App passwords still supported, no deprecation date. OAuth adds complexity without current benefit. #171 (Error Monitor) catches auth failures proactively. Revisit if Google announces deprecation. |
| **169** | Enhance or eliminate auditLog functionality | low | None | Decision needed: either build UI to use audit data or eliminate the writes. No current consumer. |
| **166** | Refactor email services to use shared reportEmailUtils | low | None | Tech debt cleanup. Multiple email services have inline implementations that should use shared utilities from Polling-1. |

**Theme**: Known issues that don't block operations  
**Status**: Deprioritized — only address if convenient or deadline approaches

---

### 💰 Sprint PM-Finance: Project Financial Integration (Deferred)
*UPC and Statement of Account integration for Special Assessments*

| Task | Title | Priority | Est |
|------|-------|----------|-----|
| PM5 | Assessment Allocation - Calculate unit shares from approved bid | medium | 3h |
| PM6 | Statement of Account Integration - Show assessments as billable items | medium | 4h |
| PM7 | UPC Payment Integration - Accept payments for project assessments | medium | 5h |

**Theme**: Complete the financial cycle for Special Projects  
**Risk**: HIGH (modifies UPC and Statement of Account - core engines)  
**Total Estimate**: ~12 hours  
**Status**: ⏸️ **DEFERRED** — Waiting for SoA/UPC to stabilize after Q1 start

**Deferral Rationale**:
- PM5-7 require modifications to UPC (transaction journal writes) and Statement of Account (billing/notification)
- These are SAMS core engines; changes should wait until Q1 baseline is stable
- Polling-1 and Polling-2 provide interim vote tracking without touching financials

**Review Trigger**: After Polling sprints complete and no SoA/UPC hotfixes for 2+ weeks

**Requirements Document**: `Agile/sprints/SAMS_Special_Projects.md`  
**Implementation Plan**: `Agile/sprints/Sprint_PM_Implementation_Plan.md`

---

## Completed Sprints Archive

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

1. **Sprint EM**: ✅ COMPLETE (Feb 16) - System Error Monitor: #171 — PR #185
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
*Updated: February 27, 2026 - Sprint MOBILE-OWNER-V1 (#132, #147, #193) ✅ COMPLETE. Future enhancements noted: Budget card (#176), Projects card, Vote Needed card. Sprint WA deferred. Sprint UC tracks Issue #54 expansion to non-HOA client types (SingleUnit + Portfolio) with child issues #200-#206.*  
*Last Review: February 27, 2026*
