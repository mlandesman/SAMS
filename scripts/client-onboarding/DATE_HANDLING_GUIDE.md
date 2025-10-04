# DateService Integration Guide for Import Scripts

**Created:** September 29, 2025  
**Purpose:** Prevent timezone-related date sliding in import operations

---

## Overview

All enhanced import scripts now use DateService to ensure consistent timezone handling. This prevents the common issue where dates "slide" due to UTC conversion, which is especially critical for:

- Transaction ID generation
- HOA payment date tracking
- Fiscal year calculations
- Audit timestamps

---

## Key Principles

### 1. Never Use Raw JavaScript Dates
```javascript
// ❌ NEVER DO THIS
const date = new Date(dateString);
const now = new Date();

// ✅ ALWAYS DO THIS
import { dateService } from './import-config.js';
const date = dateService.parseFromFrontend(dateString, 'M/d/yyyy');
const now = dateService.getNow();
```

### 2. Always Specify Date Format
```javascript
// Common formats in import data
const DATE_FORMATS = {
  transaction: 'M/d/yyyy',      // "1/15/2025"
  yearEnd: 'yyyy-MM-dd',        // "2025-01-15"
  hoaPayment: 'EEE MMM dd yyyy HH:mm:ss', // "Sat Dec 28 2024 13:56:50"
  display: 'MM/dd/yyyy'         // "01/15/2025"
};
```

### 3. Use Helper Functions
```javascript
import { parseDate, formatDate, getCurrentTimestamp } from './import-config.js';

// Parse with predefined format
const txDate = parseDate(dateString, 'transaction');

// Parse with custom format
const customDate = parseDate(dateString, 'yyyy/MM/dd');

// Format for display
console.log(`Date: ${formatDate(txDate)}`);

// Get current timestamp
const now = getCurrentTimestamp();
```

---

## Common Date Handling Patterns

### Transaction Dates
```javascript
// Transaction dates are critical for ID generation
function parseTransactionDate(dateString) {
  if (!dateString) {
    logProgress('Missing transaction date, using current date', 'warn');
    return getCurrentTimestamp();
  }
  
  // Try expected format first
  let parsedDate = parseDate(dateString, 'transaction');
  
  // Try other formats if needed
  if (!parsedDate) {
    const formats = ['yyyy-MM-dd', 'MM/dd/yyyy'];
    for (const format of formats) {
      parsedDate = parseDate(dateString, format);
      if (parsedDate) break;
    }
  }
  
  return parsedDate || getCurrentTimestamp();
}
```

### HOA Payment Dates
```javascript
// Extract date from payment notes
function extractDateFromNotes(notes) {
  // Format: "Posted: MXN 15,000.00 on Sat Dec 28 2024 13:56:50 GMT-0500"
  const dateRegex = /on\s+(.*?)\s+GMT/;
  const match = notes.match(dateRegex);
  
  if (match && match[1]) {
    const dateStr = match[1].trim();
    return parseDate(dateStr, 'hoaPayment');
  }
  
  return null;
}
```

### Fiscal Year Calculations
```javascript
// Always use DateService for current date
const currentDate = dateService.getNow();
const currentFY = getFiscalYear(currentDate, fiscalYearStartMonth);
```

---

## Client-Specific Configurations

### MTC (Mariscal Tower Condominiums)
- Transaction dates: "M/d/yyyy" format
- HOA payments: Complex note extraction
- Fiscal year: January start

### AVII
- Transaction dates: "yyyy-MM-dd" format
- Standard payment dates
- Fiscal year: July start

---

## Testing Date Handling

### 1. Verify No Date Sliding
```bash
# Run import
./run-import-enhanced.sh MTC

# Check a transaction date
# Original: "1/15/2025"
# Should remain: "2025-01-15" in Cancun timezone
# NOT: "2025-01-14" (UTC sliding)
```

### 2. Test Edge Cases
- End of year dates (12/31)
- Beginning of year dates (1/1)
- Daylight saving transitions
- Missing dates

### 3. Validate Transaction IDs
Transaction IDs include date components and must be consistent:
```
MTC-2025-01-001  # Correct
MTC-2024-12-999  # Should not slide to previous day
```

---

## Migration Checklist

When updating import scripts for a new client:

- [ ] Configure date formats in `clientAccountMapping.js`
- [ ] Test date parsing with sample data
- [ ] Verify transaction ID generation
- [ ] Check HOA payment date extraction
- [ ] Validate fiscal year calculations
- [ ] Ensure all timestamps use DateService
- [ ] Test with timezone changes

---

## Common Issues and Solutions

### Issue: Dates showing day before
**Cause:** UTC conversion without timezone awareness  
**Solution:** Use `dateService.parseFromFrontend()` with correct format

### Issue: Transaction IDs inconsistent
**Cause:** Date sliding affects ID generation  
**Solution:** Ensure transaction date parsing uses DateService

### Issue: HOA payments not linking
**Cause:** Date mismatch between payment and transaction  
**Solution:** Both must use same date parsing method

### Issue: Wrong fiscal year
**Cause:** Current date in wrong timezone  
**Solution:** Use `dateService.getNow()` not `new Date()`

---

## Code Examples

### Complete Import Flow
```javascript
// 1. Initialize with timezone
import { dateService, initializeImport } from './import-config.js';

// 2. Parse dates from source data
const transactionDate = dateService.parseFromFrontend(data.Date, 'M/d/yyyy');

// 3. Create timestamps for new records
const record = {
  date: transactionDate,
  createdAt: getCurrentTimestamp(),
  importedAt: dateService.getNow()
};

// 4. Format for display
console.log(`Imported transaction from ${formatDate(transactionDate)}`);
```

### Date Validation
```javascript
function isValidDate(date, yearRange = 10) {
  if (!date) return false;
  
  try {
    const formatted = dateService.formatForFrontend(date);
    const year = formatted.year;
    const currentYear = new Date().getFullYear();
    
    return year >= (currentYear - yearRange) && 
           year <= (currentYear + yearRange);
  } catch {
    return false;
  }
}
```

---

## Environment Variables

```bash
# Always set timezone
export TZ='America/Cancun'

# Run import
./run-import-enhanced.sh MTC
```

---

## Further Reading

- `backend/services/DateService.js` - Core DateService implementation
- `import-config.js` - Centralized import configuration
- `Phase_1_Date_Analysis_Report.md` - Detailed analysis of date issues

---

## Support

If you encounter date-related issues:
1. Check date format in source data
2. Verify DateService is being used
3. Confirm timezone is set correctly
4. Review import logs for warnings