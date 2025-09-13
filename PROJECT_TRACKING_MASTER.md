# SAMS Project Tracking Master Document

**Last Updated**: August 6, 2025 (20:15 EST)  
**Project**: Sandyland Asset Management System (SAMS)  
**Product Manager**: Michael  
**Development Team**: Claude Code APM Framework  

---

## 🎉 PRODUCTION MILESTONE ACHIEVED - August 6, 2025

### ✅ SAMS IS NOW LIVE IN PRODUCTION
- **MTC**: Successfully migrated (1,477 documents, 10 users, $414,234.12 in transactions)
- **AVII**: Successfully migrated (249 documents, $86,211.73 in transactions)
- **Migration System**: Complete Dev→Prod pipeline with automatic user creation
- **Status**: Both clients fully operational in Production environment

---

## 🚨 CRITICAL ISSUES (0 Open)

### ✅ RESOLVED - CRITICAL-001: Load MTC into Production
- **Module**: Database
- **Status**: ✅ COMPLETED (August 6, 2025)
- **Resolution**: Successfully migrated to Production with new migration system:
  - ✅ Complete Dev→Prod migration pipeline created
  - ✅ Dynamic collection discovery (no hardcoding)
  - ✅ Automatic Firebase Auth user creation with temp passwords
  - ✅ Audit log migration from root collection
  - ✅ Proper timestamp conversion for all date fields
  - ✅ Full data integrity verification
  - ✅ MTC: 1,477 documents migrated successfully
  - ✅ AVII: 249 documents migrated successfully
- **Impact**: PRODUCTION LIVE - System operational
- **Task ID**: ISSUE-20250708_1046
- **Location**: Moved to `issues/resolved/`

## 🔥 HIGH PRIORITY ISSUES (1 Open)

### HIGH-001: Units List Management (various)
- **Module**: Frontend Desktop
- **Status**: 🔴 OPEN
- **Description**: 
  1. Detailed View and Edit Record are not showing the same data
  2. List does not highlight the row when clicked so you can't tell which row you are editing or deleting
  3. Editing data (specifically Monthly Dues but probably others) is not saved to the db
  4. Quick Search (ActionBar) does not filter or search (likely applies to other list editors)
  5. Issue affects other list editors as well
- **Impact**: Non-blocked (can be edited in Firebase console) but significant impact for production use.
- **Task ID**: ISSUE-20250726_0927
- **Location**: `issues/open/ISSUE_UNITS_LIST_MANAGEMENT_(VARIOUS)_20250726_0927.md`

### (Resolved High Priority Issues)

- **Transaction Filter Timezone Issue** - ✅ RESOLVED (July 30, 2025) - Filters now show correct date ranges
- **Transaction Date Entry Timezone Issue** - ✅ RESOLVED (July 30, 2025) - Dates save correctly
- **HOA Reference Display Enhancement** - ✅ RESOLVED (July 30, 2025) - Cleaner UI with click navigation
- **Client Selector Display Regression** - ✅ RESOLVED
- **Multi-Unit Context Switching** - ✅ RESOLVED
- **PWA Mobile App Shared Components** - ✅ RESOLVED
- **Editing Categories creates duplicates** - ✅ RESOLVED (July 2025) - Fixed documentId issue
- **List Management Sticky Headers** - ✅ RESOLVED (July 2025) - Implemented in sprint task
- **Exchange Rate List Management limited output** - ✅ RESOLVED (July 22, 2025) - Shows 90+ days now
- **ListManagement Edit (Payment Methods) not working** - ✅ RESOLVED (July 29, 2025) - Fixed auth headers

---

## 🟡 MEDIUM PRIORITY ISSUES (3 Open)

### MEDIUM-001: Dates from Frontend UI need to be normalized to America/Cancun
- **Module**: Frontend Desktop
- **Status**: 🔴 OPEN
- **Description**: When entering 1/1/2025 late in the evening, the date gets sent to the controller as 12/31/2024. We have fixed this before by implementing timezone utilities in timezone.js but in the refactor, new data entry (Add Expense, for example) is writing the date as one day earlier and the quick filter commands in Transactions (This Month, for example) are also off on their start and end dates for the filter.
- **Impact**: Production Blocker
- **Task ID**: ISSUE-20250729_2222
- **Location**: `issues/open/ISSUE_DATES_FROM_FRONTEND_UI_NEED_TO_BE_NORMALIZED_TO_AMERICA/CANCUN_20250729_2222.md`

