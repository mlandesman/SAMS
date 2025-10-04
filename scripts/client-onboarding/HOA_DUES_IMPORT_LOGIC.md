# HOA Dues Import Logic Documentation

## Overview
This document details the complex logic used in the HOA dues import process, including payment-to-transaction linking, sequence number extraction, credit balance updates, and cross-reference generation.

## HOA Dues Data Structure

### Source Data Format (HOADues.json)
```json
{
  "1A": {
    "scheduledAmount": 17400,
    "totalPaid": 15000,
    "outstanding": 2400,
    "creditBalance": 0,
    "payments": [
      {
        "month": 12,
        "paid": 15000,
        "notes": "Posted: MXN 15,000.00 on Sat Dec 28 2024 13:56:51 GMT-0500 (hora estándar central)↵CASH; December 2024→Seq: 25010"
      }
    ]
  },
  "PH4D": {
    "scheduledAmount": 17400,
    "totalPaid": 34800,
    "outstanding": -17400,
    "creditBalance": 17400,
    "payments": [...]
  }
}
```

### Target Firestore Structure
```
/clients/{clientId}/units/{unitId}/dues/{year}
{
  year: "2025",                    // String format
  scheduledAmount: 1740000,        // Cents (17400 * 100)
  creditBalance: 0,                // Cents
  payments: [                      // 12-element array (one per month)
    {
      paid: 0,
      date: null,
      transactionId: null,
      paymentMethod: null
    },
    // ... months 1-11
    {
      paid: 1500000,              // December payment in cents
      date: Timestamp,
      transactionId: "2024-12-28_185651_999",
      paymentMethod: "CASH"
    }
  ],
  creditBalanceHistory: [],
  updated: Timestamp
}
```

## Payment to Transaction Linking Mechanism

### 1. Transaction Lookup Map Creation
```javascript
// Lines 30-46: createTransactionLookup()
function createTransactionLookup() {
    const lookup = new Map();
    
    transactionsData.forEach((transaction, index) => {
        const sequenceNumber = transaction[""] || transaction.sequence;
        if (sequenceNumber) {
            lookup.set(sequenceNumber, {
                ...transaction,
                originalIndex: index
            });
        }
    });
    
    return lookup;
}
```

### 2. Linking Process
The linking happens during payment array construction:

```javascript
// Lines 159-220: Payment array processing
payments: Array(12).fill(null).map((_, monthIndex) => {
    const month = monthIndex + 1;
    const monthPayment = payments.find(p => p.month === month);
    
    if (!monthPayment || monthPayment.paid <= 0) {
        return {
            paid: 0,
            date: null,
            transactionId: null,
            paymentMethod: null
        };
    }
    
    // Parse notes to extract sequence number
    const parsedNotes = parsePaymentNotes(monthPayment.notes);
    
    if (parsedNotes.sequenceNumber) {
        const linkedTransaction = transactionLookup.get(parsedNotes.sequenceNumber);
        
        if (linkedTransaction) {
            // Generate the actual transaction ID
            transactionId = generateTransactionDocId(linkedTransaction);
            paymentDate = toFirestoreTimestamp(linkedTransaction.Date);
            paymentMethod = linkedTransaction.Account;
            linkedPayments++;
        }
    }
})
```

## Sequence Number Extraction from Notes

### Notes Format Analysis
The notes field contains structured payment information:
```
"Posted: MXN 17,400.00 on Fri Dec 27 2024 16:27:51 GMT-0500 (hora estándar central)
BANCO AZTECA; December 2024→Seq: 25009"
```

