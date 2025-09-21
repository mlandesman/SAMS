# Current Client Routes Inventory

## Overview
Complete mapping of all `/api/clients/*` endpoints in the SAMS backend with file locations and line numbers.

## Main Route Entry Point
**File:** `backend/index.js`
- **Line 84:** `app.use('/api/clients', clientRoutes);` - LEGACY: To be migrated to domain-specific routes

## Core Client Endpoints
**File:** `backend/routes/clientRoutes.js`

### Base Client Routes
1. **GET** `/api/clients/test` (Line 21)
   - **Description:** Test route for connectivity verification
   - **Authentication:** None
   - **Response:** "Test route works!"

2. **GET** `/api/clients/` (Line 26)
   - **Description:** List authorized clients for the authenticated user (SECURE)
   - **Authentication:** Required (`authenticateUserWithProfile`)
   - **Controller:** `listAuthorizedClients`

3. **GET** `/api/clients/:id` (Line 29)
   - **Description:** Get a specific client by ID (SECURE)
   - **Authentication:** Required (`authenticateUserWithProfile`)
   - **Controller:** `getClient`

## Sub-Resource Route Mounts
All routes mounted under `/api/clients/:clientId/`

### 1. HOA Dues Domain
**Mount Point:** Line 32 - `/api/clients/:clientId/hoadues`
**Route File:** `backend/routes/hoaDues.js`

- **GET** `/api/clients/:clientId/hoadues/debug/connection` (hoaDues.js:20)
  - **Description:** Debug endpoint to check Firestore connection
  - **Authentication:** Inherited from parent router

### 2. Transactions Domain
**Mount Point:** Line 45 - `/api/clients/:clientId/transactions`
**Route File:** `backend/routes/transactions.js`

- **GET** `/api/clients/:clientId/transactions` (transactions.js:28)
  - **Description:** Get all transactions or query with filters
  - **Permissions:** `transactions.view`
  - **Security:** `TRANSACTION_LIST` audit log

- **POST** `/api/clients/:clientId/transactions` (transactions.js:63)
  - **Description:** Create a new transaction
  - **Permissions:** `transactions.create`
  - **Security:** `TRANSACTION_CREATE` audit log

- **GET** `/api/clients/:clientId/transactions/:txnId` (transactions.js:110)
  - **Description:** Get a transaction by ID
  - **Permissions:** `transactions.view`
  - **Security:** `TRANSACTION_VIEW` audit log

- **PUT** `/api/clients/:clientId/transactions/:txnId` (transactions.js:144)
  - **Description:** Update a transaction
  - **Permissions:** `transactions.edit`
  - **Security:** `TRANSACTION_UPDATE` audit log

- **DELETE** `/api/clients/:clientId/transactions/:txnId` (transactions.js:185)
  - **Description:** Delete a transaction (with HOA Dues cleanup)
  - **Permissions:** `transactions.delete`
  - **Security:** `TRANSACTION_DELETE` audit log

### 3. Accounts Domain
**Mount Point:** Line 62 - `/api/clients/:clientId/accounts`
**Route File:** `backend/routes/accounts.js`

- **GET** `/api/clients/:clientId/accounts` (accounts.js:25)
  - **Description:** Get all accounts for a client
  
- **POST** `/api/clients/:clientId/accounts` (accounts.js:45)
  - **Description:** Create a new account

- **PUT** `/api/clients/:clientId/accounts/:accountName` (accounts.js:66)
  - **Description:** Update an account

- **DELETE** `/api/clients/:clientId/accounts/:accountName` (accounts.js:88)
  - **Description:** Delete an account

- **PATCH** `/api/clients/:clientId/accounts/:accountName/balance` (accounts.js:119)
  - **Description:** Update account balance (add/subtract amount)

- **PUT** `/api/clients/:clientId/accounts/:accountName/balance` (accounts.js:146)
  - **Description:** Set account balance directly

- **GET** `/api/clients/:clientId/accounts/year-end-snapshots` (accounts.js:177)
  - **Description:** List all year-end snapshots

- **GET** `/api/clients/:clientId/accounts/year-end-snapshots/:year` (accounts.js:197)
  - **Description:** Get a specific year-end snapshot

- **POST** `/api/clients/:clientId/accounts/year-end-snapshots/:year` (accounts.js:219)
  - **Description:** Create a year-end snapshot

