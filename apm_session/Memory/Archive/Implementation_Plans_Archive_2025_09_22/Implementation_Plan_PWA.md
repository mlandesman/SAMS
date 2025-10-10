# SAMS (Sandyland Association Management System) – PWA Mobile Plan

**Memory Strategy:** dynamic-md
**Last Modification:** Initial creation by Setup Agent
**Project Overview:** Complete critical SAMS features to achieve production-ready status for parallel operation with Google Sheets systems. Focus on PWA recovery for mobile admin functions and remote worker modules.

## Phase 1: Mobile Admin PWA Recovery & Enhancement

### Task 1.1 – Assess PWA Breaking Changes │ Agent_Mobile
- **Objective:** Document all system changes that broke PWA functionality during 2+ month of desktop development
- **Output:** Comprehensive breaking changes report with recovery plan and effort estimates
- **Guidance:** PWA last updated over a month ago, entire system refactored since then, expect extensive breaking changes.  Changes made to firebase structures, backend endpoints, and authentication.

1. **Document System Changes:** List all major system changes including database structure, API endpoints, and authentication flow modifications
2. **Identify Dependencies:** Map broken dependencies between PWA and current system (data models, API calls, auth middleware)
1. **Component Assessment:** Evaluate which PWA components are salvageable versus requiring complete rebuild
4. **Recovery Planning:** Create detailed recovery plan with user input on approach and priorities
5. **Effort Estimation:** Provide realistic effort estimates for full PWA recovery to functional state

### Task 1.2 – Restore PWA Foundation │ Agent_Mobile
- **Objective:** Update PWA core systems to work with current database, APIs, and authentication
- **Output:** Functional PWA that loads, authenticates, and displays basic data correctly
- **Guidance:** Depends on: Task 2.1 Output,  Output by Agent_API from API Refactor for Domain Specific endpoints. Focus on core functionality before features

1. **Update Data Models:** Align PWA data models with current database structures and field names
2. **Update API Calls:** Modify all API calls to use new domain-specific endpoints from API refactoring
1. **Fix Authentication:** Implement compatibility with new authentication middleware and token handling
4. **Restore Client Context:** Update client context management and user role detection for proper data scoping
5. **Basic Testing:** Verify PWA loads, authenticates, and connects to backend successfully
6. **Role Verification:** Confirm admin versus user role differentiation works as designed

### Task 1.21 - Maintenance Worker Integration | Agent_Mobile
- **Objective:** Create limited functionality for Maintenance workers
- **Output:** PWA with working maintenace navigation and data entry, structured around simple navigation to the task assigned by user and client
- **Guidance:** Specific tasks for specific clients.  Code for Water Meter Readings in PWA is complete but not integrated and "maintenance" user role is not defined.

1. **Client Navigation:** When user logs in and is assigned only one property, skip client selector and go straight to the available options
2. **Client-specific:** Use or Build helper functions to determine which special projects a client has.  Currently AVII has Water Bills and MTC will have Propane Tanks.  Feature access can be determined by reading /clients/{clientId}/config/activities[] array and looking for keywords activity:WaterBills or activity:PropaneTanks.  Other special applications will apply in the future.
3. **UX**: Eventually bilingual but initial deployment will be Spanish only with menu, input and confirmation screens all in simple Spanish.

### Task 1.22 - Propane Tank Readings PWA | Agent_Mobile
- **Objective:** Create PWA modal
- **Output:** PWA with working maintenace navigation and data entry, structured around simple navigation to the task assigned by user and client
- **Guidance:** Specific tasks for specific clients.  Code for Water Meter Readings in PWA is complete but not integrated and "maintenance" user role is not defined.

1. **Client Navigation:** When user logs in and is assigned only one property, skip client selector and go straight to the available options
2. **Client-specific:** Use or Build helper functions to determine which special projects a client has.  Currently AVII has Water Bills and MTC will have Propane Tanks.  Feature access can be determined by reading /clients/{clientId}/config/activities[] array and looking for keywords activity:WaterBills or activity:PropaneTanks.  Other special applications will apply in the future.
3. **UX**: Eventually bilingual but initial deployment will be Spanish only with menu, input and confirmation screens all in simple Spanish.


### Task 1.3 – Restore Core Admin Functions │ Agent_Mobile
- **Objective:** Restore basic admin functionality in PWA for data viewing and client management
- **Output:** PWA with working admin navigation, data viewing, and client switching
- **Guidance:** Focus on read-only functionality before implementing write operations

