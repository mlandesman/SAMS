# SAMS (Sandyland Association Management System) – Implementation Plan

**Memory Strategy:** dynamic-md
**Last Modification:** Manager Agent 15 - Year-End Blockers (December 21, 2025)
**Current Version:** v1.1.9 (in progress) - Year-End Report Fixes
**Product Manager:** Michael  
**Development Team:** Cursor APM Framework  
**Project Overview:** SAMS is a production-ready multi-tenant association management system. Current focus: Year-End 2025 processing for MTC, then continued PWA/Mobile work.

**Production URL:** https://sams.sandyland.com.mx  
**Archive Reference:** Completed work through v0.3.0 is documented in `SAMS-Docs/COMPLETED_WORK_ARCHIVE_v0.3.0.md`

---

## 🏆 RECENT MILESTONES

### v1.1.9 - Year-End Report Fixes (December 21, 2025)
**STATUS:** 🔄 IN PROGRESS - Critical blockers for year-end processing

#### GitHub Issues #80-84 Pre-Year-End Fixes
Discovered 5 issues blocking year-end 2025 statement distribution and 2026 budget presentation:

**Critical Blockers (Must Fix Before Year-End):**
- 🔴 **#81** - Budget vs Actual Report broken (`reportCommonCss` missing) - BLOCKS board package
- 🔴 **#80** - Statement of Account showing duplicate project payments - BLOCKS owner statements
- 🔴 **#82** - Budget Report missing notes column - BLOCKS 2026 budget presentation
- 🔴 **#83** - Budget tools showing one-time project categories - CLUTTERS 2026 budget presentation

**Deferred:**
- 🔵 **#84** - Dashboard background scrolling (cosmetic, post-year-end)

