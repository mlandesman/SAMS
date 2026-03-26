# SAMS Implementation Plan

**Version:** v1.19.1 | **Deployed:** March 20, 2026 (production)  
**Last Updated:** March 20, 2026 — Production **v1.19.1** (#255 SoA email fix). WhatsApp: PR #253 code merged; **Sprint WA paused** (Meta/WhatsApp Business blocked externally). Archive: `SAMS-Docs/apm_session/Memory/Archive/WhatsApp_Webhook_WA-BACKEND_2026-03-19/`  
**Product Owner:** Michael Landesman  
**Development:** Cursor APM Framework (AI Agents)

---

## Reference Documents

All planning and backlog management is maintained in the Agile documentation:

| Document | Purpose |
|----------|---------|
| [Project Overview](../SAMS-Docs/apm_session/Agile/Project_Overview.md) | Business context, features, user roles |
| [Project Understanding](../SAMS-Docs/apm_session/Agile/Project_Understanding.md) | Historical context, decision rationale |
| [Sprint Groups](../SAMS-Docs/apm_session/Agile/Sprint_Groups.md) | Detailed backlog with all issues by sprint |
| [Roadmap & Timeline](../SAMS-Docs/apm_session/Agile/Roadmap_and_Timeline.md) | Sprint sequence, deadlines, completion log |

**Production URL:** https://sams.sandyland.com.mx  
**Mobile PWA:** https://mobile.sams.sandyland.com.mx

---

## Current Sprint

*No active sprint — **pick next theme without Meta dependency** (e.g. DOC-LIB or Polling-2+). **WA-FRONTEND / #178 remainder deferred** until WhatsApp Business setup unblocks. See [Roadmap](../SAMS-Docs/apm_session/Agile/Roadmap_and_Timeline.md).*

---

## Last Completed (shipping)

**Hotfix: Statement of Account email preamble — #255** — deployed **v1.19.1**, March 20, 2026

**Problem**: SoA PDF and data were correct; the **HTML email body** double-counted credit (incorrect Balance Due in preamble).  
**Fix**: Single balance line from SoA closing balance — no duplicate credit subtraction.  
**Quality**: Targeted email-template / preamble logic only (low blast radius once identified).

---

## WhatsApp — honest status (not “last sprint complete”)

**PR #253** (merged March 19, 2026): Webhook GET/POST, HMAC, Firestore `whatsappWebhookEvents` / `whatsappMessages`, phone match + STOP → `notifications.sms` — **in codebase**.

**Operational**: **Meta / WhatsApp Business setup blocked** (external, ~2 days Mar 18–20) — PO paused work March 20, 2026. **Do not** tell stakeholders WhatsApp is live. **WA-FRONTEND** and module triggers remain future work after unblock.

**Archive** (merge-era log): `SAMS-Docs/apm_session/Memory/Archive/WhatsApp_Webhook_WA-BACKEND_2026-03-19/`  
**When resumed**: `WHATSAPP_APP_SECRET`, hosting rewrites, Meta webhook URL — after Business Manager / WABA path is clear.

---

## Recently Completed Sprints

**Sprint AUTO-STMT: Automated Monthly Statement Generation** — #249 ✅ COMPLETE (PR #250, merged March 19, 2026)

| Task | Title | Est | Actual | Status |
|------|-------|-----|--------|--------|
| STMT-1 | scheduledStatementService — orchestrate monthly generation | 2h | ~2h | ✅ COMPLETE |
| STMT-2 | bulkStatementController — deterministic IDs, overrides, dual-language | 2h | ~4h | ✅ COMPLETE |
| STMT-3 | clientAuth superAdmin fix + internalApiClient shared URL | 0.5h | ~0.5h | ✅ COMPLETE |
| STMT-4 | nightlyScheduler TASK 5 integration | 0.5h | ~0.5h | ✅ COMPLETE |
| STMT-5 | BugBot review cycles (6 issues fixed across 6 commits) | — | ~3h | ✅ COMPLETE |

**Estimated**: 4-6h | **Actual**: ~10h | **Quality**: ⭐⭐⭐⭐⭐ (10 commits, 10 BugBot review rounds, 0 open issues)

**Impact**: Automated monthly SoA generation. 40 PDFs (20 units × 2 languages) in 398s. Deterministic overwrites. Per-language error isolation. Deadline (Apr 1) met with margin.

---

**Sprint MOBILE-ADMIN-UX: Admin Mobile UX Refactor** — #247 ✅ COMPLETE (deployed v1.18.0, March 19, 2026)

**Estimated**: 20-27h | **Actual**: ~21h | **Quality**: ⭐⭐⭐⭐ (11 commits, 6 BugBot rounds)

**Impact**: Complete admin mobile experience. Field-ready dashboard, transaction review, UPC payment recording, budget detail. Reused shared hooks and patterns from MOBILE-OWNER-UX sprint.

---

**Sprint MOBILE-OWNER-UX: Mobile Owner UX Refactor** — #244 ✅ COMPLETE (PR #245, merged March 18, 2026)

**Estimated**: 18-24h | **Actual**: ~19h | **Quality**: ⭐⭐⭐⭐⭐

**Impact**: Complete owner/manager mobile experience. SoA as single source of truth via UnitStatementContext (skipHtml backend param). Self-service email/password. Shared hooks (usePriorMonthBalance, usePollsProjects, useHoaConfig). 43 files changed (+1,686/-413).

---

**Sprint 242: Separate Assessment vs Vendor Payment Milestones** — #242 ✅ COMPLETE (PR #243, approved March 14, 2026)

| Task | Title | Est | Actual | Status |
|------|-------|-----|--------|--------|
| 242-1 | Data model: assessmentSchedule[], lockMilestoneAmounts, billMilestone | 3-4h | ~3h | ✅ COMPLETE |
| 242-2 | Backend: billMilestone uses assessmentSchedule, recordVendorPayment milestoneIndex | 1h | ~1h | ✅ COMPLETE |
| 242-3A | Frontend: AssessmentCollectionDialog (No Assessment, Upfront, Split Phases) | 2-3h | ~2h | ✅ COMPLETE |
| 242-3B | Frontend: Dialog trigger on approval, remove noAssessmentRequired checkbox | 1h | ~1h | ✅ COMPLETE |
| 242-3C | Frontend: Rename Installment Schedule → Vendor Payment Milestones, Assessment Schedule | 1h | ~1h | ✅ COMPLETE |
| 242-3D | Frontend: Milestone selector, UnitAssessmentsTable assessmentSchedule support | 1h | ~1h | ✅ COMPLETE |
| 242-4 | Testing, BugBot fixes (vendor_N lookup, duplicate lock, payment fallback) | 1h | ~1h | ✅ COMPLETE |

**Estimated**: 8-10h | **Actual**: ~10h | **Quality**: ⭐⭐⭐⭐ (BugBot fixes: transaction delete, duplicate assessment lock, payment fallback doc ID chain)

**Impact**: Assessment milestones (unit billing) decoupled from vendor payment milestones (contractor execution). Assessment Collection Dialog pops on bid selection. Bill doc IDs: assessment_N, vendor_N, legacy N. Vendor status derived from vendorPayments. 16 files changed (+632/-128).

---

**Sprint NRM: Normalize Unit-User References** — #133 ✅ COMPLETE (PR #240, merged March 14, 2026)

| Task | Title | Est | Actual | Status |
|------|-------|-----|--------|--------|
| NRM1 | Data migration script — `owners[{name,email}]` → `owners[{userId}]` | 4h | 3h | ✅ COMPLETE |
| NRM2 | Backend API — resolve user data at query time from `users` collection | 4h | 3h | ✅ COMPLETE |
| NRM3 | Backend service consumers (11 files) + sync logic refactor (UID-only writes) | 6h | 4h | ✅ COMPLETE |
| NRM4 | Desktop frontend — `UnitFormModal` sends only `{userId}` | 4h | 1h | ✅ COMPLETE |
| NRM5 | Mobile frontend — `UnitReport` tappable phone links, `unitContactUtils` | 3h | 1h | ✅ COMPLETE |
| NRM6 | Transition verification — pre-PR checks, both builds, full diff review | 4h | 1h | ✅ COMPLETE |
| NRM7 | Mobile PWA Unit Directory — admin contact list with phone/email | 3h | 2h | ✅ COMPLETE |

**Estimated**: 28h | **Actual**: ~15h | **Quality**: ⭐⭐⭐⭐⭐ (4 BugBot rounds, 0 regressions, manual testing confirmed)

**Impact**: Single source of truth for user data. Eliminated `updateUserNameInUnits` sync function. 17 files changed (+665/-331). Phone numbers now accessible across all unit displays.

---

## Recently Completed

### Sprint D: PWA/Mobile Enhancements ✅ COMPLETE
**Completed:** March 12, 2026  
**Duration:** March 10–12, 2026  

| Task | Title | Status |
|------|-------|--------|
| D1 | #184: Consolidate duplicate databaseFieldMappings.js and currencyUtils | ✅ COMPLETE (PR #236) |
| D2 | #109: PWA Mobile Install Flow (iOS + Android) | ✅ COMPLETE (PR #237) |
| D3 | #133: PWA Unit Information Dashboard | ❌ CANCELLED → Sprint NRM |
| D4+ | #176, Projects card, Vote Needed card | Deprioritized → Sprint G |

**Note**: D3 investigation revealed unit documents store denormalized owner/manager data (name/email copies instead of UID references). Converted #133 to tech debt sprint (NRM) with significantly expanded scope covering backend, desktop, and mobile refactoring + data migration.

---

### Sprint PASSKEY-AUTH: Passkey Authentication ✅ COMPLETE
**Completed:** March 10, 2026  
**Duration:** March 9–10, 2026 (2 days)  
**PR:** #233 (merged to main) — includes task PRs #228, #229, #230, #232  
**Issue:** #189  
**Quality Rating:** ⭐⭐⭐⭐⭐

**Deliverables:**
- Backend WebAuthn endpoints with SimpleWebAuthn — registration, authentication, invite generation (PK1)
- Credential storage at `/users/{uid}/passkeys/{credentialId}` with index at `/system/webauthn/credentials`
- Firebase Custom Token minting for passkey-based session establishment
- Passkey-first login UI on desktop and mobile — primary "Sign in with Passkey", secondary "Use password instead" (PK2)
- Post-password-login passkey registration prompt ("Register" / "Maybe later")
- Invite-based registration flow via `/invite/:token` route (PK2)
- Admin passkey management — list, revoke, send invite from Edit User modal (PK3)
- Passkey-first user creation — "Passkey Invitation" default method in Create User modal (PK3)
- Passkey invite emails with Sandyland branding sent automatically on invite generation
- Removed password reset flow from login forms — replaced with "Contact your administrator" (PK3)
- Removed orphaned PasswordSetupView and dead Email Invitation code path (PK4)
- Security: removed auth token display from About Modal (PK4)
- Multi-origin WebAuthn config for desktop + mobile dev servers (PK3)
- Mobile PWA passkey support with Vite proxy infrastructure for ngrok testing (PK3)

**Architecture:**
- SimpleWebAuthn (server v11 + browser v11) for FIDO2/WebAuthn
- Email-first flow with discoverable credential support for returning users
- Firebase `signInWithCustomToken()` bridges WebAuthn → Firebase Auth session
- Recovery: admin revokes credentials → re-invites → user registers new passkey

### Sprint PM-Finance-Next: Special Projects Financial Module ✅ COMPLETE
**Completed:** March 9, 2026  
**Duration:** March 2–9, 2026 (8 days)  
**PRs:** #215, #218, #219, #221, #224, #225, #226  
**Quality Rating:** ⭐⭐⭐⭐⭐

**Deliverables:**
- Allocation Engine v2 with per-bid allocations and ownership locking (PM5A)
- Installment Schedule UI with milestone-based payment schedules (PM5B)
- Unit Assessments Grid with two-level display (PM5C)
- Locked milestone amounts + billMilestone endpoint (PM5D)
- Statement of Account integration for project charges/payments (PM6)
- UPC payment integration — full, partial, and mixed payments (PM7)
- Vendor Payment CRUD with atomic transaction pattern (PM8)
- BvA "Special Assessments" with per-project collections and expenditures (PM8B)
- Project lifecycle tracking: statusHistory, approvedAt, completedAt, lifeExpectancy (PM8C)
- Feature flag gating: `projectPaymentsInUPC` gates UPC writes, SoA reads, BvA reads (PM8B/PM8C)
- Sandyland modal cleanup + `buildStatusLifecycleUpdates()` code dedup (PM9)

**Deferred:** PM5E (Adjustment Milestones) — low priority, future sprint  
**Archive:** `SAMS-Docs/apm_session/Memory/Archive/PM-Finance-Next_Sprint_2026-03-09/`

### Sprint MOBILE-OWNER-V1: Mobile Owner PWA ✅ COMPLETE
**Completed:** February 27, 2026  
**Branch:** `feature/mobile-owner-v1` (18 commits)  
**Issues:** #132, #147, #193  
**Quality Rating:** ⭐⭐⭐⭐⭐

**Deliverables:**
- Hamburger menu with role-based navigation, unit selector in drawer, unitId chip in AppBar
- Original card-grid Dashboard restored with live linkages (Balance→Transactions, HOA Dues→Current Status, My Account→Statement, Payment Due→Current Status)
- Payment Due card: unit-specific amountDue (not HOA aggregate), dollar amount prominent
- Balance card: Bank + Cash rows
- Exchange Rate card: date on subtitle to prevent wrapping
- Current Status tab (renamed from SoA): unit summary, YTD, payment calendar, unit-specific fiscal year transactions
- Transactions tab: all fiscal year transactions from /transactions endpoint with date/vendor/amount, tap-to-expand details
- Statement of Account tab: stored PDF browser (Firestore metadata, deduplicated by year/month/language) + on-demand generation with English/Spanish toggle
- Centavos-to-pesos fix, date object formatting, timezone compliance (zero new Date() calls)
- propertyAccess fallback in SelectedUnitContext and RoleProtectedRoute

**Future Enhancements** (carry to Sprint D):
- Budget card: live budget data (#176)
- Projects card: live project status data
- Vote Needed card: open polls requiring user action

### Sprint Recon: Historical Balance Lookup ✅ COMPLETE
**Completed:** February 26, 2026  
**PR:** #208 (merged to main) + #209 (BugBot follow-up)  
**Issue:** #188 — Historical balance lookup via Status Bar right-click  
**Quality Rating:** ⭐⭐⭐⭐⭐

**Deliverables:** Admin-only right-click historical lookup in Transactions status bar, pre-lookup refresh flow to mitigate stale-balance risk, `asOfDate` support in balances endpoint with rollback metadata, and follow-up fixes for next-payment amount/date logic in statement dashboard summary.  
**Archive:** `SAMS-Docs/apm_session/Memory/Archive/Sprint_Recon_Historical_Balance_2026-02-26/`

---

### Sprint B4: User-Level UI Fix + Stretch ✅ COMPLETE
**Completed:** February 24–25, 2026  
**PR:** #199 (merged to main)  
**Issue:** #195 — Desktop UI for non-admin users  
**Quality Rating:** ⭐⭐⭐⭐⭐

**Core:** Unit selector with multi-unit dropdown, Transactions/HOA Dues/Budgets view-only for non-admin, Reports unit filter, CRUD gating, balance bar recalc hidden for non-admin. Backend middleware updated for unitOwner/unitManager permissions. System error lookup tools added.  
**Stretch:** Unit Account Status dashboard card (SoA-backed balance, dues-based next payment, owner names in title bar). Lightweight `dashboard-summary` endpoint. Reusable `useUnitAccountStatus` hook for Sprint D mobile PWA. DateService compliance and UTC fix.  
**BugBot fixes:** Client-level admin detection using `userRoles.isAdmin()`, unitId fallback in authorized units extraction.  
**Archive:** `SAMS-Docs/apm_session/Memory/Archive/Sprint_B4_User_Level_UI_2026-02-24/`

---

### Sprint B3-Fix: Production Stabilization ✅ COMPLETE
**Completed:** February 21, 2026  
**PR:** #192 (merged to main)  
**Issues:** #191 CLOSED, #190 CLOSED, #186 CLOSED, #187 CLOSED, #43 CLOSED

9 files changed, +665/-130 lines. Fixed Firestore/Storage security rules (`clientAccess` → `propertyAccess`). Fixed `updateTransaction` missing allocation centavos conversion. Bank fee checkbox now works with manual splits. Client Management API path corrected. Auth reconciliation script created and run in prod. Edit User Global Role dropdown cleaned up. Role case fix (`'Admin'` → `'admin'`) in reports and email routes.

---

### Sprint EM: System Error Monitor ✅ COMPLETE
**Completed:** February 16, 2026  
**PR:** #185 (merged to main)  
**Issue:** #171 CLOSED  
**Quality:** ⭐⭐⭐⭐⭐

25 files changed, +1,376/-61 lines. 4 tasks across backend/frontend. Enhanced `logError()` with fire-and-forget Firestore persistence. RED Dashboard card (SuperAdmin) with StatusBar integration. Frontend error capture (API interceptor, ErrorBoundary, window handlers). Schema enrichment (version, environment, userAgent, url). System Errors admin tab in Settings. Email health check at startup. Batch-safe acknowledge (500-write chunking).

**Post-Merge Deployment Fixes** (committed directly to main after PR #185):
- Eliminated duplicate `shared/logger.js` — root copy deleted, `functions/shared/logger.js` is now single source of truth, predeploy `cp` removed from `firebase.json`
- Migrated API routes from `/api/system` to `/error-reporting` domain route — `/api/` prefix had no Firebase Hosting rewrite, causing HTML returns in production
- Added exact-match + wildcard rewrites in `firebase.json` for both desktop and mobile hosting targets
- Created `Firebase_Hosting_Route_Requirements.md` engineering guide to prevent recurrence
- **Lesson Learned**: Dev environment bypasses Firebase Hosting rewrites entirely. New routes MUST be added to `firebase.json` or they silently fail in production.

**Archive:** `SAMS-Docs/apm_session/Memory/Archive/Sprint_EM_System_Error_Monitor_2026-02-16/`

---

### Sprint CX: Currency Conversion Discipline ✅ COMPLETE
**Completed:** February 15, 2026  
**PR:** #183 (merged to main)  
**Issues:** #181 CLOSED, #180 CLOSED, #179 CLOSED  
**Quality:** ⭐⭐⭐⭐⭐

24 files changed, +464/-195 lines. Eliminated all systemic centavos/pesos conversion bugs. Fixed bank fee data corruption (#180), modal crash (#179), heuristic detection. Standardized all conversions to shared utilities. Added roundPesos/roundCentavos, JSDoc annotations, verification script.

**Archive:** `SAMS-Docs/apm_session/Memory/Archive/Sprint_CX_Currency_Discipline_2026-02-15/`

---

### Sprint F: Infrastructure & Tech Debt ✅ COMPLETE
**Completed:** February 6, 2026  
**PRs:** #172, #173, #174, #175, #177  
**Quality:** ⭐⭐⭐⭐

| # | Title | Status |
|---|-------|--------|
| **124** | Year-End Centavos 100x bug | ✅ CLOSED |
| **52** | Budget Dashboard Card no data | ✅ CLOSED |
| **146** | Eliminate single-language statement path | ✅ CLOSED |
| **63** | Upgrade firebase-admin v11→v13 | ✅ CLOSED |
| **155** | Local mobile testing via network | ✅ CLOSED |

**Additional outcomes:**
- #122 Gmail OAuth researched and deferred (no deprecation date)
- #171 System Error Monitor issue created
- #176 Budget Card redesign issue created
- Restore script enhanced with purge + storage sync
- Prod/Dev logo cross-bucket reference bug discovered and fixed

---

### Sprint Cleanup-1: UI Polish & Code Hygiene ✅ COMPLETE
**Completed:** February 5, 2026  
**Duration:** ~8 hours (as estimated)  
**Branch:** `feature/cleanup-1-ui-polish` → merged to `main` (PR #170)  
**Commits:** 26 atomic commits  
**Files Changed:** 59 files, +1,483/-1,278 lines  
**Quality:** ⭐⭐⭐⭐⭐

**Deliverables:**

| # | Title | Status |
|---|-------|--------|
| **160** | SAMS UI inconsistent layouts across modules | ✅ CLOSED |
| **167** | ListManagement table headers not consistently sticky | ✅ CLOSED |
| **97** | Confirmation Modal aesthetics | ✅ CLOSED |
| **84** | Dashboard backdrop scroll fix | ✅ CLOSED |
| **154** | Reduce chattiness (console.log cleanup) | ✅ CLOSED |
| **164** | Relocate Budget vs Actual report to Budgets tab | ✅ CLOSED |
| **168** | Middleware logging noise (Priority 1) | ✅ CLOSED |

**Key Achievements:**
- ActionBar positioning standardized across all 9 views (Transactions pattern)
- Centralized `logger.js` utility with LOG_LEVEL filtering
- 850+ console statements converted across 33 backend files
- Console output reduced from 100+ lines to <10 lines per operation
- Backend startup reduced to 2 clean lines (was 15+)
- First sprint using new branch/PR discipline

---

### Sprint Polling-1: Complete Voting System ✅ COMPLETE
**Completed:** February 3, 2026  
**Duration:** ~8-10 hours (as estimated)  
**Branch:** `feature/voting-and-polling` → merged to `main`  
**Commit:** `1df12e6`  
**Quality:** ⭐⭐⭐⭐⭐

**Deliverables:**

**Backend (V1):**
- `pollsController.js` (1,237 lines) — Full poll CRUD, response handling, token generation, results calculation
- `voteRoutes.js` — Public voting endpoints + authenticated admin endpoints
- `voteTokenUtils.js` — HMAC-signed token generation and validation
- `bidComparisonHtmlService.js` — Bid comparison PDF generation (bilingual)
- `pollNotificationTemplate.js` — Email notification templates
- `reportEmailUtils.js` — Email sending utilities

**Admin UI (V2):**
- `PollCreationWizard.jsx` (618 lines) — 4-step creation wizard with Translate button
- `PollDetailView.jsx` (377 lines) — Poll details, progress tracking, results visualization
- `ResponseEntryModal.jsx` (195 lines) — Admin vote entry for verbal/proxy votes
- `PollsList.jsx` — List Management integration

**Email Link Voting (V3):**
- `PublicVotingPage.jsx` (282 lines) — Public voting page, no auth required, mobile-responsive

**Integration (V4):**
- Dashboard polls card with active poll status
- Projects view with "Create Vote" button and PDF generation
- Budget view with budget approval voting
- Pre-population of poll context from projects (title, description, translations)

**Technical Stats:**
- 46 files changed
- 6,902 insertions, 170 deletions
- 15 new files created

**Known Limitations (Phase 2):**
- Email sending not yet implemented (token generation works, Dev bypass in use)
- Scheduled auto-close not implemented (manual close only)
- Public voting page is English-only UI (content is bilingual)

---

### Sprint PM: Project Management & Special Assessments ✅ PHASES 1-4 COMPLETE
**Completed:** January 29, 2026  
**Branch:** `sprint/PM-projects-module` (merged)

- **PM1-PM4:** Projects CRUD, Bids Management, Document Attachments — all complete
- **PM5-PM7:** Assessment Allocation, SoA Integration, UPC Integration — DEFERRED (waiting for SoA/UPC stability)

**Commits:** `99585de` (PM1+PM2), `166cd39` (fixes), `71d86f1` (PM3), `b641ac7` (PM4)

---

### Hotfix: Q1 Water Bills Data Correction ✅ COMPLETE
**Completed:** January 31, 2026  
**Issue:** #161 — Water bills showing incorrect amounts on Statement of Accounts  
**Duration:** ~3 hours (debugging + data fixes)  
**Type:** Data fix only (no code deployment)

**Root Cause:**
- `hasWaterBillsProject` check was using wrong data source (code fix deployed in v1.11.1)
- Q1 2026 water bills had incorrect `currentCharge`, `status`, `paidAmount`, and `payments[]` data
- Dynamic penalty recalculation was producing $188.86 instead of $5,388.86 for unit 203

**Scripts Created:**
- `fix-q1-currentCharge.js` — Set status='paid' and currentCharge=0 for all Q1 units
- `fix-q1-paidAmount.js` — Corrected paidAmount for units 101, 104
- `fix-q1-payments-array.js` — Added reconciliation payments to payments[] array

**Verification:**
- Statement of Accounts shows correct water bill amounts
- Water Consumption Reports show Q1 as PAID for all applicable units
- Bills view correctly displays payment status

---

### Sprint CL1: Changelog Feature ✅ COMPLETE
**Completed:** January 28, 2026  
**Issue:** #158 — Add Changelog Feature to About Modal  
**Duration:** ~4 hours (vs 3-4h estimated)  
**Quality:** ⭐⭐⭐⭐⭐

**Deliverables:**
- ChangelogDisplay component in About modal with color-coded types
- Curated changelog.json with 556 entries from git history
- updateChangelogPending.js script for adding entries during reviews
- finalizeChangelog.js script for version stamping at deploy
- transformChangelog.js for regenerating from seed data
- Updated manager-review-enhanced command with changelog step
- deploySams.sh auto-finalizes pending changelog on version bump

**Files:** 5 scripts, 1 component, 2 config files  
**Commit:** `8989fca`

---

### Sprint B2: General Bug Fixes #1 ✅ COMPLETE
**Completed:** January 28, 2026  
**Issues:** #115, #60, #156, #108  
**Duration:** ~3 hours (vs 4-5h estimated)  
**Quality:** ⭐⭐⭐⭐⭐

**Deliverables:**
- Adjustment transactions preserve sign when editing (#115)
- Water service checks prevent API errors for non-water clients (#60)
- Date format standardized to dd-MMM-yy across all reports (#156)
- Maintenance role available in user management (#108)

**Files:** 14 files  
**Commit:** `137b8a0`

---

### Sprint W1: Water Bills Quarterly UI ✅ COMPLETE
**Completed:** January 27, 2026  
**Issue:** #105 — Water Bills quarterly refactor (105B)  
**Duration:** ~3 hours (vs 4-6h estimated)  
**Quality:** ⭐⭐⭐⭐⭐

**Deliverables:**
- Quarterly bills display in Water Bills tab table
- Quarter selector with table display
- Generate button integrated with table view
- History tab grid layout re-enabled for quarterly
- Common Area & Building Meter columns populated

**Key Finding:** No structural mismatch existed — UI bypass was intentional from Task 105A  
**Files:** `WaterBillsList.jsx`, `WaterHistoryGrid.jsx`  
**Commits:** `1693990`, `403bc45`

---

### Sprint U1: Document Upload for UPC ✅ COMPLETE
**Completed:** January 24, 2026  
**Issue:** #153 — Add document upload in UPC  
**Duration:** ~4-5 hours  
**Quality:** ⭐⭐⭐⭐⭐

**Deliverables:**
- Document upload UI in UPC modal
- Document upload before payment recording
- Backend integration for document storage
- Transaction edit fixes (type preservation, document preservation)

**Files:** 9 files, ~274 lines added  
**Commit:** `b53d843`

---

## Known Blockers

No active blockers.

---

## Tech Debt (Future Sprints)

| Item | Notes |
|------|-------|
| **Unit owner/manager denormalization** | ✅ RESOLVED — Sprint NRM (#133, PR #240, March 14, 2026). Unit documents now store `{userId}` references. All services resolve user data at query time. |
| **Digital Receipts** | ✅ OPERATIONAL (March 18, 2026). Send Receipt button re-enabled (was broken by `.unit` vs `.unitId` field name mismatch). Client name resolved from `basicInfo`. Allocations array used for "For" field. Receipt layout no longer clips footer. Full flow: select transaction → Send Receipt → preview modal → email with image attachment. |
| **Dashboard content cache** | Lightweight `dashboard-summary` endpoint exists; consider adding a cache layer for Dashboard content in a future sprint to improve load time. |

---

## Hard Deadlines

| Deadline | Issue | Description |
|----------|-------|-------------|
| ~~**March 15, 2026**~~ | ~~#105~~ | ~~Water Bills quarterly display~~ ✅ COMPLETE |
| **June 2026** | #124 | Year-End centavos bug (AVII year-end) |

---

## Manager Agent Instructions

When closing Tasks or Sprints, update these documents:

1. **Sprint_Groups.md** — Move completed issues to "Completed Sprints Archive"
2. **Roadmap_and_Timeline.md** — Update "Current Sprint", "Sprint Completion Log"
3. **This file** — Update "Current Sprint" section with next sprint details

Always update `Last Updated` timestamps when modifying documents.

---

## Historical Record

Completed work through v1.8.0 is documented in:
- `SAMS-Docs/COMPLETED_WORK_ARCHIVE_v0.3.0.md` (early milestones)
- Previous Implementation_Plan.md snapshots in `.apm/` directory
- GitHub closed issues: https://github.com/mlandesman/SAMS/issues?q=is%3Aclosed

---

*This document was restructured on January 24, 2026 to align with the new Agile framework. Historical milestone details have been archived.*
