# SAMS Project Tracking Master Document

**Last Updated**: October 10, 2025 (Priority 1 & 2 Complete - Production Fixed)  
**Project**: Sandyland Association Management System (SAMS)  
**Product Manager**: Michael  
**Development Team**: Cursor APM Framework  

---

## 🎉 PRODUCTION MILESTONE ACHIEVED - October 7, 2025

### ✅ SAMS CLIENT IMPORT/ONBOADING WAS COMPLETE
- **MTC**: Successfully imported data into Dev and Production environments  
- **AVII**: Successfully imported data into Dev including Water Bills with payment cross-references
- **Status**: Both clients were fully operational... **UNTIL CRITICAL ISSUES DISCOVERED October 9, 2025**

---

## ✅ CRITICAL ISSUES RESOLVED (October 10, 2025)

### CRITICAL-001: Production Purge and Import System BROKEN ✅ RESOLVED
- **Module**: Backend - Import/Purge System
- **Status**: ✅ RESOLVED - Production system fully functional
- **Discovered**: October 9, 2025
- **Resolved**: October 10, 2025
- **Priority**: **PRIORITY 1 - COMPLETED**
- **Root Cause**: 
  - **Water Bills Purge Bug:** Firebase "ghost documents" not being deleted during purge operations
  - **Water Bills Transaction Linking:** Transaction IDs not propagating through import chain to bill documents
- **Solution Implemented**:
  - **Ghost Documents Fix:** Added code to ensure waterBills document always has properties, preventing Firebase recursive deletion skip
  - **Transaction Linking Fix:** Aligned Water Bills payments with HOA Dues payments[] array pattern for consistency
  - **Cross-Reference System:** Payments now properly link to transactions for UI navigation
- **Impact**: ✅ Production system fully functional, Water Bills import working, transaction links functional
- **Files Modified**: waterReadingsService.js, waterBillsService.js, importService.js, waterPaymentsService.js, WaterBillsList.jsx, waterDataService.js
- **Commits**: 39a9bd9, d7b55dd, 33a5d85 - Complete import system fixes with deployment
- **Task ID**: CRITICAL-20251009-IMPORT
- **GitHub Issue**: #7 - https://github.com/mlandesman/SAMS/issues/7

### CRITICAL-002: Water Bills Code Reversion ✅ RESOLVED
- **Module**: Frontend Desktop - Water Bills
- **Status**: ✅ RESOLVED - All Water Bills features restored
- **Discovered**: October 9, 2025
- **Resolved**: October 10, 2025
- **Priority**: **PRIORITY 2 - COMPLETED**
- **Root Cause**: User was on iOS Cursor branch from Oct 7 that predated recovery work
- **Solution**: Simple `git checkout main` to restore correct code branch
- **Investigation**: Comprehensive git history analysis confirmed no data loss, all work safely on main
- **Impact**: ✅ Development environment restored to working state, all Water Bills features functional
- **Task ID**: CRITICAL-20251009-WATERBILLS
- **GitHub Issue**: #8 - https://github.com/mlandesman/SAMS/issues/8

---

## 🚨 FORMER CRITICAL ISSUES (Now Resolved or Reclassified)

## 🔥 HIGH PRIORITY ISSUES (0 Open - All Reclassified to LOW/DEFERRED)

### FORMER HIGH-001: Units List Management (various) - RECLASSIFIED to LOW
- **Module**: Frontend Desktop
- **Status**: 🟡 OPEN - LOW Priority (Reclassified Oct 9, 2025)
- **Description**: 
  1. Detailed View and Edit Record are not showing the same data
  2. List does not highlight the row when clicked so you can't tell which row you are editing or deleting
  3. Editing data (specifically Monthly Dues but probably others) is not saved to the db
  4. Quick Search (ActionBar) does not filter or search (likely applies to other list editors)
  5. Issue affects other list editors as well
- **Impact**: Non-blocked (can be edited in Firebase console)
- **Workaround**: Firebase console editing acceptable
- **Decision**: DEFERRED - not blocking, workaround exists
- **Task ID**: ISSUE-20250726_0927
- **Location**: `issues/open/ISSUE_UNITS_LIST_MANAGEMENT_(VARIOUS)_20250726_0927.md`

### (Resolved High Priority Issues)


---

## 🟡 MEDIUM PRIORITY ISSUES (2 Open)

