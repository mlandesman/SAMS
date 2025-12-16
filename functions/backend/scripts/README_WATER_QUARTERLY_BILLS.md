# Water Bills Quarterly Bill Generation Guide

## Quick Start

After resetting/reimporting water bills data, use this script to regenerate Q1 bills:

```bash
node backend/scripts/generateWaterQ1Bills.js
```

## What It Does

1. **Verifies** AVII config is set to quarterly billing
2. **Checks** for existing quarterly bills (prevents duplicates)
3. **Validates** Q1 readings exist (months 0, 1, 2 = Jul, Aug, Sep)
4. **Generates** 2026-Q1 bill with:
   - Due Date: October 1, 2025 (in arrears)
   - Penalty Start: October 31, 2025 (30 days after due)
   - Includes months: Jul, Aug, Sep (fiscal months 0-2)
   - Bill ID format: YYYY-Q# (matches HOA Dues naming)

## Prerequisites

1. **Config Must Be Quarterly**:
   ```bash
   # Run this ONCE if not already done:
   node backend/scripts/updateWaterConfigToQuarterly.js
   ```

2. **Readings Must Exist**:
   - `clients/AVII/projects/waterBills/readings/2026-00` (July)
   - `clients/AVII/projects/waterBills/readings/2026-01` (August)
   - `clients/AVII/projects/waterBills/readings/2026-02` (September)

3. **No Existing Quarterly Bills**:
   - Delete any existing `YYYY-Q#` documents in `clients/AVII/projects/waterBills/bills/`
   - Keep or delete monthly bills (2026-00, 2026-01, etc.) as needed

## Step-by-Step Workflow

### After Data Reset/Reimport:

```bash
# 1. Delete old bills (Firestore Console or script)
#    Path: clients/AVII/projects/waterBills/bills/
#    Delete: 2026-Q1, 2026-Q2, etc. (and/or monthly bills like 2026-00)

# 2. Verify config (one-time, if needed)
node backend/scripts/updateWaterConfigToQuarterly.js

# 3. Verify readings exist for Q1 (Jul, Aug, Sep)
#    Check Firestore: clients/AVII/projects/waterBills/readings/
#    Should have: 2026-00, 2026-01, 2026-02

# 4. Generate Q1 bill
node backend/scripts/generateWaterQ1Bills.js
```

## Expected Output

```
✅ Q1 BILL GENERATION COMPLETE

Bill ID: 2026-Q1
Fiscal Year: 2026
Fiscal Quarter: Q1
Due Date: 2025-10-01
Penalty Start Date: 2025-10-31
Readings Included: 3 months (Jul, Aug, Sep)
Total Units: 10
Total Billed: $X,XXX.XX
```

## Troubleshooting

### Error: "AVII is not configured for quarterly billing"
**Solution**: Run `node backend/scripts/updateWaterConfigToQuarterly.js`

### Error: "Missing readings for months: 0, 1, 2"
**Solution**: Add readings for Jul, Aug, Sep in the UI or import data

### Warning: "Found existing quarterly bills"
**Solution**: Delete existing bills in Firestore Console first
- Path: `clients/AVII/projects/waterBills/bills/`
- Delete documents: `2026-Q1`, `2026-Q2`, `2027-Q1`, etc.

### Error: "No new readings found since last bill"
**Solution**: 
- Ensure readings exist for fiscal year 2026
- Ensure readings have `year: 2026` and `month: 0, 1, 2`
- Delete any existing bills and try again

## Generating Other Quarters

For Q2, Q3, Q4, you can use the general quarterly bill generation:

```javascript
// Q2 (Oct-Dec, fiscal months 3-5)
// Due: January 1, 2026
POST /water/clients/AVII/bills/generate
Body: { "year": 2026, "dueDate": "2026-01-01" }

// Q3 (Jan-Mar, fiscal months 6-8)  
// Due: April 1, 2026
POST /water/clients/AVII/bills/generate
Body: { "year": 2026, "dueDate": "2026-04-01" }

// Q4 (Apr-Jun, fiscal months 9-11)
// Due: July 1, 2026
POST /water/clients/AVII/bills/generate
Body: { "year": 2026, "dueDate": "2026-07-01" }
```

Or create similar scripts: `generateWaterQ2Bills.js`, etc.

## Using the UI (Future)

Once the frontend is updated, you'll be able to generate quarterly bills from the UI:
1. Go to Water Bills > Bills tab
2. Click "Generate Quarterly Bill"
3. Select quarter and due date
4. Click Generate

## Files Reference

- **Q1 Generation Script**: `backend/scripts/generateWaterQ1Bills.js`
- **Config Update**: `backend/scripts/updateWaterConfigToQuarterly.js`
- **General Test Bill**: `backend/scripts/generateTestQuarterlyBill.js`
- **Test Suite**: `backend/testing/testWaterBillsQuarterlyComplete.js`

## Firestore Paths

- **Config**: `clients/AVII/config/waterBills`
- **Readings**: `clients/AVII/projects/waterBills/readings/2026-XX`
- **Bills**: `clients/AVII/projects/waterBills/bills/YYYY-Q#` (e.g., 2026-Q1)

## API Endpoints

- **Generate**: `POST /water/clients/AVII/bills/generate` (body: `{ year, dueDate }`)
- **Get Quarterly**: `GET /water/clients/AVII/bills/quarterly/2026`
- **Get Config**: `GET /water/clients/AVII/config`