#### Task Assignments Created
- ✅ **Task BUG-001** - Report Functionality (Issues #81, #80) - 2-3 hours estimated
- ✅ **Task BUG-002** - Budget Presentation Polish (Issues #82, #83) - 3-4 hours estimated

**Total Effort:** 5-7 hours (1 working day)  
**Deadline:** December 21, 2025 EOD  
**Blocking:** Final 2025 statements, 2026 budget board presentation, Year-End #78 processing

**Task Assignment Files:**
- `SAMS-Docs/apm_session/Memory/Task_Assignments/Task_BUG-001_Report_Functionality_2025-12-21.md`
- `SAMS-Docs/apm_session/Memory/Task_Assignments/Task_BUG-002_Budget_Presentation_2025-12-21.md`

---

### v1.1.8 - Unified Payment System Overhaul + Email All (December 18-20, 2025)
**MAJOR MILESTONE - 72 hours of intensive development**

#### Enhancement #74: Allow Partial Payments at Any Level
- ✅ **Getter Functions Architecture** - Eliminated stale derived fields by calculating on demand
- ✅ **Credit Balance Reconciliation** - Rebuilt credit history with `amount` (delta) instead of `adjustedBalanceMxn`
- ✅ **Statement of Account Redesign** - New summary footer showing Balance Due / Less Credit / Net Amount Due
- ✅ **Penalty Waiver Feature** - Right-click waiver in Payment Modal, recorded in transaction notes
- ✅ **CSV Export Fix** - Credit summary now included in Statement CSV exports

**Commits:** `58d0510` through `2b8bee4` (15+ commits)
**Issues Resolved:** #72 (UI Cache), #71 (App Icon), #74 (Partial Payments)
**Quality:** ⭐⭐⭐⭐⭐

#### Bulk Operations & Email All
- ✅ **Generate All Progress Polling** - Switched from streaming to Firestore-based polling (Firebase buffers streams)
- ✅ **Email All Button** - Same UX pattern as Generate All (Email → Email All when no unit selected)
- ✅ **Public PDF URLs** - All generated statements now publicly accessible via `makePublic()`
- ✅ **Gmail Secret Configuration** - Proper Firebase Functions v2 secrets declaration

**Backend:**
- `POST /admin/bulk-statements/generate` - Bulk PDF generation with progress
- `GET /admin/bulk-statements/progress/:clientId` - Progress polling
- `POST /admin/bulk-statements/email` - Bulk email sending
- `GET /admin/bulk-statements/email/progress/:clientId` - Email progress polling
- Progress stored in Firestore: `clients/{clientId}/bulkProgress/{statements|emails}`

**Frontend:**
- Email/Email All button toggle based on unit selection
- Progress display with sent/skipped/failed counts
- Results summary showing units without email addresses

#### Infrastructure Fixes
- ✅ **Service Worker Cache Fix** - API paths were being cached as static assets (#72)
- ✅ **Firestore Persistence Disabled** - Prevents stale data on transaction CRUD
- ✅ **App Icon Added** - SLP_Icon.png for PWA/home screen (#71)
- ✅ **Public URLs (No signBlob)** - Removed getSignedUrl() dependency to avoid IAM permission issues

**Files Modified:** 20+ files across backend and frontend
**User Feedback:** "This has been a momentous day."

---

### v1.0.2 - Budget Report & Reusable Report Infrastructure (December 17, 2025)
- ✅ **Reusable Report Components** - Created shared infrastructure for all future reports
- ✅ **Budget Report** - Year-over-year comparison with 4 columns (Prior/Current/Change/%)
- ✅ **Automatic Year Detection** - Finds highest available budget year
- ✅ **Enhanced Zoom** - Page Width and Single Page zoom options
- ✅ **PDF Export** - Via PDFShift integration
- ✅ **Bilingual Support** - EN/ES

**Commits:** `92f9651`, `c3afffc`  
**Quality:** ⭐⭐⭐⭐⭐  
**User Feedback:** "This looks awesome. I have printed my budget for review."  
**Archive:** `SAMS-Docs/apm_session/Memory/Archive/Budget_Report_Reusable_Components_2025-12-17/`

**Shared Components Created:**
- `ReportPreviewContainer.jsx` - Reusable HTML preview with zoom, loading, error states
- `ReportControlBar.jsx` - Reusable button bar (Generate, CSV, PDF, Email)
- `ReportCommon.css` - Shared styles for consistent report UI

**Files:** 7 created, 4 modified, ~1,815 lines added


### v1.0.0 - Production Deployment & Unit Contact Structure Update (December 16, 2025)
- ✅ **Production Deployment** - v1.0.0 successfully deployed to production
- ✅ **Unit Contact Structure Update** - All code paths updated for `[{name, email}]` format (Issue #65)
- ✅ **Backward Compatibility** - Full support for both old `["name"]` and new `[{name, email}]` formats
- ✅ **Utility Functions** - Created 4 utility files for maintainability
- ✅ **Comprehensive Coverage** - Updated 34 files across backend, frontend, and mobile/PWA

**Issue Resolved:** #65 - Unit contact structure code updates  
**Branch:** `fix/unit-contact-structure`  
**Quality:** ⭐⭐⭐⭐⭐  
**Archive:** `SAMS-Docs/apm_session/Memory/Archive/Unit_Contact_Structure_Update_2025-12-16/`

**Technical Details:**
- Created normalization utilities: `normalizeOwners()`, `normalizeManagers()`, `getOwnerNames()`, etc.
- Updated all code paths accessing `unit.owners` or `unit.managers`
- Fixed runtime errors in `unitUtils.js`
- User tested and confirmed working in all clients

### v0.4.3 - Import Timezone Fix & Balance Reconciliation (December 7, 2025)
- ✅ **Import Timezone Handling** - Fixed UTC→Cancun conversion preventing Dec 31 → Jan 1 date shifts
- ✅ **Projects.json Import** - Added to standard import sequence (optional)
- ✅ **Luxon Date Handling** - Updated databaseFieldMappings.js per project standards
- ✅ **Credit Balance Display** - Added to Statement of Account reports
- ✅ **Balance Diagnostic Tool** - diagnose-monthly-balances.js script for troubleshooting

**Issue Resolved:** ~$70K balance discrepancy from timezone-shifted transactions  
**Commit:** `536f173`  
**Archive:** `SAMS-Docs/apm_session/Memory/Task_Completion_Logs/Import_Timezone_Fix_2025-12-07.md`

**Technical Details:**
- JSON.stringify() converts dates to UTC ISO strings
- Previous code extracted date portion before timezone conversion
- Fix: Parse as UTC, convert to Cancun, then extract date
- 4 Dec 31, 2024 transactions correctly moved back from Jan 2025
- Remaining $10K resolved via Year-End 2024 balance adjustment

---

### v0.4.2 - Projects Module / Special Assessments (December 7, 2025)
- ✅ **P-1: Analysis & Data Extraction** - 78 transactions mapped, schema defined
- ✅ **P-2: Seeding Script** - 4 projects seeded to Firestore (~393 lines)
- ✅ **P-3: Text Table Display** - Validation tool (~301 lines)
- ✅ **P-4: Statement Integration** - Projects section in Statement of Account (~250 lines)

**Total Duration:** ~5 hours (vs 8-11 hour estimate)  
**Quality:** ⭐⭐⭐⭐⭐ All tasks received 5-star ratings

**Projects Seeded:**
- `elevator-refurb-2023-2024` - Elevator Refurbishment (27 transactions)
- `roof-water-sealing-2024` - Roof Water Sealing (23 transactions)
- `propane-pipes-2025` - Propane Tank Fill Lines (13 transactions)
- `column-repairs-2025` - Column Repairs (13 transactions)

**Key Features:**
- Unit Statement of Account now shows Special Assessments section
- Projects filtered by unit payments in fiscal year
- Exempt units correctly excluded (Unit 2B exempt from Propane)
- Bilingual support (English/Spanish)
- Allocation Summary includes "Special Assessments" row

**Archive:** `SAMS-Docs/apm_session/Memory/Archive/Projects_Module_2025-12-07/`  
**Git Branch:** `feature/projects-module`

### v0.4.1 - PWA Maintenance Tools (December 6, 2025)
- ✅ **WM-2: Water Meter API Integration** - ~1,500 lines, 92% API call reduction
- ✅ **WM-3: NumericKeypad Integration** - Generic reusable component, ~150 lines
- ✅ **PT-1: Propane Tank Module** - Full new module, ~2,790 lines (21 files)
- ✅ **Auto-Login Basic** - Firebase persistence fix (1 line)
- ✅ **Bug Fix:** hasClientAccess → hasPropertyAccess (9 files)

**Archives:** 
- `SAMS-Docs/apm_session/Memory/Archive/Water_Meter_WM-2_2025-12-06/`
- `SAMS-Docs/apm_session/Memory/Archive/Propane_Tank_PT-1_2025-12-06/`
- `SAMS-Docs/apm_session/Memory/Archive/Water_Meter_WM-3_NumericKeypad_2025-12-06/`

**Git Commits:** `3081292` (WM-2 + PT-1), `4209606` (WM-3 + Auto-Login)

### v0.4.0 - Budget Module (December 4, 2025)
- ✅ **Task B1.1 - Budget Entry UI** - Real-time totals, fiscal year selector, centavos architecture
- ✅ **Task B1.2 - Budget vs Actual Report** - Three-table structure, bilingual, PDF/CSV export
- ✅ **Special Assessments Fund Format** - Collections/Expenditures/Net Balance
- ✅ **Context-Aware Variance** - Positive = favorable for both income & expense
- ✅ **Delivered 2 Days Early** - Completed Dec 4, planned for Dec 6

**Archive:** `SAMS-Docs/apm_session/Memory/Archive/Budget_Module_Task_1_2025-12-03/` and `Budget_Module_Task_2_2025-12-04/`

### v0.3.0 - Statement of Account Report (December 3, 2025)
- ✅ **Statement of Account Report** - Professional PDF/CSV with bilingual support
- ✅ **CSV Export** - Implemented as bonus feature in Step 3
- ✅ **Unified Payment System** - Cross-module payments operational
- ✅ **Phase 5 Quarterly Billing** - AVII contract-compliant
- ✅ **Water Bills Quarterly** - Quarterly display for AVII

**See:** `COMPLETED_WORK_ARCHIVE_v0.3.0.md` for full details

---

## 🚨 URGENT: YEAR-END 2025 PLANNING (MTC)

**Timeline:** Must be complete by December 31, 2025 (10 days remaining)
**Status:** 🟡 BLOCKERS IN PROGRESS

### Pre-Year-End Blockers (December 21, 2025)

**DISCOVERED:** 4 critical issues blocking year-end processing identified overnight

**In Progress (Task BUG-001 & BUG-002):**
- 🔄 **#81** - Budget vs Actual Report broken (reportCommonCss missing)
- 🔄 **#80** - Statement of Account duplicate project payments  
- 🔄 **#82** - Budget Report missing notes column
- 🔄 **#83** - Budget tools showing one-time project categories

**Impact:** Blocks final 2025 statement distribution AND 2026 budget board presentation  
**Estimated Fix Time:** 5-7 hours (1 working day)  
**Status:** Task assignments created, awaiting Implementation Agent execution

---

### Year-End Process Requirements

MTC operates on a calendar fiscal year (Jan-Dec). The following must be addressed:

#### 1. Statement Generation & Distribution
- ✅ Generate All functionality working
- ✅ Email All functionality working
- ✅ Public PDF URLs for owner access
- 🔄 **#80** - Statement accuracy (duplicate project payments) - IN PROGRESS
- 🟡 **#77** - Client-specific footers (MTC footer differs from AVII) - Enhancement, nice-to-have

#### 2. Year-End Closing Process (TBD - After Blockers)
- 📋 Final 2025 statements for all units
- 📋 Any pending payments/credits to process before Dec 31
- 📋 Balance carryover to 2026 (if needed)
- 📋 Archive 2025 data / backup procedures

#### 3. 2026 Fiscal Year Opening (Partially Ready)
- 📋 2026 HOA dues bills generation (Q1 at minimum)
- ✅ Budget entered for 2026
- 🔄 **#82, #83** - Budget presentation polish - IN PROGRESS
- 📋 Any rate changes for 2026?

#### 4. Process Documentation
- 📋 Document the year-end checklist for future years
- 📋 Identify any automation opportunities

**IMMEDIATE NEXT STEP:** Complete BUG-001 and BUG-002 tasks, then proceed with year-end processing plan (#78)

---

## ✅ COMPLETED: CRITICAL PATH TO PRODUCTION (December 2025)

### Priority 1: Budget Module │ GitHub #45
**Status:** ✅ COMPLETE - Both Tasks Done (AHEAD OF SCHEDULE)  
**Timeline:** Dec 3-6, 2025 → Completed Dec 4, 2025 (2 days early!)

**Business Need:** MTC new fiscal year budget required by Jan 1, 2026 ✅ READY

#### ✅ Task B1.1 - Budget Entry UI (COMPLETE - Dec 3, 2025)
- Backend: 3 files (routes, controller, registration)
- Frontend: 6 files (view, component, API, styling)
- Features: Real-time totals, fiscal year selector, centavos architecture
- Quality: ⭐⭐⭐⭐⭐ - User confirmed "Perfect"
- Archive: `SAMS-Docs/apm_session/Memory/Archive/Budget_Module_Task_1_2025-12-03/`

#### ✅ Task B1.2 - Budget vs Actual Report (COMPLETE - Dec 4, 2025)
- Backend: 3 services (data, text, HTML) + routes in reports.js
- Frontend: BudgetActualTab.jsx + CSS + reportService.js updates
- Features: Three-table structure, bilingual, PDF/CSV export, color-coded variance
- Quality: ⭐⭐⭐⭐⭐ - Outstanding implementation
- Total Lines: ~3,279
- Commit: `ca89377` on `feature/budget-module`
- Archive: `SAMS-Docs/apm_session/Memory/Archive/Budget_Module_Task_2_2025-12-04/`

**Key Features Delivered:**
- Three-table structure (Income, Special Assessments, Expenses)
- Context-aware variance (positive = favorable)
- Split transaction handling
- Special Assessments fund accounting format
- Bilingual support (EN/ES) with 40+ category translations
- HTML/PDF/CSV export
- Client logo and full name display

**Data Structure:**
```
/clients/{clientId}/categories/{categoryId}/budget/{year}
  - amount: number (centavos)
  - createdAt: timestamp
  - updatedAt: timestamp
```

**Implementation Steps:**

**Step 1: Budget Entry UI (Dec 3-4)**
- Wire existing Budget activity placeholder in sidebar
- Call categories endpoint (already exists for modal pulldowns)
- Display table: Category | 2025 Budget | 2026 Budget (editable)
- Save to Firestore: `/clients/{clientId}/categories/{categoryId}/budget/{year}`
- Prepopulate 2026 values from 2025 budget

**Step 2: Budget vs Actual Report (Dec 5-6)**
- Table: Category | Actual YTD | Budget YTD | Variance
- YTD Budget = Annual Budget × (% of fiscal year elapsed)
- YTD Actual = Sum of transactions by category (existing filter code)
- Uses existing fiscal year logic (MTC: Jan-Dec, AVII: Jul-Jun)

**Resources Available:**
- ✅ Sidebar placeholder for Budget activity
- ✅ Categories endpoint (used in modal pulldowns)
- ✅ Transaction filter by category
- ✅ 2025 budget exists as JSON file
- ✅ Fiscal year calculation code

**Future Enhancements (NOT Jan 1):**
- "Create New Budget" with inflation adjustment
- AI-assisted budget planning from historical data
- Per-category inflation flags
- Top 5 over-budget variance drill-down

---

### Priority 2: Data Reconciliation │ Manual Process
**Status:** ✅ MTC COMPLETE / 🟡 AVII MANUAL TASKS PENDING - Non-blocking  

**MTC:** ✅ COMPLETE (December 7, 2025)
- Fixed import timezone bug (UTC→Cancun) resolving ~$70K discrepancy
- Identified historical $10K adjustment from March 2025
- Corrected via Year-End 2024 balance adjustment
- Final balances verified: Bank $182,086 ✓, Cash $4,600 ✓
- Reconciled to actual bank statements

**AVII:** Manual tasks pending (non-blocking for go-live)
- 🟡 Unit contact structure changes (update owners/managers to match Dev)
- 🟡 Budget entry (build AVII budget for fiscal year)
- Optional: HOA Dues comparison with Google Sheets (if needed)
- Optional: Water Bills comparison (if needed)
- Goal: Complete before Jan 1, 2026

**Process:**
1. Run Statement of Account reports for AVII units
2. Compare with Google Sheets historical figures
3. Use existing UI to adjust individual fields where needed
4. Document adjustments made

---

### Priority 3: Firestore Backup Configuration │ GitHub #38
**Status:** 🟢 READY - Recommended before Jan 1, 2026  
**Effort:** Configuration task, minimal development  
**Blocking:** ❌ No - Recommended but not required for go-live

**Scope:**
- Configure automated Firestore backups
- Establish recovery procedures
- Document backup/restore process

---

## 📱 PWA/MOBILE REFACTOR (Post-Budget Module)

**Timeline:** Started Dec 4, 2025  
**Current Status:** Phase 0 Complete — Foundation ready for Phase 1

### PWA Phase 0: Firebase Migration │ ✅ COMPLETE
**Status:** ✅ COMPLETE (December 4, 2025)  
**Actual Effort:** ~3 hours (estimated 4-6 hours)  
**Quality:** ⭐⭐⭐⭐⭐  
**Archive:** `SAMS-Docs/apm_session/Memory/Archive/PWA_Phase_0_Firebase_Migration_2025-12-04/`

**Deliverables:**
- ✅ Firebase multi-site hosting configured (desktop + mobile targets)
- ✅ PWA config fixed (empty string for production = same-origin)
- ✅ Missing API rewrites added (`/reports/**`, `/credit/**`, `/payments/**`, `/budgets/**`)
- ✅ Vercel artifacts removed (3 files deleted)
- ✅ PWA builds successfully
- ✅ Local connectivity verified (localhost:5001 calls working)

**Key Configuration:**
- Firebase Site: `sams-mobile-pwa`
- Deploy Command: `firebase deploy --only hosting:mobile`
- Custom Domain: `mobile.sams.sandyland.com.mx` (ready to configure)

---

### PWA Phase 1: API & Data Fixes │ ✅ COMPLETE
**Status:** ✅ COMPLETE (December 4, 2025)  
**Actual Effort:** ~6 hours (estimated 4-6 hours)  
**Quality:** ⭐⭐⭐⭐⭐  
**Archive:** `SAMS-Docs/apm_session/Memory/Archive/PWA_Phase_1_API_Fixes_2025-12-04/`

**Deliverables:**
- ✅ Account Balances fixed (API with centavos conversion)
- ✅ HOA Dues Status fixed (matches desktop calculation)
- ✅ Exchange Rates fixed (correct endpoint path)
- ✅ Testing verified (MTC and AVII)

**Additional Achievements:**
- ✅ Past Due Units Card added with expandable details
- ✅ Water Bills Card added for AVII client
- ✅ Client Features utility (`clientFeatures.js`) created
- ✅ Fiscal Year fix for AVII (July-start)
- ✅ Client switching enhanced

**Deferred (Low Priority):**
- ⚠️ Client logos not displaying
- ⚠️ Admin tag accuracy

---

### PWA Priority A: Water Meter Entry │ ✅ COMPLETE
**Status:** ✅ WM-2 + WM-3 COMPLETE (December 6, 2025)  
**Quality:** ⭐⭐⭐⭐⭐ Outstanding  
**Archive:** `SAMS-Docs/apm_session/Memory/Archive/Water_Meter_WM-2_2025-12-06/`  
**Archive:** `SAMS-Docs/apm_session/Memory/Archive/Water_Meter_WM-3_NumericKeypad_2025-12-06/`

**Deliverables:**
- ✅ WM-2: API compatibility, batch endpoints, 92% API reduction, auth bug fix
- ✅ WM-3: NumericKeypad integration for rapid mobile data entry  
**Archive:** `SAMS-Docs/apm_session/Memory/Archive/PWA_Water_Meter_WM-2_2025-12-06/`

**Deliverables:**
- ✅ Water meter entry interface with period switching
- ✅ API compatibility fixes for refactored backend
- ✅ Unsaved changes tracking via localStorage (debounced)
- ✅ **Performance optimization: 92% reduction in API calls** (24 → 2)
- ✅ Batch endpoints for readings/bills existence checks
- ✅ Maintenance role security: Dashboard access blocked
- ✅ Test user: hdotter@gmail.com (maintenance role)

**Bug Fix During Task:**
- Fixed `hasClientAccess` → `hasPropertyAccess` naming inconsistency (9 files)
- See: `SAMS-Docs/apm_session/Memory/Bug_Fixes/BUG_FIX_hasClientAccess_Method_Naming_2025-12-04.md`

**Key Files:**
- `frontend/mobile-app/src/components/WaterMeterEntryNew.jsx`
- `frontend/mobile-app/src/services/waterReadingServiceV2.js`
- `frontend/mobile-app/src/api/waterAPI.js`
- `backend/routes/waterRoutes.js` (batch endpoints added)

---

### PWA Priority A.1: Dashboard Card Refactor │ GitHub #47
**Status:** 📋 BACKLOG (Medium Priority)  
**Estimated Effort:** 4-6 hours  
**Depends On:** Water Meter Entry complete (Priority A)

**User Story:** Current cards take up the whole screen. Need smaller, summary cards that fit 2-3 across with tap-to-view-more pattern.

**Design References:**
- [Grocery Mobile Dashboard](https://dribbble.com/shots/25180450-Grocery-Mobile-Dashboard-UI-Design)
- [Podcast Analytics Dashboard](https://dribbble.com/shots/9808385-Mobile-Dashboard-Podcast-Analytics-App)
- [Crypto Dashboard](https://dribbble.com/shots/4200700-Crypto-Mobile-Dashboard-White-or-Dark)
- [Health App](https://dribbble.com/shots/2062953-Health-App-mobile)
- [Mobile Dashboard](https://dribbble.com/shots/3224323-Mobile-Dashboard)

### PWA Priority B: Propane Tank Module │ ✅ PT-1 COMPLETE
**Status:** ✅ PT-1 COMPLETE (December 6, 2025) - Phases 1-2 + 3A  
**Actual Effort:** ~10 hours (as estimated)  
**Quality:** ⭐⭐⭐⭐⭐ Outstanding  
**Archive:** `SAMS-Docs/apm_session/Memory/Archive/Propane_Tank_PT-1_2025-12-06/`

**Deliverables:**
- ✅ Backend: services, controllers, routes, seeding scripts
- ✅ PWA: Worker entry with NumericKeypad component (Spanish)
- ✅ Desktop: History table with color-coded cells
- ✅ CSV seeding: 25 months historical data imported
- ✅ Bonus: Reusable NumericKeypad, language preference support

**Data Structure:**
```
clients/MTC/projects/propaneTanks/readings/{year}-{month}
  readings: { "1A": { level: 60 }, "1B": { level: 80 }, ... }
```

**Phases:**
1. ✅ Backend & Data Structure - PT-1
2. ✅ PWA Worker Entry - PT-1
3. ✅ Desktop History Table - PT-1 (3A)
4. 📋 Desktop Admin Entry View - Future (3B)
5. 📋 PWA Owner Dashboard Card - Future
6. 📋 Trend Analysis - Future

**Code Stats:** 21 files created, ~2,790 lines
**Related:** TD-028 (Unit-specific association data enhancement)

### PWA Priority C: Owner/Manager Dashboard │ Agent_Mobile
**Status:** 📋 After Propane  
**Estimated Effort:** Medium (existing code needs update)

**Scope:**
- Current Unit Status Dashboard
- HOA Dues status, Water Bills/Propane status
- Exchange Rates with Calculator
- Update to match new backend endpoints

---

## 🐛 DEPRIORITIZED BUGS (Post-Production)

These bugs are not blocking production go-live and will be addressed after Jan 1:

| GitHub # | Issue | Priority | Notes |
|----------|-------|----------|-------|
| #48 | Create User maintenance role | Low | Auth bug fixed in WM-2; workaround: create as Admin, edit role in Firebase Console |
| #43 | Client Management 404 | Post-prod | No new clients before Jan 1, Firebase console workaround |
| #39 | Water Bills Import Invalid Bills | Post-prod | Manual delete workaround, manual reconciliation handles |
| #44 | Credit History Details modal | Post-prod | Nice-to-have UI enhancement |
| #10 | New Client onboarding progress | Post-prod | No new clients being onboarded |
| #12 | Transaction Link modal formatting | Post-prod | UI polish |

---

## 🛠️ REMAINING TECHNICAL DEBT

### TD-001: Units List Management Multiple UI Issues
**Priority:** LOW - Dev environment only, not blocking workflow  
**Issues:** Data inconsistency, no row highlighting, save failures, broken search  
**Impact:** Minor usability issues for single dev/admin user  
**Effort:** 2-3 sessions

### TD-002: PropertyAccess Map Creation Missing
**Priority:** LOW - Manual database intervention available  
**Impact:** Cannot add new users/clients through UI (console workaround available)  
**Effort:** 1 session

### TD-007: HOA Dues Unnecessary Split Allocations
**Priority:** MEDIUM - System efficiency issue  
**Status:** ⚠️ Needs verification - May have reverted in recent update  
**Impact:** All HOA payments routed through splits system even for simple exact payments  
**Optimization:** Only use splits for multi-period payments or credit balance scenarios  
**Effort:** 1-2 sessions (including verification)

### TD-008: Year-End Processing System
**Priority:** LOW - Manual process acceptable for now  
**Scope:** Build new fiscal year files, year-end reports, balance carryover  
**Impact:** Manual year-end processing currently acceptable  
**Effort:** 5-6 sessions

### TD-009: Special Projects Activity Cleanup
**Priority:** LOW  
**Scope:** Remove unused "Extra Activity" option  
**Effort:** 1 session

### TD-017: Migrate checkExchangeRatesHealth to 2nd Gen Cloud Function
**Priority:** LOW  
**Impact:** No production impact - function still works as 1st Gen  
**Effort:** 0.5-1 hour

### TD-023: Large PDF File Size (AVII)
**Priority:** LOW  
**Impact:** ~1.4 MB PDFs (larger than MTC ~370 KB)  
**Effort:** 1-2 hours

### TD-027: System-Wide UI Consistency Refactor
**Priority:** MEDIUM  
**Impact:** Inconsistent layouts, tab styles, design patterns across modules  
**Effort:** 15-20 hours (future work)

### TD-028: Unit-Specific Association Data Enhancement
**Priority:** MEDIUM  
**Impact:** Currently hardcoding which units have propane tanks, future boat dock fees for AVII  
**Scope:** Add association-specific optional fields to unit configuration:
```javascript
// Example unit config enhancement
{
  unitId: "1A",
  // ... existing fields ...
  propaneTank: { sizeInLiters: 120 } | null,  // null = no tank
  boatOnDock: { sizeInFeet: 24 } | null       // null = no boat (for AVII)
}
```
**Use Cases:**
- MTC: Propane tank tracking (unit 2B has no tank)
- AVII: Future boat dock monthly fees based on boat/dock size
**Current Workaround:** Hardcode unit lists in propane config  
**Effort:** 2-3 sessions

---

## 🚀 FUTURE FEATURES (Backlog)

### Bulk Administration Operations │ GitHub #50
**Status:** 📋 BACKLOG (Medium Priority)  
**Estimated Effort:** 4-6 sessions total (two enhancements)

**CLI Script Available (Dec 6, 2025):**
- `backend/testHarness/generateAllStatementPDFs.js` - Developer tool for bulk PDF generation
- Saves to Firebase Storage: `clients/{clientId}/accountStatements/{FiscalYear-Month}/`

**Enhancement A: Admin Bulk Report Generation (3-4 sessions)**
- UI in Administration section to generate/save reports for all units
- Schedule recurring report generation (monthly statements)
- Manage stored report collections
- Target users: Admins/Managers

**Enhancement B: User Report Access (2-3 sessions)**
- UI for owners/managers to retrieve their own stored reports
- On-demand report generation capability  
- Download historical statements (PDF)
- Target users: Unit Owners, Unit Managers

**Suggested Approach:** Enhancement A first (builds storage infrastructure), then B (consumes stored reports)

---

### Budget Status Dashboard Card │ GitHub #46
**Status:** 📋 BACKLOG (Medium Priority)  
**Estimated Effort:** 2-3 sessions  
**Depends On:** ✅ Budget Module (v0.4.0 complete)

**Scope:**
- Quick reference card for Desktop and Mobile dashboards
- Overall tracking to budget with % of year elapsed
- Hover tooltip/dropdown showing top 5-10 variance items (+ or -)
- Follow financial app best practices

**User Story:** With budgets and budget vs actual data now in SAMS, provide a dashboard widget for at-a-glance budget health monitoring.

**Design Considerations:**
- Color-coded status indicator (green/yellow/red)
- Year-to-date context (budget prorated by elapsed time)
- Drill-down to full Budget vs Actual report

---

### PWA Auto-Login │ GitHub #49
**Status:** ✅ BASIC COMPLETE / 📋 BIOMETRICS FUTURE  
**Module:** Frontend Mobile

**Completed (Dec 6, 2025):**
- ✅ Changed Firebase persistence from `browserSessionPersistence` to `browserLocalPersistence`
- ✅ Users now stay logged in ~90 days (until explicit logout)
- ✅ One-line fix in `frontend/mobile-app/src/services/firebase.js`

**Future Enhancement (Biometrics):**
- 📋 Face ID / Touch ID authentication
- 📋 Web Authentication API (WebAuthn)
- 📋 Platform detection and fallback handling
- 📋 Estimated Effort: 1-2 days

---

### WhatsApp Business Integration │ Agent_Communications
**Status:** 📋 BACKLOG  
**Estimated Effort:** 6-8 sessions

**Scope:**
- Bilingual text messages with attachments
- Message templates, delivery tracking

### Task Manager / Calendar Service │ Agent_Business
**Status:** 📋 BACKLOG  
**Estimated Effort:** 6-8 sessions

**Scope:**
- Repetitive task assignment for maintenance users
- Push notifications, calendar visualization

### Voting/Polling System │ Agent_Business
**Status:** 📋 BACKLOG  
**Estimated Effort:** 5-7 sessions

**Scope:**
- Board/owner voting with document attachments
- Anonymous options, results storage

### General Configuration Editor │ Agent_Business
**Status:** 📋 BACKLOG  
**Estimated Effort:** 2-3 sessions

**Scope:**
- Generic tool to edit configuration collections
- Eliminates need for domain-specific editing screens

### Additional Reports │ Agent_Reports
**Status:** 📋 BACKLOG  
**Estimated Effort:** 8-12 sessions total

**Reports:**
- Monthly Transaction History Report (Statement of Account engine)
- HOA Dues Update Report (Statement of Account engine)
- Additional Budget reports (after Budget Module complete)

---

### Single Unit Client Implementation │ GitHub #54
**Status:** 📋 BACKLOG (Strategic Enhancement)  
**Estimated Effort:** 10-15 sessions (leverages existing code)  
**Target:** 2026 - After Tasks/Calendar, Projects expansion, and Additional Reports  
**Can Run In Parallel:** Yes - same underlying code, different filters/presentation

**Executive Summary:**
Extend SAMS to support individual homes/condos managed by Sandyland Properties (SLP). Currently 10+ properties with 4 owners. Leverages existing modules with minimal modification.

**Architecture Principle: Square = Special Rectangle**
Single unit clients are modeled as a special case of Associations, not a separate system:
- Same underlying code and data structures
- Different filters and limited function visibility within common modules
- One "owner" to report to (vs. multiple unit owners in HOA)
- Presentation differences only - nothing structural changes

**Business Value:**
- Single point of entry for all SLP business activities
- Common interface accessible from anywhere
- Proper logging and backup
- Foundation for Tasks/Calendar features across all clients
- Shared vendor database with notes and skill sets

**Client Type: Single Unit**
- No HOA Dues concept (vs. Association fixed schedule)
- Owner sends funds on-demand to cover scheduled bills ("burn down" model)
- Client can switch between units (like Admin switches between Associations)
- Enables rollup and individual reporting

**Modules Reusable (Identical/Near-Identical):**
- ✅ Client
- ✅ Transactions
- ✅ Budgets
- ✅ Projects (when developed)
- ✅ Tasks (when developed)
- ✅ Vendors
- ✅ Categories
- ✅ Reports

**PWA/Mobile Support:**
- Account balances, projects, upcoming bills, exchange rates
- Communication to SLP (requests, status updates)
- Maintenance worker tasks

**Key Differences from Associations:**
| Aspect | Association | Single Unit |
|--------|-------------|-------------|
| Dues | Fixed annual schedule | On-demand "burn down" |
| Users | Multiple unit owners | Single owner (with multiple properties) |
| Navigation | Switch Clients (admin) | Switch Units (owner) |
| Reporting | Per unit + association rollup | Per property + owner rollup |

**Pilot Client: SLP (Sandyland Properties)**
Perfect test case with two distinct scenarios:
- **Aventuras Club Marina 102** - Condo in building SLP does NOT manage
- **MTC PH4D** - Condo within MTC client (SLP does manage building)

This tests both standalone and "nested" single-unit scenarios.

**Rental Tracking (Future Phase - 2026):**
- Dates, names, amounts, contracts
- Currently handled via Google Sheets + Forms + Web App
- Will be phased into this enhancement when further defined
- Not blocking initial single-unit implementation

**Implementation Phases (Proposed):**
1. **Analysis:** Presentation layer changes, filter patterns
2. **Client Configuration:** Add "single-unit" flag to client config
3. **Navigation:** Switch Units UI pattern for owners
4. **On-Demand Billing:** "Burn down" funding model display
5. **PWA Integration:** Owner dashboard for single units
6. **Pilot:** Create SLP client with ACM-102 and MTC-PH4D
7. **Rental Tracking:** Phase 2 - detailed requirements TBD 2026

**Dependencies:**
- ✅ Core platform stable (achieved)
- ✅ Budget Module (v0.4.0)
- ✅ Projects Module (v0.4.2)
- 📋 Tasks/Calendar system (prerequisite)
- 📋 Additional Reports (prerequisite)
- 📋 Production go-live complete

---

## 📋 EXECUTION TIMELINE (December 2025)

### Week 1: Dec 3-6 - Budget Module ✅ COMPLETE
| Day | Planned | Actual |
|-----|---------|--------|
| Wed Dec 3 | Budget Entry UI - wire sidebar | ✅ B1.1 COMPLETE |
| Thu Dec 4 | Budget Entry UI - complete | ✅ B1.2 COMPLETE (all 4 steps!) |
| Fri Dec 5 | Budget vs Actual - table structure | ✅ PWA Phase 0-1 COMPLETE |
| Sat Dec 6 | Budget vs Actual - complete | ✅ WM-2, WM-3, PT-1, Auto-Login COMPLETE |

### Week 2: Dec 7-13 - Data Reconciliation ✅ AHEAD OF SCHEDULE
| Day | Task |
|-----|------|
| Sat Dec 6 | Bulk statement generation script created |
| Sun Dec 7 | Generate all unit statements for review |
| Mon-Fri | Manual comparison AVII vs Google Sheets |

### Week 3: Dec 14-20 - Data Reconciliation (continued)
- Continue AVII comparison if needed
- Make manual adjustments as needed
- Verify MTC data integrity

### Week 4: Dec 21-31 - Pre-Production
- Firestore backup configuration (GitHub #38)
- Final testing
- Go-live preparation

### January 1, 2026: MTC New Fiscal Year on SAMS

---

## 📈 STRATEGIC SUMMARY

### Current Production Status
**SAMS is LIVE at sams.sandyland.com.mx serving:**
- **MTC Client:** 1,477 documents, $414,234.12 in transactions
- **AVII Client:** 249 documents, $86,211.73 in transactions

### Completed Through v0.3.0
- ✅ Statement of Account Report (with PDF/CSV export)
- ✅ Unified Payment System
- ✅ Phase 5 Quarterly Billing (HOA + Water)
- ✅ Phase 6 Fiscal Year Boundaries
- ✅ Phase 4 HOA Dues Refactor
- ✅ Phase 3 Shared Services Extraction
- ✅ Water Bills Performance Optimization
- ✅ Multi-language support (in reports)
- ✅ CSV Export

### Critical Path to Production (Dec 2025)
1. ~~**Budget Module**~~ - ✅ GitHub #45 COMPLETE (Dec 4)
2. ~~**PWA Maintenance Tools**~~ - ✅ WM-2, WM-3, PT-1 COMPLETE (Dec 6)
3. ~~**Projects Module**~~ - ✅ Special Assessments in Statements COMPLETE (Dec 7)
4. ~~**Import Timezone Fix**~~ - ✅ UTC→Cancun, MTC reconciled (Dec 7)
5. ~~**Data Reconciliation**~~ - ✅ MTC COMPLETE / 🟡 AVII manual tasks pending (Dec 7-20)
6. ~~**Production Deployment**~~ - ✅ v1.0.0 COMPLETE (Dec 16), v1.0.1 COMPLETE (Dec 16)
7. **Firestore Backup** - 🟢 GitHub #38 READY (recommended before Jan 1)

**🎉 PRODUCTION GO-LIVE STATUS: ✅ READY**

**Remaining Manual Tasks (Non-Blocking):**
- 🟡 AVII Unit Contact Changes (manual data entry)
- 🟡 AVII Budget Entry (manual data entry)
- 🟢 Firestore Backup Configuration (GitHub #38)

**Post-Go-Live Tasks (Immediate Follow-Up):**
- 📋 Statement Enhancements (future HOA bills after 15th of last month of quarter)
- 📋 Email Integration (automated statement delivery)
- 📋 PWA/Mobile App (bare-bones for unit owners/managers)

### Post-Production Roadmap (Q1 2026)
1. **PWA: Owner Dashboard** - Unit status, exchange rates (GitHub #47 card refactor)
2. **Budget Status Dashboard Card** - GitHub #46, quick reference widget
3. **Bulk Admin Operations** - GitHub #50, report generation & storage
4. **PWA Auto-Login Biometrics** - GitHub #49, Face ID / Touch ID
5. **Maintenance Role CRUD** - GitHub #48, add to UI picklists
6. **Single Unit Client Support** - GitHub #54, after Tasks/Calendar complete; pilot with SLP (ACM-102, MTC-PH4D)

### Deprioritized (Post-Production)
- GitHub #43: Client Management 404
- GitHub #39: Water Bills Import Invalid Bills
- GitHub #44: Credit History Details modal
- GitHub #10: Onboarding progress bars
- GitHub #12: Transaction Link modal formatting

---

### Success Metrics
- ✅ **Core Platform:** Fully operational in production
- ✅ **Statement of Account:** Professional reports replacing Google Sheets
- ✅ **v0.4.0 Milestone:** Budget Module COMPLETE (Dec 4, 2025) - Ready for Jan 1, 2026
- ✅ **v0.4.1 Milestone:** PWA Maintenance Tools COMPLETE (Dec 6, 2025) - Water Meter + Propane Tank
- ✅ **v0.4.2 Milestone:** Projects Module COMPLETE (Dec 7, 2025) - Special Assessments in Statements
- ✅ **v0.4.3 Milestone:** Import Timezone Fix COMPLETE (Dec 7, 2025) - MTC Balance Reconciled
- 🎯 **v0.5.0 Milestone:** Data Reconciliation Complete, Firestore Backup Configured
- 🚀 **Long-term Goal:** Full Google Sheets replacement with mobile worker support
