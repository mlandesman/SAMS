# 🔒 LOCKED SCRIPTS - DO NOT MODIFY

## ⚠️ CRITICAL: These Scripts Are Production-Ready and LOCKED

The following scripts have been tested, validated, and are working perfectly. They are **LOCKED** and must NOT be modified by any agent or developer.

### ✅ LOCKED Scripts (chmod 555 - Read/Execute Only)

1. **`create-mtc-client.js`** - Creates/updates the MTC client document
   - Status: ✅ WORKING PERFECTLY
   - Creates client with ID "MTC"
   - All fields validated
   
2. **`create-default-accounts.js`** - Creates bank and cash accounts
   - Status: ✅ WORKING PERFECTLY  
   - Uses createAccount controller
   - Creates accounts array in client document
   
3. **`import-categories-vendors-with-crud.js`** - Imports categories and vendors
   - Status: ✅ WORKING PERFECTLY
   - Uses ONLY controller functions
   - No direct Firestore writes
   - All validation passing
   - Fixed: Vendor controller now uses empty string instead of "General" for category

4. **`fix-vendor-categories.js`** - One-time fix to remove "General" from vendors
   - Status: ✅ COMPLETE - Already run on 2025-07-10
   - Removed "General" category from all 24 vendors
   - Vendors now have empty category field for proper categorization

5. **`import-units-fixed.js`** - Imports units with size data
   - Status: ✅ WORKING PERFECTLY
   - Uses ONLY createUnit controller
   - NO direct Firestore writes
   - Properly combines Units.json and UnitSizes.json
   - Imports owner info, dues amounts, and physical dimensions
   - All 10 units imported successfully

### 📊 Validation Results (2025-07-10)

```
✅ Client creation - COMPLETE
✅ Accounts - 2 accounts in array
✅ Categories - All imported with correct fields
✅ Vendors - All imported with correct fields
✅ Audit logs - Working
✅ Import metadata - Working
```

### 🚫 DO NOT:
- Modify these scripts
- "Fix" these scripts (they're not broken!)
- Refactor these scripts
- Add features to these scripts
- Change import approach

### ✅ If You Need Changes:
1. Create a NEW script with a different name
2. Test thoroughly before use
3. Get approval before replacing

### 🔑 Key Success Factors:
- Client uses direct Firestore write (matching backend route)
- Accounts use controller function
- Categories/Vendors use controller functions
- NO forbidden fields (created, createdBy, metadata)
- Proper account names: "MTC Bank" and "Cash Account"
- Vendor category field is empty string (not "General") for future categorization

### 🛠️ Backend Controller Fixed:
- `vendorsController.js` line 39: Changed default from "General" to empty string
- This prevents validation failures when auto-categorization is implemented

---
**Last Validated**: 2025-07-10
**Locked By**: Manager Agent
**Reason**: Production-ready, fully tested and validated