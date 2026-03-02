# Active Modules (Used in Running Application)
**Last Updated:** 2026-03-02
**Purpose:** Document all modules actively imported and used in the SAMS application across desktop, mobile PWA, backend, and Cloud Functions.

---

## Codebase Statistics

| Area | Files | Code Lines | Comments | Blanks |
|------|------:|----------:|----------:|-------:|
| Backend | 351 | 76,961 | 15,919 | 15,921 |
| Frontend Desktop | 369 | 79,653 | 7,765 | 11,523 |
| Mobile App (PWA) | 65 | 11,262 | 618 | 1,426 |
| Shared | 5 | 813 | 515 | 174 |
| Cloud Functions (unique) | 33 | 3,848 | 1,770 | 918 |
| **TOTAL** | **823** | **172,537** | **26,587** | **29,962** |

> Counts exclude `_archive/`, `node_modules/`, test files, and SVG assets.
> `functions/backend/` is a mirror of `backend/` and is counted once.

---

## Desktop Application

### Entry Points
- `/frontend/sams-ui/src/main.jsx` — React root, wraps App in `ClientProvider`, registers global error handlers (EM-3)
- `/frontend/sams-ui/src/App.jsx` — Main app component with routing, context providers, auth flow
- `/frontend/sams-ui/src/index.css` — Global styles
- `/frontend/sams-ui/src/App.css` — App-level styles
- `/frontend/sams-ui/src/firebaseClient.js` — Firebase client initialization

### Context Providers (wrapped around AppContent)
| Provider | File | Purpose |
|----------|------|---------|
| `AuthProvider` | `context/AuthContext.jsx` | Authentication state, login/logout, user profile |
| `ExchangeRateProvider` | `context/ExchangeRateContext.jsx` | Exchange rate data and gap-fill logic |
| `ClientProvider` | `context/ClientContext.jsx` | Client (property) selection and switching |
| `TransactionsProvider` | `context/TransactionsContext.jsx` | Transaction state management |
| `TransactionFiltersProvider` | `context/TransactionFiltersContext.jsx` | Transaction filter state |
| `StatusBarProvider` | `context/StatusBarContext.jsx` | Status bar notifications |
| `HOADuesProvider` | `context/HOADuesContext.jsx` | HOA dues state (wraps HOADuesView via ActivityView) |
| `WaterBillsProvider` | `context/WaterBillsContext.jsx` | Water bills state (wraps WaterBillsViewV3) |
| `ListManagementProvider` | `context/ListManagementContext.jsx` | List management state (wraps ListManagementView via ActivityView) |

### App-Level Guards and Wrappers
- `components/MaintenanceGuard.jsx` — Maintenance mode handler (outermost wrapper)
- `components/ErrorBoundary.jsx` — React error boundary
- `components/guards/AuthGuard.jsx` — Authentication guard for standalone routes
- `components/security/ClientProtectedRoute.jsx` — Permission-based route protection
- `components/security/PermissionGuard.jsx` — `SuperAdminGuard` and permission components

### Layout (Active Files from `layout/`)
| File | Purpose |
|------|---------|
| `layout/MainLayout.jsx` | Main application shell: sidebar + content + status bar + PWA nav |
| `layout/Sidebar.jsx` | Navigation sidebar with dynamic menu from client config |
| `layout/Sidebar.css` | Sidebar styles |
| `layout/StatusBar.jsx` | Bottom status bar with version info, search, date filters |
| `layout/StatusBar.css` | Status bar styles |
| `layout/AboutModal.jsx` | About/version modal (opened from StatusBar) |
| `layout/Layout.css` | Layout container styles |
| `layout/ActionBar.css` | Shared action bar styles (imported by many views) |