### MEDIUM-002: Need to create propertyAccess MAP when adding a new client and/or user update
- **Module**: User Management
- **Status**: 🔴 OPEN
- **Description**: Creating a new user does not grant anyone access via the propertyAccess check thus blocking writes to the db even as a superAdmin.
- **Impact**: Non-production blocker
- **Task ID**: ISSUE-20250731_2127
- **Location**: `issues/open/ISSUE_NEED_TO_CREATE_PROPERTYACCESS_MAP_WHEN_ADDING_A_NEW_CLIENT_AND/OR_USER_UPDATE_20250731_2127.md`

### MEDIUM-003: Add Expense Modal Filter Active Payment Methods
- **Module**: Frontend Desktop - Transaction Entry
- **Status**: 🔴 OPEN
- **Description**: Add Expense modal shows all payment methods regardless of status, should filter for active only (like HOA Dues modal)
- **Impact**: User confusion, potential selection of inactive payment methods
- **Task ID**: ISSUE-20250730_1630
- **Location**: `issues/open/ISSUE_ADD_EXPENSE_FILTER_ACTIVE_PAYMENT_METHODS_20250730_1630.md`

### (Resolved Medium Priority Issues)

- **Transaction Calculation Errors** - ✅ RESOLVED
- **Configuration Drift Dev/Prod** - ✅ RESOLVED
- **Document Upload Size Limits** - ✅ RESOLVED
- **Dashboard HOA Dues Status numbers** - ✅ RESOLVED

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

### ENHANCEMENT-003: Mobile Unit Report for Admin/SuperAdmin
- **Module**: Frontend Mobile - Reporting
- **Status**: 🔵 BACKLOG
- **Description**: Re-add Unit Report to Mobile Admin/SuperAdmin interface
- **Task ID**: MOB-UNIT-REPORT-001

### ENHANCEMENT-004: Mobile HOA Payment Module for Admin
- **Module**: Frontend Mobile - HOA Management
- **Status**: 🔵 BACKLOG
- **Description**: Create mobile HOA payment module for Admin/SuperAdmin
- **Task ID**: MOB-HOA-ADMIN-001

### ENHANCEMENT-005: Advanced Reporting Dashboard
- **Module**: Frontend - Analytics
- **Status**: 🔵 BACKLOG
- **Description**: Create advanced analytics and reporting dashboard
- **Task ID**: ANALYTICS-DASH-001

### ENHANCEMENT-006: Mobile App Offline Support
- **Module**: Mobile
- **Status**: 🔵 BACKLOG
- **Description**: Comprehensive user activity audit logging
- **Task ID**: AUDIT-LOG-001

### ENHANCEMENT-007: Task Management System
- **Module**: Backend
- **Status**: 📋 BACKLOG
- **Priority**: ⚠️ MEDIUM
- **User Story**: We need a system to maintain repeatable and/or schedulable tasks. Examples are "Log Water Meter Readings on the last work day of each month" and "Change the cistern water filter every 6 months". Another, different example would be connected to HOA Dues and Special Assessments. "Send email follow up to all units who have not paid their monthly dues on the 10th day of the new month and add x% penalty". "Contact Special Assessment #30 Contractor for project status 30 days after project start". The TMS should be able to be "attached" to different documents in our DB (HOA Dues Payment, Projects, etc). The TMS should provide basic ToDo list functionality on its own when not connected to another module. "Change water filter" task is an example of a disconnected task.
- **Business Value**: Ensure tasks and projects are completed and that payments are made and received.
- **Effort**: 🟠 Large (1-3 days)
- **Task ID**: ENH-20250802_1904
- **Location**: `enhancements/ENHANCEMENT_TASK_MANAGEMENT_SYSTEM_20250802_1904.md`

### ENHANCEMENT-008: Automated Backup System
- **Module**: Backend - Data Management
- **Status**: 🔵 BACKLOG
- **Description**: Automated daily backup system for all client data
- **Task ID**: AUTO-BACKUP-001

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