### Parsing Logic
```javascript
// Lines 51-100: parsePaymentNotes function
function parsePaymentNotes(notes) {
    if (!notes) {
        return { 
            paymentDate: null, 
            sequenceNumber: null, 
            originalAmount: null,
            paymentMethod: null
        };
    }
    
    const result = {
        paymentDate: null,
        sequenceNumber: null,
        originalAmount: null,
        paymentMethod: null
    };
    
    try {
        // Extract payment date
        const dateMatch = notes.match(/on\s+(.+?)\s+GMT/);
        if (dateMatch) {
            result.paymentDate = new Date(dateMatch[1]);
        }
        
        // Extract sequence number - CRITICAL for linking
        const seqMatch = notes.match(/Seq:\s*(\d+)/);
        if (seqMatch) {
            result.sequenceNumber = parseInt(seqMatch[1]);
        }
        
        // Extract original amount
        const amountMatch = notes.match(/MXN\s+([\d,]+\.?\d*)/);
        if (amountMatch) {
            result.originalAmount = parseFloat(amountMatch[1].replace(/,/g, ''));
        }
        
        // Extract payment method from second line
        const lines = notes.split('\n');
        if (lines.length > 1) {
            const methodMatch = lines[1].match(/;\s*(.+?)(?:\s*→|$)/);
            if (methodMatch) {
                result.paymentMethod = methodMatch[1].trim();
            }
        }
    } catch (error) {
        console.warn(`⚠️ Error parsing notes:`, error.message);
    }
    
    return result;
}
```

### Key Extraction Patterns
1. **Sequence Number:** `Seq:\s*(\d+)` - Extracts numeric sequence ID
2. **Payment Date:** `on\s+(.+?)\s+GMT` - Extracts date string
3. **Amount:** `MXN\s+([\d,]+\.?\d*)` - Extracts Mexican peso amount
4. **Payment Method:** Second line before semicolon or arrow

## Credit Balance Update Logic

### Credit Balance Tracking
```javascript
// Line 156: Extract credit balance from source data
creditBalance: Math.round((creditBalance || 0) * 100), // Convert to cents
```

### Credit Balance Calculation
The import script preserves the credit balance from the source data but also:
1. Validates it's a number (defaults to 0)
2. Converts from dollars to cents (*100)
3. Stores in the `creditBalance` field

### Credit Balance History
```javascript
// Line 223: Initialize empty history
creditBalanceHistory: [],
```

The history array is initialized empty during import but can track:
- Date of credit balance changes
- Amount changed
- Reason for change
- User who made the change

## Monthly Payment Tracking

### Payment Array Structure
The system uses a 12-element array where index corresponds to month:
- Index 0 = January
- Index 11 = December

### Payment Data Model
Each payment entry contains:
```javascript
{
    paid: 1740000,              // Amount in cents
    date: Timestamp,            // When payment was made
    transactionId: "2024-...",  // Link to transaction
    paymentMethod: "CASH"       // How it was paid
}
```

### Unpaid Months
Unpaid months are represented as:
```javascript
{
    paid: 0,
    date: null,
    transactionId: null,
    paymentMethod: null
}
```

## Cross-Reference Generation

### HOA_Transaction_CrossRef.json Structure
```json
{
  "generated": "2025-08-06T20:05:37.965Z",
  "totalRecords": 137,
  "bySequence": {
    "25009": {
      "transactionId": "2024-12-27_150330_009",
      "unitId": "PH4D",
      "amount": 17400,
      "date": "2024-12-27T21:27:51.922Z"
    }
  }
}
```

### Cross-Reference Creation Process

1. **During Transaction Import:**
   ```javascript
   // Track HOA dues transactions
   if (txnData.Category === 'HOA Dues') {
       results.hoaDuesTransactions.push({
           transactionId,
           unitId: augmentedTxn.unitId,
           amount: txnData.Amount,
           date: txnData.Date,
           googleId: txnData[''] || `seq_${index + 1}`
       });
   }
   ```

2. **Cross-Reference File Generation:**
   - Maps sequence numbers to transaction IDs
   - Includes unit ID for validation
   - Preserves amount and date for verification

3. **Usage in HOA Import:**
   - Loads cross-reference file
   - Creates Map for O(1) lookup
   - Links payments to transactions by sequence

## Transaction ID Generation for HOA

### Temporary ID Generation (Import Script)
```javascript
// Lines 106-114: generateTransactionDocId
function generateTransactionDocId(transaction) {
    const date = new Date(transaction.Date);
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const categoryId = transaction.Category.toLowerCase()
                        .replace(/\s+/g, '')
                        .substring(0, 10);
    const sequence = transaction[""] || transaction.originalIndex;
    
    return `${dateStr}-${categoryId}-${sequence}`;
}
```

**Format:** `YYYYMMDD-categoryid-sequence`
**Example:** `20241227-hoadues-25009`

