# SAMS (Sandy's Accounting Management System) – Implementation Plan

**Memory Strategy:** dynamic-md
**Last Modification:** Manager Agent 8 - Split Transactions project completion update
**Project Overview:** Complete critical SAMS features to achieve production-ready status for parallel operation with Google Sheets systems. Focus on Water Bills completion, API architecture refactoring, PWA recovery for mobile admin functions, and automated reporting with bilingual support.

## ✅ COMPLETED PROJECTS

### Split Transactions Enhancement (COMPLETED - September 2025)
**Status:** ✅ FULLY IMPLEMENTED AND PRODUCTION-READY
- **Scope:** Comprehensive 6-phase implementation of split transaction functionality
- **Achievement:** Quicken-style split transaction interface with ID-first architecture
- **Key Features:** SplitEntryModal, running balance validation, allocations array processing
- **Architecture:** Frontend sends IDs, backend resolves ID→name (robust data integrity)
- **Integration:** Full transaction system integration with HOA dues allocations foundation
- **Status:** Core functionality complete, Edit Transactions enhancement identified as follow-up task

## Phase 1: Water Bills Completion

### Task 1.1 – Define Car/Boat Wash Configuration Fields │ Agent_Water
- **Objective:** Define configuration fields for car and boat wash rates to enable usage-based billing in Water Bills module
- **Output:** Field specification document with names, types, and default values for user to implement in Firebase config
- **Guidance:** Follow existing monetary field patterns (integers in pesos), align with rateM3 structure, provide clear implementation instructions

- Define field names using camelCase: `carWashRate` and `boatWashRate` as integer fields storing peso amounts
- Document exact location in waterbills config structure where fields should be added
- Specify default values as 100 pesos for car washes and 200 pesos for boat washes
- Create implementation instructions for user to manually add fields via Firebase console

### Task 1.2 – Implement Car/Boat Wash Frontend UI │ Agent_Water
- **Objective:** Add car and boat wash count entry fields to Water Bills reading interface with calculated charge display
- **Output:** Enhanced Water Bills entry form with wash count inputs and real-time charge calculation display
- **Guidance:** CRITICAL: Use `/frontend/sams-ui/src/views/WaterBillsViewV3.jsx` (NOT WaterBillsSimple or WaterBillsIntegratedView). Table is in `/frontend/sams-ui/src/components/water/WaterReadingEntry.jsx`

1. **Research Current Structure:** Analyze WaterReadingEntry.jsx (lines 237-374) - table has 5 columns: Unit, Owner, Prior Reading, Current Reading, Consumption
2. **Add Input Columns:** Add carWashes and boatWashes integer input columns AFTER Consumption column (currently line 251 defines columns)
3. **Design Compact UI:** Collaborate with user on space-efficient design - table already handles Common Area (line 313) and Building Meter (line 344) as special rows
4. **Display Calculations:** Show calculated wash charges in bill preview using count × rate formula from config
5. **User Validation:** Test complete data entry flow with user for approval of functionality and layout

### Task 1.3 – Update Water Bills Backend Calculations │ Agent_Water
- **Objective:** Modify backend endpoints to process wash counts and include charges in bill calculations
- **Output:** Updated aggregation and CRUD endpoints handling wash data with proper charge calculations
- **Guidance:** Depends on: Task 1.2 Output. Modify existing endpoints rather than creating new ones, maintain consistency with current calculation patterns

1. **Update Aggregation:** Modify water bills aggregation endpoint to fetch and include wash count data from readings
2. **Enhance Calculations:** Update bill total calculation logic to add wash charges (carWashes × carWashRate + boatWashes × boatWashRate)
3. **Modify Write Endpoint:** Update CRUD write endpoint to accept and store wash count integers in database
4. **Verify Consistency:** Test that backend calculations match frontend preview displays exactly

