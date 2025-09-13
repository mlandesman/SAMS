# Active Modules (Used in Running Application)
**Generated:** 2025-09-10
**Purpose:** Document all modules actively imported and used in the SAMS application

## Entry Points

### Main Application
- `/frontend/sams-ui/src/main.jsx` - Application entry point, creates React root
- `/frontend/sams-ui/src/App.jsx` - Main app component with routing (imports at line 1-28)
- `/frontend/sams-ui/src/index.css` - Global styles

### Mobile Application (PWA)
- `/frontend/sams-ui/mobile-app/src/main.jsx` - Mobile PWA entry point
- `/frontend/sams-ui/mobile-app/src/App.jsx` - Mobile app routing

## Core Context Providers (All Active)

### Authentication & Client Management
- `/frontend/sams-ui/src/context/AuthContext.jsx` - Authentication state (App.jsx:7)
- `/frontend/sams-ui/src/context/ClientContext.jsx` - Client selection/switching (App.jsx:3)
- `/frontend/sams-ui/src/context/StatusBarContext.jsx` - Status bar notifications (App.jsx:6)

### Data Contexts
- `/frontend/sams-ui/src/context/TransactionsContext.jsx` - Transaction state (App.jsx:4)
- `/frontend/sams-ui/src/context/TransactionFiltersContext.jsx` - Transaction filters (App.jsx:5)
- `/frontend/sams-ui/src/context/ExchangeRateContext.jsx` - Exchange rate management (App.jsx:8)

## Layout Components

- `/frontend/sams-ui/src/layout/MainLayout.jsx` - Main application layout wrapper (App.jsx:10)

## Guard Components

- `/frontend/sams-ui/src/components/MaintenanceGuard.jsx` - Maintenance mode handler (App.jsx:21)
- `/frontend/sams-ui/src/components/guards/AuthGuard.jsx` - Authentication guard (App.jsx:24)
- `/frontend/sams-ui/src/components/security/ClientProtectedRoute.jsx` - Permission-based routing (App.jsx:23)

## Views (Active Routes)

### Primary Routes (App.jsx Routes)
- `/frontend/sams-ui/src/views/SplashScreen.jsx` - Initial loading screen (App.jsx:11)
- `/frontend/sams-ui/src/views/DashboardView.jsx` - Dashboard view (App.jsx:14, routes: /, /dashboard)
- `/frontend/sams-ui/src/views/TransactionsView.jsx` - Transaction management (App.jsx:15, route: /transactions)
- `/frontend/sams-ui/src/views/ListManagementView.jsx` - List management (App.jsx:17, route: /lists)
- `/frontend/sams-ui/src/views/UnitReportView.jsx` - Unit reports (App.jsx:20, route: /unit-report)
- `/frontend/sams-ui/src/views/ExchangeRatesView.jsx` - Exchange rates (App.jsx:25, route: /exchange-rates)
- `/frontend/sams-ui/src/views/AddExpenseView.jsx` - Add expense form (App.jsx:26, route: /add-expense)
- `/frontend/sams-ui/src/views/PasswordSetupView.jsx` - Password setup (App.jsx:22, route: /setup-password)

### Water Bills Feature (ACTIVE VERSION)
- `/frontend/sams-ui/src/views/WaterBillsViewV3.jsx` - **ACTIVE** Water Bills view (App.jsx:27, routes: /waterbills, /water-bills)
  - Uses tab layout with 3 tabs: Readings, Bills, History
  - Imports at line 1-18 of WaterBillsViewV3.jsx

### Dynamic Activity Routes
- `/frontend/sams-ui/src/views/ActivityView.jsx` - Dynamic activity router (App.jsx:16, route: /:activity)
  - Maps activities to views dynamically
  - Imports `WaterBillsSimple.jsx` for legacy compatibility (line 6)
  - Imports `HOADuesView.jsx` for HOA management (line 5)
  - Imports `SettingsView.jsx` for settings (line 8)

### Demo/Test Routes
- `/frontend/sams-ui/src/views/DigitalReceiptDemo.jsx` - Receipt demo (App.jsx:18, route: /receipt-demo)
- `/frontend/sams-ui/src/components/TestRoute.jsx` - Test route (App.jsx:19, route: /test)

## Water Bills Components (ACTIVE)

