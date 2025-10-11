# Water Meter Document Structure

This document details the exact fields stored in Firestore for water meter readings and bills.

## 1. Water Meter Reading Document

**Path**: `/clients/{clientId}/units/{unitId}/waterMeter/{fiscalYear}/readings/{readingId}`

**Document ID Format**: `{timestamp}-{uuid8}`
Example: `1754691795878-a1b2c3d4`

### Fields Stored in Firestore:

```javascript
{
  // Core Reading Data (unitId not stored - it's in the path)
  meterType: "waterMeter",          // String - Always "waterMeter" for water readings
  reading: 1234.56,                 // Number - Meter reading value in cubic meters
  date: Timestamp,                  // Firestore Timestamp - Reading date
  
  // Additional Information
  notes: "Monthly reading",         // String - Optional notes about the reading
  readBy: "API",                    // String - Who/what recorded the reading
  
  // Metadata
  created: Timestamp,               // Firestore Timestamp - When record was created
  updated: Timestamp                // Firestore Timestamp - Last update time
}
```

### Additional Fields Returned to Frontend (not stored):

```javascript
{
  id: "1754691795878-a1b2c3d4",          // Document ID
  unitId: "A01",                          // Added by API from path
  dateFormatted: {                       // Formatted date object
    raw: "2025-08-08T06:00:00.000Z",
    formatted: "08/08/2025",
    month: "August",
    year: 2025,
    day: 8
  },
  firestorePath: "/clients/AVII/units/A01/waterMeter/2026/readings/reading-..."
  fiscalYear: 2026                       // Fiscal year (returned from saveReading)
}
```

## 2. Water Bill Document

**Path**: `/clients/{clientId}/units/{unitId}/waterMeter/{fiscalYear}/bills/{billId}`

**Document ID Format**: `{fiscalYear}-{month}-{uuid8}`
Example: `2026-august-5f6g7h8i`

### Fields Stored in Firestore:

```javascript
{
  // Billing Identifiers (unitId not stored - it's in the path)
  clientId: "AVII",                 // String - Client identifier
  year: 2026,                       // Number - Fiscal year for the bill
  meterType: "waterMeter",          // String - Always "waterMeter"
  
  // Billing Period and Dates
  billingDate: Timestamp,           // Firestore Timestamp - Bill generation date
  dueDate: Timestamp,               // Firestore Timestamp - Payment due date
  billingPeriod: "monthly",         // String - Billing frequency
  
  // Consumption Data
  consumption: 45.2,                // Number - Water consumption in cubic meters
  currentReading: 1234.56,          // Number - Current meter reading (nullable)
  previousReading: 1189.36,         // Number - Previous meter reading (nullable)
  consumptionWarnings: [],          // Array - Warnings (e.g., ["Unusually high consumption"])
  
  // Billing Amounts (all stored as integers in cents)
  consumptionCharge: 226000,        // Integer - Base charge for consumption (2260.00 MXN)
  previousBalance: 0,               // Integer - Outstanding balance from previous bills
  penaltyAmount: 0,                 // Integer - Late payment penalty
  penaltyDetails: null,             // Object - Penalty calculation details (nullable)
  subtotal: 226000,                 // Integer - Total before credit
  creditApplied: 0,                 // Integer - Credit amount applied
  creditRemaining: 0,               // Integer - Remaining credit after application
  totalAmount: 226000,              // Integer - Final amount due
  currency: "MXN",                  // String - Currency code
  
  // Rate Information
  ratePerM3: 5000,                  // Integer - Rate per cubic meter in cents (50.00 MXN)
  penaltyRate: 0.05,                // Number - Monthly penalty rate (5%)
  minimumCharge: 0,                 // Integer - Minimum charge (0 for AVII)
  
  // Payment Tracking
  paid: false,                      // Boolean - Payment status
  paidAmount: 0,                    // Integer - Amount paid in cents
  paidDate: null,                   // Firestore Timestamp - Payment date (nullable)
  paymentReference: null,           // String - Payment reference (nullable)
  
  // Additional Information
  notes: "Generated for 8/2025",    // String - Optional notes
  status: "pending",                // String - Bill status (pending/paid/partial)
  
  // Metadata
  created: Timestamp,               // Firestore Timestamp - Creation time
  updated: Timestamp,               // Firestore Timestamp - Last update time
  createdAt: {                      // Object - Formatted creation date
    raw: "2025-08-08T06:00:00.000Z",
    formatted: "08/08/2025",
    month: "August",
    year: 2025,
    day: 8
  }
}
```

