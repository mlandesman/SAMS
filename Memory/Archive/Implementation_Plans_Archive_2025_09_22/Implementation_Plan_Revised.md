# SAMS Implementation Plan (Revised)

## Phase 1: Water Bills Completion - Agent_Water

Task 1.1: Define Car/Boat Wash Configuration Fields - Agent_Water
- Define field names: carWashRate and boatWashRate (integers in pesos, like rateM3)
- Document config location and structure for user to create fields
- Specify default values (100 pesos car, 200 pesos boat)

Task 1.2: Implement Car/Boat Wash Frontend UI - Agent_Water
1. Ad-Hoc Delegation – Research Water Bills data entry table structure
2. Add carWashes and boatWashes integer input columns to reading entry table
3. Explore compact UI design with user (icon columns? expandable section?)
4. Display calculated wash charges in bill preview (count × rate)
5. Test data entry flow with user approval

Task 1.3: Update Water Bills Backend Calculations - Agent_Water - Depends on Task 1.2 output
1. Modify water bills aggregation endpoint to include wash counts
2. Update bill calculation to add wash charges (count × rate from config)
3. Modify CRUD write endpoint to store wash count integers
4. Test calculations match frontend preview

Task 1.4: Implement Transaction Linking - Agent_Water
1. Ad-Hoc Delegation – Study HOA Dues transaction linking in hoadues module
2. Store transactionId from createTransaction response in Water Bills payment
3. Implement navigation from Water Bills to linked transaction
4. Consider extracting shared logic to utility function for reuse

Task 1.5: Enable Cascade Delete Support - Agent_Water - Depends on Task 1.4 output
1. Ad-Hoc Delegation – Review deleteTransaction cascade logic in transaction controller
2. Add required fields to Water Bills (payment array, credit balance array)
3. Register Water Bills in cascade delete handler
4. Test deletion properly reverses credits and penalties

Task 1.6: Restore Water Bills UI Layout - Agent_Water
1. Review original Water Bills screenshots in /docs/Water Bills Screens.pdf
2. Restore tab-based layout structure with user feedback
3. Apply original styling (colors, fonts, spacing)
4. Ensure responsive design for various screens
5. Get final approval comparing to original design

## Phase 2: API Architecture Refactoring - Agent_API

Task 2.1: Audit and Document Current Endpoints - Agent_API
1. Review 12_API_DOCUMENTATION.md for documented endpoints
2. Search codebase for all /api/, /water/, /system/ route patterns
3. Map current endpoints to proposed domain structure
4. Identify which endpoints need authentication vs public access
5. Create comprehensive migration checklist

Task 2.2: Design Domain-Specific Route Structure - Agent_API - Depends on Task 2.1 output
1. Organize endpoints into domains: /water/, /hoa/, /transactions/, /admin/, /public/
2. Define authentication requirements per domain
3. Document new route naming conventions
4. Get user approval on domain organization

Task 2.3: Implement Domain-Aware Middleware - Agent_API - Depends on Task 2.2 output
1. Create routing middleware for domain-specific paths
2. Implement public route handling (no auth required)
3. Implement protected route handling with token validation
4. Add domain-specific middleware configurations
5. Include specific handling for Exchange Rates (public access)

Task 2.4: Migrate Backend Endpoints - Agent_API - Depends on Task 2.3 output
1. Update base_URL patterns in backend route files
2. Migrate Water Bills routes to /water/ domain
3. Migrate HOA routes to /hoa/ domain
4. Migrate remaining routes to appropriate domains
5. Test each domain's endpoints function correctly
6. Document all endpoint changes for frontend team

Task 2.5: Update Frontend Service Layer - Agent_API - Depends on Task 2.4 output
1. Create API service abstraction layer with domain-specific modules
2. Update base_URL configurations to use new domains
3. Modify all API calls throughout components
4. Test each module's API interactions
5. Perform comprehensive end-to-end testing with user

## Phase 3: Mobile Admin PWA Recovery & Enhancement - Agent_Mobile

Task 3.1: Assess PWA Breaking Changes - Agent_Mobile
1. Document all system changes since PWA last updated (1+ month)
2. List broken dependencies: data models, API endpoints, auth flow
3. Identify salvageable components vs needs-rebuild
4. Create recovery plan with user input
5. Estimate effort for full PWA recovery

