# Water Bills V2 - Future Bill Generation Work

## Current State (January 11, 2025)
Water Bills V2 implements a **simplified meter reading storage system** with:
- ✅ Explicit month/year selection (critical fix from V1 failure)
- ✅ Storage of meter readings for units, common area, and building meter
- ✅ Consumption calculation (current - prior reading)
- ✅ History display matching HOA Dues layout

## Temporary Simplifications
The following were simplified for the initial implementation:
1. **Payment tracking disabled** - `monthsBehind` and `unpaidBalance` hardcoded to 0
2. **Validation logic commented out** - The data integrity checks for payment consistency
3. **No bill generation** - Just storing readings, not generating bills
4. **No payment processing** - No payment UI or backend logic

## Code Locations Needing Updates

### Backend: `/backend/services/projectsService.js`
**Line 154-155**: Re-enable validation
```javascript
// Skip validation for water bills (simplified implementation)
// this.validateUnitData(updatedUnits[unitId]);
```
Should become:
```javascript
// CRITICAL: Validate data integrity
this.validateUnitData(updatedUnits[unitId]);
```

**Lines 138-150**: Restore payment tracking logic
Currently simplified to:
```javascript
// For water bills V2, we're just tracking readings, not payments
// So we'll simplify this structure
updatedUnits[unitId] = {
  priorReading,
  currentReading,
  consumption,
  amount,
  unpaidBalance: 0,  // Simplified - no payment tracking for now
  monthsBehind: 0,   // Simplified - no payment tracking for now
  paid: false,
  paidDate: null,
  paymentRecord: null
};
```

Should restore the original logic for tracking unpaid balances and months behind.

### Frontend: `/frontend/sams-ui/src/views/WaterBillsViewV2.jsx`
Needs to add:
1. Bills tab showing amounts due
2. Payment processing UI
3. Payment history tracking
4. Balance display per unit

## Next Steps for Bill Generation

### Phase 1: Enable Bill Generation
1. Restore payment tracking logic in backend
2. Add configuration for water rates (per m³ pricing)
3. Generate bills based on consumption
4. Track unpaid balances across months

### Phase 2: Payment Processing
1. Add payment UI similar to HOA Dues
2. Implement payment recording endpoints
3. Track partial vs full payments
4. Handle penalty calculations for late payments

### Phase 3: Reporting
1. Add bills summary view
2. Payment history per unit
3. Outstanding balance reports
4. Consumption trends

## Important Notes
- The validation logic for `monthsBehind` and `unpaidBalance` is CRITICAL for data integrity
- Must ensure if `monthsBehind > 0` then `unpaidBalance > 0` (and vice versa)
- This prevents the "phantom debt" or "missing payment" bugs that waste debugging time

## Why This Approach
We implemented the simplified version first to:
1. Fix the critical V1 bug (no month/year selection)
2. Get meter reading storage working
3. Validate the UI/UX flow
4. Have a working foundation before adding complexity

Once this simplified version is approved, we can layer on the billing logic without breaking the core meter reading functionality.