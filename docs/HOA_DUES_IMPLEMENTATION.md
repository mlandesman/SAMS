# HOA Dues Implementation Plan

## Overview

This document outlines the implementation plan for the HOA Dues functionality in the Sandyland Asset Management System (SAMS). The HOA Dues module will allow property managers to track and manage monthly dues payments for condominium units.

## Requirements

Based on the current workflow described in `HOA-Dues.md`, we need to implement:

1. A dues table displaying units and their payment status for each month
2. A payment entry system with automation for applying payments to months
3. Credit balance tracking
4. Receipt generation and distribution
5. Transaction recording with proper audit logging

## Data Model Approach

After reviewing the options presented in `HOA-Dues.md`, we will implement a hybrid approach:

### Primary Data Storage: Dues Collection in Units

We will store dues payment data within the unit documents using a sub-collection:
```
/clients/{clientId}/units/{unitId}/dues/{year}
```

Each year document will contain:
- `creditBalance`: The current credit balance for the unit
- `scheduledAmount`: The scheduled monthly dues amount
- `payments`: An array of 12 payment objects representing each month:
  ```javascript
  [
    {
      "month": 1, // January
      "paid": 500.00,
      "date": Timestamp,
      "transactionId": "docId", // Reference to transaction
      "notes": "Partial payment"
    },
    // ... other months
  ]
  ```

### Transaction Integration

For each dues payment:
1. Create a transaction record in `/clients/{clientId}/transactions/{transactionId}`
2. Store the transaction ID in the dues payment record
3. For distribution of payments across months, add a `duesDistribution` field to transactions:
   ```javascript
   {
     "duesDistribution": [
       {
         "unitId": "2B",
         "month": 1,
         "amount": 500.00,
         "year": 2025
       },
       // Other months/distributions
     ],
     "creditBalanceAdded": 250.00
   }
   ```

This approach provides:
- Easy lookup of a unit's payment status
- Proper connection to transactions for audit purposes
- Minimal data duplication
- Efficient querying for the dues table display

## UI Implementation Plan

### 1. HOA Dues Table View

Create a component `HOADuesView.jsx` with:
- A table displaying units as rows and months as columns
- Color coding for payment status (paid, partial, unpaid)
- Totals row for monthly collection totals
- Filtering options (by unit, owner, payment status)
- Year selector for historical data

### 2. Dues Payment Entry Modal

Implement `DuesPaymentModal.jsx` with:
- Unit selection dropdown
- Payment amount input
- Payment method selection
- Notes field
- Automated calculation of months to be paid
- Visual representation of payment distribution
- Credit balance display and calculation

### 3. Unit Payment Detail View

Create `UnitDuesDetailView.jsx` to show:
- Payment history for a specific unit
- Credit balance history
- Receipt history
- Owner information
- Payment trend visualization

## Implementation Phases

### Phase 1: Basic Structure
- Create the basic table structure with static data
- Implement year and month display
- Set up routing and navigation

### Phase 2: Data Integration
- Implement Firestore data structure
- Connect table to live data
- Add filtering and sorting functionality

### Phase 3: Payment Processing
- Create payment entry modal
- Implement payment distribution algorithm
- Set up credit balance tracking

### Phase 4: Receipts and Notifications
- Create receipt generation
- Implement email notification system
- Add payment reminders

## Technical Considerations

### Performance
- Use pagination or virtualization for large condo complexes
- Implement efficient querying patterns
- Consider data denormalization for frequently accessed views

### Security
- Ensure proper Firestore rules for dues data
- Implement role-based access for payment entry
- Add validation for payment amounts and distribution

## Development Plan

1. **Day 1**: Set up basic UI structure and routing
2. **Day 2**: Implement data structure and test with sample data
3. **Day 3**: Develop payment entry and distribution algorithm
4. **Day 4**: Create receipt generation and complete integration
5. **Day 5**: Testing, bug fixing, and documentation

## Digital Receipt Integration

**Status: ✅ IMPLEMENTED (June 17, 2025)**

The HOA Dues payment workflow now includes automatic Digital Receipt generation:

### Features:
- **Automatic Receipt Generation**: After successful payment, Digital Receipt modal opens automatically
- **Universal Receipt System**: Uses centralized `generateReceipt()` utility for consistency
- **Deferred Data Refresh**: Modal remains stable during background operations
- **Email Integration**: Send receipts directly from payment confirmation
- **Owner Information**: Automatic lookup of unit owner details for receipt personalization

### Implementation:
- Payment submission triggers `generateHOADuesReceipt(transactionId, context)`
- Receipt data includes formatted date, amount in Spanish words, and owner information
- Modal closure triggers data refresh to update HOA Dues display
- Works seamlessly with existing notification systems

### Usage:
```javascript
// After successful payment API call
const receiptGenerated = await generateHOADuesReceipt(result.transactionId, {
  setReceiptTransactionData,
  setShowDigitalReceipt,
  showError,
  selectedClient,
  units
});
```

---