- **POST** `/api/clients/:clientId/accounts/rebuild` (accounts.js:246)
  - **Description:** Rebuild account balances

### 4. Balances Domain
**Mount Point:** Line 75 - `/api/clients/:clientId/balances`
**Route File:** `backend/routes/balances.js`

- **GET** `/api/clients/:clientId/balances/current` (balances.js:34)
  - **Description:** Get current account balances for a client
  - **Permissions:** `accounts.view`
  - **Security:** `BALANCE_VIEW_CURRENT` audit log

### 5. Vendors Domain
**Mount Point:** Line 88 - `/api/clients/:clientId/vendors`
**Route File:** To be analyzed (referenced but not fully detailed)

### 6. Categories Domain
**Mount Point:** Line 101 - `/api/clients/:clientId/categories`
**Route File:** Referenced in frontend (categories.js API calls)

### 7. Payment Methods Domain
**Mount Point:** Line 114 - `/api/clients/:clientId/paymentMethods`
**Route File:** To be analyzed

### 8. Units Domain
**Mount Point:** Line 127 - `/api/clients/:clientId/units`
**Route File:** `backend/routes/units.js`

- **GET** `/api/clients/:clientId/units` (units.js:10)
  - **Description:** List all units for a client

- **POST** `/api/clients/:clientId/units` (units.js:39)
  - **Description:** Create a new unit

- **PUT** `/api/clients/:clientId/units/:unitId` (units.js:78)
  - **Description:** Update a unit

### 9. Email/Communications Domain
**Mount Point:** Line 140 - `/api/clients/:clientId/email`
**Route File:** Referenced in index.js direct mount

### 10. Reports Domain
**Mount Point:** Line 153 - `/api/clients/:clientId/reports`
**Route File:** `backend/routes/reports.js`

- **GET** `/api/clients/:clientId/reports/unit/:unitId` (reports.js:27)
  - **Description:** Get unit-specific financial report

### 11. Projects Domain
**Mount Point:** Line 167 - `/api/clients/:clientId/projects`
**Route File:** To be analyzed

### 12. Water Bills Domain
**Mount Point:** Line 180 - `/api/clients/:clientId/projects/waterBills`
**Route File:** Nested under projects (complex water billing system)

### 13. Config Domain
**Mount Point:** Line 193 - `/api/clients/:clientId/config`
**Route File:** To be analyzed

## Additional Direct Mounts
**File:** `backend/index.js`

- **Line 88:** `/api/clients/:clientId/email` - Email routes
- **Line 92:** `/api/clients/:clientId/documents` - Document routes

## Frontend Consumption Summary

### Core API Service Files
1. **clientManagement.js** - Client CRUD operations
2. **fetchClients.js** - Client access and selection
3. **client.js** - Client data and accounts
4. **categories.js** - Expense categorization
5. **units.js** - Unit management
6. **transaction.js** - Financial transactions
7. **waterMeterService.js** - Water billing system

### Key Frontend Components
1. **UnitReport.jsx** - Unit financial reports
2. **useDashboardData.js** - Dashboard metrics and calculations
3. Various form components for data entry

## Security Architecture Summary
- **Authentication:** `authenticateUserWithProfile` middleware on all routes
- **Authorization:** `enforceClientAccess` middleware for client isolation
- **Permissions:** Role-based permission system with granular controls
- **Audit Logging:** Security events logged for all operations
- **Data Isolation:** Strict client-level data separation

## Migration Status
Current routes marked as **LEGACY** in index.js (Line 84). Target architecture includes domain-specific routing:
- `/system/*` - System services
- `/auth/*` - Authentication & user management
- `/water/*` - Water billing & meter management
- `/comm/*` - Communications & email
- `/admin/*` - Administrative functions
- `/hoadues/*` - HOA dues & assessments

## Analysis Notes
- **22+ distinct endpoint patterns** under `/api/clients/:clientId/`
- **Complex nested routing** with multiple levels of abstraction
- **Strong security model** but tightly coupled to client-centric architecture
- **Frontend services heavily dependent** on client-scoped endpoints
- **Mixed domain concerns** within client-centric structure (water, transactions, units, etc.)

This inventory reveals a comprehensive but monolithic client-centric API that mixes multiple business domains under a single routing pattern, making it a prime candidate for domain-first architectural refactoring.