# Modern Import Scripts Documentation

## Overview

This document describes the modernized import scripts created in Phase 4 of the client onboarding system modernization. These scripts use the application's controllers directly instead of making database writes, ensuring consistency with the main application logic.

## Scripts

### 1. import-transactions-modern.js

**Purpose:** Import transaction data using the transactionsController

**Key Features:**
- Uses the EXACT same transaction ID generation algorithm as the controller (`generateTransactionId`)
- Maps vendor and category names to IDs using controller logic
- Handles split transactions with proper allocations
- Creates HOA dues cross-reference data for payment linking
- Maintains running account balances through the controller
- Preserves sequence numbers for HOA cross-references

**Usage:**
```bash
node import-transactions-modern.js <clientId> [environment]
```

**Input:** `MTCdata/Transactions.json`

**Outputs:**
- `transaction-id-mapping.json` - Maps sequence numbers to transaction IDs
- `HOA_Transaction_CrossRef.json` - HOA-specific cross-reference data

**Example:**
```bash
node import-transactions-modern.js MTC dev
```

### 2. import-hoa-dues-modern.js

**Purpose:** Import HOA dues payment data with transaction linking

**Key Features:**
- Extracts sequence numbers from payment notes using regex patterns
- Links payments to transactions using cross-reference data
- Updates credit balances properly
- Creates proper 12-month payment array structure
- Handles payment method extraction from notes
- Uses DateService for all date operations

**Usage:**
```bash
node import-hoa-dues-modern.js <clientId> [year] [environment]
```

**Input:** 
- `MTCdata/HOADues.json` - Payment data by unit
- `HOA_Transaction_CrossRef.json` or `transaction-id-mapping.json` - For linking

**Example:**
```bash
node import-hoa-dues-modern.js MTC 2025 dev
```

### 3. validate-hoa-transaction-links.js

**Purpose:** Validate HOA payment to transaction links and data integrity

**Key Features:**
- Verifies all HOA payments have valid transaction links
- Validates transaction ID format (YYYY-MM-DD_HHMMSS_nnn)
- Checks if linked transactions actually exist in database
- Validates payment amounts match transaction amounts
- Verifies credit balance calculations
- Reports orphaned payments and data inconsistencies

**Usage:**
```bash
node validate-hoa-transaction-links.js <clientId> [year] [environment]
```

**Output:** `hoa-validation-report-<clientId>-<year>.json`

**Example:**
```bash
node validate-hoa-transaction-links.js MTC 2025 dev
```

## Transaction ID Generation

The modern scripts use the exact same ID generation as the controllers:

```javascript
// From databaseFieldMappings.js
generateTransactionId: async (isoDateString) => {
  // Format: YYYY-MM-DD_HHMMSS_nnn
  // Uses Luxon for timezone handling
  // Implements collision detection with retry
  // Always uses America/Cancun timezone
}
```

**Key Points:**
- IDs reflect the transaction date, not creation date
- Current time components ensure uniqueness
- Collision detection prevents duplicates
- Timezone-aware using Luxon

## Payment Note Parsing

The HOA import extracts metadata from structured notes:

```javascript
// Example note format:
"Posted: MXN 17,400.00 on Fri Dec 27 2024 16:27:51 GMT-0500 (hora estándar central)↵
BANCO AZTECA; December 2024→Seq: 25009"

// Extracts:
- Sequence number: 25009
- Payment date: 2024-12-27T16:27:51
- Amount: 17400.00
- Payment method: BANCO AZTECA
```

## Data Flow

1. **Transaction Import**
   - Load transactions from JSON
   - Create via controller (generates proper IDs)
   - Track HOA transactions with sequence numbers
   - Save cross-reference mapping

2. **HOA Dues Import**
   - Load payment data and cross-reference
   - Parse notes to extract sequence numbers
   - Link payments to transactions
   - Create dues records with proper structure

3. **Validation**
   - Check all payments have valid links
   - Verify transactions exist
   - Validate amounts and balances
   - Generate detailed report

## Error Handling

All scripts include:
- Detailed progress logging
- Error tracking with context
- Summary statistics
- Debug mode for troubleshooting
- Non-blocking error handling (continue on error)

## Configuration

Environment variables:
- `DATA_DIR` - Override data directory (default: MTCdata)
- `DEBUG=true` - Enable detailed debug logging
- `SAMS_ENV` - Set environment (dev/staging/prod)

## Best Practices

1. **Import Order:** Always run transaction import before HOA dues import
2. **Validation:** Run validator after imports to check data integrity
3. **Cross-Reference:** Ensure cross-reference file is generated and accessible
4. **Date Handling:** All dates use America/Cancun timezone consistently
5. **Amount Storage:** All amounts stored as cents (integers)

## Comparison with Legacy Scripts

### Legacy Issues Fixed:
- Direct database writes → Controller-based operations
- Inconsistent ID generation → Exact controller algorithm
- Manual date handling → DateService usage
- Missing validation → Comprehensive validation
- Poor error handling → Detailed error tracking

### Improvements:
- Uses application business logic
- Maintains data consistency
- Better error recovery
- Progress tracking
- Detailed reporting
- Timezone-aware operations

## Troubleshooting

### Common Issues:

1. **Missing Cross-Reference File**
   - Ensure transaction import completed successfully
   - Check for `HOA_Transaction_CrossRef.json` or `transaction-id-mapping.json`

2. **Low Link Success Rate**
   - Verify sequence numbers in source data
   - Check note format matches expected pattern
   - Enable debug mode to see parsing details

3. **Transaction Not Found**
   - Verify transaction was imported
   - Check transaction ID format
   - Ensure correct environment

4. **Credit Balance Mismatch**
   - Review payment amounts
   - Check for missing payments
   - Verify scheduled amount is correct

## Future Enhancements

1. **Batch Processing:** Process multiple units/transactions in parallel
2. **Resume Capability:** Continue failed imports from last successful point
3. **Better Reporting:** Generate HTML reports with charts
4. **Auto-Retry:** Automatically retry failed operations
5. **Data Validation:** Pre-import data validation and cleaning