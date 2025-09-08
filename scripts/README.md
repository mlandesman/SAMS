# SAMS Scripts

This folder contains utility scripts for managing and testing the Sandyland Asset Management System (SAMS).

## Configuration Scripts

### configureClientMenu.js

This script configures the menu items displayed in the sidebar for a specific client. The menu configuration is stored in Firestore at `/clients/{clientId}/config/activities`.

#### Usage

```bash
node --experimental-json-modules scripts/configureClientMenu.js
```

#### Parameters

- `clientId` - The ID of the client to configure (default: 'MTC')
- `menuItems` - An array of menu items with `label` and `activity` properties

#### Example Configuration

```javascript
const menuItems = [
  { label: "Dashboard", activity: "Dashboard" },
  { label: "Transactions", activity: "Transactions" },
  { label: "HOA Dues", activity: "HOADues" },
  { label: "Projects", activity: "Projects" },
  { label: "Budgets", activity: "Budgets" },
  { label: "List Management", activity: "ListManagement" },
  { label: "Settings", activity: "Settings" }
];
```

#### Notes

- The script uses ES modules, so you need to use the `--experimental-json-modules` flag
- Requires a valid service account key in `/backend/serviceAccountKey.json`
- Updates are performed directly in Firestore, no local backup is created

## Data Import Scripts

### importMTCData.js

This script imports the initial data for the Marina Turquesa Condominiums (MTC) client.

#### Usage

```bash
node scripts/importMTCData.js
```

### importMTCLists.js

This script imports the categories, vendors, and units data for the MTC client.

#### Usage

```bash
node scripts/importMTCLists.js
```

### importTransactionsForMTC.js

This script imports transaction data for the MTC client.

#### Usage

```bash
node scripts/importTransactionsForMTC.js
```

## Testing Scripts

### testAllCRUD.js

This script tests all CRUD operations for all controllers.

#### Usage

```bash
node scripts/testAllCRUD.js
```

### testAuth.js

This script tests the Firebase authentication system.

#### Usage

```bash
node scripts/testAuth.js
```

## Utility Scripts

### dumpClientTree.js

This script dumps the entire client tree structure for inspection.

#### Usage

```bash
node scripts/dumpClientTree.js
```

### reset.js

This script resets the database by removing all data.

#### Usage

```bash
node scripts/reset.js
```

**⚠️ WARNING: This script will delete all data in the database. Use with caution.**