**Note:** This is NOT the final transaction ID format used in production.

## Import Workflow

### Complete Import Process

1. **Initialize Firebase Connection**
   ```javascript
   const { db } = await initializeFirebase(ENV);
   ```

2. **Load Source Data**
   - HOADues.json - Payment records by unit
   - Transactions.json - For linking via sequence numbers

3. **Create Transaction Lookup Map**
   - Index all transactions by sequence number
   - Enable O(1) lookup during linking

4. **Process Each Unit**
   ```javascript
   for (const [unitId, unitData] of Object.entries(hoaDuesData)) {
       // Process unit payments
   }
   ```

5. **For Each Payment**
   - Parse notes to extract sequence number
   - Look up corresponding transaction
   - Link transaction ID if found
   - Track success/failure rates

6. **Data Transformation**
   - Convert amounts to cents (*100)
   - Create 12-element payment array
   - Preserve credit balances
   - Add timestamps

7. **Validation**
   ```javascript
   const validatedData = validateCollectionData(cleanedData, 'hoaDues');
   ```

8. **Store in Firestore**
   ```javascript
   const duesRef = db.collection('clients')
                     .doc(clientId)
                     .collection('units')
                     .doc(unitId)
                     .collection('dues')
                     .doc(year);
   await duesRef.set(validatedData);
   ```

## Error Handling

### Common Issues and Solutions

1. **Missing Sequence Numbers**
   - Fallback: Use payment date from notes
   - Log as unlinked payment
   - Continue processing

2. **Transaction Not Found**
   ```javascript
   if (linkedTransaction) {
       // Success path
   } else {
       console.warn(`⚠️ Month ${month}: Transaction ${parsedNotes.sequenceNumber} not found`);
       unlinkedPayments++;
   }
   ```

3. **Invalid Date Parsing**
   - Fallback: Use current timestamp
   - Log warning
   - Continue import

4. **Validation Failures**
   - Detailed error messages
   - Stop processing for that unit
   - Continue with next unit

## Performance Metrics

### Import Statistics Tracked
```javascript
console.log(`\n📊 Import Summary:`);
console.log(`   Units processed: ${importCount}`);
console.log(`   Payments linked to transactions: ${linkedPayments}`);
console.log(`   Payments without transaction links: ${unlinkedPayments}`);
console.log(`   Total payments processed: ${linkedPayments + unlinkedPayments}`);
console.log(`   Link success rate: ${((linkedPayments/(linkedPayments + unlinkedPayments))*100).toFixed(1)}%`);
```

### Key Metrics
1. **Link Success Rate:** Percentage of payments successfully linked to transactions
2. **Units Processed:** Total units with HOA dues data
3. **Payment Coverage:** Months with payments vs. total months

## Data Integrity Requirements

### Validation Rules
1. **Year Field:** Must be string format (e.g., "2025")
2. **Amounts:** Must be integers (cents)
3. **Payment Array:** Must have exactly 12 elements
4. **Dates:** Must be valid Firestore Timestamps

### Consistency Checks
1. **Transaction Links:** Verify transaction exists before linking
2. **Unit Validation:** Ensure unit exists in units collection
3. **Amount Matching:** Verify payment amount matches transaction amount

### Audit Trail
- All imports logged with timestamp
- Success/failure counts recorded
- Link statistics preserved

## Best Practices

### Import Preparation
1. Run transaction import first
2. Verify cross-reference file generated
3. Check sequence numbers in source data
4. Validate credit balances

### During Import
1. Use debug mode for detailed logging
2. Monitor link success rate
3. Review unlinked payments
4. Verify data transformations

### Post-Import Verification
1. Spot-check linked payments
2. Verify credit balances
3. Test payment queries
4. Validate monthly totals

## Future Improvements

### Suggested Enhancements
1. **Batch Processing:** Process multiple units in parallel
2. **Better Error Recovery:** Resume failed imports
3. **Validation Reports:** Generate detailed validation summaries
4. **Automatic Retries:** Retry failed transaction lookups

### Data Quality Improvements
1. **Sequence Number Validation:** Ensure uniqueness
2. **Amount Reconciliation:** Verify totals match
3. **Date Consistency:** Validate payment dates
4. **Credit Balance Audit:** Track all changes