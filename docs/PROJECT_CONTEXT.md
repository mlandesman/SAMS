# Sandyland Management System (SAMS) - Turnover Document
This document provides a comprehensive overview of the Sandyland Management System (SAMS) project, including its background, design philosophy, architecture, development environment, completed tasks, remaining tasks, and challenges faced. It is intended to serve as a guide for future developers or AI agents to understand and contribute to the project.

## 1. Project Overview
SAMS is a web-based application designed to streamline property management tasks for Sandyland Properties. It aims to replace a manual, spreadsheet-based system with a more efficient, scalable, and user-friendly solution.  We intend to create a private, professional-grade property management system optimized for Sandyland Properties, balancing clean design, high efficiency, and secure multi-client support.


### 1.1. Origin in Google Sheets and Apps Script
The initial version of SAMS was built using Google Sheets and Apps Script. This allowed for rapid prototyping and easy data management. The existing system has major automation and auditing features and works perfectly for the single client (Marina Turquesa Condominiums or MTC) but does not scale to multiple clients or clients with differ needs.  This requires us to move a new system with a more database-driven architecture to that can change behavior for each client.

### 1.15. Features and Requirements
The system is centered on the financial Transactions and differentiated by client.  No data is displayed or usable until a client is selected then only that client's data is available.  
The core components of SAMS are:
1. clients  # based on a contract.  a single client may have mulitple contracts.
    1. Identity information (name, address, contract number, etc)
    2. Type of client (Single Home, Condo Association)
    3. All clients have:
        1. Transactions
        2. Budgets
        3. Projects
        4. Vendors
        5. Categories
    4.  Condo Association-type clients also have:
        1. Units (name, unitId, DuesAmount, unit size, phone, email, door access codes, etc)
2. auditLogs  # one record for every CRUD action

### 1.2. Design Philosophy

The core design principles guiding the development of SAMS are:

*   **Simplicity:** The system should be easy to use and understand, even for users with limited technical expertise.
*   **Efficiency:** The system should automate repetitive tasks and provide quick access to relevant information.
*   **Scalability:** The system should be able to handle a growing number of properties, users, and transactions.
*   **Maintainability:** The codebase should be well-organized, documented, and easy to maintain.
*   **Data Integrity:** The system should ensure the accuracy and consistency of data.

### 1.3. UI Design Elements

# **Users**
1. Admin/Management/Staff  
   1. Access Control through Google Domain Log In (landesman.com/sandyland.com.mx)  
   2. Primarily focused on desktop, larger screens with more content and full keyboard  
   3. Data Entry focused on mobile devices  
   4. No need to make detailed outputs available on smaller screens  
2. External Users  
   1. Primarily mobile, smaller screen access  
   2. Limited output of specific screens for personal use  
   3. No data entry or modification (must request that from Admin)

# **Inputs**
1. All existing collections CRUD  
   1. Unit management  
   2. Vendor management  
   3. Category management  
   4. Users management (external access control for client access)  
2. New Contacts (not yet Clients)  
   1. CRM-style details  
3. Deposits  
   1. Associations  
      1. HOA Dues  
      2. Special Assessment Fees  
   2. Owners  
      1. Expense Reimbursement  
      2. Prepay/Future Funding on deposit  
4. Expenses  
   1. Associations  
      1. All Categories collection under that Association  
   2. Owners  
      1. All Categories collection under that Owner  
5. Cash and Bank Adjustments  
6. Budgets  
   1. Plan for each Category per year or per month by Association and Owner  
7. Projects  
   1. Proposed/Future Projects  
   2. Current Project (moved from Proposed status)  
   3. Completed Projects (moved from Current status)  
   4. Project Payments made

# **Outputs (ALWAYS filtered by {clientId})**
1. On Screen  
   1. Dashboard  
      1. Account balances (cash and bank, if available)  
      2. High-level status summary of past-due payments from owners  
      3. Status of Current Project(s)  
      4. Status of Actuals vs Budget  
      5. Current DOF rate (from DOF website or Google Sheet via API)  
      6. Upcoming Expenses Due or past-due  
      7. YTD Graphs (Expenses only in a pie chart with clickable labels)  
   2. HOA Dues grid (see Sheets image when ready)  
   3. Special Assessments grid (see Sheets image when ready)  
   4. Current Projects Payments made by Project with balance due  
   5. Transaction Journal with filters and searching  
      1. current month  
      2. prior month  
      3. prior 3 months  
      4. prior year  
      5. YTD  
      6. ALL  
   6. Budget vs Actual for % of the current year  
   7. Unit Report (see Sheets image when ready)  
