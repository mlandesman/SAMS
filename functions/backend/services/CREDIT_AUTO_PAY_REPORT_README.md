# Credit Auto-Pay Report Email System
**TASK-90 Phase 2** - HTML Email & Nightly Scheduling

## Overview
Automated email reporting system that notifies property managers about units with credit balances that could be used to auto-pay outstanding bills.

## Architecture

### Data Flow
```
Nightly Scheduler (3 AM Cancun)
    ↓
runScheduledCreditAutoPayReports()
    ↓
For each client (MTC, AVII):
    ↓
    generateCreditAutoPayReportData(clientId)
        ↓
        - Query units with credit > 0
        - Call UPS preview for each unit
        - Collect bill payment data
        ↓
    generateCreditAutoPayEmailHTML(reportData)
        ↓
        - Format as HTML table
        - Include summary statistics
        ↓
    Send email to managementCompany.email
        ↓
    Log to Firestore
```

### Components

#### 1. Report Service (`creditAutoPayReportService.js`)
- **`generateCreditAutoPayReportData(clientId)`**
  - Queries all units for a client
  - Gets credit balance via `getCreditBalance()`
  - Calls `unifiedPaymentWrapper.previewUnifiedPayment()` for each unit
  - Returns structured report data

- **`generateCreditAutoPayEmailHTML(report)`**
  - Converts report data to HTML email
  - Professional table layout with styling
  - Color-coded payment types (FULL vs PARTIAL)
  - Summary section with totals

- **`getCreditAutoPayEmailRecipients(clientId)`**
  - Retrieves `managementCompany.email` from client document
  - Dev override: Uses `michael@landesman.com` for testing

#### 2. Controller (`creditAutoPayReportController.js`)
- **`sendCreditAutoPayReport(clientId, isDryRun)`**
  - Generates and sends report for one client
  - Supports dry run mode (no email sent)
  - Logs to Firestore: `system/creditAutoPayReports/sent/{docId}`

- **`sendAllCreditAutoPayReports(isDryRun)`**
  - Sends reports for all clients (MTC, AVII)
  - Returns summary statistics

- **`runScheduledCreditAutoPayReports()`**
  - Called by nightly scheduler
  - Logs to Firestore: `system/creditAutoPayReports/scheduled/{YYYY-MM-DD}`

- **`handleManualTrigger(req, res)`**
  - Express route handler for manual testing

#### 3. Routes (`creditAutoPayReportRoutes.js`)
Manual trigger endpoints:
- `GET /reports/credit-auto-pay/send` - All clients
- `GET /reports/credit-auto-pay/send?client=MTC` - Specific client
- `GET /reports/credit-auto-pay/send?dryRun=true` - Dry run mode

#### 4. Scheduler Integration (`nightlyScheduler.js`)
- Runs at 3:00 AM Cancun time daily
- Integrated as TASK 4 in nightly scheduler
- Sends separate emails for MTC and AVII

## Email Format

### Header
- Title: "Credit Auto-Pay Report"
- Date: Current date in "Month D, YYYY" format
- Summary: Number of units and total amount

### Client Sections
For each client (MTC, AVII):
- Client name header
- Table with columns:
  - **Unit**: Unit ID
  - **Credit**: Current credit balance
  - **Would Pay**: Amount that would be paid
  - **Type**: FULL or ⚠️ PARTIAL
  - **HOA Bills**: Count and total amount
  - **Water Bills**: Count and total amount
  - **Penalties**: Total penalty amount

### Summary Section
- Total Units
- Full Payments count
- Partial Payments count
- Total Credit Available
- Total Would Be Paid
- Total Penalties
- HOA Bills count
- Water Bills count

### Notes Section
- Explanation of PARTIAL payments
- Priority ordering explanation
- Reminder that this is preview only

## Testing

### Local Testing (Dry Run)
```bash
# Test all clients (dry run)
node functions/backend/testing/testCreditAutoPayEmail.js

# Test specific client (dry run)
node functions/backend/testing/testCreditAutoPayEmail.js MTC
node functions/backend/testing/testCreditAutoPayEmail.js AVII
```

### Local Testing (Actual Email)
The test script automatically loads Gmail credentials from `/backend/.env` file:
```bash
# No environment variables needed - loads from /backend/.env automatically
node functions/backend/testing/testCreditAutoPayEmail.js MTC send
node functions/backend/testing/testCreditAutoPayEmail.js AVII send
```

**Note**: Gmail credentials are stored in `/backend/.env`:
```
GMAIL_USER=michael@sandyland.com.mx
GMAIL_APP_PASSWORD=ikaixkskbmuqiusz
```

### API Testing
```bash
# Dry run via API
curl "http://localhost:5001/reports/credit-auto-pay/send?dryRun=true"

# Specific client
curl "http://localhost:5001/reports/credit-auto-pay/send?client=MTC&dryRun=true"

# Actually send (requires Gmail password)
curl "http://localhost:5001/reports/credit-auto-pay/send?client=MTC"
```