### MEDIUM-001: Dates from Frontend UI need to be normalized to America/Cancun
- **Module**: Frontend Desktop
- **Status**: ✅ COMPLETED
- **Description**: When entering 1/1/2025 late in the evening, the date gets sent to the controller as 12/31/2024. We have fixed this before by implementing timezone utilities in timezone.js but in the refactor, new data entry (Add Expense, for example) is writing the date as one day earlier and the quick filter commands in Transactions (This Month, for example) are also off on their start and end dates for the filter.
- **Impact**: Production Blocker
- **Task ID**: ISSUE-20250729_2222
- **Resolved**: October 8, 2025 (again)

### MEDIUM-002: Need to create propertyAccess MAP when adding a new client and/or user update
- **Module**: User Management
- **Status**: 🔴 OPEN
- **Description**: Creating a new user does not grant anyone access via the propertyAccess check thus blocking writes to the db even as a superAdmin.  Also, using the -New Client- UI onboarding does not up superAdmin propertyAccess.
- **Impact**: Non-production blocker
- **Task ID**: ISSUE-20250731_2127
- **Location**: `issues/open/ISSUE_NEED_TO_CREATE_PROPERTYACCESS_MAP_WHEN_ADDING_A_NEW_CLIENT_AND/OR_USER_UPDATE_20250731_2127.md`

### MEDIUM-003: Add Expense Modal Filter Active Payment Methods
- **Module**: Frontend Desktop - Transaction Entry
- **Status**: 🔴 OPEN
- **Description**: Add Expense modal doesn't honor the active/inactive status of payment methods, vendors and categories regardless of status. Should filter for active only (like HOA Dues modal)
- **Impact**: User confusion, potential selection of inactive payment methods
- **Task ID**: ISSUE-20250730_1630
- **Location**: `issues/open/ISSUE_ADD_EXPENSE_FILTER_ACTIVE_PAYMENT_METHODS_20250730_1630.md`

### (Resolved Medium Priority Issues)

---

## 🟢 LOW PRIORITY ISSUES

### LOW-001: User Session Timeout Issues
- **Module**: Frontend - Session Management
- **Status**: 🔵 BACKLOG
- **Description**: Allow SuperAdmin to login without selecting client first
- **Access**: Settings and List Management (Exchange Rates, Users, Client Management only)
- **Rationale**: These actions span multiple clients
- **Task ID**: SUPERADMIN-LOGIN-001
- **Location**: `/apm/planning/Task_Backlog_Production_Issues.md`

---

## 🚀 ENHANCEMENTS

### ENHANCEMENT-001: List Management for Accounts
- **Module**: UI/UX
- **Status**: 📋 BACKLOG
- **Priority**: ⚠️ MEDIUM
- **User Story**: We need to ability to edit the accounts list. The data collection is created during import onboarding but we do not have a list management function to edit it.
- **Business Value**: Complete CRUD functionality for financial accounts
- **Effort**: 🟢 Small (1-2 hours)
- **Task ID**: ENH-20250707_1323
- **Location**: `enhancements/ENHANCEMENT_LIST_MANAGEMENT_FOR_ACCOUNTS_20250707_1323.md`

### ENHANCEMENT-002: Multi-view for Transactions
- **Module**: Frontend Desktop
- **Status**: 📋 BACKLOG
- **Priority**: 🚀 FUTURE
- **User Story**: Create a [View] ActionBar item that will toggle between a Monthly Calendar View and a List View, similar to calendar options for Month and Agenda.
- **Business Value**: Enhanced transaction visualization and navigation
- **Effort**: 🟠 Large (1-3 days)
- **Task ID**: ENH-20250721_0913
- **Location**: `enhancements/ENHANCEMENT_MULTI-VIEW_FOR_TRANSACTIONS_20250721_0913.md`

### ENHANCEMENT-004: Mobile HOA Payment Module for Admin
- **Module**: Frontend Mobile - HOA Management
- **Status**: 🔵 BACKLOG
- **Description**: Create mobile HOA payment module for Admin/SuperAdmin
- **Task ID**: MOB-HOA-ADMIN-001