### Task 1.4 – Implement Transaction Linking │ Agent_Water
- **Objective:** Create bidirectional linking between Water Bills payments and transaction records for audit trail
- **Output:** Transaction linking system storing transactionId in Water Bills with click-through navigation
- **Guidance:** Study HOA Dues implementation - specifically `/frontend/sams-ui/src/components/DuesPaymentModal.jsx` which stores transactionId for receipt generation

1. **Study HOA Pattern:** Research DuesPaymentModal.jsx - see how it captures `result.transactionId` from createTransaction response
2. **Store Transaction ID:** Capture and store transactionId returned from createTransaction call in Water Bills payment record (likely in WaterPaymentModal.jsx)
3. **Implement Navigation:** Create click-through navigation from Water Bills payment to linked transaction with proper routing
4. **Extract Shared Logic:** Consider creating utility function for transaction linking to enable reuse across other payment modules

### Task 1.5 – Enable Cascade Delete Support │ Agent_Water
- **Objective:** Implement cascade delete handling to properly reverse Water Bills payments when transactions are deleted
- **Output:** Cascade delete integration that reverses payments, restores credits, and recalculates penalties
- **Guidance:** Depends on: Task 1.4 Output. Review transaction controller implementation, add required fields to match HOA structure

1. **Review Delete Logic:** Study deleteTransaction cascade implementation in transaction controller to understand reversal patterns
2. **Add Required Fields:** Enhance Water Bills documents with payment array and credit balance array matching HOA Dues structure
3. **Register Handler:** Add Water Bills module to cascade delete handler registry in transaction controller
4. **Test Reversals:** Verify deletion properly reverses credits, removes payments, and recalculates penalties

### Task 1.6 – Restore Water Bills UI Layout │ Agent_Water
- **Objective:** Restore original attractive Water Bills UI design from screenshots while preserving functionality
- **Output:** Restored tab-based layout with original styling matching approved design screenshots
- **Guidance:** Reference /docs/Water Bills Screens.pdf. Current implementation in WaterBillsViewV3.jsx already has tabs (lines 145-177), focus on styling improvements

1. **Analyze Screenshots:** Review original Water Bills design in /docs/Water Bills Screens.pdf to understand layout structure and styling
2. **Enhance Tab Layout:** Current tabs exist (Readings, Bills, History) in WaterBillsViewV3.jsx - improve visual design to match screenshots
3. **Apply Styling:** Update `/frontend/sams-ui/src/views/WaterBillsIntegratedView.css` with original colors, typography, spacing
4. **Ensure Responsiveness:** Verify layout works properly across desktop, tablet, and mobile screen sizes
5. **Final Approval:** Get user sign-off with side-by-side comparison to original screenshots

## Phase 2: API Architecture Refactoring

### Task 2.1 – Audit and Document Current Endpoints │ Agent_API
- **Objective:** Create comprehensive inventory of all existing API endpoints with authentication requirements and usage patterns
- **Output:** Complete endpoint audit document with current paths, proposed domains, and migration checklist
- **Guidance:** Multiple water route files exist: water.js, waterMeters.js, waterReadings.js, waterRoutes.js - check which are actually mounted in Express app

1. **Review Documentation:** Study `/apm_v0.3_summary/12_API_DOCUMENTATION.md` to understand already documented endpoints
2. **Check Backend Routes:** Review `/backend/routes/` directory - note duplicate water files that may need consolidation
3. **Map to Domains:** Create mapping table showing current endpoint path → proposed domain-specific path for migration
4. **Document Auth Requirements:** Identify which endpoints require authentication tokens versus public access (Exchange Rates must be public)
5. **Create Migration Checklist:** Produce comprehensive checklist of all endpoints to migrate with priority order

### Task 2.2 – Design Domain-Specific Route Structure │ Agent_API
- **Objective:** Design logical domain-based API architecture replacing generic /api/ routes with feature-specific domains
- **Output:** Approved route structure design document with domains, auth strategy, and naming conventions
- **Guidance:** Depends on: Task 2.1 Output. Create domains for /water/, /hoa/, /transactions/, /admin/, /public/

