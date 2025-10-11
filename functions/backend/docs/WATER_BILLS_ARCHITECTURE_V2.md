# Water Bills System Architecture V2

## Overview
The Water Bills system is a project type within the SAMS projects framework. It manages water meter readings, billing, and payments, following the same pattern as other assessment projects (roof, propane, etc).

## Data Structure Hierarchy

```
/clients/{clientId}/
├── config/
│   └── waterBilling (rate structure, penalties, etc)
└── projects/
    └── waterBills/
        ├── meters/
        │   └── {unitId} (meter configuration)
        ├── readings/
        │   └── {year}/
        │       └── {month} (monthly readings)
        ├── bills/
        │   └── {year}/
        │       └── {month} (generated bills)
        └── payments/
            └── {paymentId} (payment records)
```

## Data Models

### 1. Configuration (`/clients/{clientId}/config/waterBilling`)
Global water billing configuration for the client.
```javascript
{
  rateStructure: {
    baseCharge: 25.00,        // Monthly base charge per unit
    usageRate: 5.50           // $ per 1000 gallons (flat rate)
  },
  penalties: {
    type: "percentage",       // "fixed" or "percentage"
    percentage: 5.0,          // 5% monthly interest (AVII specific)
    compound: true,           // Compound monthly
    gracePeriodDays: 10       // Days after due date before penalty (AVII: 10 days)
  },
  billing: {
    dueDayOfMonth: 10,        // Standard due date (10th of month for AVII)
    readingDayOfMonth: 1      // When readings are typically taken
  }
}
```

### 2. Meters (`/clients/{clientId}/projects/waterBills/meters/{unitId}`)
Meter configuration for each unit.
```javascript
{
  unitId: "101",
  meterNumber: "WM-101-2025",
  installDate: "2020-01-15",
  lastReadingDate: "2025-08-01",
  lastReading: 1785,
  active: true
}
```

### 3. Readings (`/clients/{clientId}/projects/waterBills/readings/{year}/{month}`)
Monthly meter readings document.
```javascript
{
  readingDate: "2025-08-01",
  billingPeriod: "July 2025",    // Month being billed
  fiscalYear: 2026,               // AVII fiscal year
  fiscalMonth: 0,                 // 0-based fiscal month
  readings: {
    units: {
      "101": { 
        prior: 1774, 
        current: 1785, 
        consumption: 11 
      },
      "102": { 
        prior: 30, 
        current: 35, 
        consumption: 5 
      }
      // ... more units
    },
    commonArea: { 
      prior: 1730, 
      current: 1750, 
      consumption: 20 
    },
    buildingMeter: { 
      prior: 12985, 
      current: 13090, 
      consumption: 105 
    }
  },
  metadata: {
    enteredBy: "userId",
    enteredAt: "2025-08-01T10:30:00Z",
    source: "manual"  // manual, import, api
  }
}
```

### 4. Bills (`/clients/{clientId}/projects/waterBills/bills/{year}/{month}`)
Generated bills for the month.
```javascript
{
  billDate: "2025-08-01",
  dueDate: "2025-08-15",
  billingPeriod: "July 2025",
  fiscalYear: 2026,
  fiscalMonth: 0,
  bills: {
    units: {
      "101": {
        priorReading: 1774,
        currentReading: 1785,
        consumption: 11,
        baseCharge: 25.00,
        usageCharge: 0.06,      // 11 gal * $5.50/1000
        totalAmount: 25.06,
        paidAmount: 0,
        status: "unpaid",       // unpaid, partial, paid, overdue
        dueDate: "2025-08-15",
        penaltyAmount: 0
      },
      "102": {
        // ... similar structure
      }
    },
    commonArea: {
      // Reading only, no billing
      priorReading: 1730,
      currentReading: 1750,
      consumption: 20
    },
    buildingMeter: {
      // Reading only, no billing
      priorReading: 12985,
      currentReading: 13090,
      consumption: 105,
      calculated: true  // Sum of units + common
    }
  },
  summary: {
    totalUnits: 10,
    totalBilled: 250.60,
    totalPaid: 0,
    totalOutstanding: 250.60,
    unitsUnpaid: 10,
    unitsPaid: 0
  }
}
```

### 5. Payments (`/clients/{clientId}/projects/waterBills/payments/{transactionId}`)
Individual payment records linked to transaction ledger.
```javascript
{
  transactionId: "TXN-2025-08-001",  // Same as in Transactions collection
  paymentDate: "2025-08-10",
  unitId: "101",
  billReference: {
    year: 2025,
    month: 7,
    period: "July 2025"
  },
  amount: 25.06,
  method: "check",
  checkNumber: "1234",
  metadata: {
    processedBy: "userId",
    processedAt: "2025-08-10T14:00:00Z",
    notes: "Paid at office",
    ledgerPosted: true,
    ledgerPostDate: "2025-08-10T14:01:00Z"
  }
}
```

## API Endpoints

### Reading Management
```
POST   /api/clients/{clientId}/projects/waterBills/readings
GET    /api/clients/{clientId}/projects/waterBills/readings/{year}
GET    /api/clients/{clientId}/projects/waterBills/readings/{year}/{month}
PUT    /api/clients/{clientId}/projects/waterBills/readings/{year}/{month}
DELETE /api/clients/{clientId}/projects/waterBills/readings/{year}/{month}
```