### ENHANCEMENT-007: Task Management System
- **Module**: Backend
- **Status**: 📋 BACKLOG
- **Priority**: ⚠️ MEDIUM
- **User Story**: We need a system to maintain repeatable and/or schedulable tasks. Examples are "Log Water Meter Readings on the last work day of each month" and "Change the cistern water filter every 6 months". Another, different example would be connected to HOA Dues and Special Assessments. "Send email follow up to all units who have not paid their monthly dues on the 10th day of the new month and add x% penalty". "Contact Special Assessment #30 Contractor for project status 30 days after project start". The TMS should be able to be "attached" to different documents in our DB (HOA Dues Payment, Projects, etc). The TMS should provide basic ToDo list functionality on its own when not connected to another module. "Change water filter" task is an example of a disconnected task.
- **Business Value**: Ensure tasks and projects are completed and that payments are made and received.
- **Effort**: 🟠 Large (1-3 days)
- **Task ID**: ENH-20250802_1904
- **Location**: `enhancements/ENHANCEMENT_TASK_MANAGEMENT_SYSTEM_20250802_1904.md`

### ENHANCEMENT-009: Multi-Language Support
- **Module**: Frontend - Internationalization
- **Status**: 🔵 BACKLOG
- **Description**: Add Spanish language support for MTC operations
- **Priority**: Future Development
- **Task ID**: MULTI-LANG-001

### ENHANCEMENT-010: HOA Collection Rate Celebration
- **Module**: Frontend Desktop - Dashboard
- **Status**: 📋 BACKLOG
- **Priority**: 🎉 FUN
- **User Story**: Add confetti animation when HOA collection rate reaches 100%
- **Business Value**: Gamification to encourage timely payments
- **Effort**: 🟢 Small (1-2 hours)
- **Task ID**: ENH-20250728-CONFETTI
- **Location**: Future enhancement discussed July 28, 2025

### ENHANCEMENT-013: Activity-Based Meter Reading Modules
- **Module**: New Activity (Propane Monitoring)
- **Status**: 📋 BACKLOG
- **Priority**: 🔥 HIGH
- **User Story**: Create individual Activity modules for client-specific needs: Water Consumption (AVII) for monthly water billing, and Propane Monitoring (MTC) for tank level notifications. Each activity will be enabled through the existing config/activities system.  **UPDATE: Water Bills fully implemented**.
- **Business Value**: 
  - Automate monthly water billing for AVII (~$50,000 MXN/month revenue)
  - Improve safety with propane level monitoring for MTC
  - Reduce manual work and errors in billing calculations
  - Enable future client-specific activities (EV Charging, Parking, etc.)
- **New Activities**:
  1. **Water Consumption** (AVII): Meter readings → consumption calc → bills → payments → receipts
  2. **Propane Monitoring** (MTC): Tank levels → gauge visualizations → notifications
- **Shared Components**:
  - Staff user type for field data entry
  - Reading entry interface (configurable per activity)
  - Historical data storage and trending
  - Email notification system
  - Payment tracking grid (for billing activities)
- **Effort**: 🟠 Large (3-5 weeks)
- **Task ID**: ENH-20250803-ACTIVITY-MODULES
- **Design Documents**: 
  - Original: `/apm/memory/enhancements/SPECIAL_BILLINGS_MODULE_DESIGN.md`
  - Updated: `/apm/memory/enhancements/ACTIVITY_BASED_MODULES_DESIGN.md`
- **Dependencies**: 
  - Task Management System (ENH-20250802_1904) for scheduling
  - Fiscal Year Support completion for AVII
  - Existing config/activities system

### ENHANCEMENT-014: HOA Dues and Special Billings Autopay from Credit Balance
- **Module**: Backend
- **Status**: 📋 BACKLOG
- **Priority**: ⚠️ MEDIUM
- **User Story**: Upon loading or as a nightly scheduled task, any unit that is past due in their HOA and/or Special Billings (for example, water consumption bill) that has sufficient credit balance to cover a full payment should have that payment made and credit balance reduced accordingly. This will require comprehensive notes within the transaction, an automated Digital Receipt sent to the owner and property manager and some form of notification to the administrators and superAdmins for verification and confirmation after the fact.
- **Business Value**: Avoid Late Fees while credit balances exist.
- **Effort**: 🟡 Medium (3-8 hours)
- **Task ID**: ENH-20250804_2206
- **Location**: `enhancements/ENHANCEMENT_HOA_DUES_AND_SPECIAL_BILLINGS_AUTOPAY_FROM_CREDIT_BALANCE_20250804_2206.md`