1. **Organize by Domain:** Group endpoints into logical domains based on feature area and authentication requirements
2. **Define Auth Strategy:** Document authentication requirements per domain (public access for /public/, token for others)
3. **Establish Conventions:** Create consistent naming conventions for routes within each domain following RESTful patterns
4. **User Approval:** Present complete domain design to user for approval before implementation begins

### Task 2.3 – Implement Domain-Aware Middleware │ Agent_API
- **Objective:** Create flexible middleware system supporting domain-specific authentication and routing requirements
- **Output:** Domain-aware middleware with public and protected route handling based on path patterns
- **Guidance:** Depends on: Task 2.2 Output. Handle Exchange Rates as public, implement token validation for protected routes

1. **Create Router Middleware:** Develop domain-aware routing middleware that directs requests based on path patterns
2. **Public Route Handler:** Implement authentication bypass for public routes (e.g., /public/exchange-rates)
3. **Protected Route Handler:** Implement token validation middleware for protected domains with proper error responses
4. **Domain Configuration:** Add domain-specific middleware configurations for special requirements per domain
5. **Exchange Rate Handling:** Ensure Exchange Rates endpoint works without authentication as specified requirement

### Task 2.4 – Migrate Backend Endpoints │ Agent_API
- **Objective:** Systematically migrate all backend endpoints from generic /api/ to domain-specific paths
- **Output:** All endpoints migrated to appropriate domains with complete documentation of changes
- **Guidance:** Depends on: Task 2.3 Output. No backward compatibility needed, migrate incrementally with testing

1. **Update Base URLs:** Modify base_URL patterns in backend route files to use domain-specific paths
2. **Migrate Water Domain:** Move all Water Bills endpoints to /water/ domain and verify functionality
3. **Migrate HOA Domain:** Move HOA-related endpoints to /hoa/ domain with proper routing
4. **Migrate Remaining:** Move transaction, admin, and other endpoints to their respective domains
5. **Test Domains:** Thoroughly test each domain's endpoints to ensure proper routing and authentication
6. **Document Changes:** Create comprehensive documentation of all endpoint migrations for frontend reference

### Task 2.5 – Update Frontend Service Layer │ Agent_API
- **Objective:** Update all frontend API calls to use new domain-specific endpoints with abstraction layer
- **Output:** Frontend service layer using new domain endpoints with successful end-to-end testing
- **Guidance:** Depends on: Task 2.4 Output. Create service abstraction layer, update all component API calls

1. **Create Service Abstraction:** Build API service abstraction layer with domain-specific modules for organized code
2. **Update Configurations:** Modify base_URL configurations throughout frontend to use new domain paths
3. **Update Components:** Systematically update all API calls in React components to use new endpoints
4. **Module Testing:** Test each frontend module's API interactions to ensure proper communication
5. **End-to-End Testing:** Perform comprehensive testing with user to verify all features work with new endpoints

## Phase 3: Mobile Admin PWA Recovery & Enhancement

### Task 3.1 – Assess PWA Breaking Changes │ Agent_Mobile
- **Objective:** Document all system changes that broke PWA functionality during 1+ month of desktop development
- **Output:** Comprehensive breaking changes report with recovery plan and effort estimates
- **Guidance:** PWA at `/frontend/sams-ui/mobile-app/` hasn't been touched in 1+ month. Desktop app uses different paths and components now

1. **Document System Changes:** List all major changes - database structure, API endpoints (now domain-specific), authentication flow
2. **Check PWA Status:** PWA is at localhost:5174 (mentioned as "out-of-date" in original requirements) - verify if it even starts
3. **Component Assessment:** PWA likely uses old water components (not WaterBillsViewV3) and old API patterns
4. **Recovery Planning:** Create detailed recovery plan with user input on approach and priorities
5. **Effort Estimation:** Provide realistic effort estimates for full PWA recovery to functional state

