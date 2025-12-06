# SAMS (Sandyland Association Management System) – Implementation Plan

**Memory Strategy:** dynamic-md
**Last Modification:** Manager Agent - Task B1.2 COMPLETE, Budget Module DONE (December 4, 2025)  
**Current Version:** v0.4.0 - Budget Module Complete  
**Product Manager:** Michael  
**Development Team:** Cursor APM Framework  
**Project Overview:** SAMS is a production-ready multi-tenant association management system. Current focus: Budget Module (urgent), then PWA/Mobile refactor.

**Production URL:** https://sams.sandyland.com.mx  
**Archive Reference:** Completed work through v0.3.0 is documented in `SAMS-Docs/COMPLETED_WORK_ARCHIVE_v0.3.0.md`

---

## 🏆 RECENT MILESTONES

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

## 🚨 CRITICAL PATH TO PRODUCTION (December 2025)

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
**Status:** 🟡 IN PROGRESS - Due Dec 31, 2025  
**No development required** - Manual comparison and adjustment

**MTC:** Verify only - data should match 100% (built from import)

**AVII:** Manual comparison required
- HOA Dues: Compare 10 units with Google Sheets history
- Water Bills: Compare 10 units × 5 months with historical records
- Adjust penalty calculations to match previously reported numbers
- Goal: Establish clean starting point for Jan 1

**Process:**
1. Run Statement of Account reports for AVII units
2. Compare with Google Sheets historical figures
3. Use existing UI to adjust individual fields where needed
4. Document adjustments made

---

### Priority 3: Firestore Backup Configuration │ GitHub #38
**Status:** 🟢 READY - Before production go-live  
**Effort:** Configuration task, minimal development

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

## 📋 EXECUTION TIMELINE (December 2025)

### Week 1: Dec 3-6 - Budget Module ✅ COMPLETE
| Day | Planned | Actual |
|-----|---------|--------|
| Wed Dec 3 | Budget Entry UI - wire sidebar | ✅ B1.1 COMPLETE |
| Thu Dec 4 | Budget Entry UI - complete | ✅ B1.2 COMPLETE (all 4 steps!) |
| Fri Dec 5 | Budget vs Actual - table structure | 🎉 FREE - 2 days ahead |
| Sat Dec 6 | Budget vs Actual - complete | 🎉 FREE - 2 days ahead |

### Week 2: Dec 7-13 - PWA Water Meters
| Day | Task |
|-----|------|
| Weekend | PWA assessment and foundation update |
| Mid-week | Water meter readings - Spanish UI |
| End-week | Testing and polish |

### Week 3: Dec 14-20 - Data Reconciliation
- Run Statement of Account reports for AVII
- Compare with Google Sheets historical data
- Make manual adjustments as needed

### Week 4: Dec 21-31 - Pre-Production
- Firestore backup configuration
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
1. **Budget Module** - GitHub #45 (this week)
2. **Data Reconciliation** - Manual process (Dec 14-20)
3. **Firestore Backup** - GitHub #38 (Dec 21-31)

### Post-Production Roadmap (Q1 2026)
1. ~~**PWA: Water Meter Entry**~~ - ✅ COMPLETE (Dec 6, 2025)
2. ~~**Propane Tank Module**~~ - ✅ PT-1 COMPLETE (Dec 6, 2025)
3. **PWA: Owner Dashboard** - Unit status, exchange rates
4. **Budget Status Dashboard Card** - GitHub #46, quick reference widget
5. **PWA Auto-Login** - GitHub #49, biometrics/cookies

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
- 🎯 **v0.5.0 Milestone:** PWA Water Meters for field operations
- 🚀 **Long-term Goal:** Full Google Sheets replacement with mobile worker support
