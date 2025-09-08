# MTC Import Sequence

## Complete Import Process

Run these commands from the `/scripts/client-onboarding/` directory:

```bash
# Option 1: Use the automated script
chmod +x run-complete-import-mtcdata.sh
./run-complete-import-mtcdata.sh

# Option 2: Run manually in sequence
# 1. Create MTC Client (🔒 LOCKED - DO NOT MODIFY)
node create-mtc-client.js

# 2. Create Default Accounts (🔒 LOCKED - DO NOT MODIFY)
node create-default-accounts.js

# 2.5. Setup Client Configuration
node setup-client-config.js

# 3. Import Payment Methods
node import-payment-methods-with-crud.js

# 4. Import Categories & Vendors (🔒 LOCKED - DO NOT MODIFY)
node import-categories-vendors-with-crud.js

# 5. Import Units (🔒 LOCKED - DO NOT MODIFY)
node import-units-with-crud-refactored.js

# 6. Import Transactions (🔒 LOCKED - DO NOT MODIFY)
node import-transactions-with-crud-refactored.js

# 7. Import HOA Dues (Uses cross-reference from transactions)
node import-hoa-dues-with-crud-refactored.js

# 8. Import Users (Optional - if script exists)
node import-users-with-crud.js

# 9. Validate Import
node validate-import.js
```

## Key Points

1. **Client MUST be created first** - Creates the MTC document with ID "MTC"
2. **Accounts MUST be created second** - Creates bank-001 and cash-001
3. **Categories/Vendors before Transactions** - Transactions reference these
4. **Transactions before HOA Dues** - HOA import uses transaction cross-reference
5. **All imports use CRUD controllers** - No direct Firestore writes
6. **Cross-reference file** - Transactions generate HOA_Transaction_CrossRef.json

## Account Mappings

The system expects these account mappings in transactions:
- "MTC Bank" → loads actual account from database (sorted order)
- "Cash Account" → loads actual account from database (sorted order)

## Import Features

### Transaction Import
- Generates document IDs based on transaction date
- Creates HOA cross-reference file for sequence number mapping
- Handles income/expense detection based on amount sign
- Links HOA transactions to units

### HOA Dues Import
- Extracts payment dates from notes
- Links payments to transactions via sequence numbers
- Stores dues data in unit subcollections
- Tracks payment history with credit balances

## Troubleshooting

If validation fails:
1. Check for audit log errors (ensure proper writeAuditLog parameters)
2. Verify metadata controller accepts all document types
3. Ensure all scripts use controllers, not direct Firestore writes
4. Check that client and accounts exist before importing data
5. Verify HOA_Transaction_CrossRef.json was created

## Scripts to Lock After Testing

Once fully tested, these scripts should be locked:
```bash
chmod 555 import-hoa-dues-with-crud-refactored.js
```

## Production Deployment

For production use:
1. All refactored scripts should be renamed to remove "-refactored" suffix
2. Old versions should be archived
3. All scripts should be locked (chmod 555)
4. Update this documentation to reflect final names