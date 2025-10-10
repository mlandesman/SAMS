# Client Data Requirements

This document specifies the exact data formats required for importing client data into SAMS.

## Required Data Files

Every client import requires these 7 JSON files:

1. **Categories.json** - Income and expense categories
2. **Vendors.json** - Vendors, payees, and service providers
3. **Units.json** - Property units and basic ownership info
4. **UnitSizes.json** - Detailed unit measurements and ownership percentages
5. **Transactions.json** - All financial transactions
6. **HOADues.json** - HOA dues records and payment history
7. **AutoCategorize.json** - Rules for automatic transaction categorization

## Data Format Specifications

### Categories.json
```json
[
  {
    "Category": "Utilities",
    "Type": "expense"
  },
  {
    "Category": "HOA Dues", 
    "Type": "income"
  }
]
```

**Required Fields:**
- `Category` (string): Category name
- `Type` (string): "expense" or "income"

### Vendors.json
```json
[
  {
    "Vendor": "CFE",
    "Type": "Utility Company"
  },
  {
    "Vendor": "Home Depot",
    "Type": "Hardware Store"
  }
]
```

**Required Fields:**
- `Vendor` (string): Vendor/payee name
- `Type` (string): Vendor category or type

### Units.json
```json
[
  {
    "UnitID": "101",
    "Owner": "John Smith",
    "eMail": "john.smith@email.com",
    "Dues": 6900,
    "% Owner": 0.092
  }
]
```

**Required Fields:**
- `UnitID` (string): Unique unit identifier
- `Owner` (string): Primary owner name
- `eMail` (string): Owner email address
- `Dues` (number): Monthly dues amount
- `% Owner` (decimal): Ownership percentage as decimal (0.092 = 9.2%)

### UnitSizes.json
```json
[
  {
    "UnitID": "101",
    "m² ": 85.5,
    "ft² ": 920.2,
    "%": 0.092
  }
]
```

**Required Fields:**
- `UnitID` (string): Must match Units.json
- `m² ` (number): Square meters (note the space)
- `ft² ` (number): Square feet (note the space)
- `%` (decimal): Ownership percentage

### Transactions.json
```json
[
  {
    "Date": "2024-01-15",
    "Amount": -1250.00,
    "Category": "Utilities",
    "Vendor": "CFE",
    "PaymentMethod": "Bank Transfer",
    "Notes": "Monthly electricity bill",
    "Type": "expense"
  }
]
```

**Required Fields:**
- `Date` (string): ISO format "YYYY-MM-DD"
- `Amount` (number): Transaction amount (negative for expenses, positive for income)
- `Category` (string): Must exist in Categories.json
- `Vendor` (string): Must exist in Vendors.json
- `PaymentMethod` (string): How payment was made
- `Notes` (string): Transaction description
- `Type` (string): "expense" or "income"

### HOADues.json
```json
[
  {
    "UnitID": "101",
    "Date": "2024-01-01",
    "Amount": 6900,
    "Status": "paid",
    "PaymentDate": "2024-01-15",
    "TransactionID": "txn_001",
    "Notes": "January 2024 dues"
  }
]
```

**Required Fields:**
- `UnitID` (string): Must match Units.json
- `Date` (string): Due date in "YYYY-MM-DD" format
- `Amount` (number): Dues amount
- `Status` (string): "paid", "unpaid", "partial"
- `PaymentDate` (string): When paid (null if unpaid)
- `TransactionID` (string): Link to transaction record
- `Notes` (string): Additional notes

### AutoCategorize.json
```json
[
  {
    "Trigger": "CFE",
    "Category": "Utilities",
    "Type": "expense",
    "Field": "vendor"
  },
  {
    "Trigger": "Transfer HOA",
    "Category": "HOA Dues",
    "Type": "income", 
    "Field": "notes"
  }
]
```

**Required Fields:**
- `Trigger` (string): Text to match
- `Category` (string): Category to assign
- `Type` (string): "expense" or "income"
- `Field` (string): Which field to search ("vendor", "notes", "category")

## Data Validation Rules

### General Rules
1. **No empty required fields** - All required fields must have values
2. **Consistent IDs** - UnitIDs must match across Units.json and UnitSizes.json
3. **Valid references** - Categories and Vendors referenced in Transactions must exist
4. **Date formats** - All dates must be in ISO format "YYYY-MM-DD"
5. **Numeric values** - Amounts must be valid numbers
6. **Email validation** - Email addresses must be valid format

### Business Logic Rules
1. **Ownership percentages** - All unit ownership percentages should sum to approximately 1.0
2. **Transaction consistency** - Transaction categories must match their type (expense/income)
3. **HOA dues linking** - HOA dues with "paid" status should have corresponding transactions
4. **Amount signs** - Expenses should be negative, income should be positive

### Data Quality Checks
1. **Duplicate detection** - Check for duplicate units, vendors, or categories
2. **Orphaned records** - Identify transactions without valid categories/vendors
3. **Missing data** - Report any critical missing information
4. **Date ranges** - Validate reasonable date ranges for transactions

## File Size Limits

- **Small import**: < 1,000 total records across all files
- **Medium import**: 1,000 - 5,000 total records
- **Large import**: 5,000+ total records

## Import Performance Guidelines

### File Optimization
- Remove unnecessary fields not used by SAMS
- Sort transactions by date (oldest first)
- Ensure no duplicate records
- Validate all data before import

### Import Order
1. Categories and Vendors first (dependencies)
2. Units and UnitSizes (property structure)
3. Transactions (main data)
4. HOADues (linked to transactions)
5. AutoCategorize (processing rules)

## Common Data Issues

### Date Format Problems
```
❌ Wrong: "01/15/2024", "15-Jan-2024", "2024/01/15"
✅ Correct: "2024-01-15"
```

### Amount Format Issues
```
❌ Wrong: "$1,250.00", "1.250,00", "(1250)"
✅ Correct: -1250.00, 1250.00
```

### Email Format Problems
```
❌ Wrong: "john.smith", "email@", "@domain.com"
✅ Correct: "john.smith@email.com"
```

### Category/Vendor Mismatches
```
❌ Wrong: Transaction references "Electric" but Categories.json has "Utilities"
✅ Correct: Exact name matching required
```

## Data Preparation Checklist

Before importing client data, verify:

- [ ] All 7 required JSON files present
- [ ] No empty required fields
- [ ] All dates in ISO format (YYYY-MM-DD)
- [ ] All amounts as numbers (no currency symbols)
- [ ] All emails in valid format
- [ ] Categories/Vendors referenced in transactions exist
- [ ] UnitIDs consistent across Units.json and UnitSizes.json
- [ ] Ownership percentages are decimals (not percentages)
- [ ] No duplicate records
- [ ] Transaction types match amount signs

Use the validation script to check all requirements:
```bash
node scripts/client-onboarding/validate-client-data.js --data-dir /path/to/client/data
```