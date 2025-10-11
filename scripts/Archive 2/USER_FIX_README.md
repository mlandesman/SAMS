# User Profile Structure Fix Scripts

## Problem
After the mobile compatibility updates, some user profiles have an incorrect `clientAccess` structure that causes permission errors. The issue is that the `unitId` field is missing at the client level when users have unit assignments.

## Correct Structure
```javascript
clientAccess: {
  "MTC": {
    role: "unitOwner",        // Primary role
    unitId: "PH4D",          // Primary unit (REQUIRED)
    permissions: [],
    addedDate: "...",
    addedBy: "...",
    unitAssignments: [       // Additional units
      {
        unitId: "1C",
        role: "unitManager",
        addedDate: "...",
        addedBy: "..."
      }
    ]
  }
}
```

## Script

### fix-user-structure.js
Generic script to fix any user's profile structure using ES modules.

```bash
cd scripts
# Fix by email
node fix-user-structure.js ms@landesman.com

# Fix by userId
node fix-user-structure.js YHk0uE4Qha5XQrBss1Yw
```

## What the Scripts Do

1. **Detect Problem**: Check if user has `unitAssignments` but no primary `unitId`
2. **Find Primary Unit**: 
   - If user owns a unit, that becomes primary
   - Otherwise, first managed unit becomes primary
3. **Restructure**: 
   - Move primary unit to `unitId` field
   - Keep other units in `unitAssignments` array
   - Ensure all required fields exist
4. **Verify**: Show the updated structure

## Manual Firestore Fix

If you prefer to fix manually in Firestore Console:

1. Find the user document
2. Edit `clientAccess.MTC` (or relevant client)
3. Add `unitId` field with the primary unit ID
4. Ensure `role` matches the primary unit's role
5. Keep additional units in `unitAssignments` array

## Verification

After running the fix, verify in the app:
1. User can log in
2. Dashboard loads without "Access Denied"
3. User can access their assigned units

## Prevention

New users created through the SAMS app will have the correct structure automatically.