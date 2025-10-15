---
task_id: WB-Implementation-4-Import-DueDate-Fix
priority: 🔥 HIGH (Blocks Testing)
agent_type: Implementation Agent
status: Ready for Assignment
created: 2025-10-15
approved_by: Manager Agent + Product Manager (Michael)
prerequisites: None (can run parallel or after Task 3)
estimated_effort: 1-2 hours
memory_log_path: apm_session/Memory/Task_Completion_Logs/Task_4_Water_Bills_Import_DueDate_Fix_2025-10-15.md
fixes_issues:
  - Data Import Issue: dueDate set to import date instead of bill month
  - Prevents penalty calculation testing
  - Blocks fresh data imports for testing
testing_required: Backend import testing with sample data
validation_source: Issue discovered during Task 1 investigation
branch: feature/water-bills-issues-0-7-complete-fix
---

# IMPLEMENTATION TASK 4: Fix Water Bills Import dueDate Logic

## 🎯 MISSION: Set Correct dueDate During Bill Import

**CRITICAL DATA IMPORT BUG**

The water bills import routine currently sets `dueDate` to "today's date" (the import date), which means:
- All imported bills appear current (not overdue)
- Penalties are never calculated (bills aren't past grace period)
- Testing penalty calculations is impossible with imported data
- Fresh data imports don't work for testing

**YOUR FIX:**
Set `dueDate` to the 1st day of the bill's month, not the import date.

---

## 📖 CONTEXT FROM DISCOVERY

### How Issue Was Found:
During Task 1 (Penalty Calculation), agent discovered that all imported bills had:
- `dueDate`: Current date (e.g., "2025-10-15")
- `billDate`: Current date (e.g., "2025-10-15")
- **Expected:** `dueDate` should be "2025-07-01" for July bill

**Documented in:** `docs/investigations/IMPORT_ISSUE_BILL_DUE_DATES.md`

### Why This Matters:
1. **Testing:** Can't test penalties with imported data
2. **Data Integrity:** Historical bills show wrong dates
3. **Production:** Future imports will have same issue
4. **Fresh Imports:** Need this fixed to reload test data

---

## 🔧 IMPLEMENTATION REQUIREMENTS

### Current (WRONG) Behavior:
```javascript
// Import sets dueDate to today
billData.dueDate = new Date(); // 2025-10-15
billData.billDate = new Date(); // 2025-10-15

// Result: July 2025 bill has October 2025 dates
// Bill appears current, not overdue
// Penalties never calculated
```

### Required (CORRECT) Behavior:
```javascript
// Import should set dueDate to 1st of bill month
// For bill "2026-00" (July 2025):
billData.dueDate = new Date('2025-07-01'); // July 1st, 2025
billData.billDate = new Date('2025-07-01'); // July 1st, 2025

// For bill "2026-01" (August 2025):
billData.dueDate = new Date('2025-08-01'); // August 1st, 2025
billData.billDate = new Date('2025-08-01'); // August 1st, 2025

// And so on...
```

---

## 📋 STEP-BY-STEP IMPLEMENTATION

### Step 1: Locate Import Script

**Likely Location:**
```bash
# Search for water bills import scripts
grep -r "import.*water" scripts/
grep -r "dueDate.*new Date" scripts/

# Common locations:
scripts/import/importWaterBills.js
scripts/data/importWaterData.js
backend/scripts/importWaterBills.js
```

**What to Look For:**
- Function that reads bill data
- Code that sets `dueDate` field
- Bill document creation logic

---

### Step 2: Understand Bill ID Format

**Bill ID Format:** `YYYY-MM`
- `2026-00` = Fiscal year 2026, Month 0 (July 2025)
- `2026-01` = Fiscal year 2026, Month 1 (August 2025)
- `2026-11` = Fiscal year 2026, Month 11 (June 2026)

**Fiscal Year Logic:**
- Fiscal year 2026 = July 2025 - June 2026
- Month 0 = July of previous calendar year
- Month 11 = June of current calendar year

**Calendar Year Calculation:**
```javascript
// For fiscal year 2026:
// Month 0-5 (Jul-Dec) = 2025
// Month 6-11 (Jan-Jun) = 2026

const fiscalYear = 2026;
const monthIndex = 0; // 0-11

// Calculate calendar year
const calendarYear = monthIndex <= 5 
  ? fiscalYear - 1  // Jul-Dec of previous year
  : fiscalYear;      // Jan-Jun of current year

// Calculate calendar month (0-based, 0=January)
const calendarMonth = (monthIndex + 6) % 12; // Offset by 6 (July is month 0)

// Create date for 1st of that month
const dueDate = new Date(calendarYear, calendarMonth, 1);
```

---

### Step 3: Create Helper Function

**Add this function to the import script:**

```javascript
/**
 * Calculate the correct dueDate for a water bill based on fiscal year and month
 * @param {number} fiscalYear - Fiscal year (e.g., 2026)
 * @param {number} monthIndex - Month index 0-11 (0=July, 11=June)
 * @returns {Date} - Date object set to 1st of the bill's month
 */
function calculateBillDueDate(fiscalYear, monthIndex) {
  // Validate inputs
  if (monthIndex < 0 || monthIndex > 11) {
    throw new Error(`Invalid month index: ${monthIndex}. Must be 0-11.`);
  }
  
  // Fiscal year starts in July (month 0)
  // Months 0-5 = July-December of (fiscalYear - 1)
  // Months 6-11 = January-June of fiscalYear
  const calendarYear = monthIndex <= 5 
    ? fiscalYear - 1  // Jul-Dec of previous calendar year
    : fiscalYear;      // Jan-Jun of current calendar year
  
  // Convert fiscal month to calendar month
  // Month 0 (July) = Calendar month 6
  // Month 1 (August) = Calendar month 7
  // Month 6 (January) = Calendar month 0
  const calendarMonth = (monthIndex + 6) % 12;
  
  // Create date for 1st of that month
  const dueDate = new Date(calendarYear, calendarMonth, 1);
  
  console.log(`Fiscal ${fiscalYear}-${monthIndex.toString().padStart(2, '0')} → ${dueDate.toISOString().split('T')[0]}`);
  
  return dueDate;
}

// Examples:
// calculateBillDueDate(2026, 0)  → 2025-07-01 (July 2025)
// calculateBillDueDate(2026, 1)  → 2025-08-01 (August 2025)
// calculateBillDueDate(2026, 6)  → 2026-01-01 (January 2026)
// calculateBillDueDate(2026, 11) → 2026-06-01 (June 2026)
```

---

### Step 4: Update Import Logic

**Find the code that creates bill documents:**

```javascript
// WRONG (Current):
const billData = {
  billId: `${fiscalYear}-${monthIndex.toString().padStart(2, '0')}`,
  fiscalYear,
  monthIndex,
  unitId,
  currentCharge,
  totalAmount,
  status: 'unpaid',
  dueDate: new Date(), // ❌ WRONG - uses import date
  billDate: new Date(), // ❌ WRONG - uses import date
  createdAt: admin.firestore.Timestamp.now()
};
```

**CORRECT (Update to):**

```javascript
// CORRECT:
const dueDate = calculateBillDueDate(fiscalYear, monthIndex);

const billData = {
  billId: `${fiscalYear}-${monthIndex.toString().padStart(2, '0')}`,
  fiscalYear,
  monthIndex,
  unitId,
  currentCharge,
  totalAmount,
  status: 'unpaid',
  dueDate: admin.firestore.Timestamp.fromDate(dueDate), // ✅ CORRECT - 1st of bill month
  billDate: admin.firestore.Timestamp.fromDate(dueDate), // ✅ CORRECT - 1st of bill month
  createdAt: admin.firestore.Timestamp.now()
};
```

**Key Changes:**
1. Call `calculateBillDueDate(fiscalYear, monthIndex)` to get correct date
2. Use that date for both `dueDate` and `billDate`
3. Convert to Firestore Timestamp with `admin.firestore.Timestamp.fromDate()`

---

### Step 5: Add Validation

**Add checks to ensure dates are correct:**

```javascript
// After setting dueDate, validate it
const expectedYear = monthIndex <= 5 ? fiscalYear - 1 : fiscalYear;
const actualYear = dueDate.getFullYear();

if (actualYear !== expectedYear) {
  throw new Error(
    `Date calculation error for ${fiscalYear}-${monthIndex}: ` +
    `Expected year ${expectedYear}, got ${actualYear}`
  );
}

// Validate day is 1st
if (dueDate.getDate() !== 1) {
  throw new Error(
    `dueDate must be 1st of month, got day ${dueDate.getDate()}`
  );
}

console.log(`✅ Bill ${fiscalYear}-${monthIndex}: dueDate = ${dueDate.toISOString().split('T')[0]}`);
```

---

## 🧪 TESTING REQUIREMENTS

### Test 1: Validate Helper Function

```javascript
// Create test file: backend/testing/testDueDateCalculation.js

function testDueDateCalculation() {
  console.log('🧪 Testing dueDate calculation...\n');
  
  const tests = [
    { fiscalYear: 2026, month: 0, expected: '2025-07-01', name: 'July 2025' },
    { fiscalYear: 2026, month: 1, expected: '2025-08-01', name: 'August 2025' },
    { fiscalYear: 2026, month: 2, expected: '2025-09-01', name: 'September 2025' },
    { fiscalYear: 2026, month: 3, expected: '2025-10-01', name: 'October 2025' },
    { fiscalYear: 2026, month: 4, expected: '2025-11-01', name: 'November 2025' },
    { fiscalYear: 2026, month: 5, expected: '2025-12-01', name: 'December 2025' },
    { fiscalYear: 2026, month: 6, expected: '2026-01-01', name: 'January 2026' },
    { fiscalYear: 2026, month: 7, expected: '2026-02-01', name: 'February 2026' },
    { fiscalYear: 2026, month: 8, expected: '2026-03-01', name: 'March 2026' },
    { fiscalYear: 2026, month: 9, expected: '2026-04-01', name: 'April 2026' },
    { fiscalYear: 2026, month: 10, expected: '2026-05-01', name: 'May 2026' },
    { fiscalYear: 2026, month: 11, expected: '2026-06-01', name: 'June 2026' }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const result = calculateBillDueDate(test.fiscalYear, test.month);
    const resultStr = result.toISOString().split('T')[0];
    
    if (resultStr === test.expected) {
      console.log(`✅ ${test.name}: ${resultStr}`);
      passed++;
    } else {
      console.log(`❌ ${test.name}: Expected ${test.expected}, got ${resultStr}`);
      failed++;
    }
  }
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

testDueDateCalculation();
```

**Expected Output:**
```
✅ July 2025: 2025-07-01
✅ August 2025: 2025-08-01
...
✅ June 2026: 2026-06-01

📊 Results: 12 passed, 0 failed
```

---

### Test 2: Import Sample Data

```javascript
// Test with small dataset
const sampleBills = [
  { fiscalYear: 2026, month: 0, unitId: '101' },  // July 2025
  { fiscalYear: 2026, month: 1, unitId: '101' },  // August 2025
  { fiscalYear: 2026, month: 6, unitId: '101' }   // January 2026
];

// Run import
await importBills(sampleBills);

// Verify in Firestore
const bill1 = await getBillDocument('AVII', 2026, 0, '101');
console.log('Bill 2026-00 dueDate:', bill1.dueDate.toDate());
// Should show: 2025-07-01

const bill2 = await getBillDocument('AVII', 2026, 6, '101');
console.log('Bill 2026-06 dueDate:', bill2.dueDate.toDate());
// Should show: 2026-01-01
```

---

### Test 3: Verify Penalties Calculate

```javascript
// After importing with correct dates, verify penalties work
const today = new Date('2025-10-15');
const bill = await getBillDocument('AVII', 2026, 0, '101');

console.log('Bill dueDate:', bill.dueDate.toDate()); // Should be 2025-07-01
console.log('Grace period ends:', new Date(bill.dueDate.toDate().getTime() + 10 * 24 * 60 * 60 * 1000)); // Should be 2025-07-11
console.log('Today:', today); // 2025-10-15
console.log('Is overdue?', today > new Date(bill.dueDate.toDate().getTime() + 10 * 24 * 60 * 60 * 1000)); // Should be true

// Trigger penalty calculation
await waterDataService.calculateYearSummary('AVII', 2026);

// Verify penalties calculated
const aggregatedData = await waterDataService.getAggregatedData('AVII', 2026);
const unitData = aggregatedData.months[0].units['101'];

console.log('Penalties:', unitData.penalties); // Should be > 0
console.log('Penalties applied?', unitData.penaltiesApplied); // Should be true
```

---

## ✅ SUCCESS CRITERIA

- [ ] Helper function `calculateBillDueDate()` created and tested
- [ ] All 12 months test correctly (July → June)
- [ ] Import script updated to use helper function
- [ ] Sample import test passes
- [ ] Bills have correct dueDates (1st of their month)
- [ ] Penalties now calculate correctly for imported bills
- [ ] Validation added to catch date calculation errors
- [ ] Memory Log created with before/after examples
- [ ] Changes committed to feature branch

---

## 🚨 CRITICAL CONSTRAINTS

### 1. Firestore Timestamp Format
**IMPORTANT:** Firestore uses `Timestamp` objects, not JavaScript `Date` objects.

```javascript
// WRONG:
billData.dueDate = new Date('2025-07-01'); // ❌

// CORRECT:
const dueDate = new Date('2025-07-01');
billData.dueDate = admin.firestore.Timestamp.fromDate(dueDate); // ✅
```

### 2. Month Indexing
- Fiscal months: 0-11 (0 = July, 11 = June)
- Calendar months: 0-11 (0 = January, 11 = December)
- **Be careful with conversions!**

### 3. Date Constructor Format
```javascript
// Safe (ISO format):
new Date('2025-07-01') // ✅

// Unsafe (locale-dependent):
new Date('7/1/2025') // ❌ Might parse differently

// Best (explicit):
new Date(2025, 6, 1) // ✅ July 1, 2025 (month is 0-based)
```

### 4. Testing Impact
After this fix, all existing imported data will have **wrong dates**. You'll need to:
- Re-import data to get correct dates
- Or manually update existing bills (not recommended)

---

## 📝 MEMORY LOG REQUIREMENTS

**File:** `apm_session/Memory/Task_Completion_Logs/Task_4_Water_Bills_Import_DueDate_Fix_2025-10-15.md`

### Must Include:

1. **Problem Statement**
   - Current behavior (uses import date)
   - Required behavior (uses bill month 1st)

2. **Implementation Details**
   - Helper function code
   - Import script changes
   - File paths and line numbers

3. **Test Results**
   - All 12 months tested
   - Before/after examples
   - Penalty calculation verification

4. **Impact Assessment**
   - Existing data affected
   - Re-import required
   - Future imports fixed

5. **Examples**
   ```
   Before: Bill 2026-00 → dueDate: 2025-10-15 (import date)
   After:  Bill 2026-00 → dueDate: 2025-07-01 (bill month)
   ```

---

## 🎯 PRIORITY AND TIMING

**Priority:** 🔥 HIGH (blocks testing)

**Can Run:**
- Parallel with Task 3 (different files)
- After Task 3 (cleaner separation)
- Before final testing (required for data reload)

**Estimated Duration:** 1-2 hours
- Helper function: 30 min
- Update import script: 30 min
- Testing: 30 min
- Documentation: 15 min

---

## 📁 LIKELY FILE LOCATIONS

Search for import scripts in these locations:

```bash
# Common locations:
scripts/import/importWaterBills.js
scripts/data/importWaterData.js
scripts/importWaterBills.cjs
backend/scripts/importWaterBills.js
backend/services/importService.js

# Search commands:
grep -r "import.*water.*bills" scripts/
grep -r "dueDate.*new Date" scripts/ backend/
grep -r "billDate.*new Date" scripts/ backend/
```

---

## 🎓 KEY LEARNING

**Why This Matters:**
- Import scripts set foundational data
- Wrong dates at import = wrong calculations forever
- Testing depends on realistic data
- Production imports must be correct

**Best Practice:**
- Always use domain-specific dates (bill month), not system dates (today)
- Validate dates during import
- Test date calculations thoroughly

---

## 🚀 READY FOR ASSIGNMENT

**Task Type:** Bug Fix (Import Logic)  
**Complexity:** MEDIUM - Date calculations can be tricky  
**Risk:** LOW - Isolated to import script  
**Impact:** HIGH - Fixes testing and future imports

**Testing Approach:** Backend import testing  
**Branch:** feature/water-bills-issues-0-7-complete-fix

---

**Manager Agent Sign-off:** October 15, 2025  
**Product Manager Approved:** Michael Landesman  
**Status:** Ready for Implementation Agent Assignment  
**Priority:** 🔥 HIGH - Blocks effective testing