### Bill Management
```
POST   /api/clients/{clientId}/projects/waterBills/bills/generate
GET    /api/clients/{clientId}/projects/waterBills/bills/{year}
GET    /api/clients/{clientId}/projects/waterBills/bills/{year}/{month}
PUT    /api/clients/{clientId}/projects/waterBills/bills/{year}/{month}/unit/{unitId}
POST   /api/clients/{clientId}/projects/waterBills/bills/apply-penalties
```

### Payment Processing
```
POST   /api/clients/{clientId}/projects/waterBills/payments
GET    /api/clients/{clientId}/projects/waterBills/payments
GET    /api/clients/{clientId}/projects/waterBills/payments/{paymentId}
DELETE /api/clients/{clientId}/projects/waterBills/payments/{paymentId}
```

### Dashboard & Analytics
```
GET    /api/clients/{clientId}/projects/waterBills/dashboard
GET    /api/clients/{clientId}/projects/waterBills/aging
GET    /api/clients/{clientId}/projects/waterBills/outstanding
```

### Configuration
```
GET    /api/clients/{clientId}/config/waterBilling
PUT    /api/clients/{clientId}/config/waterBilling
```

## Frontend Components

### 1. Water Bills Main View
- Tab navigation: Entry | Bills | Payments | History
- Fiscal year selector
- Dashboard summary card

### 2. Reading Entry Tab
```javascript
// Component features:
- Month/Year dropdown selectors (explicit control)
- Reading entry grid:
  * Unit column
  * Prior reading (auto-filled, read-only)
  * Current reading (input)
  * Consumption (auto-calculated)
  * Validation indicators
- Common area reading input
- Building meter (auto-calculated or manual)
- Save & Generate Bills button
- CSV import option
```

### 3. Bills Tab
```javascript
// Component features:
- Month selector
- Bills table:
  * Unit
  * Consumption
  * Amount
  * Status (chip: paid/unpaid/overdue)
  * Due Date
  * Actions (view/pay)
- Batch actions:
  * Generate bills
  * Apply penalties
  * Send reminders
- Summary totals
```

### 4. Payments Tab
```javascript
// Component features:
- Payment entry form:
  * Unit selector
  * Bill period selector
  * Amount
  * Payment method
  * Check number (if applicable)
  * Notes
- Recent payments list
- Quick pay for multiple units
```

### 5. History Tab
```javascript
// Component features:
- Year selector
- 12-month grid showing:
  * All units as columns
  * Months as rows
  * Current readings in cells
  * Color coding for payment status
- Export options (CSV, PDF)
```

## Dashboard Integration

### Dashboard Card Data
```javascript
{
  title: "Water Bills",
  currentPeriod: "July 2025",
  metrics: {
    outstanding: {
      count: 4,
      amount: 450.00,
      label: "Units Unpaid"
    },
    overdue: {
      count: 2,
      amount: 225.00,
      label: "Overdue"
    },
    collection: {
      rate: 60,
      label: "Collection Rate"
    }
  },
  actions: [
    { label: "Enter Readings", route: "/waterbills?tab=entry" },
    { label: "View Bills", route: "/waterbills?tab=bills" }
  ]
}
```

## Workflow

### Monthly Process
1. **Day 1: Reading Entry**
   - Enter meter readings
   - Validate against prior month
   - Save to readings collection

2. **Day 2: Bill Generation**
   - Generate bills from readings
   - Apply rate structure
   - Set due dates
   - Save to bills collection

3. **Days 3-15: Payment Collection**
   - Record payments as received
   - Update bill statuses
   - Track partial payments

4. **Day 16+: Overdue Management**
   - Apply penalties after grace period
   - Update status to overdue
   - Generate aging report

## Benefits of This Structure

1. **Organized Hierarchy**: All water-related data under projects/waterBills
2. **Consistent Pattern**: Follows same structure as other assessment projects
3. **Clean Root**: Doesn't clutter the client root with multiple collections
4. **Centralized Config**: Uses existing config collection for settings
5. **Simplified Pricing**: Flat rate only (no complex tiers)
6. **Clear Separation**: Readings, bills, and payments are separate but linked
7. **Scalable**: Easy to add more project types following same pattern

## Migration from Current Structure

### Current Structure
```
/clients/AVII/projects/waterBills/{year}/data
  └── months: [ {...}, {...}, ... ]
```

### Migration Steps
1. Create new collection structure
2. Parse existing months array
3. Create reading documents for each month with data
4. Generate bill documents from readings
5. Preserve payment history if exists
6. Update frontend to use new endpoints

## Security & Validation

### Access Control
- Admin: Full access to all operations
- Manager: Can enter readings, generate bills, record payments
- Viewer: Read-only access to bills and reports

### Data Validation
- Readings must be >= prior readings
- Consumption cannot be negative
- Payment amount cannot exceed bill amount
- Dates must be logical (due date > bill date)

## Future Enhancements
- Email notifications for bills and reminders
- Resident portal for viewing bills
- Payment gateway integration
- Mobile app for meter reading
- Automated penalty calculations
- Bulk payment import from bank files