Task 3.2: Restore PWA Foundation - Agent_Mobile - Depends on Task 3.1 output, Task 2.5 output by Agent_API
1. Update PWA data models to match current database structures
2. Update all API calls to new domain-specific endpoints
3. Implement new authentication middleware compatibility
4. Restore client context and user role detection
5. Test basic PWA loads and authenticates properly
6. Verify admin vs user role differentiation works

Task 3.3: Restore Core Admin Functions - Agent_Mobile - Depends on Task 3.2 output
1. Implement basic navigation for admin users
2. Restore data viewing capabilities (read-only)
3. Ensure client switching works properly
4. Test core functions with real data
5. Document remaining broken features for next phase

Task 3.4: Design Mobile Admin Interface - Agent_Mobile - Depends on Task 3.3 output
1. Design mobile navigation optimized for admin tasks
2. Create touch-friendly layouts for payment entry
3. Design lightweight views for slow connections
4. Create consistent form patterns for data entry
5. Get user approval on design approach

Task 3.5: Implement Expense Entry Module - Agent_Mobile - Depends on Task 3.4 output
1. Create mobile-optimized expense form
2. Implement category/vendor selection
3. Add validation and error handling
4. Connect to expense API endpoints
5. Add optional receipt photo capability
6. Test various expense scenarios with user

Task 3.6: Implement HOA Payment Module - Agent_Mobile - Depends on Task 3.4 output
1. Create unit selection interface
2. Implement dues amount calculation
3. Add credit balance handling logic
4. Generate digital receipts
5. Connect to HOA payment endpoints
6. Test payment scenarios including credits

Task 3.7: Implement Water Payment Module - Agent_Mobile - Depends on Task 3.4 output
1. Create month/bill selection interface
2. Calculate penalties for overdue bills
3. Implement credit application logic
4. Generate payment receipts
5. Connect to water payment endpoints
6. Test including penalty scenarios

Task 3.8: Optimize for Field Conditions - Agent_Mobile - Depends on Tasks 3.5, 3.6, 3.7 output
1. Implement aggressive caching for offline capability
2. Add request queuing for poor connectivity
3. Optimize bundle size and lazy loading
4. Minimize data transfer for LTE
5. Field test on actual mobile network with user

## Phase 4: Reports & Email System - Agent_Reports

Task 4.1: Gather Report Requirements - Agent_Reports
1. Review user's Google Sheets reports samples
2. Document data requirements for each report type
3. Identify bilingual text requirements (English/Spanish)
4. Plan for translation API integration
5. Get user approval on report specifications

Task 4.2: Design Report Templates - Agent_Reports - Depends on Task 4.1 output
1. Create payment receipt template with bilingual support
2. Design unit report template (chronological transactions)
3. Create monthly HOA statement template
4. Include placeholders for dynamic translations
5. Get design approval from user

Task 4.3: Select Technical Stack - Agent_Reports
1. Evaluate and select PDF generation library
2. Choose charting library (Chart.js recommended)
3. Research Google Cloud Translation API integration
4. Verify Gmail API compatibility
5. Document technical choices for user approval

Task 4.4: Implement Payment Receipts - Agent_Reports - Depends on Tasks 4.2, 4.3 output
1. Fetch payment transaction data
2. Apply bilingual text based on user preference
3. Generate PDF with unique receipt number
4. Store in Firebase for retrieval
5. Test with various payment types

Task 4.5: Implement Unit Reports - Agent_Reports - Depends on Tasks 4.2, 4.3 output
1. Aggregate all charges for unit in fiscal year
2. Aggregate all payments and credits
3. Sort chronologically and calculate running balance
4. Generate bilingual report based on user language
5. Add translation for dynamic content
6. Validate accuracy with user test data

Task 4.6: Implement Monthly Statements - Agent_Reports - Depends on Tasks 4.2, 4.3 output
1. Aggregate monthly financial data by category
2. Calculate collection rates and balances
3. Generate payment status summary
4. Create bilingual statement
5. Test with real monthly data

Task 4.7: Add Chart Visualizations - Agent_Reports - Depends on Tasks 4.5, 4.6 output
1. Implement collection status pie chart
2. Create income/expense bar charts
3. Add trend line charts for metrics
4. Ensure charts work in PDF export
5. Test chart rendering and accuracy

Task 4.8: Integrate Gmail Service - Agent_Reports - Depends on Tasks 4.4, 4.5, 4.6 output
1. Configure Gmail API with sandyland.com.mx
2. Implement OAuth2 authentication
3. Create email templates with bilingual support
4. Add attachment handling for PDFs
5. Implement email queue for reliability
6. Test delivery with user credentials