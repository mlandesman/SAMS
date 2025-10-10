# SAMS Technical Debt Tracking

**Last Updated:** 2025-01-19  
**Maintainer:** APM Manager Agent

## Active Technical Debt Items

### **TD-001: Water Bills Payment Tracking Disabled** 
**Category:** Temporary Simplification  
**Priority:** High  
**Created:** January 11, 2025  
**Context:** Water Bills V2 Implementation

**Description:**
During Water Bills V2 implementation, payment tracking logic was temporarily disabled to get the core meter reading storage system working. This includes hardcoded values for `monthsBehind: 0` and `unpaidBalance: 0`, and commented-out validation logic.

**Code Locations:**
- `backend/services/projectsService.js` lines 138-150: Simplified payment tracking structure
- `backend/services/projectsService.js` lines 154-155: Validation logic commented out
- `frontend/sams-ui/src/views/WaterBillsViewV2.jsx`: Missing Bills tab and payment UI

**Cleanup Required:**
- Restore payment tracking logic in backend
- Re-enable validation for data integrity (`this.validateUnitData()`)
- Add Bills tab showing amounts due
- Implement payment processing UI and backend endpoints
- Add payment history tracking and balance display

**Trigger for Cleanup:** Water Bills V2 approval and move to Phase 2 (Bill Generation)

**Estimated Cleanup Effort:** 3-4 Implementation Agent sessions

**Business Impact:** High - Cannot generate or track water bill payments currently

---

### **TD-002: Units List Management Multiple UI Issues**
**Category:** Production Bug  
**Priority:** High  
**Created:** Issue-20250726_0927  
**Context:** List Management functionality

**Description:**
Multiple critical usability issues in Units List Management affecting production use including data display inconsistencies, missing row highlighting, edit failures, and broken search functionality.

**Specific Issues:**
1. Detailed View and Edit Record show different data
2. No row highlighting when clicked
3. Monthly Dues edits not saving to database
4. Quick Search doesn't filter or search
5. Issues affect other list editors

**Code Locations:**
- Units List Management components
- List editor base components
- ActionBar search functionality

**Cleanup Required:**
- Fix data consistency between views
- Implement row highlighting
- Debug and fix save functionality
- Repair search/filter operations
- Test all list management interfaces

**Trigger for Cleanup:** Immediate - production usability issue

**Estimated Cleanup Effort:** 2-3 Implementation Agent sessions

**Business Impact:** High - Severely impacts production usability

---

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

---

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

---

### **TD-005: API Domain Migration Legacy Routes** ✅ **RESOLVED**
**Category:** Architecture  
**Priority:** ~~Medium~~ **COMPLETED**  
**Created:** Completed September 2025  
**Resolved:** September 22, 2025  
**Context:** API Domain Migration project

**Description:**
Complex client-scoped routes preserved as legacy during API domain migration transition. These routes were functional but needed migration to domain-specific patterns. Critical production blocker with HOA Dues requiring immediate resolution.

**Resolution Completed:**
- ✅ Fixed critical HOA Dues API domain migration (frontend to backend alignment)
- ✅ Updated `/clients/${clientId}/hoadues/*` to `/hoadues/${clientId}/*` pattern
- ✅ Eliminated blank screen errors in HOA Dues functionality
- ✅ Established clean domain architecture foundation
- ✅ Production testing successful - all HOA functionality working normally

**Files Modified:**
- `frontend/sams-ui/src/context/HOADuesContext.jsx` - API endpoint corrected
- Backend domain routing verified and confirmed working

**Business Impact:** **RESOLVED** - Critical production blocker eliminated, HOA Dues functionality fully restored

**Completion Date:** September 22, 2025

---

### **TD-006: Water Bills Phase Implementation Aggregation Flag**
**Category:** Feature Toggle  
**Priority:** Medium  
**Created:** Identified in code review  
**Context:** Water Bills phase implementation

**Description:**
Temporary feature flag `ENABLE_AGGREGATION = false` in WaterBillsList component to limit to single month display during Phase 1 implementation.

**Code Locations:**
- `frontend/sams-ui/src/components/water/WaterBillsList.jsx` lines 10-12

**Cleanup Required:**
- Remove `ENABLE_AGGREGATION` flag
- Implement cross-month aggregation functionality 
- Remove phase-related TODO comments

**Trigger for Cleanup:** Phase 2 Water Bills implementation

**Estimated Cleanup Effort:** 1 Implementation Agent session

**Business Impact:** Low - Limits functionality but core features work

---