1. **Admin Navigation:** Implement navigation menu structure for admin users with appropriate options
2. **Data Viewing:** Restore read-only data viewing capabilities for transactions, units, and other entities
1. **Client Switching:** Ensure client context switching works properly for multi-client admin access
4. **Real Data Testing:** Test all core functions with production-like data from development environment
5. **Document Issues:** Create list of remaining broken features for systematic resolution in next phase

### Task 1.4 – Design Mobile Admin Interface │ Agent_Mobile
- **Objective:** Design mobile-optimized admin interface for field payment and expense entry
- **Output:** Approved mobile UI design optimized for touch input and slow connections
- **Guidance:** Depends on: Task 1.3 Output. Prioritize data efficiency and touch-friendly controls

1. **Navigation Design:** Create mobile navigation pattern optimized for admin tasks (bottom tabs or hamburger menu)
2. **Payment Layouts:** Design touch-friendly layouts for expense, HOA, and water payment entry forms
1. **Responsive Forms:** Design form controls with appropriate sizing for touch input and error prevention
4. **Lightweight Views:** Create data views optimized for slow LTE connections with minimal data transfer
5. **Design Approval:** Get user approval on overall design approach and specific layout choices

### Task 1.5 – Implement Expense Entry Module │ Agent_Mobile
- **Objective:** Create mobile-optimized expense entry form for field expense recording
- **Output:** Functional expense entry module with validation and optional receipt photos
- **Guidance:** Depends on: Task 1.4 Output. Focus on common expense scenarios and quick entry

1. **Create Form Component:** Build mobile-optimized expense entry form with appropriate field layout
2. **Category Selection:** Implement searchable category/vendor selection with recent items for quick access
1. **Validation Logic:** Add comprehensive validation and user-friendly error handling with clear messages
4. **API Integration:** Connect form to expense submission endpoints with proper error handling
5. **Photo Capability:** Add optional receipt photo capture using device camera (if available)
6. **Scenario Testing:** Test various expense entry scenarios with user for completeness

### Task 1.6 – Implement HOA Payment Module │ Agent_Mobile
- **Objective:** Create mobile HOA payment recording interface with credit balance handling
- **Output:** HOA payment module with unit selection, credit management, and receipt generation
- **Guidance:** Depends on: Task 1.4 Output. Handle complex credit balance and overpayment scenarios

1. **Unit Selection UI:** Create efficient unit selection interface for multiple unit payments
2. **Dues Calculation:** Implement automatic dues amount calculation based on unit configuration
1. **Credit Balance Logic:** Add credit balance application and overpayment handling with clear display
4. **Receipt Generation:** Implement digital receipt generation with all payment details
5. **API Connection:** Connect to HOA payment endpoints with proper error handling
6. **Credit Testing:** Test payment scenarios including credit application with user validation

### Task 1.7 – Implement Water Payment Module │ Agent_Mobile
- **Objective:** Create mobile water bills payment interface with penalty calculations
- **Output:** Water payment module handling penalties, credits, and receipt generation
- **Guidance:** Depends on: Task 1.4 Output. Complex penalty and credit calculations required

1. **Bill Selection UI:** Create month/bill selection interface showing outstanding bills clearly
2. **Penalty Calculation:** Implement automatic penalty calculation for overdue bills with clear display
1. **Credit Application:** Add credit balance application logic matching desktop implementation
4. **Receipt Generation:** Generate detailed payment receipts including penalties and credits
5. **API Connection:** Connect to water payment endpoints with comprehensive error handling
6. **Penalty Testing:** Test complex scenarios including multiple overdue bills with penalties

### Task 1.8 – Optimize for Field Conditions │ Agent_Mobile
- **Objective:** Optimize PWA performance for real-world field conditions with poor connectivity
- **Output:** PWA optimized for LTE/poor connectivity with caching and offline capabilities
- **Guidance:** Depends on: Task 1.5, 1.6, 1.7 Output. Test in actual field conditions

1. **Aggressive Caching:** Implement comprehensive caching strategy for offline data access
2. **Request Queuing:** Add request queue for poor connectivity with retry logic
1. **Bundle Optimization:** Minimize bundle size through code splitting and lazy loading
4. **Data Minimization:** Reduce data transfer requirements for all API calls
5. **Field Testing:** Conduct real-world testing on LTE network with user in field conditions
