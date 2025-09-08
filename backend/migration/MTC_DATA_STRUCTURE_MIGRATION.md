# MTC Data Structure Migration Guide

**Date**: July 5, 2025  
**Purpose**: Clean data reload with new field structures  
**No Backward Compatibility Required**

## Overview

Since MTC is test data that can be reloaded at will, we will perform a complete data migration to the new structure without any legacy fields.

## 1. Users Collection Migration

### Old Structure (Remove)
```javascript
{
  // Document ID: email-based or random
  email: "user@example.com",
  globalRole: "superAdmin" | "admin" | "user",
  clientAccess: {
    "MTC": {
      role: "admin" | "unitManager" | "unitOwner",
      unitId: "2C",
      additionalAssignments: [...]
    }
  },
  isActive: true,
  lastLogin: "2025-07-01T..."
}
```

### New Structure (Use)
```javascript
{
  // Document ID: MUST be Firebase Auth UID
  email: "user@example.com",
  displayName: "User Name",
  isSuperAdmin: false, // boolean only
  propertyAccess: {
    "MTC": {
      isAdmin: false,
      unitAssignments: [
        { unitId: "2C", role: "owner" },
        { unitId: "3A", role: "manager" }
      ]
    }
  },
  profile: {
    firstName: "First",
    lastName: "Last",
    phone: "+1234567890",
    preferredCurrency: "MXN",
    preferredLanguage: "english",
    taxId: "RFC123456"
  },
  notifications: {
    email: true,
    sms: true,
    duesReminders: true
  },
  accountState: "active", // "active" | "suspended" | "pending"
  mustChangePassword: false,
  updated: Timestamp // Firestore timestamp
}
```

## 2. Transactions Collection Migration

### Old Structure (Remove)
```javascript
{
  // Document ID: random
  amount: 123.45, // decimal
  vendorId: "vendor123",
  // Missing vendorName
  createdAt: "2025-07-01T...",
  updatedAt: "2025-07-01T..."
}
```

### New Structure (Use)
```javascript
{
  // Document ID: YYYY-MM-DD_HHMMSS_nnn
  amount: 12345, // cents as integer
  vendorId: "vendor123",
  vendorName: "Vendor Name", // denormalized
  accountId: "account123",
  accountName: "Account Name", // denormalized
  created: Timestamp, // Firestore timestamp
  updated: Timestamp, // Firestore timestamp
  propertyId: "MTC", // explicit property reference
  unitId: "2C"
}
```

## 3. Migration Scripts Required

### Step 1: Clear Existing Data
```javascript
// Clear all collections for MTC
const collections = ['users', 'transactions', 'units', 'hoaDues'];
for (const collection of collections) {
  const snapshot = await db.collection(collection)
    .where('clientId', '==', 'MTC').get();
  
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}
```

### Step 2: Create New User Structure
```javascript
// Example user creation with new structure
async function createCleanUser(authEmail, userData) {
  // 1. Create in Firebase Auth first
  const userRecord = await admin.auth().createUser({
    email: authEmail,
    password: generateTempPassword(),
    displayName: userData.displayName
  });
  
  // 2. Create Firestore document with UID
  await db.collection('users').doc(userRecord.uid).set({
    email: authEmail,
    displayName: userData.displayName,
    isSuperAdmin: userData.isSuperAdmin || false,
    propertyAccess: userData.propertyAccess || {},
    profile: {
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      phone: userData.phone || null,
      preferredCurrency: 'MXN',
      preferredLanguage: 'english',
      taxId: userData.rfc || null
    },
    notifications: {
      email: true,
      sms: true,
      duesReminders: true
    },
    accountState: 'active',
    mustChangePassword: true,
    updated: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return userRecord.uid;
}
```

### Step 3: Convert Role Mappings
```javascript
function convertUserRoles(oldUser) {
  const propertyAccess = {};
  
  if (oldUser.clientAccess) {
    for (const [clientId, access] of Object.entries(oldUser.clientAccess)) {
      const newAccess = {
        isAdmin: access.role === 'admin',
        unitAssignments: []
      };
      
      // Convert unit managers and owners
      if (access.role === 'unitManager' || access.role === 'unitOwner') {
        newAccess.unitAssignments.push({
          unitId: access.unitId,
          role: access.role === 'unitManager' ? 'manager' : 'owner'
        });
      }
      
      // Convert additional assignments
      if (access.additionalAssignments) {
        access.additionalAssignments.forEach(assignment => {
          newAccess.unitAssignments.push({
            unitId: assignment.unitId,
            role: assignment.role === 'unitManager' ? 'manager' : 'owner'
          });
        });
      }
      
      propertyAccess[clientId] = newAccess;
    }
  }
  
  return {
    displayName: oldUser.name || oldUser.email,
    isSuperAdmin: oldUser.globalRole === 'superAdmin',
    propertyAccess,
    firstName: oldUser.name?.split(' ')[0] || '',
    lastName: oldUser.name?.split(' ').slice(1).join(' ') || '',
    phone: oldUser.phone || null,
    rfc: oldUser.rfc || null
  };
}
```

### Step 4: Transaction Document IDs
```javascript
function generateTransactionId(date) {
  const d = new Date(date);
  const datePart = d.toISOString().split('T')[0];
  const timePart = d.toTimeString().split(' ')[0].replace(/:/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${datePart}_${timePart}_${random}`;
}

// Convert amount to cents
function convertToCents(amount) {
  return Math.round(amount * 100);
}
```

## 4. Data Import Order

1. **Users** - Must create Firebase Auth entries first
2. **Units** - Update with clean owner/manager arrays
3. **Vendors & Categories** - Simple field updates
4. **Transactions** - New document IDs and amount format
5. **HOA Dues** - Link to transactions with new IDs

## 5. Validation Checklist

After migration, verify:

- [ ] All user documents use Firebase UID as document ID
- [ ] No `clientAccess` field remains (only `propertyAccess`)
- [ ] No `globalRole` field remains (only `isSuperAdmin`)
- [ ] No `isActive` field remains (only `accountState`)
- [ ] All amounts stored as integers (cents)
- [ ] All timestamps are Firestore Timestamps
- [ ] Transaction IDs follow YYYY-MM-DD_HHMMSS_nnn format
- [ ] All denormalized fields populated (vendorName, accountName)

## 6. Clean Import Script

Create `import-mtc-clean.js`:

```javascript
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

async function cleanImportMTC() {
  const db = getFirestore();
  const auth = getAuth();
  
  console.log('🧹 Starting clean MTC import...');
  
  // 1. Clear existing data
  await clearMTCData(db);
  
  // 2. Import users with new structure
  await importCleanUsers(db, auth);
  
  // 3. Import other collections
  await importCleanTransactions(db);
  await importCleanUnits(db);
  
  console.log('✅ Clean import complete!');
}

cleanImportMTC().catch(console.error);
```

## 7. Benefits of Clean Migration

1. **Performance**: No runtime field conversions needed
2. **Clarity**: Single source of truth for field names
3. **Type Safety**: Consistent data types (boolean vs string, int vs float)
4. **Maintenance**: No legacy code to maintain
5. **Security**: Clean permission checks without fallbacks

## 8. Post-Migration

After successful migration:

1. Delete all `*-fixed.js` and `*-clean.js` variants
2. Remove migration scripts
3. Update all documentation to reflect new structure only
4. Run full integration test suite
5. Deploy to development environment