### Task 3.2 – Restore PWA Foundation │ Agent_Mobile
- **Objective:** Update PWA core systems to work with current database, APIs, and authentication
- **Output:** Functional PWA that loads, authenticates, and displays basic data correctly
- **Guidance:** Depends on: Task 3.1 Output, Task 2.5 Output by Agent_API. Focus on core functionality before features

1. **Update Data Models:** Align PWA data models with current database structures and field names
2. **Update API Calls:** Modify all API calls to use new domain-specific endpoints from API refactoring
3. **Fix Authentication:** Implement compatibility with new authentication middleware and token handling
4. **Restore Client Context:** Update client context management and user role detection for proper data scoping
5. **Basic Testing:** Verify PWA loads, authenticates, and connects to backend successfully
6. **Role Verification:** Confirm admin versus user role differentiation works as designed

### Task 3.3 – Restore Core Admin Functions │ Agent_Mobile
- **Objective:** Restore basic admin functionality in PWA for data viewing and client management
- **Output:** PWA with working admin navigation, data viewing, and client switching
- **Guidance:** Depends on: Task 3.2 Output. Focus on read-only functionality before implementing write operations

1. **Admin Navigation:** Implement navigation menu structure for admin users with appropriate options
2. **Data Viewing:** Restore read-only data viewing capabilities for transactions, units, and other entities
3. **Client Switching:** Ensure client context switching works properly for multi-client admin access
4. **Real Data Testing:** Test all core functions with production-like data from development environment
5. **Document Issues:** Create list of remaining broken features for systematic resolution in next phase

### Task 3.4 – Design Mobile Admin Interface │ Agent_Mobile
- **Objective:** Design mobile-optimized admin interface for field payment and expense entry
- **Output:** Approved mobile UI design optimized for touch input and slow connections
- **Guidance:** Depends on: Task 3.3 Output. Prioritize data efficiency and touch-friendly controls

1. **Navigation Design:** Create mobile navigation pattern optimized for admin tasks (bottom tabs or hamburger menu)
2. **Payment Layouts:** Design touch-friendly layouts for expense, HOA, and water payment entry forms
3. **Responsive Forms:** Design form controls with appropriate sizing for touch input and error prevention
4. **Lightweight Views:** Create data views optimized for slow LTE connections with minimal data transfer
5. **Design Approval:** Get user approval on overall design approach and specific layout choices

### Task 3.5 – Implement Expense Entry Module │ Agent_Mobile
- **Objective:** Create mobile-optimized expense entry form for field expense recording
- **Output:** Functional expense entry module with validation and optional receipt photos
- **Guidance:** Depends on: Task 3.4 Output. Focus on common expense scenarios and quick entry

1. **Create Form Component:** Build mobile-optimized expense entry form with appropriate field layout
2. **Category Selection:** Implement searchable category/vendor selection with recent items for quick access
3. **Validation Logic:** Add comprehensive validation and user-friendly error handling with clear messages
4. **API Integration:** Connect form to expense submission endpoints with proper error handling
5. **Photo Capability:** Add optional receipt photo capture using device camera (if available)
6. **Scenario Testing:** Test various expense entry scenarios with user for completeness

### Task 3.6 – Implement HOA Payment Module │ Agent_Mobile
- **Objective:** Create mobile HOA payment recording interface with credit balance handling
- **Output:** HOA payment module with unit selection, credit management, and receipt generation
- **Guidance:** Depends on: Task 3.4 Output. Handle complex credit balance and overpayment scenarios

1. **Unit Selection UI:** Create efficient unit selection interface for multiple unit payments
2. **Dues Calculation:** Implement automatic dues amount calculation based on unit configuration
3. **Credit Balance Logic:** Add credit balance application and overpayment handling with clear display
4. **Receipt Generation:** Implement digital receipt generation with all payment details
5. **API Connection:** Connect to HOA payment endpoints with proper error handling
6. **Credit Testing:** Test payment scenarios including credit application with user validation