### Additional Fields Returned to Frontend (not stored):

```javascript
{
  id: "2026-august-5f6g7h8i",             // Document ID
  unitId: "A01",                          // Added by API from path
  displayAmounts: {                      // Formatted amounts in MXN (not cents)
    consumptionCharge: "2260.00",
    previousBalance: "0.00",
    penaltyAmount: "0.00", 
    creditApplied: "0.00",
    totalAmount: "2260.00",
    paidAmount: "0.00"
  },
  billingDateFormatted: {...},          // Formatted billing date
  dueDateFormatted: {...},              // Formatted due date
  createdFormatted: {...},              // Formatted creation date
  firestorePath: "/clients/AVII/units/A01/waterMeter/2026/bills/bill-..."
}
```

## 3. After Payment Update

When a payment is recorded, these fields are updated in the bill document:

```javascript
{
  // Payment fields updated
  paid: true,                           // Boolean - Changed to true if fully paid
  paidAmount: 226000,                   // Integer - Amount paid in cents
  paidDate: Timestamp,                  // Firestore Timestamp - When payment was made
  paymentReference: "PAY-1754691795878", // String - Payment reference number
  paymentNotes: "Paid via transfer",    // String - Payment notes
  status: "paid",                       // String - Updated to "paid" or "partial"
  
  // Metadata updated
  updated: Timestamp                    // Firestore Timestamp - Updated to current time
}
```

## 4. Water Billing Configuration

**Path**: `/clients/{clientId}/config/waterBills`

```javascript
{
  // Billing rates (stored as integers in cents)
  ratePerM3: 5000,                      // 50.00 MXN per cubic meter
  minimumCharge: 0,                     // No minimum for AVII
  ivaRate: 0,                           // No IVA for AVII
  
  // Penalty configuration
  penaltyRate: 0.05,                    // 5% monthly penalty
  penaltyDays: 10,                      // Apply after 10 days late
  compoundPenalty: true,                // Compound penalties monthly
  
  // Billing periods
  billingPeriod: "monthly",
  readingDay: 1,                        // Read on 1st of month
  billingDay: 1,                        // Bill on 1st
  dueDay: 10,                           // Due on 10th
  
  // Display configuration
  currency: "MXN",
  currencySymbol: "$",
  decimalPlaces: 2,
  
  // Features
  allowCreditBalance: true,
  autoApplyCredit: true,
  emailBills: false,
  
  // Metadata
  created: Timestamp,
  updated: Timestamp,
  createdBy: "system",
  notes: "AVII Water Billing Configuration"
}
```

## 5. Client Configuration (Fiscal Year)

**Path**: `/clients/{clientId}`

```javascript
{
  // ... other client fields ...
  
  configuration: {
    fiscalYearStartMonth: 7,            // July (1-12)
    // ... other configuration ...
  }
}
```

## Important Notes

1. **Fiscal Year Storage**: All documents are stored under the fiscal year, not calendar year
   - August 2025 → Stored in `/2026/` collection (FY 2026)
   - June 2025 → Stored in `/2025/` collection (FY 2025)

2. **Monetary Values**: All amounts are stored as **integers in cents**
   - 50.00 MXN → stored as 5000
   - 2260.00 MXN → stored as 226000

3. **Timestamps**: All dates are stored as Firestore Timestamps
   - Frontend receives formatted versions via `dateFormatted` fields

4. **Document IDs**: 
   - Reading IDs include timestamp for uniqueness
   - Bill IDs include fiscal year and month for readability

5. **Path Structure**: Unit-centric architecture
   - Everything is organized under `/units/{unitId}/`
   - Each meter type has its own subcollection
   - Each year has its own subcollection