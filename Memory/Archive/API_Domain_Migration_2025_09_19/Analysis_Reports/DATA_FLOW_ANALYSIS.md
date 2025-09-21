# Data Flow Analysis - Current `/api/clients/*` Structure

## Overview
Analysis of data flows through each endpoint in the current client-centric API architecture, documenting what data each route retrieves/modifies and how it's used.

## 1. Client Management Data Flow

### Core Client Access Flow
```
Frontend → GET /api/clients → Backend → Firestore users/{uid} → propertyAccess validation → client list
```

**Data Retrieved:**
- User's authorized client list from `propertyAccess` field
- Client metadata (id, name, logoUrl, etc.)
- User's role per client (admin, unitOwner, unitManager)

**Usage:** Populates client selector dropdown, establishes client context for all subsequent requests

### Individual Client Data Flow
```
Frontend → GET /api/clients/{id} → Backend → Client access validation → Firestore clients/{id} → Client data
```

**Data Retrieved:**
- Complete client configuration
- Client settings and metadata
- Unit configurations

**Usage:** Client-specific views, configuration management

## 2. Financial Domain Data Flows

### Transaction Data Flow
```
Frontend → GET /api/clients/{id}/transactions → Backend → Permission check → Firestore clients/{id}/transactions → Filtered results
```

**Data Retrieved:**
- Transaction records (income/expense)
- Associated metadata (vendor, category, unit)
- Linked HOA dues information
- Audit trail data

**Data Modified:**
- Create: New transaction records
- Update: Transaction fields, amounts, categorization
- Delete: Transaction removal + HOA dues cleanup

**Usage:** Financial reporting, expense tracking, HOA dues calculations

### Account Balance Data Flow
```
Frontend → GET /api/clients/{id}/balances/current → Backend → Firestore clients/{id}/accounts → Calculated balances
```

**Data Retrieved:**
- Current account balances (calculated from transactions)
- Account configurations
- Year-end snapshots for historical data

**Usage:** Dashboard metrics, financial reports, account management

### Account Management Data Flow
```
Frontend → POST/PUT/DELETE /api/clients/{id}/accounts → Backend → Firestore clients/{id}/accounts → Account operations
```

**Data Modified:**
- Account creation/updates/deletion
- Balance adjustments (add/subtract operations)
- Year-end snapshot creation
- Account balance rebuilds

**Usage:** Chart of accounts management, financial structure setup

## 3. Property Management Data Flows

### Units Data Flow
```
Frontend → GET /api/clients/{id}/units → Backend → Firestore clients/{id}/units → Unit list
```

**Data Retrieved:**
- Unit configurations (A101, A102, etc.)
- Unit metadata (square footage, special assessments)
- Owner/tenant information

**Data Modified:**
- Unit creation/updates
- Owner assignments
- Special assessment configurations

**Usage:** HOA dues calculations, water billing, unit reports

### HOA Dues Data Flow
```
Frontend → GET /api/clients/{id}/hoadues → Backend → Complex calculation → Derived dues data
```

**Data Retrieved:**
- Calculated HOA dues per unit
- Payment history and outstanding balances
- Special assessment data
- Fiscal year calculations

**Usage:** HOA dues billing, payment tracking, financial reporting

## 4. Water Management Data Flows

### Water Meter Readings Flow
```
Frontend → GET/POST /api/clients/{id}/projects/waterBills → Backend → Firestore clients/{id}/waterBills → Meter data
```

**Data Retrieved:**
- Monthly meter readings per unit
- Historical consumption data
- Bill generation status
- Payment records

**Data Modified:**
- Meter reading entries
- Bill generation triggers
- Payment recording
- Penalty calculations

**Usage:** Water billing system, consumption tracking, payment management

### Water Bills Generation Flow
```
Frontend → POST /api/clients/{id}/watermeters/bills/generate → Backend → Complex calculation → Generated bills
```

**Data Process:**
- Reads meter data for billing period
- Calculates consumption (current - previous reading)
- Applies rate structures and penalties
- Generates bill records
- Updates payment tracking

**Usage:** Monthly water billing, penalty assessment, revenue tracking

## 5. Administrative Data Flows

