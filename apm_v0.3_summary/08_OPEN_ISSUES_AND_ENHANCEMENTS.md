# SAMS Open Issues, Enhancements, and Technical Debt Catalog
*Consolidated from PROJECT_TRACKING_MASTER.md and issue/enhancement files*
*Last Updated: September 2025*

## Overview

This document consolidates all open issues, planned enhancements, and identified technical debt from the APM v0.3 system. Items are organized by priority and include all relevant details for v0.4 implementation teams.

---

## 🔴 OPEN ISSUES (Active Problems)

### HIGH PRIORITY

#### HIGH-001: Units List Management Multiple Issues
- **Status**: 🔴 OPEN
- **Module**: Frontend Desktop - List Management
- **Task ID**: ISSUE-20250726_0927
- **Problems**:
  1. Detailed View and Edit Record show different data
  2. No row highlighting when clicked (can't tell which row is being edited)
  3. Monthly Dues edits not saving to database
  4. Quick Search (ActionBar) doesn't filter or search
  5. Issues affect other list editors as well
- **Impact**: Production usability severely impacted
- **Workaround**: Direct Firebase console editing

### MEDIUM PRIORITY

#### MEDIUM-002: PropertyAccess Map Creation for New Users/Clients
- **Status**: 🔴 OPEN
- **Module**: User Management
- **Task ID**: ISSUE-20250731_2127
- **Problem**: New users don't get propertyAccess map, blocking database writes
- **Impact**: Can't add new users or clients without manual intervention
- **Required Fix**: Auto-create propertyAccess on user/client creation

#### MEDIUM-003: Add Expense Modal Shows Inactive Payment Methods
- **Status**: 🔴 OPEN
- **Module**: Frontend Desktop - Transaction Entry
- **Task ID**: ISSUE-20250730_1630
- **Problem**: All payment methods shown regardless of active status
- **Impact**: User confusion, potential selection of inactive methods
- **Required Fix**: Filter for status === 'active' like HOA modal does

#### MEDIUM-004: Client Logos and Icons Not Appearing
- **Status**: 🔴 OPEN
- **Module**: Document Management
- **Task ID**: ISSUE-20250807_1450
- **Problem**: Files upload to bucket but don't display in UI
- **Impact**: Poor user experience, missing branding
- **Required Fix**: Connect uploaded URLs to client display components

#### MEDIUM-005: Digital Receipt Email Authentication Error
- **Status**: 🔴 OPEN
- **Module**: Email System
- **Task ID**: ISSUE-20250803_1040
- **Problem**: Authentication errors when sending receipts
- **Impact**: Receipts not delivered to clients

### LOW PRIORITY

#### LOW-001: HOA Transaction Not Found Misleading Error
- **Status**: 🔴 OPEN
- **Module**: Error Handling
- **Problem**: Confusing error message when transaction lookup fails
- **Impact**: Minor UX issue
- **Required Fix**: Improve error messaging

#### LOW-002: Exchange Rate Daily Update Script
- **Status**: 🔴 OPEN
- **Module**: Backend Scripts
- **Problem**: macOS permissions prevent automated cron execution
- **Impact**: Manual daily updates required
- **Solution**: Consider cloud-based scheduler

---

## 🚀 ENHANCEMENTS (Feature Requests)

### IMMEDIATE PRIORITY

#### ENH-001: List Management for Accounts (Bank and Cash)
- **Priority**: ⚠️ MEDIUM
- **Module**: UI/UX - List Management
- **Task ID**: ENH-20250707_1323
- **Description**: Add CRUD functionality for accounts list
- **Business Value**: Complete financial account management
- **Effort**: 🟢 Small (1-2 hours)

#### ENH-002: Universal Configuration Editor
- **Priority**: ⚠️ MEDIUM
- **Module**: Frontend Desktop - Settings
- **Task ID**: ENH-20250901_1405
- **Description**: Generic viewer/editor for all /config collections
- **Business Value**: Essential for client maintenance
- **Effort**: 🟠 Large (1-3 days)

### WATER BILLS RELATED

#### ENH-003: AVII Water Bills UX Enhancement
- **Priority**: 🔥 MEDIUM
- **Module**: Water Billing
- **Task ID**: No task built
- **Description**: Default the Readings tab to be the next month without a reading (ready for input) and Bills tab to the last month file generated (ready for bill paying)
- **Effort**: 🟠 Small (2 hours)

#### ENH-004: Activity-Based Meter Reading Modules
- **Priority**: 🔥 HIGH
- **Module**: Water Billing
- **Task ID**: No task built
- **Description**: Expand water billing to include numeric entry of number of car washes and number of boat washes per unit.  Car washes charge at 100 pesos and boat washes at 200 pesos.  The charged amount will be new entries in the config file.
- **Effort**: 🟡 Medium (1 day)

#### ENH-005: Add data entry for Car and Boat Washes
- **Priority**: 🔥 HIGH
- **Module**: New Activities
- **Task ID**: ENH-20250803-ACTIVITY-MODULES
- **Description**: Expand water billing to other meter types (propane, EV charging)
- **Effort**: 🟠 Large (3-5 weeks)

### FINANCIAL FEATURES

#### ENH-006: Quarterly Payment Schedules
- **Priority**: 🚀 FUTURE
- **Module**: HOA Dues
- **Task ID**: ENH-20250804_2222
- **Description**: Support quarterly payments (AVII requirement)
- **Business Value**: Accurate client communications
- **Effort**: 🟠 Large (1-3 days)

#### ENH-007: Exchange Rate Trend Graph
- **Priority**: 🚀 FUTURE
- **Module**: Frontend - Analytics
- **Task ID**: ENH-20250806_1644
- **Description**: 6-month USD/MXN trend visualization
- **Business Value**: Visual exchange rate tracking
- **Effort**: 🟡 Medium (3-8 hours)

### USER EXPERIENCE

#### ENH-008: Multi-View for Transactions
- **Priority**: 🚀 FUTURE
- **Module**: Frontend Desktop
- **Task ID**: ENH-20250721_0913
- **Description**: Calendar view + List view toggle
- **Business Value**: Enhanced transaction visualization
- **Effort**: 🟠 Large (1-3 days)

#### ENH-009: HOA Collection Celebration (Confetti)
- **Priority**: 🎉 FUN
- **Module**: Dashboard
- **Task ID**: ENH-20250728-CONFETTI
- **Description**: Confetti animation at 100% collection rate
- **Business Value**: Gamification for timely payments
- **Effort**: 🟢 Small (1-2 hours)

### SYSTEM FEATURES

#### ENH-010: Task Management System
- **Priority**: ⚠️ MEDIUM
- **Module**: Backend
- **Task ID**: ENH-20250802_1904
- **Description**: Schedulable/repeatable tasks system
- **Use Cases**:
  - Monthly water meter readings
  - Maintenance reminders (filters, etc.)
  - Payment follow-ups with penalties
  - Project status checks
- **Effort**: 🟠 Large (1-3 days)

#### ENH-011: Backend Timezone Handling with Luxon
- **Priority**: ⚠️ MEDIUM
- **Module**: Backend Utilities
- **Task ID**: ENH-20250805
- **Description**: Comprehensive timezone solution
- **Effort**: 🟡 Medium (3-8 hours)

### MOBILE ENHANCEMENTS

#### ENH-012: Mobile Unit Report for Admin
- **Priority**: 🔵 BACKLOG
- **Module**: Mobile App
- **Task ID**: MOB-UNIT-REPORT-001
- **Description**: Re-add unit report to mobile admin interface

#### ENH-013: Mobile HOA Payment Module
- **Priority**: 🔥 HIGH
- **Module**: Mobile App
- **Task ID**: MOB-HOA-ADMIN-001
- **Description**: Payment module for mobile admin to add HOA Payments, Expense Entries, Water Bill payments, etc.

### FUTURE DEVELOPMENT

#### ENH-014: Advanced Reporting Dashboard
- **Priority**: 🔵 BACKLOG
- **Module**: Analytics
- **Task ID**: ANALYTICS-DASH-001
- **Description**: Comprehensive analytics and reporting

#### ENH-015: Mobile App Refactor
- **Priority**: 🔥 HIGH
- **Module**: Mobile App
- **Task ID**: 
- **Description**: Complete refactor to match the new data structures, endpoints and authorizations in the Desktop UI frontend.

#### ENH-016: Multi-Language Support
- **Priority**: 🔵 BACKLOG
- **Module**: Internationalization
- **Task ID**: MULTI-LANG-001
- **Description**: Spanish language support

---

## 🔧 TECHNICAL DEBT

### DEBT-001: Legacy Code Cleanup
- **Status**: 🟡 IN PROGRESS
- **Module**: Backend - Code Quality
- **Task ID**: BACKEND-CLEANUP-001
- **Description**: Remove 15+ legacy test files and obsolete utilities
- **Impact**: Deployment size and maintenance complexity

### DEBT-002: Frontend Component Standardization
- **Status**: 🔵 BACKLOG
- **Module**: Frontend - Component Architecture
- **Task ID**: COMPONENT-STD-001
- **Description**: Standardize component patterns across desktop and mobile
- **Impact**: Maintenance efficiency

### DEBT-003: Database Query Optimization
- **Status**: 🔵 BACKLOG
- **Module**: Backend - Performance
- **Task ID**: DB-OPTIMIZE-001
- **Description**: Optimize Firestore queries for better performance
- **Impact**: System responsiveness

### DEBT-004: Unit Management Dues Field Migration
- **Status**: 🟡 TODO
- **Module**: Data Model
- **Task ID**: ENH-20250728-DUES-FIELD
- **Description**: Migrate duesAmount → scheduledAmount for consistency
- **Impact**: Field naming consistency

---

## 📊 SUMMARY METRICS

### Issue Distribution
- **High Priority**: 1 open
- **Medium Priority**: 5 open
- **Low Priority**: 2 open
- **Total Open Issues**: 8

### Enhancement Distribution
- **Immediate Priority**: 2
- **Water Bills Related**: 2 (1 completed)
- **Financial Features**: 3
- **User Experience**: 2
- **System Features**: 2
- **Mobile**: 2
- **Future Development**: 3
- **Total Enhancements**: 16

### Technical Debt Items
- **In Progress**: 1
- **TODO**: 1
- **Backlog**: 2
- **Total Debt Items**: 4

### Total Items Requiring Attention: 28

---

## 📝 NOTES

1. **Water Bills Module**: Operational for AVII (August 2025) but requires UI clean up and addition of Car Wash and Boat Wash.  Also requires cross-linking to TransactionId to match HOA Dues cross-linking and cascading deletes.
2. **Production Status**: Non-production.  Code and Data in Prod is out of date with Dev beyond the point of usability.
3. **Technical Foundation**: ES6 modules, test harness, and utility functions are mandatory

---

## 🚨 WARNINGS FOR V0.4 IMPLEMENTATION

1. **MUST use ES6 module exports** - CommonJS will break the system
2. **MUST use testHarness.runTests()** - NOT runSuite() which doesn't exist
3. **MUST use utility functions** for dates, currency, fiscal year calculations
4. **MUST normalize dates** to America/Cancun timezone
5. **Domain-specific APIs** use `/water/` routes, not traditional REST patterns

This catalog represents the complete state of open work items as of the APM v0.3 to v0.4 transition.