### ENHANCEMENT-015: Dues Payments on different schedules (monthly vs quarterly)
- **Module**: Frontend Desktop
- **Status**: 📋 BACKLOG
- **Priority**: 🚀 FUTURE
- **User Story**: The AVII client pays their HOA dues quarterly. We are talking about the minimum amount due. Any owner can overpay or advance pay but each client will have a minimum payment period. Most will be monthly (MTC) but some (AVII) have a required quarterly (3 months) payment. The enhancement would work with the new Fiscal Year handling to determine HOA payment status and Past Due amounts for the dashboard and reports. The data would still be stored and shown in monthly increments but the logic and language would change for reports and notifications to require full period (quarterly) payments.
- **Business Value**: More accurate client communications
- **Effort**: 🟠 Large (1-3 days)
- **Task ID**: ENH-20250804_2222
- **Location**: `enhancements/ENHANCEMENT_DUES_PAYMENTS_ON_DIFFERENT_SCHEDULES_(MONTHLY_VS_QUARTERLY)_20250804_2222.md`

### ENH-0806: Exchange Rate trend graph
- **Module**: Frontend Desktop
- **Status**: 📋 BACKLOG
- **Priority**: 🚀 FUTURE
- **User Story**: Using our historical exchangeRates create a trend graph for the trailing 6 months showing USD vs MXP.  The first phase can use just 6 months and just USD hardcoded.  A future phase could add user-selected periods and currencies.  The graph will be used on both desktop UI and mobile app when the Exchange Rates dashboard card is clicked or tapped.  On the mobile-app that tap currently brings up the calculator so we will have to detail with the UI/UX for that.
- **Business Value**: Visual representation of the user's expenses and deposit exchange rates.
- **Effort**: 🟡 Medium (3-8 hours)
- **Task ID**: ENH-20250806_1644
- **Location**: `enhancements/ENHANCEMENT_EXCHANGE_RATE_TREND_GRAPH_20250806_1644.md`

### NEW-0807: Client Logos and Icons are not appearing
- **Module**: Document Management
- **Status**: 🔴 OPEN
- **Description**: When we upload icon and logo images via the Edit Client modal, the files get uploaded to the bucket but are not callled in for the model itself of the Client Selector.\n
- **Impact**: Poor User Experience
- **Task ID**: ISSUE-20250807_1450
- **Location**: `issues/open/ISSUE_CLIENT_LOGOS_AND_ICONS_ARE_NOT_APPEARING_20250807_1450.md`

### ENH-0901: Universal Configuration Editor needed
- **Module**: Frontend Desktop
- **Status**: 📋 BACKLOG
- **Priority**: ⚠️ MEDIUM
- **User Story**: We have a ton of fields in the /clients/:clientId/config collection that are unique to each client.  Each document has many fields that are used throughout the code.  We should ccreate a generalized view and edit function inside of Settings that just lists all collections then all documents then all fields recursively.  We will never know what config data each client has but we need to allow an Admin to edit them for data-driven functions.
- **Business Value**: Maintenance of Clients requires this.
- **Effort**: 🟠 Large (1-3 days)
- **Task ID**: ENH-20250901_1405
- **Location**: `enhancements/ENHANCEMENT_UNIVERSAL_CONFIGURATION_EDITOR_NEEDED_20250901_1405.md`

---

## 🔮 FUTURE PHASES

### Phase 13: Communication System
- **Priority**: Future Development
- **Components**:
  - WhatsApp API integration for notifications
  - In-app messaging system
  - Voting and polling system for HOA decisions
  - Email template customization
- **Task ID**: PHASE-13-COMM

### Phase 15: Projects Module
- **Priority**: Future Development
- **Components**:
  - Capital project management
  - Contractor management
  - Project timeline tracking
  - Cost allocation across units
- **Task ID**: PHASE-15-PROJECTS

---

## 📊 TECHNICAL DEBT

### **TD-003: PWA Backend Routes Misalignment**
**Category:** Architecture  
**Priority:** High  
**Created:** Identified in Manager Handover 5  
**Context:** PWA Infrastructure Migration

**Description:**
Mobile PWA currently uses outdated backend routing and database structures that don't align with the new desktop backend architecture and domain-specific routing patterns.

**Code Locations:**
- `frontend/mobile-app/src/api/` - Outdated API service patterns
- PWA authentication and data fetching services
- Mobile component backend integrations

**Cleanup Required:**
- Align PWA with new backend routing patterns
- Update mobile API services to use domain-specific endpoints
- Migrate PWA database structure integration
- Test all mobile functionality with new backend

**Trigger for Cleanup:** Split Transactions Phase 2+ completion (foundational work)

**Estimated Cleanup Effort:** 5-8 Implementation Agent sessions

**Business Impact:** High - PWA functionality degraded without alignment