### **TD-007: Hard-coded API URLs in Configuration**
**Category:** Configuration Management  
**Priority:** Medium  
**Created:** Identified during API migration  
**Context:** Mobile/Desktop configuration unification

**Description:**
Historical pattern of hardcoded API URLs in mobile app configuration that causes production deployment failures and prevents environment-specific configuration.

**Code Locations:**
- Previous mobile configuration files (now resolved)
- Potential remaining hardcoded URLs in older components

**Cleanup Required:**
- Audit all remaining hardcoded API URLs
- Ensure all services use centralized configuration
- Test environment-specific deployments
- Document configuration management patterns

**Trigger for Cleanup:** Next deployment or configuration review

**Estimated Cleanup Effort:** 1 Implementation Agent session

**Business Impact:** Medium - Prevents flexible deployment configuration

---

### **TD-008: Legacy Test Files and Obsolete Utilities**
**Category:** Code Quality  
**Priority:** Low  
**Created:** Ongoing  
**Context:** Backend cleanup

**Description:**
15+ legacy test files and obsolete utility scripts remain in the backend that are no longer used and contribute to deployment size and maintenance complexity.

**Code Locations:**
- `backend/testing/` - Multiple obsolete test files
- `backend/scripts/` - Legacy utility scripts
- `backend/utils/` - Unused utility functions

**Cleanup Required:**
- Audit and remove unused test files
- Archive or delete obsolete scripts
- Clean up unused utility functions
- Update documentation to reflect current utilities

**Trigger for Cleanup:** Next deployment optimization or codebase review

**Estimated Cleanup Effort:** 1-2 Implementation Agent sessions

**Business Impact:** Low - Improves maintainability and deployment efficiency

---

### **TD-009: Frontend Component Standardization Gap**
**Category:** Component Architecture  
**Priority:** Low  
**Created:** Ongoing development  
**Context:** Component consistency across desktop and mobile

**Description:**
Inconsistent component patterns between desktop and mobile applications that increase maintenance overhead and developer onboarding complexity.

**Code Locations:**
- `frontend/sams-ui/src/components/` - Desktop components
- `frontend/mobile-app/src/components/` - Mobile components
- Shared component patterns

**Cleanup Required:**
- Standardize component API patterns
- Create shared component library
- Document component development standards
- Align styling and interaction patterns

**Trigger for Cleanup:** Next major UI/UX standardization phase

**Estimated Cleanup Effort:** 8-12 Implementation Agent sessions

**Business Impact:** Low - Improves development efficiency and maintainability

---

### **TD-010: PropertyAccess Map Creation Missing**
**Category:** Production Bug  
**Priority:** High  
**Created:** Identified in APM v0.3 Summary  
**Context:** User Management System

**Description:**
New users don't get propertyAccess map created during user creation, which blocks database writes and prevents adding new users or clients without manual intervention.

**Code Locations:**
- User creation workflow
- Client onboarding process
- Database write permissions

**Cleanup Required:**
- Fix user creation to automatically generate propertyAccess map
- Add validation to ensure map exists before database operations
- Test user creation workflow end-to-end
- Add error handling for missing propertyAccess cases

**Trigger for Cleanup:** Immediate - blocking production user management

**Estimated Cleanup Effort:** 1 Implementation Agent session

**Business Impact:** High - Cannot add new users or clients without manual database intervention

---

### **TD-011: ES6 Module Export Compliance**
**Category:** Critical Architecture  
**Priority:** Critical  
**Created:** Identified in APM v0.3 Summary  
**Context:** Backend Code Standards

**Description:**
All backend code MUST use ES6 exports instead of CommonJS. Using CommonJS breaks the system. This is an ongoing compliance requirement that must be maintained.

**Code Locations:**
- Backend controllers and services
- All backend JavaScript files
- Import/export statements throughout backend

**Cleanup Required:**
- Audit all backend files for CommonJS usage
- Convert any remaining CommonJS to ES6 modules
- Add linting rules to prevent CommonJS usage
- Document ES6 requirement in coding standards

**Trigger for Cleanup:** Immediate - system breaks if not maintained

**Estimated Cleanup Effort:** Ongoing maintenance + 1 session for audit

**Business Impact:** Critical - System failure if CommonJS is used

---

### **TD-012: TypeScript Migration**
**Category:** Code Quality  
**Priority:** High  
**Created:** Identified in APM v0.3 Summary  
**Context:** Runtime Error Prevention

**Description:**
System needs TypeScript conversion to prevent runtime type errors and improve development productivity. Currently experiencing runtime errors that TypeScript would catch at compile time.

