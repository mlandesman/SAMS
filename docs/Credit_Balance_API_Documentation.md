# Credit Balance API Documentation

## Overview
Clean, domain-independent API for credit balance operations across all SAMS modules (Water Bills, HOA Dues, Special Billings, etc.).

**Base URL:** `http://localhost:5001/credit`  
**Authentication:** Required - Uses `authenticateUserWithProfile` middleware  
**Storage Location:** Currently points to HOA Dues collection (`clients/{clientId}/units/{unitId}/dues/{fiscalYear}`)

---

## Endpoints

### 1. GET Credit Balance

**Get current credit balance for a unit**

```http
GET /credit/:clientId/:unitId
```

#### Parameters
- `clientId` (path, required): Client identifier (e.g., "AVII", "MTC")
- `unitId` (path, required): Unit identifier (e.g., "101", "203")

#### Response (200 OK)
```json
{
  "clientId": "AVII",
  "unitId": "203",
  "creditBalance": 150.50,
  "creditBalanceDisplay": "$150.50 MXN",
  "lastUpdated": "2025-10-16T14:30:00.000Z"
}
```

#### Response Fields
- `creditBalance` (number): Balance in dollars (for calculations)
- `creditBalanceDisplay` (string): Formatted currency string (for display)
- `lastUpdated` (string): ISO timestamp of last update

#### Error Responses
- `400 Bad Request`: Missing clientId or unitId
- `401 Unauthorized`: Authentication required
- `500 Internal Server Error`: Database error

---

### 2. POST Update Credit Balance

**Update credit balance (add or subtract)**

```http
POST /credit/:clientId/:unitId
```

#### Parameters
- `clientId` (path, required): Client identifier
- `unitId` (path, required): Unit identifier

#### Request Body
```json
{
  "amount": 5000,
  "transactionId": "2025-10-16_1729090800000_abc123",
  "note": "Water Bills overpayment - Bill 2025-10",
  "source": "waterBills"
}
```

#### Request Body Fields
- `amount` (number, required): Amount in **centavos** (positive to add, negative to subtract)
- `transactionId` (string, required): Transaction identifier for audit trail
- `note` (string, required): Description of the change
- `source` (string, required): Source module (e.g., "waterBills", "hoaDues", "admin")

#### Response (200 OK)
```json
{
  "success": true,
  "clientId": "AVII",
  "unitId": "203",
  "previousBalance": 10000,
  "newBalance": 15000,
  "amountChange": 5000,
  "transactionId": "2025-10-16_1729090800000_abc123"
}
```

#### Validation Rules
- Amount must be a valid number
- Credit balance cannot go negative (throws error if insufficient balance)
- All required fields must be present

#### Error Responses
- `400 Bad Request`: 
  - Missing required parameters
  - Invalid amount format
  - Insufficient credit balance
- `401 Unauthorized`: Authentication required
- `500 Internal Server Error`: Database error

#### Audit Trail
All updates automatically logged to:
- **Module:** `credit`
- **Action:** `update_balance`
- **Notes:** Includes amount, new balance, source, and transaction ID

---

### 3. GET Credit History

**Get credit balance history with pagination**

```http
GET /credit/:clientId/:unitId/history?limit=50
```

#### Parameters
- `clientId` (path, required): Client identifier
- `unitId` (path, required): Unit identifier
- `limit` (query, optional): Maximum entries to return (default: 50, max: 500)

#### Response (200 OK)
```json
{
  "clientId": "AVII",
  "unitId": "203",
  "currentBalance": 150.50,
  "history": [
    {
      "id": "credit_1729090800000_abc123",
      "date": "2025-10-16T14:30:00.000Z",
      "amount": 50.00,
      "balance": 150.50,
      "transactionId": "2025-10-16_1729090800000_xyz",
      "note": "Water Bills overpayment",
      "source": "waterBills"
    }
  ]
}
```

#### Response Fields
- `currentBalance` (number): Current balance in dollars
- `history` (array): Sorted by most recent first
  - `amount` (number): Amount in dollars (positive = added, negative = used)
  - `balance` (number): Balance after this entry in dollars

---

### 4. POST Add Credit History Entry

**Add historical or correction entry (backdated)**

```http
POST /credit/:clientId/:unitId/history
```

#### Parameters
- `clientId` (path, required): Client identifier
- `unitId` (path, required): Unit identifier

#### Request Body
```json
{
  "amount": 10000,
  "date": "2025-10-01T10:00:00.000Z",
  "transactionId": "historical_correction_123",
  "note": "Historical correction for September",
  "source": "admin"
}
```

#### Request Body Fields
- `amount` (number, required): Amount in **centavos**
- `date` (string, required): ISO date string for the entry
- `transactionId` (string, required): Transaction identifier
- `note` (string, required): Description
- `source` (string, required): Source module