### **TD-004: duesDistribution Fallback Code**
**Category:** Legacy Data Support  
**Priority:** Medium  
**Created:** 2025-01-19  
**Context:** Phase 2 HOA Allocations Remodel

**Description:**
During the Phase 2 HOA Dues remodel to use the new `allocations` array pattern, the Implementation Agent correctly maintained fallback support for the legacy `duesDistribution` array structure. This was necessary for testing with existing data and ensuring zero breakage during development.

**Code Locations:**
- `backend/controllers/hoaDues.js` - duesDistribution fallback logic
- `frontend/sams-ui/src/components/hoa/` - Legacy display components
- Transaction processing logic that handles both patterns

**Cleanup Required:**
- Remove all `duesDistribution` fallback code and breadcrumbs
- Eliminate dual-pattern handling logic
- Clean up any legacy display components
- Update documentation to reflect allocations-only pattern

**Trigger for Cleanup:** **DATA REIMPORT** - When production data is reimported with new allocations pattern

**Estimated Cleanup Effort:** 1-2 Implementation Agent sessions

**Business Impact:** None (cleanup only improves code maintainability)

### **TD-016: Mobile App Complete Refactor Required**
**Category:** Platform Architecture  
**Priority:** High (when mobile work resumes)  
**Created:** Identified in APM v0.3 Summary  
**Context:** Mobile/Desktop Alignment

**Description:**
Mobile app requires complete refactor to match new data structures, endpoints, and authorization patterns. Currently increasingly out of sync with desktop platform.

**Code Locations:**
- Entire mobile app codebase
- Mobile API integration layer
- Authentication and data fetching services

**Cleanup Required:**
- Complete mobile app architecture refactor
- Align with current backend API patterns
- Update authentication and authorization flows
- Migrate to current data structures

**Trigger for Cleanup:** When mobile development resumes

**Estimated Cleanup Effort:** 12-15 Implementation Agent sessions

**Business Impact:** High - Mobile platform becoming unusable due to drift

### **TD-017: Client Name Is Not On All Displays
**Category:** Frontend Desktop
**Priority:** High
**Created:** Michael Landesman
**Context:** Safety

**Description:**
The Client Name needs to be prominently displayed on all screen to ensure no mistakes are made by an admin with editing ability.  Some screens, notably the Settings screens, do not show the client the admin is changing.  This information is on the Action Bar but not all screens have an action bar yet.  Mandatory to use the Action Bar even if there is no action button.

**Code Locations:**
- Settings, Projects, etc.

**Cleanup Required:**
- Layout changes to all screens

**Trigger for Cleanup:** Before production usage

**Estimated Cleanup Effort:** 1-3 Implementation Agent sessions

**Business Impact:** Medium - Only affects Admins
---

---

## 📋 PRIORITY EXECUTION ROADMAP (Post-Workshop October 9, 2025)

### ✅ COMPLETED - Immediate Action (Priorities 1-2)
1. ✅ **Fix Production Purge/Import System** (~2-4 sessions) - COMPLETED October 10, 2025
2. ✅ **Investigate Water Bills Code Reversion** (~1-3 sessions) - COMPLETED October 10, 2025

### Core Features (Priorities 3-7) - READY TO START
3. **Statement of Account Report - Phase 1 (MTC)** (~8-10 sessions)
4. **HOA Quarterly Collection** (~4-5 sessions)
5. **HOA Penalty System** (~4-5 sessions)
6. **Budget Module** (~3-4 sessions)
7. **Monthly Transaction Reports** (~4-5 sessions)

### Business Value Enhancements (Priorities 8-10)
8. **HOA Autopay from Credit Balance** (~3-4 sessions)
9. **Digital Receipts Production Polish** (~3-4 sessions)
10. **Propane Tanks Module (MTC)** (~4-5 sessions)

### Next Tier (Priorities 11-15+)
11. Water Bill Payment Emails (~2-3 sessions) - BLOCKED by Priority 2
12. Exchange Rates Dev Environment (~1 session)
13. Task Management System (~6-8 sessions)
14. PWA - All 3 Phases (~22-29 sessions) - After desktop stable
15. Future Enhancements (WhatsApp, Export, Multi-Language, etc.)

**Total Estimated Effort (Top 10):** 41-58 Implementation Agent sessions

---

**Document Owner**: Michael (Product Manager)  
**Update Frequency**: Daily during active development  
**Last Major Update**: October 9, 2025 (Priority Workshop Complete)  
**Next Review**: After Priorities 1-2 completion
