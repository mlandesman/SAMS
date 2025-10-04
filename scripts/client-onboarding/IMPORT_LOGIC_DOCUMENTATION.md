# Import Logic Documentation

**Created:** September 29, 2025  
**Purpose:** Document the existing logic flow of import scripts before modernization

---

## Overview

The existing import scripts directly use Firebase SDK and follow a specific sequence to import MTC (Mariscal Tower Condominiums) data into SAMS. All scripts use CRUD functions from controllers but still rely on direct Firebase initialization.

## Import Sequence

The scripts must be run in the following order due to dependencies:

1. **Categories & Vendors** (no dependencies)
2. **Units** (no dependencies)  
3. **Users** (depends on Units)
4. **Year-End Balances** (depends on client config)
5. **Transactions** (depends on Categories, Vendors, Accounts)
6. **HOA Dues** (depends on Transactions, Units)

---

## 1. Categories & Vendors Import (`import-categories-vendors-with-crud.js`)

### Purpose
Import expense categories and vendor records from JSON files.

### Input Data Structure

**Categories.json format:**
```json
[
  { "Categories": "Income - HOA Dues" },
  { "Categories": "Maintenance - Pool" },
  { "Categories": "Insurance" }
]
```

**Vendors.json format:**
```json
[
  { "Vendors": "CFE (Electric Company)" },
  { "Vendors": "Pool Service Company" }
]
```

### Transformation Logic
1. Uses `augmentMTCCategory()` and `augmentMTCVendor()` from data-augmentation-utils
2. Adds client ID reference
3. Adds migration metadata
4. Removes createdAt field (CRUD function adds it)

### Output Structure
- Categories stored in: `/clients/MTC/categories/{categoryId}`
- Vendors stored in: `/clients/MTC/vendors/{vendorId}`
- Auto-generated IDs used

### Special Business Rules
- Checks for duplicates by name before creating
- Creates client document if it doesn't exist
- Automatic audit logging via CRUD functions

### Dependencies
- `backend/firebase.js` for initialization
- `backend/controllers/categoriesController.js`
- `backend/controllers/vendorsController.js`
- `data-augmentation-utils.js`

---

## 2. Units Import (`import-units-with-crud.js`)

### Purpose
Import condo unit information including owner details, emails, and physical specifications.

### Input Data Structure

**Units.json format (array):**
```json
[
  {
    "UnitID": "A2",
    "Owner": "Garcia Martinez Family",
    "eMail": "email@example.com",
    "Dues": 4600
  }
]
```

**UnitSizes.json format (array):**
```json
[
  {
    "Condo": "A2",
    "ft² ": 1122,
    "%": 2.5
  }
]
```

### Transformation Logic
1. Matches unit data with size data using "Condo" field
2. Uses `augmentMTCUnit()` to combine and transform data
3. Validates with `validateAugmentedUnit()`
4. Maps fields to controller expectations

### Output Structure
- Units stored in: `/clients/MTC/units/{unitId}`
- Document ID is the UnitID (e.g., "A2")

### Special Business Rules
- Unit ID is extracted from UnitID field
- Size data is optional but tracked
- Monthly dues stored as number
- Percent ownership calculated
- Creates client document if needed

### Dependencies
- `backend/controllers/unitsController.js`
- `data-augmentation-utils.js`
- Firebase initialization

---

## 3. Users Import (`import-users-with-crud.js`)

### Purpose
Create Firebase Auth users and corresponding Firestore user documents, linking them to units.

### Input Data Structure

**Users.json format (array):**
```json
[
  {
    "LastName": "Garcia",
    "Email": "garcia@example.com",
    "Password": "temporary123",
    "Unit": "A2"
  }
]
```

### Transformation Logic
1. Creates or gets Firebase Auth user
2. Creates Firestore user document with:
   - Role: 'unitOwner' (default)
   - Property access configuration
   - Unit association
3. Updates unit documents with user associations

### Output Structure
- Auth users created in Firebase Authentication
- User docs stored in: `/users/{authUserId}`
- Units updated with owner/email arrays

### Special Business Rules
- Uses provided password (users must reset on first login)
- Default role is 'unitOwner'
- Creates propertyAccess structure for multi-property support
- Updates units with bidirectional references
- Migration flag indicates password needs reset

### Dependencies
- Firebase Admin SDK
- `backend/controllers/importMetadataController.js`
- `backend/utils/auditLogger.js`
- Direct Firestore access for unit updates

---

## 4. Year-End Balances Import (`import-yearend-balances.js`)

### Purpose
Import year-end financial balances or create fallback zero-balance document.

### Input Data Structure

**yearEndBalances.json format (optional):**
```json
{
  "2023": {
    "date": "2023-12-31",
    "accounts": [
      { "id": "checking", "name": "Checking Account", "balance": 150000 },
      { "id": "reserve", "name": "Reserve Fund", "balance": 500000 }
    ]
  }
}
```