**Code Locations:**
- Throughout entire codebase
- Frontend and backend JavaScript files
- Component interfaces and API contracts

**Cleanup Required:**
- Plan TypeScript migration strategy
- Convert critical components to TypeScript first
- Add TypeScript build pipeline
- Train development team on TypeScript patterns

**Trigger for Cleanup:** Next major development phase

**Estimated Cleanup Effort:** 8-12 Implementation Agent sessions

**Business Impact:** High - Runtime errors impact user experience and system stability

---

### **TD-013: Test Coverage Below 40%**
**Category:** Quality Assurance  
**Priority:** High  
**Created:** Identified in APM v0.3 Summary  
**Context:** Regression Prevention

**Description:**
Low test coverage (< 40%) with missing integration tests and no performance tests. Risk of regressions increases as system grows without adequate test coverage.

**Code Locations:**
- Throughout codebase
- Missing test files for critical components
- Backend API endpoints lack integration tests

**Cleanup Required:**
- Implement automated testing suite with 80% coverage minimum
- Add integration tests for critical workflows
- Set up CI/CD pipeline with automated testing
- Add performance testing for key operations

**Trigger for Cleanup:** Before next major feature development

**Estimated Cleanup Effort:** 6-8 Implementation Agent sessions

**Business Impact:** High - Risk of production regressions without adequate testing

---

### **TD-014: Universal Configuration Editor Missing**
**Category:** Feature Gap  
**Priority:** Medium  
**Created:** Identified in APM v0.3 Summary  
**Context:** Client Maintenance

**Description:**
Missing generic viewer/editor for all /config collections. Essential for client maintenance but currently requires manual database editing.

**Code Locations:**
- Frontend Desktop - Settings module
- Configuration management interfaces
- Admin tools

**Cleanup Required:**
- Build universal configuration editor component
- Add validation for configuration changes
- Implement role-based access control for config editing
- Add audit trail for configuration changes

**Trigger for Cleanup:** Next administrative tool development phase

**Estimated Cleanup Effort:** 3-4 Implementation Agent sessions

**Business Impact:** Medium - Requires manual database editing for client maintenance

---

### **TD-015: Water Bills Cross-linking to Transactions**
**Category:** Data Consistency  
**Priority:** High  
**Created:** Identified in APM v0.3 Summary  
**Context:** Audit Trail Completion

**Description:**
Water bill payments need to be linked to transaction records like HOA dues for complete audit trail and data consistency. Currently missing bidirectional linkage.

**Code Locations:**
- Water bills payment processing
- Transaction creation workflows
- Payment history displays

**Cleanup Required:**
- Implement water bill payment → transaction linking
- Add transaction references to water bill records
- Update payment processing to create transaction records
- Ensure audit trail completeness

**Trigger for Cleanup:** Water Bills Phase 2 implementation

**Estimated Cleanup Effort:** 2-3 Implementation Agent sessions

**Business Impact:** High - Incomplete audit trail and data inconsistency

---

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

---

## Technical Debt Guidelines

### **When to Add Debt Items**
- Legacy compatibility code that has planned removal date
- Workarounds implemented due to external constraints
- Performance optimizations deferred for delivery schedule
- Code patterns that need standardization across modules

### **When NOT to Add Debt Items**
- Poor code quality that should be fixed immediately
- Security vulnerabilities (fix immediately)
- Broken functionality (fix before deployment)
- Critical performance issues (address immediately)

### **Debt Item Format**
```markdown
### **TD-XXX: Descriptive Title**
**Category:** [Legacy Support|Performance|Architecture|Standards]  
**Priority:** [High|Medium|Low]  
**Created:** YYYY-MM-DD  
**Context:** [Project/Phase that created the debt]

**Description:** Clear explanation of what was implemented and why

**Cleanup Required:** Specific tasks needed to resolve

**Trigger for Cleanup:** What event/milestone allows cleanup

**Estimated Effort:** Implementation Agent sessions required
```

### **Debt Resolution Process**
1. **Trigger Event Occurs** (e.g., data reimport, dependency update)
2. **Manager Agent Creates Cleanup Task** for Implementation Agent
3. **Implementation Agent Executes Cleanup** following standard procedures
4. **Debt Item Marked as Resolved** with completion date

### **Review Schedule**
- **Monthly:** Review all active debt items for trigger events
- **Pre-Release:** Assess if any debt items should be resolved before deployment
- **Post-Milestone:** Clean up debt items that were waiting for project completion