### ENHANCEMENT-011: Unit Management Dues Field Migration
- **Module**: Frontend Desktop - Unit Management
- **Status**: 🟡 TODO
- **Priority**: ⚠️ MEDIUM
- **Description**: Migrate dues field from duesAmount to scheduledAmount in Unit Management
- **Business Value**: Field naming consistency across the application
- **Effort**: 🟢 Small (1-2 hours)
- **Task ID**: ENH-20250728-DUES-FIELD
- **Location**: Identified during HOA transaction work

### ENHANCEMENT-012: AVII Water Bills
- **Module**: Financial Operations
- **Status**: 📋 BACKLOG
- **Priority**: 🔥 HIGH
- **User Story**: The AVII (Aventuras Villas II) client has a unique situation with regard to water bills. Each unit pays for their own water usage based on their own meter readings. The water bill is very straightforward -- new meter reading minus previous meter reading times 50 pesos is the bill without taxes or other charges. There is an extra component for washing cars (100 pesos per wash) and boats (200 pesos per wash). We need a tool in SAMS to accept meter readings per unit, compare to previous meter readings, allow for car and boat washes then generate a digital request for payment to be emailed to the unit's email addresses. Payments will be tracked similar to HOA Dues with a grid of who has paid, who hasn't and the penalties of 5% per month after 10 days of non-payment. The payment will log as a transaction the same way HOA Dues payments are logged with cross-reference and notes.
- **Business Value**: Small peso amounts but monthly and with penalties tied to late payments means this has to be efficient and easy to use.
- **Effort**: 🟡 Medium (3-8 hours)
- **Task ID**: ENH-20250731_1510
- **Location**: `enhancements/ENHANCEMENT_AV-II_WATER_BILLS_20250731_1510.md`

### ENHANCEMENT-013: Activity-Based Meter Reading Modules
- **Module**: New Activities (Water Consumption, Propane Monitoring)
- **Status**: 📋 BACKLOG
- **Priority**: 🔥 HIGH
- **User Story**: Create individual Activity modules for client-specific needs: Water Consumption (AVII) for monthly water billing, and Propane Monitoring (MTC) for tank level notifications. Each activity will be enabled through the existing config/activities system.
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

### DEBT-001: Legacy Code Cleanup
- **Module**: Backend - Code Quality
- **Status**: 🟡 IN PROGRESS
- **Description**: Remove 15+ legacy test files and obsolete utilities
- **Impact**: Deployment size and maintenance complexity
- **Task ID**: BACKEND-CLEANUP-001

### DEBT-002: Frontend Component Standardization
- **Module**: Frontend - Component Architecture
- **Status**: 🔵 BACKLOG
- **Description**: Standardize component patterns across desktop and mobile
- **Task ID**: COMPONENT-STD-001

### DEBT-003: Database Query Optimization
- **Module**: Backend - Performance
- **Status**: 🔵 BACKLOG
- **Description**: Optimize database queries for better performance
- **Task ID**: DB-OPTIMIZE-001

---

## ✅ RECENTLY RESOLVED (Past 7 Days)

### RESOLVED-001: Import Script Fixes for Production
- **Status**: ✅ COMPLETED
- **Description**: Fixed payment methods missing status field and HOA dues using wrong reference field name
- **Resolution**: Added status: 'active' to payment methods, changed transactionId to reference in HOA dues
- **Date**: July 30, 2025
- **Task IDs**: IMPORT-FIX-PAYMENT-METHODS-STATUS, IMPORT-FIX-HOA-REFERENCE-FIELD

### RESOLVED-002: Balance API Migration
- **Status**: ✅ COMPLETED
- **Description**: Migrated all balance operations from direct Firebase SDK to secure backend APIs
- **Resolution**: Implemented 4 new endpoints, removed SDK calls from frontend utilities
- **Date**: July 29, 2025
- **Task ID**: BALANCE-API-MIGRATION

### RESOLVED-003: Payment Methods Edit Authorization
- **Status**: ✅ COMPLETED
- **Description**: PUT requests to payment methods failing with 401 Unauthorized
- **Resolution**: Fixed authentication headers in API calls
- **Date**: July 29, 2025
- **Task ID**: ISSUE-20250713_0950