### Task 3.7 – Implement Water Payment Module │ Agent_Mobile
- **Objective:** Create mobile water bills payment interface with penalty calculations
- **Output:** Water payment module handling penalties, credits, and receipt generation
- **Guidance:** Depends on: Task 3.4 Output. Complex penalty and credit calculations required

1. **Bill Selection UI:** Create month/bill selection interface showing outstanding bills clearly
2. **Penalty Calculation:** Implement automatic penalty calculation for overdue bills with clear display
3. **Credit Application:** Add credit balance application logic matching desktop implementation
4. **Receipt Generation:** Generate detailed payment receipts including penalties and credits
5. **API Connection:** Connect to water payment endpoints with comprehensive error handling
6. **Penalty Testing:** Test complex scenarios including multiple overdue bills with penalties

### Task 3.8 – Optimize for Field Conditions │ Agent_Mobile
- **Objective:** Optimize PWA performance for real-world field conditions with poor connectivity
- **Output:** PWA optimized for LTE/poor connectivity with caching and offline capabilities
- **Guidance:** Depends on: Task 3.5, 3.6, 3.7 Output. Test in actual field conditions

1. **Aggressive Caching:** Implement comprehensive caching strategy for offline data access
2. **Request Queuing:** Add request queue for poor connectivity with retry logic
3. **Bundle Optimization:** Minimize bundle size through code splitting and lazy loading
4. **Data Minimization:** Reduce data transfer requirements for all API calls
5. **Field Testing:** Conduct real-world testing on LTE network with user in field conditions

## Phase 4: Reports & Email System

### Task 4.1 – Gather Report Requirements │ Agent_Reports
- **Objective:** Document comprehensive requirements for all report types including bilingual support needs
- **Output:** Complete report specifications document with data requirements and translation needs
- **Guidance:** Review Google Sheets samples, plan for English/Spanish support from the start

1. **Review Samples:** Analyze user's Google Sheets report samples to understand current format and content
2. **Document Data Needs:** List all data fields required for each report type (receipts, unit reports, statements)
3. **Bilingual Requirements:** Identify all text requiring translation (boilerplate, labels, headers)
4. **Translation Planning:** Research Google Cloud Translation API for dynamic content translation
5. **User Approval:** Get approval on report specifications and bilingual approach

### Task 4.2 – Design Report Templates │ Agent_Reports
- **Objective:** Create professional report templates with bilingual support for all report types
- **Output:** Approved HTML/PDF templates for receipts, unit reports, and monthly statements
- **Guidance:** Depends on: Task 4.1 Output. Include translation placeholders, match existing report quality

1. **Receipt Template:** Design payment receipt template with Sandyland branding and bilingual text sections
2. **Unit Report Template:** Create chronological transaction report template with running balance display
3. **Statement Template:** Design monthly HOA statement template with financial summaries and charts
4. **Translation Placeholders:** Include structured placeholders for dynamic translation of content
5. **Design Approval:** Get user approval on all template designs and bilingual layout

### Task 4.3 – Select Technical Stack │ Agent_Reports
- **Objective:** Evaluate and select libraries for PDF generation, charting, and translation
- **Output:** Technical stack documentation with selected libraries and integration approach
- **Guidance:** Consider compatibility between chart library and PDF generation, verify Gmail API support

1. **PDF Library Selection:** Evaluate PDF generation libraries (puppeteer, jsPDF, pdfkit) for features and performance
2. **Chart Library Choice:** Select charting library (Chart.js recommended) compatible with PDF export
3. **Translation API Research:** Investigate Google Cloud Translation API integration requirements and costs
4. **Gmail Compatibility:** Verify Gmail API supports attachment handling for selected PDF format
5. **Technical Approval:** Document technical choices and get user approval before implementation