### Categories Data Flow
```
Frontend → GET/POST/PUT/DELETE /api/clients/{id}/categories → Backend → Firestore clients/{id}/categories → Category data
```

**Data Retrieved/Modified:**
- Expense/income categories
- Category hierarchies
- Budget allocations

**Usage:** Transaction categorization, financial reporting, budget tracking

### Vendors Data Flow
```
Frontend → GET /api/clients/{id}/vendors → Backend → Firestore clients/{id}/vendors → Vendor list
```

**Data Retrieved:**
- Vendor information
- Payment terms
- Historical transaction data

**Usage:** Expense entry, vendor management, payment processing

### Reports Data Flow
```
Frontend → GET /api/clients/{id}/reports/unit/{unitId} → Backend → Multi-collection aggregation → Report data
```

**Data Retrieved:**
- Aggregated transaction data per unit
- HOA dues history
- Water billing history
- Payment status across all domains

**Usage:** Unit-specific financial reports, owner statements

## 6. Communications Data Flows

### Email Template Data Flow
```
Frontend → GET /api/clients/{id}/email → Backend → Firestore clients/{id}/emailTemplates → Template data
```

**Data Retrieved:**
- Email templates for water bills, HOA dues
- Client-specific branding and messaging
- Template variables and configurations

**Usage:** Automated email generation, client communications

## 7. Configuration Data Flows

### Client Config Data Flow
```
Frontend → GET/PUT /api/clients/{id}/config → Backend → Firestore clients/{id}/config → Settings data
```

**Data Retrieved/Modified:**
- Billing configurations
- Rate structures
- System preferences
- Integration settings

**Usage:** System behavior configuration, billing customization

## Data Flow Patterns Analysis

### 1. Client-Scoped Data Access
**Pattern:** All data access goes through `/api/clients/{id}/...`
- **Firestore Structure:** `clients/{id}/subcollection/documents`
- **Security:** Client access validated on every request
- **Isolation:** Complete data separation between clients

### 2. Multi-Domain Data Dependencies
**Cross-Domain Calculations:**
- HOA dues depend on: transactions, units, special assessments
- Water bills depend on: meter readings, units, payment history, penalties
- Reports depend on: transactions, HOA dues, water bills, units

### 3. Complex Aggregation Flows
**Dashboard Data Flow:**
```
Frontend → Multiple parallel API calls:
├── /api/clients/{id}/balances/current
├── /api/clients/{id}/units
├── /api/clients/{id}/hoadues/year/{year}
└── /water/clients/{id}/data/{year}
→ Client-side aggregation → Dashboard metrics
```

### 4. Data Consistency Challenges
**Related Data Updates:**
- Transaction deletion requires HOA dues recalculation
- Unit changes affect water billing and HOA dues
- Payment recording updates multiple domain balances

## Critical Data Flow Issues

### 1. Tight Coupling
- Frontend makes multiple API calls for single views
- Data dependencies span multiple endpoints
- Complex client-side aggregation logic

### 2. Inefficient Network Usage
- Multiple round-trips for dashboard data
- Redundant client access validation
- Large payloads for aggregated views

### 3. Domain Boundary Confusion
- Water billing mixed with general transactions
- HOA dues calculations scattered across multiple endpoints
- Financial data spread across accounts, transactions, and domain-specific collections

### 4. Maintenance Complexity
- Changes to one domain affect multiple endpoints
- Difficult to trace data flow for debugging
- Business logic scattered across multiple controllers

## Migration Implications

### Data Flow Consolidation Opportunities
1. **Water Domain:** Consolidate all water-related data flows under `/water/*`
2. **Financial Domain:** Unify transactions, accounts, and balances under `/transactions/*`
3. **Property Domain:** Combine units and HOA dues under `/properties/*`
4. **Communications Domain:** Centralize all email/notification flows under `/comm/*`

### Expected Improvements
- **Reduced API Calls:** Domain-specific aggregation endpoints
- **Clearer Data Ownership:** Each domain owns its data flows
- **Simplified Frontend Logic:** Domain-specific services instead of client-scoped calls
- **Better Caching:** Domain-level caching strategies
- **Improved Performance:** Optimized queries within domain boundaries

This analysis reveals significant complexity in the current data flows due to the client-centric architecture mixing multiple business domains under a single routing pattern.