# Water Bills System Architecture

## Overview
The Water Bills system manages water meter readings, billing, payments, and notifications for property management. It provides a complete workflow from meter reading entry to payment tracking and overdue management.

## Data Model

### 1. Water Meters (`/clients/{clientId}/waterMeters`)
Stores meter configuration for each unit.
```javascript
{
  unitId: "101",
  meterNumber: "WM-101-2025",
  installDate: "2020-01-15",
  lastReadingDate: "2025-08-01",
  lastReading: 1785,
  active: true,
  notes: "Second floor unit"
}
```

### 2. Water Readings (`/clients/{clientId}/waterReadings/{year}/{month}`)
Raw meter readings taken on specific dates.
```javascript
{
  readingDate: "2025-08-01",
  readingMonth: 7,  // Month being billed (July)
  readingYear: 2025,
  fiscalYear: 2026,
  fiscalMonth: 0,
  readings: {
    "101": { current: 1785, prior: 1774, consumption: 11 },
    "102": { current: 35, prior: 30, consumption: 5 },
    // ... more units
    "commonArea": { current: 1750, prior: 1730, consumption: 20 },
    "buildingMeter": { current: 13090, prior: 12985, consumption: 105 }
  },
  enteredBy: "userId",
  enteredAt: "2025-08-01T10:30:00Z"
}
```

### 3. Water Bills (`/clients/{clientId}/waterBills/{year}/{month}`)
Generated bills with calculated amounts.
```javascript
{
  billDate: "2025-08-01",
  dueDate: "2025-08-15",
  billingPeriod: "July 2025",
  fiscalYear: 2026,
  fiscalMonth: 0,
  bills: {
    "101": {
      unitId: "101",
      priorReading: 1774,
      currentReading: 1785,
      consumption: 11,
      rate: 5.50,  // $ per 1000 gallons
      baseCharge: 25.00,
      usageCharge: 0.06,  // 11 gal * $5.50/1000
      totalAmount: 25.06,
      status: "unpaid",  // unpaid, paid, overdue
      paidAmount: 0,
      paidDate: null,
      overdueDate: "2025-08-16",
      penaltyAmount: 0,
      notes: null
    },
    // ... more units
  },
  totals: {
    totalBilled: 1250.00,
    totalPaid: 800.00,
    totalOverdue: 450.00,
    unitsCount: 10,
    paidCount: 6,
    overdueCount: 4
  }
}
```

### 4. Water Payments (`/clients/{clientId}/waterPayments`)
Payment records linked to bills.
```javascript
{
  paymentId: "PAY-2025-08-101",
  paymentDate: "2025-08-10",
  unitId: "101",
  billReference: "2025/07",  // Year/Month of bill
  amount: 25.06,
  method: "check",
  checkNumber: "1234",
  notes: "Paid at office",
  processedBy: "userId",
  processedAt: "2025-08-10T14:00:00Z"
}
```

### 5. Water Configuration (`/clients/{clientId}/config/waterBilling`)
Billing rates and settings.
```javascript
{
  rateStructure: {
    baseCharge: 25.00,  // Monthly base charge
    usageRate: 5.50,    // $ per 1000 gallons
    tiers: [            // Optional tiered pricing
      { min: 0, max: 5000, rate: 5.50 },
      { min: 5001, max: 10000, rate: 6.50 },
      { min: 10001, max: null, rate: 7.50 }
    ]
  },
  penalties: {
    lateFeeAmount: 25.00,      // Fixed late fee
    lateFeePercent: 0,         // Or percentage
    gracePeriodDays: 15,       // Days after due date
    compoundPenalties: false   // Apply penalties on penalties
  },
  notifications: {
    sendBillNotification: true,
    billNotificationDays: 0,    // Days after bill generation
    sendReminder: true,
    reminderDays: [7, 14],      // Days before due date
    sendOverdueNotice: true,
    overdueNoticeDays: [1, 7, 14, 30]  // Days after due date
  },
  fiscalYearStartMonth: 7  // July = 7
}
```

## API Endpoints

### Reading Management
- `POST /api/clients/{clientId}/water/readings` - Submit new readings
- `GET /api/clients/{clientId}/water/readings/{year}/{month}` - Get readings for period
- `PUT /api/clients/{clientId}/water/readings/{year}/{month}` - Update readings
- `DELETE /api/clients/{clientId}/water/readings/{year}/{month}` - Delete readings