#### Response (200 OK)
```json
{
  "success": true,
  "entryAdded": true,
  "newBalance": 25000
}
```

#### Use Cases
- Historical corrections
- Migration of legacy data
- Manual adjustments with specific dates

---

## Integration Guide for Task 3 (Delete Reversal)

### Scenario: Reversing Water Bills Payment

When deleting a water bills transaction that affected credit balance:

#### Step 1: Get Current Credit Balance
```javascript
const response = await fetch(`http://localhost:5001/credit/${clientId}/${unitId}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const { creditBalance } = await response.json();
```

#### Step 2: Calculate Reversal Amount
```javascript
// If transaction added 50.00 to credit (overpayment)
const reversalAmount = -5000; // Negative to subtract (in centavos)

// If transaction used 30.00 from credit
const reversalAmount = 3000; // Positive to restore (in centavos)
```

#### Step 3: Update Credit Balance
```javascript
const updateResponse = await fetch(`http://localhost:5001/credit/${clientId}/${unitId}`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: reversalAmount,
    transactionId: `${txnId}_reversal`,
    note: `Transaction deletion reversal - Original transaction: ${txnId}`,
    source: 'waterBills'
  })
});

const result = await updateResponse.json();
console.log(`Credit balance updated: ${result.previousBalance} → ${result.newBalance}`);
```

---

## Important Notes

### Currency Handling
- **API Input (POST):** All amounts in **centavos** (integer)
- **API Output (GET):** Balance returned in **dollars** (decimal) AND formatted display string
- **Conversion:** 100 centavos = 1 peso/dollar

### Fiscal Year
- Automatically calculated using current date and fiscal start month (July for AVII)
- Credit balance stored in current fiscal year document

### Validation
- ✅ Comprehensive input validation on all endpoints
- ✅ Prevents negative credit balances
- ✅ Requires authentication for all operations

### Audit Trail
- ✅ All credit balance changes logged to audit system
- ✅ Includes transaction ID, source module, and detailed notes
- ✅ History maintained in `creditBalanceHistory` array

### Error Handling
- All errors return proper HTTP status codes
- Detailed error messages for debugging
- Stack traces included in non-production environments

---

## Example: Full Delete Reversal Flow

```javascript
async function reverseWaterPaymentCreditChanges(clientId, unitId, txnId) {
  try {
    // 1. Get current state
    const balanceResponse = await fetch(
      `http://localhost:5001/credit/${clientId}/${unitId}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const { creditBalance } = await balanceResponse.json();
    
    // 2. Get history to find this transaction's entries
    const historyResponse = await fetch(
      `http://localhost:5001/credit/${clientId}/${unitId}/history?limit=100`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const { history } = await historyResponse.json();
    
    // 3. Find entries for this transaction
    const transactionEntries = history.filter(entry => 
      entry.transactionId === txnId
    );
    
    // 4. Calculate reversal amount
    let reversalAmount = 0;
    for (const entry of transactionEntries) {
      // Reverse the effect: if credit was added, subtract it; if used, restore it
      reversalAmount -= entry.amount * 100; // Convert to centavos
    }
    
    if (reversalAmount === 0) {
      console.log('No credit changes to reverse');
      return;
    }
    
    // 5. Apply reversal
    const updateResponse = await fetch(
      `http://localhost:5001/credit/${clientId}/${unitId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: reversalAmount,
          transactionId: `${txnId}_reversal`,
          note: `Reversal of credit changes from deleted transaction ${txnId}`,
          source: 'waterBills'
        })
      }
    );
    
    const result = await updateResponse.json();
    console.log(`✅ Credit reversal complete:`, result);
    
  } catch (error) {
    console.error('❌ Error reversing credit changes:', error);
    throw error;
  }
}
```

---

## Testing

### Test with curl
```bash
# Get credit balance
curl -X GET "http://localhost:5001/credit/AVII/203" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Update credit balance
curl -X POST "http://localhost:5001/credit/AVII/203" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "transactionId": "test_transaction_123",
    "note": "Test credit addition",
    "source": "waterBills"
  }'

# Get history
curl -X GET "http://localhost:5001/credit/AVII/203/history?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Harness
Use existing test harness at `/backend/testing/testHarness.js` with live authentication tokens.

---

## Future Migration

When credit balance storage is migrated to a new location:
- ✅ API endpoints remain unchanged
- ✅ Only internal service implementation updates
- ✅ No client code changes required
- ✅ Maintains backward compatibility

---

**Last Updated:** October 16, 2025  
**API Version:** 1.0  
**Contact:** Implementation Agent - Credit API

