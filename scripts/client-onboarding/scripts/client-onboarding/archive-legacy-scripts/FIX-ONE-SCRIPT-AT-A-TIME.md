# Fix Import Scripts - One at a Time

## New Approach: Test & Validate Each Script Individually

### Why This Approach?
- Previous "comprehensive fixes" keep failing
- Can't trust that backend validation is working
- Need proof each script follows rules before moving to next

### Process for EACH Script

1. **Purge Database First**
   ```bash
   node purge-dev-complete.cjs
   ```

2. **Run ONE Script**
   ```bash
   node import-categories-vendors-with-crud.js
   ```

3. **Validate Immediately**
   ```bash
   node validate-import.js
   ```

4. **Manual Spot Check**
   - Open Firebase Console
   - Check 2-3 documents
   - Verify NO forbidden fields
   - Verify data in correct collections

5. **Fix Issues**
   - If validation fails, fix ONLY that script
   - Re-test until it passes
   - Document what was fixed

6. **Sign Off**
   - Update IMPORT-VALIDATION-CHECKLIST.md
   - Mark script as approved
   - Move to next script

### Script Order
1. `import-categories-vendors-with-crud.js` - Simplest, no date issues
2. `import-units-with-crud.js` - Simple structure
3. `import-transactions-with-crud.js` - Complex, needs account mapping
4. `import-users-with-audit.js` - User management
5. `importHOADuesFixed.js` - Most complex, needs transaction linking

### Critical Fixes Needed

#### For ALL Scripts:
- Remove any code that adds metadata fields to documents
- Ensure only 'updated' timestamp is added
- Move all metadata to importMetadata collection

#### For Transactions:
- Add account mapping:
  ```javascript
  const ACCOUNT_MAPPING = {
    'Cash Account': 'cash-001',
    'MTC Bank': 'bank-001'
  };
  
  // In transaction processing:
  const accountId = ACCOUNT_MAPPING[data.account] || data.account;
  ```

- Ensure date preservation:
  ```javascript
  // Preserve original date, don't use new Date()
  date: originalTransaction.date
  ```

- HOA Dues vendor fix:
  ```javascript
  if (category === 'HOA Dues') {
    vendorName = 'Deposit';
    notes = originalTransaction.vendor; // Save original vendor in notes
  }
  ```

### Success Criteria
- Each script passes validation independently
- No forbidden fields in any document
- All data in correct collections
- Dates preserved correctly
- Account mapping working

### What NOT to Do
- Don't try to fix all scripts at once
- Don't assume backend validation is working
- Don't move to next script until current one is perfect
- Don't add new features - just fix field compliance

## Current Status
- [ ] Categories/Vendors Script - NOT VALIDATED
- [ ] Units Script - NOT VALIDATED  
- [ ] Transactions Script - NOT VALIDATED
- [ ] Users Script - NOT VALIDATED
- [ ] HOA Dues Script - NOT VALIDATED

Ready to start with first script...