> **Note:** The `layout/` directory contains ~60 additional `.jsx` files that are **unused duplicates** of files in `components/`. Only the 8 files listed above are actively imported. See [Layout Duplication](#layout-duplication-note) below.

### Routes (Desktop)

#### Public Routes (no auth required)
| Route | View | Notes |
|-------|------|-------|
| `/setup-password` | `views/PasswordSetupView.jsx` | Password setup for new users |
| `/vote/:token` | `views/PublicVotingPage.jsx` | Public poll voting via token |

#### Standalone Auth Routes (auth required, no client selection, outside MainLayout)
| Route | View | Notes |
|-------|------|-------|
| `/receipt-demo` | `views/DigitalReceiptDemo.jsx` | Receipt demo/test |
| `/test` | `components/TestRoute.jsx` | Transaction management test page |

#### Main Application Routes (auth + client selection, inside MainLayout)
| Route | View | Permission |
|-------|------|-----------|
| `/`, `/dashboard` | `views/DashboardView.jsx` | `dashboard.view` |
| `/transactions` | `views/TransactionsView.jsx` | `transactions.view` |
| `/lists` | `views/ListManagementView.jsx` | `client.manage` |
| `/unit-report` | `views/UnitReportView.jsx` | `unit.view` |
| `/exchange-rates` | `views/ExchangeRatesView.jsx` | — |
| `/waterbills`, `/water-bills` | `views/WaterBillsViewV3.jsx` | — |
| `/propane` | `components/propane/PropaneView.jsx` | — |
| `/add-expense` | `views/AddExpenseView.jsx` | `transactions.create` |
| `/:activity` (dynamic) | `views/ActivityView.jsx` | — |
| `*` (fallback) | `views/DashboardView.jsx` | — |

#### Dynamic Activities (via ActivityView)
| Activity | View | Context Wrapper |
|----------|------|-----------------|
| `dashboard` | `views/DashboardView.jsx` | — |
| `transactions` | `views/TransactionsView.jsx` | — |
| `hoadues` | `views/HOADuesView.jsx` | `HOADuesProvider` |
| `waterbills` | `views/WaterBillsSimple.jsx` | — |
| `reports` | `views/ReportsView.jsx` | — |
| `projects` | `views/ProjectsView.jsx` | — |
| `budgets` | `views/BudgetView.jsx` | — |
| `listmanagement`, `users` | `views/ListManagementView.jsx` | `ListManagementProvider` |
| `settings` | `views/SettingsView.jsx` | — |
| `propanetanks`, `propane` | `components/propane/PropaneView.jsx` | — |

### Views
| File | Lines | Description |
|------|------:|-------------|
| `views/DashboardView.jsx` | 996 | Main dashboard with financial summary, budget status, unit accounts |
| `views/TransactionsView.jsx` | 1,688 | Transaction management with filters, CRUD, split entries |
| `views/ListManagementView.jsx` | 1,335 | Units, categories, vendors, payment methods, users management |
| `views/HOADuesView.jsx` | 1,050 | HOA dues management |
| `views/ProjectsView.jsx` | 949 | Special assessment projects with bids, vendors, documents |
| `views/DigitalReceiptDemo.jsx` | 921 | Digital receipt demo |
| `views/SettingsView.jsx` | 413 | Settings: exchange rates, import, year-end, backup, errors |
| `views/WaterBillsViewV3.jsx` | 347 | Water bills: readings, bills, history, consumption analysis |
| `views/BudgetView.jsx` | 345 | Budget entry, reports, polls |
| `views/WaterBillsSimple.jsx` | 296 | Legacy water bills (used via ActivityView) |
| `views/PublicVotingPage.jsx` | 283 | Public poll voting page |
| `views/ExchangeRatesView.jsx` | — | Exchange rates display |
| `views/UnitReportView.jsx` | 186 | Unit report viewer |
| `views/ReportsView.jsx` | 148 | Reports: Statement of Account, Budget vs Actual |
| `views/AddExpenseView.jsx` | — | Quick expense entry |
| `views/SplashScreen.jsx` | — | Loading/splash screen |
| `views/PasswordSetupView.jsx` | — | Password setup |
| `views/ActivityView.jsx` | 78 | Dynamic activity router |
| `views/settings/YearEndProcessing.jsx` | 539 | Year-end processing UI |
| `views/settings/BackupSettings.jsx` | 211 | Backup management UI |

### Components (Active — `components/`)

#### Water Bills
| File | Purpose |
|------|---------|
| `components/water/WaterReadingEntry.jsx` | Water meter reading entry grid (5-column table) |
| `components/water/WaterBillsList.jsx` | Bills display with payment tracking |
| `components/water/WaterHistoryGrid.jsx` | History grid view |
| `components/water/WaterHistoryQuarterly.jsx` | Quarterly history view |
| `components/water/WaterPaymentModal.jsx` | Water bill payment modal |
| `components/water/WaterConsumptionAnalysis.jsx` | Consumption analysis charts |
| `components/water/WaterConsumptionReportTab.jsx` | Consumption report tab |
| `components/water/WashModal.jsx` | WASH (Water and Sewer Handling) modal |
| `components/water/CSVImporter.jsx` | CSV import for water readings |

#### Propane
| File | Purpose |
|------|---------|
| `components/propane/PropaneView.jsx` | Propane tank levels view |
| `components/propane/PropaneHistoryTable.jsx` | Propane history table |

#### Transactions
| File | Purpose |
|------|---------|
| `components/TransactionConfirmationModal.jsx` | Transaction confirmation |
| `components/TransactionDetailModal.jsx` | Transaction detail view |
| `components/TransactionDetails.jsx` | Transaction details display |
| `components/TransactionTable.jsx` | Transaction table |
| `components/TransactionsRoute.jsx` | Transaction routing |
| `components/transactions/SplitEntryModal.jsx` | Split transaction entry |

#### Payments
| File | Purpose |
|------|---------|
| `components/payments/UnifiedPaymentModal.jsx` | Unified payment modal (HOA, water, etc.) |
| `components/DuesPaymentModal-old.jsx` | Legacy HOA payment modal (**should be archived**) |
| `components/PaymentDetailsModal.jsx` | Payment details display |

#### Credit Balance
| File | Purpose |
|------|---------|
| `components/CreditBalanceEditModal.jsx` | Credit balance editing |
| `components/CreditBalanceHistoryModal.jsx` | Credit balance history |
| `components/CreditBalanceAddModal.jsx` | Add credit balance |
| `components/CreditBalanceRemoveModal.jsx` | Remove credit balance |
| `components/CreditBalanceEditEntryModal.jsx` | Edit credit entry |
| `components/CreditBalanceConfirmModal.jsx` | Credit balance confirmation |

#### Reports
| File | Purpose |
|------|---------|
| `components/reports/StatementOfAccountTab.jsx` | Statement of Account report |
| `components/reports/BudgetActualTab.jsx` | Budget vs Actual report |
| `components/reports/UnitReport.jsx` | Unit-level financial report |
| `components/reports/common/ReportControlBar.jsx` | Report controls |
| `components/reports/common/ReportPreviewContainer.jsx` | Report preview |
| `components/reports/common/ReportCommon.css` | Shared report styles |

#### Budget
| File | Purpose |
|------|---------|
| `components/budget/BudgetEntryTab.jsx` | Budget data entry |
| `components/budget/BudgetReportTab.jsx` | Budget report display |

#### Polls
| File | Purpose |
|------|---------|
| `components/polls/PollCreationWizard.jsx` | Poll creation wizard |
| `components/polls/PollDetailView.jsx` | Poll detail/results view |
| `components/polls/PollsList.jsx` | Polls listing |
| `components/polls/ResponseEntryModal.jsx` | Poll response entry |

#### Projects
| File | Purpose |
|------|---------|
| `components/projects/ProjectFormModal.jsx` | Project form |
| `components/projects/ProjectDocumentsList.jsx` | Project documents |
| `components/projects/BidsManagementModal.jsx` | Bids management |
| `components/projects/BidFormModal.jsx` | Individual bid form |
| `components/projects/BidComparisonView.jsx` | Bid comparison |
| `components/projects/VendorPaymentsTable.jsx` | Vendor payments |
| `components/projects/UnitAssessmentsTable.jsx` | Unit assessments |

#### Documents
| File | Purpose |
|------|---------|
| `components/documents/DocumentViewer.jsx` | Document viewer |
| `components/documents/DocumentUploader.jsx` | Document upload |
| `components/documents/DocumentList.jsx` | Document listing |
| `components/documents/DocumentThumbnail.jsx` | Document thumbnail |

#### Lists (used by ListManagementView)
| File | Purpose |
|------|---------|
| `components/lists/ModernBaseList.jsx` | Base list component |
| `components/lists/ModernUnitList.jsx` | Unit list |
| `components/lists/ModernVendorList.jsx` | Vendor list |
| `components/lists/ModernCategoryList.jsx` | Category list |
| `components/lists/ModernPaymentMethodList.jsx` | Payment method list |
| `components/lists/ExchangeRatesList.jsx` | Exchange rates list |
| `components/lists/VendorList.jsx` | Legacy vendor list |
| `components/lists/VendorFormModal.jsx` | Vendor form |
| `components/lists/SystemErrorsList.jsx` | System errors list |

#### Modals
| File | Purpose |
|------|---------|
| `components/modals/ClientFormModal.jsx` | Client form modal |
| `components/modals/UnitFormModal.jsx` | Unit form modal |
| `components/modals/CategoryFormModal.jsx` | Category form modal |
| `components/modals/PaymentMethodFormModal.jsx` | Payment method form |
| `components/modals/VendorFormModal.jsx` | Vendor form modal |
| `components/modals/DeleteConfirmationModal.jsx` | Delete confirmation |
| `components/modals/ConfirmationModal.jsx` | General confirmation |
| `components/modals/EmailPrependModal.jsx` | Email prepend |
| `components/modals/ItemDetailModal.jsx` | Item detail view |

#### Admin
| File | Purpose |
|------|---------|
| `components/admin/UserManagement.jsx` | User management (1,569 lines) |
| `components/admin/ClientManagement.jsx` | Client management |

#### Settings
| File | Purpose |
|------|---------|
| `components/Settings/ImportManagement.jsx` | Import management UI |
| `components/Settings/SystemErrorsSection.jsx` | System errors display |
| `components/Settings/InfoTooltip.jsx` | Info tooltip component |

#### Dashboard
| File | Purpose |
|------|---------|
| `components/Dashboard/ErrorDetailModal.jsx` | Error detail modal |
| `components/Dashboard/ErrorMonitorCard.jsx` | Error monitor card |

#### Common/Shared UI
| File | Purpose |
|------|---------|
| `components/common/ActivityActionBar.jsx` | Action bar for views |
| `components/common/LoadingSpinner.jsx` | Loading spinner |
| `components/common/UserPicker.jsx` | User picker |
| `components/common/ExportMenu.jsx` | Export menu (CSV, PDF) |
| `components/common/index.js` | Common exports barrel |

#### Other Components
| File | Purpose |
|------|---------|
| `components/ClientSwitchModal.jsx` | Client selection modal |
| `components/ClientSwitcher.jsx` | Client switcher |
| `components/ExchangeRateModal.jsx` | Exchange rate status modal |
| `components/ExchangeRatesDisplay.jsx` | Exchange rates display |
| `components/LoginForm.jsx` | Login form |
| `components/UnifiedExpenseEntry.jsx` | Unified expense entry form |
| `components/CurrencyCalculatorModal.jsx` | Currency calculator modal |
| `components/CurrencyCalculator.jsx` | Currency calculator |
| `components/DigitalReceipt.jsx` | Digital receipt component |
| `components/AdvancedFilterModal.jsx` | Advanced transaction filter |
| `components/FilterSwitchModal.jsx` | Filter switch modal |
| `components/DateRangeDropdown.jsx` | Date range dropdown |
| `components/DateTimeDisplay.jsx` | Date/time display |
| `components/ConfirmationDialog.jsx` | Confirmation dialog |
| `components/NotificationModal.jsx` | Notification modal |
| `components/PasswordChangeModal.jsx` | Password change |
| `components/MaintenancePage.jsx` | Maintenance mode page |
| `components/ExpenseModal.jsx` | Expense modal |
| `components/ExpenseSuccessModal.jsx` | Expense success feedback |
| `components/ImportFileUploader.jsx` | Import file uploader |
| `components/AccountReconciliation.jsx` | Account reconciliation |
| `components/CriticalErrorAlert.jsx` | Critical error display |
| `components/ChangelogDisplay.jsx` | Changelog display |
| `components/GlobalSearch.jsx` | Global search |
| `components/HOADuesTransactionCard.jsx` | HOA dues transaction card |
| `components/ListManagementStatusContent.jsx` | List management status |
| `components/ContextMenu.jsx` | Context menu |
| `components/VersionDisplay.jsx` | Version display |
| `components/PWANavigation.jsx` | PWA bottom navigation |
| `components/TestRoute.jsx` | Test route page |

### Hooks
| File | Purpose |
|------|---------|
| `hooks/useDashboardData.js` | Dashboard data fetching and aggregation (574 lines) |
| `hooks/useExchangeRates.js` | Exchange rate operations with gap-fill |
| `hooks/useBudgetStatus.js` | Budget status calculations |
| `hooks/useUnitAccountStatus.js` | Unit account status |
| `hooks/useTransactionFilters.js` | Transaction filter logic |
| `hooks/useNotification.js` | Notification hook |
| `hooks/useErrorMonitor.js` | Error monitoring |
| `hooks/useLoadingSpinner.js` | Loading spinner state |

### API Services (`api/`)
| File | Purpose |
|------|---------|
| `api/enhancedApiClient.js` | Enhanced API client with auth headers |
| `api/enhancedApiClientOptimized.js` | Optimized API client |
| `api/secureApiClient.js` | Secure API client |
| `api/apiUtils.js` | API utilities |
| `api/waterAPI.js` | Water bills API |
| `api/waterMeterService.js` | Water meter API |
| `api/hoaDuesAPI.js` | HOA dues API |
| `api/hoaDuesService.js` | HOA dues service |
| `api/unifiedPaymentAPI.js` | Unified payment API |
| `api/transaction.js` | Transaction API |
| `api/exchangeRates.js` | Exchange rates API |
| `api/budget.js` | Budget API |
| `api/projects.js` | Projects API |
| `api/polls.js` | Polls API |
| `api/propaneAPI.js` | Propane API |
| `api/documents.js` | Documents API |
| `api/categories.js` | Categories API |
| `api/vendors.js` | Vendors API |
| `api/units.js` | Units API |
| `api/paymentMethods.js` | Payment methods API |
| `api/client.js` | Client API |
| `api/clientManagement.js` | Client management API |
| `api/admin.js` | Admin API |
| `api/user.js` | User API |
| `api/email.js` | Email API |
| `api/translate.js` | Translation API (DeepL) |
| `api/importStorage.js` | Import storage API |
| `api/systemErrors.js` | System error reporting API |

### Utilities (`utils/`)
| File | Purpose |
|------|---------|
| `utils/timezone.js` | Timezone handling (America/Cancun) |
| `utils/fiscalYearUtils.js` | Fiscal year calculations |
| `utils/userRoles.js` | Role checking (isAdmin, isSuperAdmin) |
| `utils/clientFeatures.js` | Client feature flags (hasWaterBills, etc.) |
| `utils/currencyUtils.js` | Currency formatting |
| `utils/mobileDetection.js` | Mobile/PWA detection |
| `utils/versionChecker.js` | Version checking |
| `utils/versionUtils.js` | Version display utilities |
| `utils/cacheManagement.js` | Cache/hard reset management |
| `utils/databaseFieldMappings.js` | Database field mappings |
| `utils/transactionPdfTemplate.js` | Transaction PDF template |
| `utils/receiptUtils.js` | Receipt utilities |
| `utils/csvExport.js` | CSV export |
| `utils/printUtils.js` | Print utilities |
| `utils/numberToWords.js` | Number to words conversion |
| `utils/unitDisplayUtils.js` | Unit display formatting |
| `utils/unitContactUtils.js` | Unit contact utilities |
| `utils/unitUtils.js` | Unit utilities |
| `utils/roleUtils.js` | Role utilities |
| `utils/exchangeRates.js` | Exchange rate utilities |
| `utils/hoaDuesUtils.js` | HOA dues utilities |
| `utils/hoaDuesImporter.js` | HOA dues import |
| `utils/balanceRecalculation.js` | Balance recalculation |
| `utils/lastKnownBalances.js` | Last known balance tracking |
| `utils/clientAccounts.js` | Client account utilities |
| `utils/dateFiltering.js` | Date filter utilities |
| `utils/transactionFiltering.js` | Transaction filter logic |
| `utils/fetchTransactions.js` | Transaction fetching |
| `utils/fetchClients.js` | Client fetching |
| `utils/debug.js` | Debug utilities |

### Services
| File | Purpose |
|------|---------|
| `services/reportService.js` | Report generation service (486 lines) |

### Styles
| File | Purpose |
|------|---------|
| `styles/SandylandModalTheme.css` | Sandyland modal theme |
| `styles/SandylandEmailBranding.css` | Email branding styles |
| `styles/force-mobile-overrides.css` | Mobile override styles |
| `styles/InputModal.css` | Input modal styles |

---

## Mobile PWA Application

**URL:** `mobile.sams.sandyland.com.mx`
**Local Dev:** Port 5174
**Status:** Active and running in production
**Framework:** React + Material-UI + Vite PWA

### Entry Points
- `/frontend/sams-ui/mobile-app/src/main.jsx` — React root with PWA service worker registration
- `/frontend/sams-ui/mobile-app/src/App.jsx` — Mobile app routing with MUI theme
- `/frontend/sams-ui/mobile-app/src/styles/mobile.css` — Mobile-specific styles
- `/frontend/sams-ui/mobile-app/vite.config.js` — Vite config with PWA plugin

### Auth
- `hooks/useAuthStable.jsx` — Stable auth hook (`AuthProvider`, `useAuth`)
- `hooks/useAuth.jsx` — Alternative auth hook
- `services/firebase.js` — Firebase client initialization

### Routes (Mobile)

#### Public Routes
| Route | Component | Notes |
|-------|-----------|-------|
| `/auth` | `AuthScreen.jsx` | Login/authentication |
| `*` (fallback) | Redirects to `/auth` | — |

#### Test/Debug Routes
| Route | Component | Notes |
|-------|-----------|-------|
| `/test` | `AuthTest.jsx` | Auth test |
| `/simple-test` | `SimpleAuthTest.jsx` | Simple auth test |
| `/minimal-test` | `MinimalAuthTest.jsx` | Minimal auth test |
| `/super-simple` | `SuperSimpleTest.jsx` | Super simple test |
| `/ultra-simple` | `UltraSimpleTest.jsx` | Ultra simple test |
| `/auth-debug` | `AuthDebugScreen.jsx` | Auth debug |
| `/user-debug` | `UserDebugger.jsx` | User debug |

#### Protected Routes (auth required)
| Route | Component | Role |
|-------|-----------|------|
| `/`, `/dashboard` | `Dashboard.jsx` | any |
| `/exchange-rates` | `ExchangeRatesView.jsx` | any |
| `/about` | `AboutScreen.jsx` | any |
| `/expense-entry` | `expense/ExpenseEntryScreen.jsx` | admin |
| `/expense-desktop` | `ExpenseForm.jsx` | admin |
| `/clients` | `ClientSelect.jsx` | admin |
| `/my-report` | `MyUnitReport.jsx` | unitOwner |
| `/my-report-old` | `UnitOwnerFinancialReport.jsx` | unitOwner (legacy) |
| `/expense/:clientId` | `ExpenseForm.jsx` | admin (legacy) |
| `/confirmation` | `Confirmation.jsx` | any |

### Mobile Components
| File | Purpose |
|------|---------|
| `components/Layout.jsx` | Mobile app shell with AppBar and PWA navigation |
| `components/PWANavigation.jsx` | Bottom navigation bar |
| `components/Dashboard.jsx` | Mobile dashboard |
| `components/AuthScreen.jsx` | Authentication screen |
| `components/ClientSelect.jsx` | Client selection |
| `components/ClientSwitcher.jsx` | Client switcher |
| `components/ExpenseForm.jsx` | Expense form |
| `components/Confirmation.jsx` | Confirmation screen |
| `components/ExchangeRatesView.jsx` | Exchange rates |
| `components/ExchangeRateTools.jsx` | Exchange rate tools |
| `components/CurrencyCalculatorModal.jsx` | Currency calculator |
| `components/CurrencyCalculator.jsx` | Currency calculator (inline) |
| `components/UnitReport.jsx` | Unit report |
| `components/MyUnitReport.jsx` | Unit owner's report |
| `components/UnitOwnerFinancialReport.jsx` | Unit owner financial report |
| `components/UserProfileManager.jsx` | User profile management |
| `components/AboutScreen.jsx` | About screen |
| `components/ProtectedRoute.jsx` | Auth route protection |
| `components/RoleProtectedRoute.jsx` | Role-based route protection |
| `components/common/LoadingSpinner.jsx` | Loading spinner |
| `components/documents/DocumentViewer.jsx` | Document viewer |
| `components/documents/DocumentUploader.jsx` | Document uploader |
| `components/documents/DocumentList.jsx` | Document list |
| `components/expense/ExpenseEntryScreen.jsx` | Expense entry screen |
| `components/expense/ExpenseForm.jsx` | Expense form (new) |
| `components/expense/ExpenseConfirmation.jsx` | Expense confirmation |
| `components/expense/ClientSelector.jsx` | Client selector for expense |

### Mobile Hooks
| File | Purpose |
|------|---------|
| `hooks/useAuthStable.jsx` | Stable auth hook (primary) |
| `hooks/useAuth.jsx` | Auth hook |
| `hooks/useDashboardData.js` | Dashboard data |
| `hooks/useExpenseForm.jsx` | Expense form logic |
| `hooks/useExpenseForm.js` | Expense form logic (JS variant) |
| `hooks/useClients.js` | Client data |
| `hooks/useClients.jsx` | Client data (JSX variant) |
| `hooks/useExchangeRates.jsx` | Exchange rates |

### Mobile Services
| File | Purpose |
|------|---------|
| `services/api.js` | Main API service |
| `services/enhancedApiClient.js` | Enhanced API client |
| `services/firebase.js` | Firebase client |

### Mobile Utilities
| File | Purpose |
|------|---------|
| `utils/timezone.js` | Timezone handling |
| `utils/versionChecker.js` | Version checking |
| `utils/versionUtils.js` | Version utilities |

---

## Backend

### Entry Point
- `/backend/index.js` — Express app setup, CORS, middleware, route mounting

### Route Mounting (from `index.js`)

#### Public Routes (no auth)
| Mount Path | Route File | Purpose |
|------------|-----------|---------|
| `/system/exchange-rates` | `routes/exchangeRates.js` | Exchange rate API |
| `/system/version` | `routes/version.js` | Version endpoint |
| `/system/health` | Inline handler | Health check |
| `/error-reporting` | `routes/systemRoutes.js` | Error reporting |
| `/api/auth` | `routes/auth.js` | Authentication |
| `/` | Inline handler | Root status |

#### Auth-Aware Routes
| Mount Path | Route File | Purpose |
|------------|-----------|---------|
| `/comm/email` | `routes/emailRoutes.js` | Communication email |
| `/water` | `routes/waterRoutes.js` | Water billing domain |
| `/propane` | `routes/propaneRoutes.js` | Propane domain |
| `/vote` | `routes/voteRoutes.js` | Polling/voting |
| `/auth/user` | `routes/user.js` | User management |
| `/clients` | `routes/clientRoutes.js` | Client domain router |
| `/translate` | `routes/translateRoutes.js` | DeepL translation |

#### Admin Routes (`authenticateUserWithProfile` middleware)
| Mount Path | Route File | Purpose |
|------------|-----------|---------|
| `/admin` | `routes/admin.js` | Admin router |
| `/hoadues` | `routes/hoaDues.js` | HOA dues |
| `/reports/:clientId` | `routes/reports.js` | Reports |
| `/credit` | `routes/creditRoutes.js` | Credit balance |
| `/payments` | `routes/paymentRoutes.js` | Unified payments |
| `/budgets` | `routes/budgets.js` | Budgets |

#### Sub-routes via `clientRoutes.js` (under `/clients/:clientId/`)
| Sub-path | Route File |
|----------|-----------|
| `/transactions` | `routes/transactions.js` |
| `/accounts` | `routes/accounts.js` |
| `/balances` | `routes/balances.js` |
| `/vendors` | `routes/vendors.js` |
| `/categories` | `routes/categories.js` |
| `/paymentMethods` | `routes/paymentMethods.js` |
| `/units` | `routes/units.js` |
| `/email` | `routes/email.js` |
| `/reports` | `routes/reports.js` |
| `/projects` | `routes/projects.js` |
| `/config` | `routes/config.js` |
| `/year-end` | `routes/yearEnd.js` |

#### Sub-routes via `admin.js` (under `/admin/`)
| Sub-path | Route File |
|----------|-----------|
| `/onboarding` | `routes/clientOnboarding.js` |
| `/client-management` | `routes/clientManagement.js` |
| `/import` | `routes/import.js` |

#### Unmounted Route Files (in `routes/` but not in `index.js`)
- `routes/user-uid-based.js` — Legacy user route
- `routes/user-email-docid.js` — Legacy user route
- `routes/user-uid-based-backup.js` — Backup
- `routes/exchangeRates-enterprise.js` — Enterprise variant
- `routes/monitoring-enterprise.js` — Enterprise monitoring
- `routes/creditAutoPayReportRoutes.js` — Not yet mounted

### Controllers (`controllers/`)
| File | Purpose |
|------|---------|
| `clientsController.js` | Client CRUD |
| `userManagementController.js` | User management (1,163 lines) |
| `transactionsController.js` | Transaction CRUD (1,518 lines) |
| `accountsController.js` | Account management |
| `vendorsController.js` | Vendor CRUD |
| `categoriesController.js` | Category CRUD |
| `paymentMethodsController.js` | Payment method CRUD |
| `unitsController.js` | Unit CRUD |
| `documentsController.js` | Document management |
| `hoaDuesController.js` | HOA dues management (1,538 lines) |
| `unifiedPaymentController.js` | Unified payment processing |
| `creditController.js` | Credit balance management |
| `creditAutoPayReportController.js` | Credit auto-pay reports |
| `waterReadingsController.js` | Water readings |
| `waterBillsController.js` | Water bills |
| `waterPaymentsController.js` | Water payments |
| `propaneController.js` | Propane management |
| `budgetController.js` | Budget management |
| `budgetsController.js` | Budget management (alternate) |
| `statementController.js` | Statement generation |
| `bulkStatementController.js` | Bulk statement generation |
| `exchangeRatesController.js` | Exchange rates |
| `balancesController.js` | Balance management |
| `yearEndController.js` | Year-end processing |
| `yearEndBalancesController.js` | Year-end balances |
| `projectsController.js` | Projects management |
| `projectsDataController.js` | Projects data |
| `pollsController.js` | Polls/voting (1,023 lines) |
| `associationsController.js` | Associations |
| `ownersController.js` | Owners |
| `importController.js` | Data import (1,025 lines) |
| `importMetadataController.js` | Import metadata |
| `clientOnboardingController.js` | Client onboarding |
| `emailConfigController.js` | Email configuration |
| `emailService.js` | Email sending (1,104 lines, misplaced — functions as controller) |
| `translateController.js` | Translation |

#### Enterprise/Unused Controllers
- `transactionsController-enterprise.js`
- `exchangeRatesController-enterprise.js`
- `balancesController-enterprise.js`

### Services (`services/`)
| File | Lines | Purpose |
|------|------:|---------|
| `importService.js` | 2,616 | Data import processing |
| `statementDataService.js` | 2,332 | Statement data generation |
| `statementHtmlService.js` | 1,558 | Statement HTML rendering |
| `unifiedPaymentWrapper.js` | 1,457 | Unified payment wrapper |
| `waterDataService.js` | 987 | Water data operations |
| `waterBillsService.js` | 984 | Water bill operations |
| `waterBillReportHtmlService.js` | 900 | Water bill report HTML |
| `waterPaymentsService.js` | 834 | Water payment operations |
| `waterMeterService.js` | 585 | Water meter operations |
| `waterBillReportService.js` | 532 | Water bill report generation |
| `waterConsumptionAnalysisService.js` | — | Water consumption analysis |
| `waterReadingsService.js` | — | Water readings |
| `meterReadingService.js` | — | Meter readings |
| `budgetActualHtmlService.js` | 616 | Budget vs Actual HTML |
| `budgetActualDataService.js` | 360 | Budget vs Actual data |
| `budgetActualTextService.js` | — | Budget vs Actual text |
| `budgetReportHtmlService.js` | 479 | Budget report HTML |
| `creditService.js` | 431 | Credit balance operations |
| `creditAutoPayReportService.js` | 315 | Credit auto-pay reports |
| `emailService.js` | 381 | Email sending |
| `penaltyRecalculationService.js` | 269 | Penalty recalculation |
| `statementDataCollector.js` | 652 | Statement data collection |
| `projectsService.js` | 349 | Projects service |
| `bidComparisonHtmlService.js` | 358 | Bid comparison HTML |
| `yearEndReportService.js` | 246 | Year-end reports |
| `backupService.js` | 406 | Database backup |
| `pdfService.js` | — | PDF generation |
| `imageResizeService.js` | — | Image resizing |
| `propaneReadingsService.js` | — | Propane readings |
| `errorCaptureService.js` | — | Error capture |
| `generateUPCData.js` | 620 | UPC data generation |
| `generateStatementData.js` | 284 | Statement data |
| `DataAggregator.js` | 469 | Data aggregation |
| `ReportEngine.js` | — | Report engine |
| `DateService.js` | 200 | Date/time operations |

### Middleware (`middleware/`)
| File | Purpose |
|------|---------|
| `clientAuth.js` | Authentication + user profile loading (`authenticateUserWithProfile`) |
| `unitAuthorization.js` | Unit-level access control |
| `auditContext.js` | Audit context injection |
| `criticalErrorNotifier.js` | Critical error notification |
| `fieldValidation.js` | Field validation |
| `waterValidation.js` | Water domain validation |
| `security-enterprise.js` | Enterprise security (unused in main flow) |

### Utilities (`utils/` — 31 files)
| File | Purpose |
|------|---------|
| `timezone.js` | Timezone utilities |
| `hoaCalculations.js` | HOA calculation logic |
| `batchOperations.js` | Firestore batch operations |
| `penaltyCalculator.js` | Penalty calculation |
| `dateNormalization.js` | Date normalization |
| `fiscalYearUtils.js` | Fiscal year utilities |
| `currencyUtils.js` | Currency formatting |
| `databaseFieldMappings.js` | Database field mappings |
| `versionUtils.js` | Version utilities |
| `clientFeatures.js` | Client feature detection |
| `exchangeRates.js` | Exchange rate utilities |
| `unitContactUtils.js` | Unit contact utilities |
| `accountMapping.js` | Account mapping |
| `centavosValidation.js` | Centavos validation |
| `securityUtils.js` | Security utilities |
| `requestValidator.js` | Request validation |
| `auditLogger.js` | Audit logging |
| `emailDocId.js` | Email document IDs |
| `documentIdGenerator.js` | Document ID generation |
| `validateDocument.js` | Document validation |
| `userPreferences.js` | User preferences |
| `authMiddleware.js` | Auth middleware utilities |
| `timestampUtils.js` | Timestamp utilities |
| `reportEmailUtils.js` | Report email utilities |
| `voteTokenUtils.js` | Vote token utilities |
| `data-augmentation-utils.js` | Data augmentation |
| `performance-monitor.js` | Performance monitoring |
| `performance-utils.js` | Performance utilities |
| `health-diagnostics.js` | Health diagnostics |
| `dataValidation-enterprise.js` | Enterprise validation (unused) |
| `generateTestToken.js` | Test token generation |

### Templates (`templates/`)
| File | Purpose |
|------|---------|
| `clientTemplates.js` | Client templates |
| `statementEmailTemplate.js` | Statement email template |
| `waterReportEmailTemplate.js` | Water report email template |
| `pollNotificationTemplate.js` | Poll notification template |
| `waterBills/templateVariables.js` | Water bill template variables |
| `reports/reportCommon.css` | Report common CSS |

### Validation & Schemas
| File | Purpose |
|------|---------|
| `schemas/transactionSchema.js` | Transaction validation schema |
| `validation/backend-validation-script.js` | Validation script |
| `validation/migrate-backend-fields.js` | Field migration |
| `validation/test-auth-middleware.js` | Auth middleware test |

### Backend API
| File | Purpose |
|------|---------|
| `api/creditAPI.js` | Credit API client |
| `api/importStorage.js` | Import storage API |

### Backend Scripts (`scripts/` — 164 files, 22,317 lines)
Migration, diagnostic, seed, and utility scripts. These are not part of the running application but support operations:
- Migration scripts (field migrations, data cleanup)
- Diagnostic scripts (balance reconciliation, data analysis)
- Seed scripts (initial data population)
- Test scripts (API testing, validation)

---

## Shared Modules (`/shared/`)

| File | Purpose |
|------|---------|
| `utils/versionUtils.js` | Cross-platform version utilities (448 lines) |
| `utils/databaseFieldMappings.js` | Database field mapping definitions |
| `utils/centavosValidation.js` | Centavos validation logic |
| `utils/configValidation.js` | Configuration validation |
| `utils/currencyUtils.js` | Currency utilities |

---

## Cloud Functions (`/functions/`)

### Exported Functions (from `functions/index.js`)
| Function | Type | Purpose |
|----------|------|---------|
| `api` | `onRequest` (HTTP) | Main Express backend as Cloud Function |
| `nightlyScheduler` | `onSchedule` | 3:00 AM America/Cancun: backup, exchange rates, sync, credit reports |
| `manualExchangeRatesUpdate` | `onCall` | Manual exchange rate update |
| `syncExchangeRatesFromProdToDev` | `onCall` | Sync exchange rates prod → dev |
| `checkExchangeRatesHealth` | `onRequest` | Exchange rates health check |
| `loadHistoricalExchangeRates` | `onCall` | Load historical exchange rate data |

### Unique Code (not mirrored from `backend/`)
| File | Purpose |
|------|---------|
| `index.js` | Cloud Functions entry point and exports |
| `scheduled/nightlyScheduler.js` | Nightly scheduler logic |
| `src/exchangeRatesUpdater.js` | Exchange rate update logic |
| `src/bulkHistoricalLoader.js` | Historical rate bulk loading |
| `src/syncToDevDatabase.js` | Prod → dev sync |
| `src/utils/timezone.js` | Timezone utilities |
| `src/utils/rateCalculations.js` | Rate calculation utilities |
| `src/utils/dateHelpers.js` | Date helper utilities |
| `src/apiClients/banxico.js` | Banxico API client |
| `src/apiClients/colombian.js` | Colombian API client |
| `src/apiClients/dof.js` | DOF (Diario Oficial) API client |
| `src/apiClients/openExchangeRates.js` | Open Exchange Rates API client |

### Functions Shared Modules (`functions/shared/`)
| File | Purpose |
|------|---------|
| `logger.js` | Logging utility |
| `utils/versionUtils.js` | Version utilities |
| `utils/formatUtils.js` | Format utilities |
| `utils/waterBillReportUtils.js` | Water bill report utilities |
| `utils/databaseFieldMappings.js` | Database field mappings |
| `utils/billCalculations.js` | Bill calculations |
| `utils/configValidation.js` | Configuration validation |
| `utils/currencyUtils.js` | Currency utilities |
| `utils/centavosValidation.js` | Centavos validation |
| `utils/creditBalanceUtils.js` | Credit balance utilities |
| `services/DateService.js` | Date service |
| `services/CreditBalanceService.js` | Credit balance service |
| `services/BillDataService.js` | Bill data service |
| `services/TransactionAllocationService.js` | Transaction allocation |
| `services/PenaltyRecalculationService.js` | Penalty recalculation |
| `services/PaymentDistributionService.js` | Payment distribution |

> Note: `functions/backend/` is a **complete mirror** of `/backend/` — the `api` Cloud Function lazy-loads it. Not counted separately.

---

## Frontend Shared Components (`/frontend/shared-components/`)

TypeScript/React shared component library (not yet widely integrated):

| Module | Key Files | Purpose |
|--------|-----------|---------|
| ErrorHandling | `EnhancedErrorBoundary.tsx`, `StandardizedError.tsx`, etc. | Error handling components |
| UX | `LoadingComponents.tsx`, `FeedbackComponents.tsx`, etc. | UX components |
| Performance | `ResponseTimeOptimizer.tsx`, `ConnectionManager.tsx` | Performance components |
| LoadingSpinner | `LoadingSpinner.tsx` | Shared loading spinner |
| Hooks | `useLoadingSpinner.ts` | Shared hooks |

---

## Known Issues and Cleanup Opportunities

### Layout Duplication Note
The `layout/` directory contains ~60 `.jsx` files that duplicate files in `components/`. Only 8 files from `layout/` are actively imported:
- `MainLayout.jsx`, `Sidebar.jsx`, `StatusBar.jsx`, `AboutModal.jsx` (core layout)
- `Layout.css`, `Sidebar.css`, `StatusBar.css`, `ActionBar.css` (styles)

All view and component files import from `components/`, not `layout/`. The duplicate files in `layout/` (e.g., `layout/ClientSwitchModal.jsx`, `layout/UnifiedExpenseEntry.jsx`, etc.) appear to be copies that are never imported and could be removed.

### Deprecated Files Still in Tree
- `components/DuesPaymentModal-old.jsx` — 885 lines, should be archived
- `components/deprecated/ExpenseEntryModal_components.jsx` — 449 lines
- `components/deprecated/ExpenseEntryModal_layout.jsx` — 388 lines

### `_archive` Directories
- `frontend/sams-ui/src/_archive/` — Archived views
- `frontend/sams-ui/src/components/_archive/` — Archived components
- `functions/backend/_archive/` — Archived backend code
- `functions/backend/controllers/_archive/` — Archived controllers
- `scripts/_archive/` — Archived scripts

### Test/Debug Components in Mobile
The mobile app contains several test/debug components that could be removed from production:
- `AuthTest.jsx`, `SimpleAuthTest.jsx`, `MinimalAuthTest.jsx`
- `SuperSimpleTest.jsx`, `UltraSimpleTest.jsx`
- `AuthDebugScreen.jsx`, `AuthDebugMinimal.jsx`, `AuthDebugger.jsx`
- `UserDebugger.jsx`, `StaticTest.jsx`

### Unmounted Backend Routes
Five route files exist in `routes/` but are not mounted in `index.js`:
- `user-uid-based.js`, `user-email-docid.js` — Legacy user routes
- `exchangeRates-enterprise.js`, `monitoring-enterprise.js` — Enterprise variants
- `creditAutoPayReportRoutes.js` — Not yet integrated