### Bill Generation and Management
- `POST /api/clients/{clientId}/water/bills/generate` - Generate bills from readings
- `GET /api/clients/{clientId}/water/bills` - List all bills (with filters)
- `GET /api/clients/{clientId}/water/bills/{year}/{month}` - Get specific month's bills
- `PUT /api/clients/{clientId}/water/bills/{year}/{month}/{unitId}` - Update bill (admin)
- `POST /api/clients/{clientId}/water/bills/calculate-penalties` - Calculate overdue penalties

### Payment Processing
- `POST /api/clients/{clientId}/water/payments` - Record payment
- `GET /api/clients/{clientId}/water/payments` - List payments (with filters)
- `GET /api/clients/{clientId}/water/payments/{paymentId}` - Get payment details
- `DELETE /api/clients/{clientId}/water/payments/{paymentId}` - Void payment (admin)

### Dashboard and Reports
- `GET /api/clients/{clientId}/water/dashboard` - Dashboard summary
- `GET /api/clients/{clientId}/water/reports/aging` - Aging report
- `GET /api/clients/{clientId}/water/reports/consumption` - Consumption trends
- `GET /api/clients/{clientId}/water/export` - Export data (CSV/PDF)

### Configuration
- `GET /api/clients/{clientId}/water/config` - Get billing configuration
- `PUT /api/clients/{clientId}/water/config` - Update configuration (admin)

## Frontend Components

### 1. Reading Entry Component
- Month/Year selector (explicit control)
- Grid for entering readings per unit
- CSV import option
- Validation against prior readings
- Auto-calculation of consumption

### 2. Bill Management Component
- Generate bills from readings
- View/Edit bills
- Batch operations
- Send notifications

### 3. Payment Recording Component
- Record individual or batch payments
- Multiple payment methods
- Payment history per unit
- Receipt generation

### 4. Dashboard Widget
```javascript
{
  currentMonth: "August 2025",
  statistics: {
    totalUnits: 10,
    billsSent: 10,
    billsPaid: 6,
    billsOverdue: 4,
    totalBilled: 1250.00,
    totalCollected: 800.00,
    totalOutstanding: 450.00,
    oldestOverdue: "May 2025",
    averageConsumption: 850  // gallons
  },
  trends: {
    collectionRate: 64,  // percentage
    overdueRate: 40,     // percentage
    avgDaysToPayment: 12
  }
}
```

### 5. Reports Component
- Aging report (30/60/90 days)
- Consumption trends
- Payment history
- Unit comparison

## Workflow

### Monthly Billing Cycle
1. **Reading Entry** (1st of month)
   - Enter current meter readings
   - System calculates consumption
   - Validates against historical data

2. **Bill Generation** (2nd of month)
   - Generate bills from readings
   - Apply rate structure
   - Calculate due dates
   - Send notifications

3. **Payment Collection** (Throughout month)
   - Record payments as received
   - Update bill status
   - Generate receipts

4. **Overdue Processing** (16th of month)
   - Mark overdue bills
   - Calculate penalties
   - Send overdue notices

5. **Month-End Reporting**
   - Generate collection report
   - Update dashboard metrics
   - Prepare aging report

## Migration Strategy

### Phase 1: Backend Setup
1. Create new services and models
2. Implement core API endpoints
3. Set up billing calculation engine

### Phase 2: Data Migration
1. Map existing data to new structure
2. Migrate historical readings
3. Generate bills for current period

### Phase 3: Frontend Implementation
1. Build reading entry component
2. Create bill management views
3. Implement payment recording

### Phase 4: Dashboard Integration
1. Create dashboard API
2. Build dashboard widget
3. Add to main dashboard

### Phase 5: Advanced Features
1. Automated notifications
2. Penalty calculations
3. Report generation
4. CSV/PDF exports

## Security Considerations
- Role-based access (Admin, Manager, Viewer)
- Audit trail for all financial transactions
- Data validation at multiple levels
- Secure payment information handling

## Performance Optimization
- Indexed queries on common filters
- Cached dashboard statistics
- Batch processing for large operations
- Pagination for list views

## Future Enhancements
- Mobile app for meter reading
- QR code scanning for meters
- Automated meter reading (AMR) integration
- Payment gateway integration
- Customer portal for residents