### Primary Water Components (Used by WaterBillsViewV3)
- `/frontend/sams-ui/src/components/water/WaterReadingEntry.jsx` - Water meter reading entry (WaterBillsViewV3:184)
  - **Table Structure:** 5 columns (Unit, Owner, Prior Reading, Current Reading, Consumption)
  - Handles unit readings + Common Area + Building Meter
- `/frontend/sams-ui/src/components/water/WaterBillsList.jsx` - Bills display (WaterBillsViewV3:197)
- `/frontend/sams-ui/src/components/water/WaterHistoryGrid.jsx` - History grid (WaterBillsViewV3:206)
- `/frontend/sams-ui/src/components/water/WaterPaymentModal.jsx` - Payment modal (likely used by WaterBillsList)

### Water API Services
- `/frontend/sams-ui/src/api/waterAPI.js` - Main water API service (WaterBillsViewV3:8)
- `/frontend/sams-ui/src/api/waterMeterService.js` - Water meter service

### Water Styles
- `/frontend/sams-ui/src/views/WaterBillsIntegratedView.css` - Integrated view styles (WaterBillsViewV3:18)
- `/frontend/sams-ui/src/components/water/WaterReadingEntry.css` - Reading entry styles

## HOA Dues Components

### Views
- `/frontend/sams-ui/src/views/HOADuesView.jsx` - HOA dues management (ActivityView:5)

### Context
- `/frontend/sams-ui/src/context/HOADuesContext.jsx` - HOA state management (ActivityView:9)

### Components
- `/frontend/sams-ui/src/components/DuesPaymentModal.jsx` - HOA payment modal
  - Contains transaction linking pattern (stores transactionId)

## Common Components

### UI Components
- `/frontend/sams-ui/src/components/ClientSwitchModal.jsx` - Client selection modal (App.jsx:12)
- `/frontend/sams-ui/src/components/ExchangeRateModal.jsx` - Exchange rate modal (App.jsx:13)
- `/frontend/sams-ui/src/components/common/ActivityActionBar.jsx` - Action bar (WaterBillsViewV3:4)

## Utility Modules

### Mobile Detection
- `/frontend/sams-ui/src/utils/mobileDetection.js` - Mobile detection utilities (App.jsx:30)
- `/frontend/sams-ui/src/styles/force-mobile-overrides.css` - Mobile override styles (App.jsx:31)

### Version Management
- `/frontend/sams-ui/src/utils/versionChecker.js` - Version checking (App.jsx:32)

### Hooks
- `/frontend/sams-ui/src/hooks/useExchangeRates.js` - Exchange rate hook (App.jsx:9)

## Backend Routes (Active)

### Water Domain Routes
- `/backend/routes/water.js` - Water routes
- `/backend/routes/waterMeters.js` - Water meter routes
- `/backend/routes/waterReadings.js` - Water reading routes
- `/backend/routes/waterRoutes.js` - Main water routing

### Other Domain Routes
- `/backend/routes/api.js` - General API routes (needs migration to domain-specific)
- `/backend/routes/transactions.js` - Transaction routes
- `/backend/routes/units.js` - Unit management routes
- `/backend/routes/clients.js` - Client management routes

## Key Implementation Details

### Water Bills Table Structure (VERIFIED)
Location: `/frontend/sams-ui/src/components/water/WaterReadingEntry.jsx`
Lines: 237-374

**Actual Table Columns (5 total):**
1. Unit (10% width) - Unit ID
2. Owner (25% width) - Owner name
3. Prior Reading (20% width) - Previous meter reading
4. Current Reading (20% width) - Input field for new reading
5. Consumption (m³) (25% width) - Calculated consumption

**Special Rows:**
- Common Area (CA) - Line 313-341
- Building Meter (BM) - Line 344-372

### Transaction Linking Pattern (HOA Dues)
Location: `/frontend/sams-ui/src/components/DuesPaymentModal.jsx`
- Stores `transactionId` from createTransaction response
- Used for receipt generation and audit trail

### API Structure
- Currently uses mixed patterns: `/api/`, `/water/`, `/system/`
- Water Bills uses domain-specific `/water/` routes
- Exchange Rates needs public access (no auth)

## Mobile PWA Status
**WARNING:** Mobile PWA at `/frontend/sams-ui/mobile-app/` appears to be outdated
- Last updated: Over 1 month ago
- Breaking changes: Database structure, API endpoints, authentication flow
- Status: Likely non-functional, needs recovery