**client-config.json (for accounts and fiscal year):**
```json
{
  "configuration": {
    "fiscalYearStartMonth": 1
  },
  "accounts": [
    { "id": "checking", "name": "Checking Account" }
  ]
}
```

### Transformation Logic
1. Loads client config for fiscal year settings
2. If yearEndBalances.json exists:
   - Imports each year's data
3. If not found:
   - Creates fallback with zero balances
   - Uses most recent completed fiscal year

### Output Structure
- Stored in: `/clients/MTC/yearEndBalances/{year}`
- Year is fiscal year as string

### Special Business Rules
- Balances stored in cents (multiply by 100)
- Fiscal year calculation based on client config
- Fallback creates zero balances for all configured accounts
- Removes any fields starting with underscore

### Dependencies
- `backend/utils/fiscalYearUtils.js`
- Client configuration file
- Environment variables for paths

---

## 5. Transactions Import (`import-transactions-with-crud.js`)

### Purpose
Import all financial transactions with proper account mapping and categorization.

### Input Data Structure

**Transactions.json format (array):**
```json
[
  {
    "": "25001",  // Google sequence ID
    "Date": "1/3/2024",
    "Vendor": "CFE",
    "Category": "Electricity",
    "Amount": -3459.23,
    "Account": "Operating",
    "Unit": "1A (Fletcher)",  // For HOA Dues
    "Notes": "JAN payment"
  }
]
```

### Transformation Logic
1. Uses `augmentMTCTransaction()` for field mapping
2. Extracts unit ID from "Unit" field for HOA Dues
3. Maps account names to account IDs
4. Determines transaction type from amount sign
5. Creates vendor/category references

### Output Structure
- Stored in: `/clients/MTC/transactions/{transactionId}`
- Auto-generated transaction IDs
- Saves ID mapping for HOA dues linking

### Special Business Rules
- Negative amounts = expenses, positive = income
- HOA Dues transactions tagged with metadata
- Unit ID extracted from format "1A (Name)"
- Maps Google sequence ID to Firestore ID
- Tracks transactions by category and account

### Dependencies
- `backend/controllers/transactionsController.js`
- `data-augmentation-utils.js`
- Account mapping configuration

### Critical ID Generation
- Must preserve transaction ID generation algorithm
- IDs used for HOA/Transaction cross-references
- Saves mapping file for HOA import

---

## 6. HOA Dues Import (not shown but referenced)

### Purpose
Import HOA payment records and link to transactions.

### Expected Functionality
1. Reads HOA_Transaction_CrossRef.json
2. Links HOA payments to transaction IDs
3. Updates credit balances
4. Tracks payment sequences

### Cross-Reference Format
```json
{
  "25001": "2024-01-03_123456_789",
  "25002": "2024-01-03_123457_790"
}
```

Maps Google sequence IDs to SAMS transaction IDs.

---

## Common Patterns

### Authentication
- All scripts use direct Firebase initialization
- System user created for audit logs:
  ```javascript
  const systemUser = {
    uid: 'import-script',
    email: 'import@system.local',
    displayName: 'Import Script'
  };
  ```

### Error Handling
- Try-catch blocks for each record
- Continues on individual errors
- Tracks success/error counts
- Detailed logging for debugging

### Audit Trail
- Automatic via CRUD functions
- Includes import metadata
- Tracks source script and timestamp

### Validation
- Pre-validation before CRUD calls
- Duplicate checking
- Required field validation
- Data type checking

---

## Migration Metadata

All imports add migration metadata:
```javascript
{
  migrationData: {
    importDate: new Date(),
    importScript: 'script-name.js',
    originalData: { /* original JSON */ }
  }
}
```

---

## Key Issues to Address in Modernization

1. **Direct Firebase Access**: All scripts use `initializeFirebase()` directly
2. **Path Dependencies**: Hard-coded paths to MTCdata directory
3. **Date Handling**: Not using DateService consistently
4. **Account Mapping**: Relies on external augmentation utils
5. **Error Recovery**: No rollback mechanism
6. **Batch Operations**: Processes one record at a time
7. **Authentication**: Needs proper request/response context for controllers

---

## Data Flow Summary

```
Categories.json ─┐
Vendors.json ────┼──> Categories & Vendors (no deps)
                 │
Units.json ──────┼──> Units (no deps)
UnitSizes.json ──┘
                 │
Users.json ──────┼──> Users (needs Units)
                 │
yearEndBalances──┼──> Year-End Balances (needs config)
client-config ───┘
                 │
Transactions ────┼──> Transactions (needs Categories, Vendors)
                 │
HOADues.json ────┼──> HOA Dues (needs Transactions, Units)
CrossRef.json ───┘
```

This documentation captures the current state before modernization begins.