### RESOLVED-004: HOA Transaction Cascade Deletion
- **Status**: ✅ COMPLETED
- **Description**: HOA transaction deletion not properly clearing payment entries in dues records
- **Resolution**: Fixed payment reference matching, added cache invalidation, restored progress animation
- **Date**: July 28, 2025
- **Task ID**: ISSUE-20250728-HOA-CASCADE

### RESOLVED-005: Dashboard HOA Dues Status Numbers
- **Status**: ✅ COMPLETED
- **Description**: HOA Dues Status Card showing incorrect numbers
- **Resolution**: Fixed calculation logic
- **Date**: July 12, 2025

### RESOLVED-006: Server Startup Issues
- **Status**: ✅ COMPLETED
- **Description**: Backend server failing to start on localhost:5001
- **Resolution**: Fixed startup process and npm scripts
- **Date**: July 5, 2025

### RESOLVED-007: Field Structure Compliance
- **Status**: ✅ COMPLETED
- **Description**: Updated all backend routes to use new database field structure
- **Resolution**: 100% compliance achieved
- **Date**: July 5, 2025

### RESOLVED-008: Unit Reference Validation
- **Status**: ✅ COMPLETED
- **Description**: Fixed unit reference validation (was 0/6, now 8/8 valid)
- **Resolution**: Proper validation implemented
- **Date**: July 5, 2025

---

## 🚨 DEPLOYMENT STATUS & WARNINGS

### Current Production Status:
- **MTC Client**: ✅ Live and operational
- **Backend**: ✅ Stable with new balance APIs
- **Frontend Desktop**: ✅ Operational with Firebase migration ~95% complete
- **Frontend Mobile**: ✅ Operational (mobile Firebase migration pending)

### Deployment Warnings:
- **sams-deploy CLI**: ❌ BROKEN - Use manual deployment only
- **Staging Environment**: ❌ NOT CONFIGURED - Deploy directly to production
- **CDN Caching**: ⚠️ 1-hour cache delays for production updates

### Immediate Action Required:
1. **CRITICAL**: Update MTC Data Import scripts for new field structures
2. Address remaining HIGH priority issues (Units List, Payment Methods)
3. Complete remaining Firebase migration (~5% - mobile app, list management cleanup)

---

## 📈 METRICS & TRACKING

### Issue Volume by Priority:
- **Critical**: 1 open (ready for import), 1 resolved
- **High**: 1 open, 10 resolved  
- **Medium**: 3 open, 4 resolved
- **Low**: 1 open
- **Enhancements**: 15 backlog, 7 with issue files
- **Future Phases**: 2 planned
- **Technical Debt**: 3 items (1 in progress)

### Module Breakdown:
- **Frontend Desktop**: 3 open issues
- **Database**: 1 open issue (ready for import)
- **User Management**: 1 open issue
- **Session Management**: 1 open issue

### Resolution Rate:
- **Last 7 Days**: 11 items resolved (including 7 high priority)
- **Open Issues**: 6 total (1 critical ready, 1 high, 3 medium, 1 low)
- **Backlog Growth**: Stable

---

## 📋 NEXT SPRINT PRIORITIES

### Sprint Focus (Current):
1. **CRITICAL-001**: Production Database Migration  
2. **HIGH-001**: Units List Management Issues
3. **Phase 5**: Complete Transactions Migration (95% done - balance APIs complete)

### After Current Sprint:
1. Backend cleanup and optimization (DEBT-001)
2. Frontend component standardization
3. Enhancement implementations
4. Performance optimizations

---

**Document Owner**: Michael (Product Manager)  
**Update Frequency**: Daily during active development  
**Last Major Update**: August 5, 2025  
**Next Review**: August 6, 2025

## Notes on Recent Changes (August 5, 2025)
- Incorporated new issues and enhancements from bottom of document
- Moved timezone normalization issue (ISSUE-20250729_2222) to MEDIUM-001
- Moved propertyAccess MAP issue (ISSUE-20250731_2127) to MEDIUM-002
- Added 5 new enhancements (ENH-0731 through ENH-0804 → renumbered to ENH-012 through ENH-015)
- Fixed duplicate ENH-0804 ID by renumbering the second one to ENH-015
- Updated metrics: 6 open issues total (increased from 4)
- Updated enhancement count: 15 total (increased from 10)
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