### Production Testing
Once deployed, the nightly scheduler will run automatically at 3 AM Cancun time.

To manually trigger in production:
```bash
# Via Firebase Console: Functions → nightlyScheduler → Test Function
# Or via API (if exposed)
```

## Configuration

### Email Recipients
- **Production**: Uses `clients/{clientId}/managementCompany.email`
- **Development**: Hardcoded to `michael@landesman.com` (see line 239 in service)

To enable production emails:
1. Open `creditAutoPayReportService.js`
2. Find `getCreditAutoPayEmailRecipients()` function
3. Uncomment line 237: `recipients.push(managementEmail);`
4. Comment out line 238: `recipients.push('michael@landesman.com');`

### Gmail Credentials
- **Local**: Loaded automatically from `/backend/.env` file by test script
  - File location: `/Users/michael/Projects/SAMS/backend/.env`
  - Contains: `GMAIL_USER` and `GMAIL_APP_PASSWORD`
- **Production**: Configured in Firebase Functions secrets
  ```bash
  firebase functions:secrets:set GMAIL_APP_PASSWORD
  ```

## Data Sources

### Credit Balances
- Uses `CreditBalanceService.getCreditBalance(clientId, unitId)`
- Returns balance in pesos (not centavos)

### Bill Previews
- Uses `unifiedPaymentWrapper.previewUnifiedPayment(clientId, unitId, amount, date)`
- Returns structured preview with HOA and Water bills
- Includes penalty calculations
- Respects payment priority ordering

## Firestore Logging

### Manual/API Triggers
Collection: `system/creditAutoPayReports/sent`
```javascript
{
  clientId: 'MTC',
  timestamp: '2026-01-03T...',
  recipients: ['michael@landesman.com'],
  unitCount: 6,
  totalWouldPay: 17580.00,
  totalPenalties: 0,
  messageId: '<...@gmail.com>',
  triggeredBy: 'manual'
}
```

### Scheduled Runs
Collection: `system/creditAutoPayReports/scheduled`
Document ID: `YYYY-MM-DD`
```javascript
{
  timestamp: '2026-01-03T03:00:00...',
  clients: {
    MTC: { success: true, unitCount: 6, ... },
    AVII: { success: true, unitCount: 9, ... }
  },
  summary: {
    total: 2,
    sent: 2,
    skipped: 0,
    failed: 0
  },
  triggeredBy: 'scheduled'
}
```

## Current Test Results

### MTC
- **Units**: 6 (1A, 2A, 3A, 4A, 5A, PH4D)
- **Total Credit**: $38,961.09
- **Would Pay**: $17,580.00
- **Bills**: Mostly HOA, no penalties

### AVII
- **Units**: 9 (102, 103, 105, 106, 201, 202, 203, 204, 301)
- **Total Credit**: $39,119.04
- **Would Pay**: $39,119.04
- **Bills**: Mix of HOA and Water, some with penalties

## Future Enhancements (Phase 3)

### 5-Day Advance Notice Filter
Currently reports ALL units with payable bills. Future enhancement will filter to only bills due within 5 days:

```javascript
const NOTICE_DAYS = 5;
const noticeDate = new Date();
noticeDate.setDate(noticeDate.getDate() + NOTICE_DAYS);

const imminentBills = preview.bills.filter(b => 
  new Date(b.dueDate) <= noticeDate
);
```

This will change the report purpose from "all payable bills" to "5-day advance notice" for homeowners.

### Actual Payment Recording
Phase 3 will add the ability to actually record payments (not just preview).

## Troubleshooting

### No Email Sent
1. Check `GMAIL_APP_PASSWORD` is set (local) or configured (production)
2. Verify recipients are configured in client document
3. Check Firestore logs for error details

### Wrong Recipients
- Development override is active (line 238 in service)
- Update `getCreditAutoPayEmailRecipients()` to use production emails

### Empty Reports
- No units have credit > 0
- Units have credit but no payable bills
- Check UPS preview logic for issues

### Missing Bills
- UPS priority logic may be filtering bills
- Check grace period calculations
- Verify bill due dates

## Files Created/Modified

### Created
- `functions/backend/services/creditAutoPayReportService.js` (379 lines)
- `functions/backend/controllers/creditAutoPayReportController.js` (238 lines)
- `functions/backend/routes/creditAutoPayReportRoutes.js` (25 lines)
- `functions/backend/testing/testCreditAutoPayEmail.js` (50 lines)
- `functions/backend/services/CREDIT_AUTO_PAY_REPORT_README.md` (this file)

### Modified
- `functions/backend/routes/reports.js` (added import and route mounting)
- `functions/scheduled/nightlyScheduler.js` (integrated credit auto-pay report task)

## Dependencies
- `nodemailer` - Email sending
- `luxon` - Date formatting
- `unifiedPaymentWrapper` - Bill preview logic
- `CreditBalanceService` - Credit balance retrieval
- `DateService` - Timezone handling
- `firebase-admin` - Firestore access