2. Report  
   1. Data-ranged Cash report for balancing  
   2. Data-ranged Bank report for balancing  
3. Audit  
   1. Audit log filtered by fields (data range, module, action, etc)  
4. Electronic (email/WhatsApp)  
   1. Unit Reports (from Admin and External User log ins, ie; push or pull)  
   2. Digital Receipt (from Admin following all Deposits)  
   3. Monthly Status report data sent to a Google Docs or Gmail template with placeholders

## 2. Project Structure

SAMS is built using a modern JavaScript stack:

*   **React:** A JavaScript library for building user interfaces.
*   **Vite:** A fast build tool and development server for modern web projects.
*   **Firebase/Firestore:** A cloud-based platform for data storage, authentication, and hosting.

### 2.1. Directory Structure Mon Jun 16
*stored on Google Drive and commited to local GIT*

```
michael@Michaels-MacBook-Air-2 SAMS % tree --gitignore
.SAMS
├── backend
│   ├── controllers
│   │   ├── accountsController.js
│   │   ├── associationsController.js
│   │   ├── balancesController.js
│   │   ├── budgetsController.js
│   │   ├── categoriesController.js
│   │   ├── clientsController.js
│   │   ├── exchangeRatesController.js
│   │   ├── hoaDuesController.js
│   │   ├── ownersController.js
│   │   ├── paymentMethodsController.js
│   │   ├── projectsController.js
│   │   ├── transactionsController.js
│   │   ├── unitsController.js
│   │   └── vendorsController.js
│   ├── firebase.js
│   ├── index.js
│   ├── package-lock.json
│   ├── package.json
│   ├── routes
│   │   ├── accounts.js
│   │   ├── categories.js
│   │   ├── clientRoutes.js
│   │   ├── exchangeRates.js
│   │   ├── hoaDues.js
│   │   ├── paymentMethods.js
│   │   ├── transactions.js
│   │   └── vendors.js
│   └── utils
│       ├── auditLogger.js
│       ├── exchangeRates.js
│       └── timestampUtils.js
├── BALANCE_REBUILD_GUIDE.md
├── commit_transaction_filters.sh
├── commit.sh
├── cors.json
├── currentpath.txt
├── CVdata (1)
│   ├── Deposits.json
│   ├── Expenses.json
│   ├── rangeExpenseCategories.json
│   ├── rangeIncomeCategories.json
│   └── VendorList.json
├── deploy_rules.sh
├── documentation
│   ├── 1. PROJECT_CONTEXT.md
│   ├── 2. NextUp.md
│   ├── 3. TODO.md
│   ├── ACCOUNT_BALANCE_SYSTEM.md
│   ├── assets
│   │   ├── MTC_Receipt_Example.pdf
│   │   ├── Screenshot 2025-06-03 at 7.54.23 AM.png
│   │   └── Screenshot 2025-06-10 at 12.45.44 PM.jpg
│   ├── AUTHENTICATION_IMPLEMENTATION.md
│   ├── BALANCE_TRACKING_REDESIGN.md
│   ├── BALANCE_TRACKING_TECHNICAL_IMPLEMENTATION.md
│   ├── CHANGELOG.md
│   ├── CLIENT_MANAGEMENT_PLAN.md
│   ├── CLIENT_MANAGEMENT.md
│   ├── DASHBOARD.md
│   ├── DESIGN.md
│   ├── DIGITAL_RECEIPT.md
│   ├── DYNAMIC_SIDEBAR.md
│   ├── EXCHANGE_RATES_INTEGRATION.md
│   ├── EXCHANGE_RATES.md
│   ├── FILTERING_SYSTEM.md
│   ├── HANDOFF_DIGITAL_RECEIPT.md
│   ├── HOA_DUES_CALC.md
│   ├── HOA_DUES_IMPLEMENTATION.md
│   ├── HOA-Dues.md
│   ├── LIST_MANAGEMENT_REFACTOR.md
│   ├── LIST_MANAGEMENT.md
│   ├── LOGO_EXPORT_PROBLEMS.md
│   ├── SECURITY_NOTES.md
│   ├── STATUS_BAR_IMPLEMENTATION.md
│   ├── TRANSACTION_IMPLEMENTATION.md
│   ├── TURNOVER.md
│   ├── UI Design Requirements.md
│   └── UI_IMPROVEMENTS.md
├── firebase.json
├── firestore.indexes.json
├── firestore.rules
├── frontend
│   ├── jsconfig.json
│   ├── package-lock.json
│   ├── package.json
│   ├── public
│   │   ├── favicon.ico
│   │   ├── index.html
│   │   ├── logo192.png
│   │   ├── logo512.png
│   │   ├── manifest.json
│   │   ├── robots.txt
│   │   └── sandyland-logo.png
│   ├── README.md
│   ├── sams-ui
│   │   ├── eslint.config.js
│   │   ├── index.html
│   │   ├── package-lock.json
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── restart.sh
│   │   ├── src
│   │   │   ├── api
│   │   │   │   ├── apiUtils.js
│   │   │   │   ├── categories.js
│   │   │   │   ├── client.js
│   │   │   │   ├── exchangeRates.js
│   │   │   │   ├── hoaDuesService.js
│   │   │   │   ├── paymentMethods.js
│   │   │   │   ├── transaction.js
│   │   │   │   └── vendors.js
│   │   │   ├── App.css
│   │   │   ├── App.jsx
│   │   │   ├── assets
│   │   │   ├── components
│   │   │   │   ├── AdvancedFilterModal.css
│   │   │   │   ├── AdvancedFilterModal.jsx
│   │   │   │   ├── ClientSwitchModal.css
│   │   │   │   ├── ClientSwitchModal.jsx
│   │   │   │   ├── common
│   │   │   │   │   └── ActivityActionBar.jsx
│   │   │   │   ├── ConfirmationDialog.css
│   │   │   │   ├── ConfirmationDialog.jsx
│   │   │   │   ├── DateRangeDropdown.css
│   │   │   │   ├── DateRangeDropdown.jsx
│   │   │   │   ├── DateTimeDisplay.jsx
│   │   │   │   ├── DigitalReceipt.css
│   │   │   │   ├── DigitalReceipt.jsx
│   │   │   │   ├── DuesPaymentModal-new.jsx
│   │   │   │   ├── DuesPaymentModal.css
│   │   │   │   ├── DuesPaymentModal.jsx
│   │   │   │   ├── ExchangeRateModal.css
│   │   │   │   ├── ExchangeRateModal.jsx
│   │   │   │   ├── ExpenseEntryModal.css
│   │   │   │   ├── ExpenseEntryModal.jsx
│   │   │   │   ├── ExpenseModal.css
│   │   │   │   ├── ExpenseModal.jsx
│   │   │   │   ├── FilterSwitchModal.css
│   │   │   │   ├── FilterSwitchModal.jsx
│   │   │   │   ├── FirestoreAuthTest.css
│   │   │   │   ├── FirestoreAuthTest.jsx
│   │   │   │   ├── GlobalSearch.css
│   │   │   │   ├── GlobalSearch.jsx
│   │   │   │   ├── HOADuesTransactionCard.css
│   │   │   │   ├── HOADuesTransactionCard.jsx
│   │   │   │   ├── ListManagementStatusContent.css
│   │   │   │   ├── ListManagementStatusContent.jsx
│   │   │   │   ├── lists
│   │   │   │   │   ├── ExchangeRatesList.jsx
│   │   │   │   │   ├── ModernBaseList.css
│   │   │   │   │   ├── ModernBaseList.jsx
│   │   │   │   │   ├── ModernCategoryList.jsx
│   │   │   │   │   ├── ModernPaymentMethodList.jsx
│   │   │   │   │   ├── ModernUnitList.jsx
│   │   │   │   │   ├── ModernVendorList.jsx
│   │   │   │   │   ├── VendorFormModal.jsx
│   │   │   │   │   └── VendorList.jsx
│   │   │   │   ├── LoginForm.css
│   │   │   │   ├── LoginForm.jsx
│   │   │   │   ├── modals
│   │   │   │   │   ├── CategoryFormModal.css
│   │   │   │   │   ├── CategoryFormModal.jsx
│   │   │   │   │   ├── DeleteConfirmationModal.css
│   │   │   │   │   ├── DeleteConfirmationModal.jsx
│   │   │   │   │   ├── ItemDetailModal.jsx
│   │   │   │   │   ├── PaymentMethodFormModal.css
│   │   │   │   │   ├── PaymentMethodFormModal.jsx
│   │   │   │   │   ├── VendorFormModal.css
│   │   │   │   │   └── VendorFormModal.jsx
│   │   │   │   ├── TestRoute.jsx
│   │   │   │   ├── TransactionDetailModal.css
│   │   │   │   ├── TransactionDetailModal.jsx
│   │   │   │   ├── TransactionDetails.css
│   │   │   │   ├── TransactionDetails.jsx
│   │   │   │   ├── TransactionsRoute.css
│   │   │   │   ├── TransactionsRoute.jsx
│   │   │   │   ├── TransactionTable.css
│   │   │   │   ├── TransactionTable.jsx
│   │   │   │   └── TransactionTestComponent.jsx
│   │   │   ├── context
│   │   │   │   ├── AuthContext.jsx
│   │   │   │   ├── ClientContext.jsx
│   │   │   │   ├── HOADuesContext.jsx
│   │   │   │   ├── ListManagementContext.jsx
│   │   │   │   ├── StatusBarContext.jsx
│   │   │   │   ├── TransactionFiltersContext.js
│   │   │   │   ├── TransactionFiltersContext.jsx
│   │   │   │   └── TransactionsContext.jsx
│   │   │   ├── firebaseClient.js
│   │   │   ├── firebaseClient.js.bak
│   │   │   ├── hooks
│   │   │   │   ├── useExchangeRates.js
│   │   │   │   └── useTransactionFilters.js
│   │   │   ├── index.css
│   │   │   ├── layout
│   │   │   │   ├── ActionBar.css
│   │   │   │   ├── Layout.css
│   │   │   │   ├── MainLayout.jsx
│   │   │   │   ├── Sidebar.css
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   ├── StatusBar.css
│   │   │   │   └── StatusBar.jsx
│   │   │   ├── Layout.css
│   │   │   ├── Layout.jsx
│   │   │   ├── ListManagementTest.jsx
│   │   │   ├── main.jsx
│   │   │   ├── styles
│   │   │   │   └── InputModal.css
│   │   │   ├── tests
│   │   │   │   └── testReceiptMapping.js
│   │   │   ├── utils
│   │   │   │   ├── balanceRecalculation.js
│   │   │   │   ├── clientAccounts.js
│   │   │   │   ├── dateFiltering.js
│   │   │   │   ├── exchangeRates.js
│   │   │   │   ├── fetchClients.js
│   │   │   │   ├── fetchTransactions.js
│   │   │   │   ├── hoaDuesImporter.js
│   │   │   │   ├── hoaDuesUtils.js
│   │   │   │   ├── lastKnownBalances.js
│   │   │   │   ├── numberToWords.js
│   │   │   │   ├── transactionFiltering.js
│   │   │   │   └── unitUtils.js
│   │   │   └── views
│   │   │       ├── ActivityView.css
│   │   │       ├── ActivityView.jsx
│   │   │       ├── AuthTestView.jsx
│   │   │       ├── backups
│   │   │       │   ├── TransactionsView.fixed.jsx
│   │   │       │   ├── TransactionsView.jsx.backup
│   │   │       │   ├── TransactionsView.jsx.bak
│   │   │       │   └── TransactionsView.jsx.bak2
│   │   │       ├── DashboardView.css
│   │   │       ├── DashboardView.jsx
│   │   │       ├── DigitalReceiptDemo.css
│   │   │       ├── DigitalReceiptDemo.jsx
│   │   │       ├── fix_jsx.sh
│   │   │       ├── HOADuesView.css
│   │   │       ├── HOADuesView.jsx
│   │   │       ├── ListManagementView.css
│   │   │       ├── ListManagementView.jsx
│   │   │       ├── ReceiptDemo.css
│   │   │       ├── ReceiptDemo.jsx
│   │   │       ├── SettingsView.jsx
│   │   │       ├── SplashScreen.css
│   │   │       ├── SplashScreen.jsx
│   │   │       ├── TransactionsDetail.css
│   │   │       └── TransactionsView.jsx
│   │   └── vite.config.js
│   └── src
│       ├── index.css
│       └── index.js
├── functions
│   ├── index.js
│   └── package.json
├── gcloud
├── MTCdata
│   ├── AutoCategorize.json
│   ├── Categories.json
│   ├── DOFrates.json
│   ├── HOA_Dues_Export.json
│   ├── Transactions.json
│   ├── transHistory.json
│   ├── Units.json
│   ├── UnitSizes.json
│   └── Vendors.json
├── package-lock.json
├── package.json
├── README.md
├── rebuild-balances.sh
├── scripts
│   ├── account-id-migration.js
│   ├── addListManagementToMenu.mjs
│   ├── auditCrawler.js
│   ├── balance-migration.js
│   ├── bulkImportExchangeRates.js
│   ├── bulkImportExchangeRates.js.backup
│   ├── checkAuditLogs.js
│   ├── com.sams.exchangerates.daily.plist
│   ├── configureClientMenu.js
│   ├── createMTC.js
│   ├── createTestUser.js
│   ├── daily_exchange_rates_update.sh
│   ├── DAILY_UPDATE_SETUP.md
│   ├── dumpClientTree.js
│   ├── fetchDOF.js
│   ├── fetchDOFRates.js
│   ├── fixNullVendorIds.js
│   ├── full_migration_process.sh
│   ├── import_and_rebuild.sh
│   ├── import-mtc-transactions.js
│   ├── import-transactions-clean.js
│   ├── import-transactions.js
│   ├── importExchangeRates.js
│   ├── importHOADues.js
│   ├── importHOADuesCommonJS.js
│   ├── importHOADuesFixed.js
│   ├── importHOADuesFixed2.js
│   ├── importHOADuesFixed3.js
│   ├── importHOADuesSimple.js
│   ├── importHOADuesWithDates.js
│   ├── importMTCData.js
│   ├── importMTCLists.js
│   ├── importTransactionsForMTC.js
│   ├── install_daily_updates.sh
│   ├── link-hoa-dues-improved.js
│   ├── link-hoa-dues-to-transactions.js
│   ├── link-hoa-dues.js
│   ├── logs
│   │   ├── launchagent_error.log
│   │   └── launchagent.log
│   ├── package-lock.json
│   ├── package.json
│   ├── README_ExchangeRates.md
│   ├── README.md
│   ├── rebuild-balances.js
│   ├── rebuildBalancesForMTC.js
│   ├── reset.js
│   ├── runBulkImport.sh
│   ├── schemaCrawler.js
│   ├── setupClientLists.js
│   ├── setupClientLists.mjs
│   ├── simpleSingleTests
│   │   ├── browser_test.html
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── run_tests.sh
│   │   ├── serve.js
│   │   ├── test1_unauthenticated_write.js
│   │   └── test2_authenticated_write.js
│   ├── simpleTransactionTest.js
│   ├── standardize-transaction-units.js
│   ├── standardize-unit-fields.js
│   ├── test-accounts.js
│   ├── testAllCRUD.js
│   ├── testAPIConnections.js
│   ├── testArgs.js
│   ├── testAuth.js
│   ├── testBackendTransaction.js
│   ├── testBulkImportSetup.js
│   ├── testClientData.js
│   ├── testCreateTransaction.js
│   ├── testDirectWrite.js
│   ├── testDuesPayment.js
│   ├── testDuesRecord.js
│   ├── testEmailAuthTransaction.js
│   ├── testExchangeRates.js
│   ├── testExchangeRatesEndpoints.js
│   ├── testFinalAuth.js
│   ├── testFirebaseTransaction.js
│   ├── testFirestoreConnection.js
│   ├── testFrontendTransaction.js
│   ├── testHoaDuesDataStructure.js
│   ├── testReceiptMapping.js
│   ├── testSimpleAuth.js
│   ├── testTransactionManagement.js
│   ├── testUiAuthFlow.js
│   ├── testUpdatedAuth.js
│   ├── testVendorsCRUD.js
│   ├── updateExchangeRates.js
│   ├── utils
│   │   ├── auditLogger.js
│   │   └── timestampConverter.js
│   └── verify-data.js
├── START_GUIDE.md
├── start_sams.sh
├── stop_sams.sh
└── storage.rules

34 directories, 337 files
```

### 2.2. Key Technologies

*   **React:** Used for building the user interface with a component-based architecture.
*   **Vite:** Provides a fast and efficient development environment with hot module replacement.
*   **Firebase/Firestore:** Used for storing and retrieving data, handling user authentication, and deploying the application.
*   **React Router:** Used for navigation between different views within the application.
*   **Context API:** Used for managing global state, such as the selected client and transaction filters.
*   **ESLint:** Used for linting the code and enforcing code style.
*   **Prettier:** Used for formatting the code.
*   **Font Awesome:** Used for icons.

## 3. Conclusion

The SAMS project is making good progress with several key architectural decisions resolved. By moving to an activity-specific action bar approach, we've simplified the component structure and resolved context-related issues. The balance calculation logic is now more efficient with the month-end snapshot approach. By following the design principles outlined in this document and addressing the challenges that have been faced, future developers can contribute to the success of this project.