### Task 4.4 – Implement Payment Receipts │ Agent_Reports
- **Objective:** Implement payment receipt generation with bilingual support and PDF output
- **Output:** Functional receipt generation system storing PDFs in Firebase
- **Guidance:** Depends on: Task 4.2, 4.3 Output. Apply user language preference for text selection

1. **Fetch Transaction Data:** Retrieve payment transaction details including unit, amount, and payment method
2. **Apply Language Preference:** Select appropriate language text based on user's preferredLanguage field
3. **Generate PDF Receipt:** Create PDF with unique receipt number and formatted transaction details
4. **Firebase Storage:** Store generated receipt in Firebase Storage for retrieval and audit trail
5. **Payment Type Testing:** Test receipt generation with HOA, water, and expense payments

### Task 4.5 – Implement Unit Reports │ Agent_Reports
- **Objective:** Generate comprehensive unit reports showing all fiscal year activity with bilingual support
- **Output:** Unit report generation showing chronological transactions with running balances
- **Guidance:** Depends on: Task 4.2, 4.3 Output. Include all charge types and payments, handle dynamic translation

1. **Aggregate Charges:** Fetch all unit charges within fiscal year (HOA dues, water bills, special assessments)
2. **Aggregate Payments:** Retrieve all payments and credit applications for the unit
3. **Chronological Sorting:** Sort all transactions by date and calculate running balance after each
4. **Bilingual Generation:** Generate report in user's preferred language with static text translation
5. **Dynamic Translation:** Implement translation for dynamic content (descriptions, notes)
6. **Accuracy Validation:** Test report accuracy with user using known test data

### Task 4.6 – Implement Monthly Statements │ Agent_Reports
- **Objective:** Create monthly HOA financial statements with collection summaries and bilingual support
- **Output:** Monthly statement generation with income/expense summaries and payment status
- **Guidance:** Depends on: Task 4.2, 4.3 Output. Aggregate community-wide financial data

1. **Income Aggregation:** Calculate monthly income by category (HOA dues, water bills, other fees)
2. **Expense Aggregation:** Summarize monthly expenses by category with vendor details
3. **Payment Status:** Generate HOA payment collection status showing paid/unpaid units
4. **Bilingual Statement:** Create statement with language-appropriate headers and labels
5. **Real Data Testing:** Validate statement accuracy with actual monthly data

### Task 4.7 – Add Chart Visualizations │ Agent_Reports
- **Objective:** Implement charts for visual representation of financial data in reports
- **Output:** Interactive charts embedded in reports with PDF export compatibility
- **Guidance:** Depends on: Task 4.5, 4.6 Output. Ensure charts render properly in PDF format

1. **Collection Pie Chart:** Create payment status pie chart showing collected vs outstanding percentages
2. **Income/Expense Bar Chart:** Implement monthly comparison bar charts for financial trends
3. **Trend Line Charts:** Add line charts showing key metrics over time (collection rate, balances)
4. **PDF Compatibility:** Ensure all charts render correctly when exported to PDF format
5. **Chart Accuracy:** Verify chart data matches report numbers exactly

### Task 4.8 – Integrate Gmail Service │ Agent_Reports
- **Objective:** Implement email delivery system using Gmail API for report distribution
- **Output:** Functional email service sending reports with bilingual templates
- **Guidance:** Depends on: Task 4.4, 4.5, 4.6 Output. Use sandyland.com.mx domain, implement queue for reliability

1. **Gmail API Setup:** Configure Gmail API with sandyland.com.mx domain credentials
2. **OAuth2 Implementation:** Set up OAuth2 authentication flow for Gmail access
3. **Email Templates:** Create bilingual email templates for each report type
4. **Attachment Handling:** Implement PDF attachment functionality for report delivery
5. **Queue Implementation:** Add email queue with retry logic for reliability
6. **Delivery Testing:** Test email delivery with user credentials and verify receipt