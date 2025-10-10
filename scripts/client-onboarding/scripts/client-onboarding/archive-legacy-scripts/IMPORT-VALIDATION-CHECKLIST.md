# Import Script Validation Checklist

## MANDATORY VALIDATION FOR EACH SCRIPT

### Pre-Flight Checks
- [ ] Script uses backend API (createTransaction, createCategory, etc.)
- [ ] NO direct Firestore writes
- [ ] Account mapping configured: 
  - "Cash Account" → "cash-001"
  - "MTC Bank" → "bank-001"

### Field Validation (MUST PASS ALL)

#### ✅ ALLOWED Fields in Documents
**Transactions:**
- `type` (NOT transactionType)
- `amount`
- `date` (preserved from source)
- `vendorId`, `vendorName`
- `categoryId`, `categoryName`
- `accountId`, `accountName`
- `notes`
- `unitId` (for HOA dues)
- `updated` (timestamp)
- `clientId`
- `propertyId`

**Categories/Vendors:**
- Core business fields only
- `updated` (timestamp)
- NO metadata fields

#### ❌ FORBIDDEN Fields (MUST NOT EXIST)
- `created`, `createdAt`
- `createdBy`, `enteredBy`
- `lastModified`, `lastModifiedBy`
- `metadata` object
- `transactionType` (use `type` only)
- `sequenceNumber` (temporary lookup only)

### Collection Validation

#### ✅ Correct Locations
- Audit data → `auditLogs` collection
- Import metadata → `clients/MTC/importMetadata` collection
- Accounts → Client document array ONLY (no subcollection)

#### ❌ Wrong Locations
- NO metadata in transaction/category/vendor documents
- NO accounts subcollection

### Data Integrity Checks
- [ ] Historical dates preserved (not today's date)
- [ ] Document IDs use historical dates
- [ ] HOA dues have vendor = "Deposit"
- [ ] HOA payment details in notes field
- [ ] duesDistribution populated (if applicable)

### Post-Import Validation
- [ ] Check random transaction - NO forbidden fields
- [ ] Check auditLogs - has creation info
- [ ] Check importMetadata - has source data
- [ ] Verify date preservation
- [ ] Verify account mapping worked

## Sign-Off Process

For EACH script separately:

1. **Run Script**
2. **Check 3 Random Documents** - verify ALL field rules
3. **Check Collections** - verify data in correct places
4. **Sign Below**

---

### Script: import-categories-vendors-with-crud.js
- [ ] Pre-flight passed
- [ ] Field validation passed
- [ ] Collection validation passed
- [ ] Data integrity passed
- Date tested: ___________
- Tested by: ___________
- APPROVED: [ ]

### Script: import-units-with-crud.js
- [ ] Pre-flight passed
- [ ] Field validation passed
- [ ] Collection validation passed
- [ ] Data integrity passed
- Date tested: ___________
- Tested by: ___________
- APPROVED: [ ]

### Script: import-transactions-with-crud.js
- [ ] Pre-flight passed
- [ ] Field validation passed
- [ ] Collection validation passed
- [ ] Data integrity passed
- Date tested: ___________
- Tested by: ___________
- APPROVED: [ ]

### Script: import-users-with-audit.js
- [ ] Pre-flight passed
- [ ] Field validation passed
- [ ] Collection validation passed
- [ ] Data integrity passed
- Date tested: ___________
- Tested by: ___________
- APPROVED: [ ]

### Script: importHOADuesFixed.js
- [ ] Pre-flight passed
- [ ] Field validation passed
- [ ] Collection validation passed
- [ ] Data integrity passed
- Date tested: ___________
- Tested by: ___________
- APPROVED: [ ]

## Final Production Approval
ALL scripts approved: [ ]
Ready for production: [ ]