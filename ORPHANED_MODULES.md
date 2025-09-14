# Orphaned Modules (Not Referenced Anywhere)
**Generated:** 2025-09-10
**Purpose:** Document modules that exist but are NOT imported or used in the running application

## Deprecated Water Bills Views

### Unused Water Views
- `/frontend/sams-ui/src/views/SimpleWaterBillsView.jsx` - **ORPHANED**
  - Not imported anywhere
  - Likely superseded by WaterBillsSimple.jsx

- `/frontend/sams-ui/src/views/WaterBillsIntegratedView.jsx` - **ORPHANED**
  - Not imported as a component (only CSS file is used)
  - Superseded by WaterBillsViewV3.jsx
  
- `/frontend/sams-ui/src/views/WaterBillsSimple.jsx` - **SEMI-ORPHANED**
  - Only imported by ActivityView.jsx for dynamic routing
  - NOT used by main water bills routes (/waterbills uses WaterBillsViewV3)
  - May be legacy fallback

### Unused Water Components
- `/frontend/sams-ui/src/components/water/SimpleWaterHistoryTable.jsx` - **ORPHANED**
  - Not imported by any active component
  - Imports WaterHistoryTable.css but not used

- `/frontend/sams-ui/src/components/water/WaterHistoryTable.jsx` - **ORPHANED**
  - Only imported by WaterHistoryTableWrapper.jsx
  - Not part of active water bills flow

- `/frontend/sams-ui/src/components/water/WaterHistoryTableWrapper.jsx` - **ORPHANED**
  - Not imported anywhere
  - Wrapper for unused WaterHistoryTable

### Unused Water Context
- `/frontend/sams-ui/src/context/WaterBillsContext.jsx` - **SEMI-ORPHANED**
  - Only imported by ActivityView.jsx (line 10) for WaterBillsSimple wrapper
  - NOT used by active WaterBillsViewV3
  - May be legacy context provider

## Deprecated View Files

### Unused Transaction View
- `/frontend/sams-ui/src/views/TransactionsView.new.jsx` - **ORPHANED**
  - Not imported anywhere
  - Likely an abandoned refactor attempt
  - Active version is TransactionsView.jsx

### Unused Test Views
- `/frontend/sams-ui/src/views/AuthTestView.jsx` - **ORPHANED**
  - Not imported or routed anywhere
  - Likely development test file

- `/frontend/sams-ui/src/views/ReceiptDemo.jsx` - **ORPHANED**
  - Not imported (DigitalReceiptDemo.jsx is used instead)
  - Likely older demo version

## Deprecated Context Providers

### Unused List Management Context
- `/frontend/sams-ui/src/context/ListManagementContext.jsx` - **SEMI-ORPHANED**
  - Only imported by ActivityView.jsx for wrapper
  - Check if ListManagementView needs this

## Test Files (May be intentionally unused)

### Test Files
- `/frontend/sams-ui/src/views/__tests__/HOADuesView.test.jsx` - Test file
  - Unit test, not imported in production code
  - Keep if tests are being maintained

## Mobile PWA (Entire Directory at Risk)

### Mobile App Directory
- `/frontend/sams-ui/mobile-app/**` - **ENTIRE DIRECTORY AT RISK**
  - Not updated in over 1 month
  - Database structures have changed
  - API endpoints have changed
  - Authentication flow has changed
  - Likely completely broken and needs recovery or removal

## Backend Orphaned Routes

### Potential Duplicate Water Routes
Need investigation - multiple water route files exist:
- `/backend/routes/water.js`
- `/backend/routes/waterMeters.js`
- `/backend/routes/waterReadings.js`
- `/backend/routes/waterRoutes.js`

Check if all are actively mounted in the Express app or if some are deprecated.

## CSS Files Without Components

### Potentially Orphaned Styles
- Check if CSS files exist for components that have been removed
- `/frontend/sams-ui/src/components/water/WaterHistoryTable.css` - Used by orphaned components

## Recommendations

### Immediate Cleanup Candidates
1. **SimpleWaterBillsView.jsx** - Delete, not used
2. **WaterBillsIntegratedView.jsx** - Delete component, keep CSS if needed
3. **TransactionsView.new.jsx** - Delete or complete migration
4. **AuthTestView.jsx** - Delete if not needed for testing
5. **ReceiptDemo.jsx** - Delete, using DigitalReceiptDemo instead

### Needs Investigation
1. **WaterBillsSimple.jsx** - Check if ActivityView routing is still needed
2. **WaterBillsContext.jsx** - Remove if WaterBillsSimple is removed
3. **Water History components** - All three history table components unused
4. **Mobile PWA directory** - Major decision needed: recover or remove

### Backend Cleanup
1. Consolidate water routes - too many separate files
2. Check which routes are actually mounted in Express app

## Impact Analysis

### Safe to Remove
Components that have no imports and no dependencies:
- SimpleWaterBillsView.jsx
- WaterBillsIntegratedView.jsx (keep CSS)
- SimpleWaterHistoryTable.jsx
- WaterHistoryTable.jsx
- WaterHistoryTableWrapper.jsx
- TransactionsView.new.jsx
- AuthTestView.jsx
- ReceiptDemo.jsx

### Requires Careful Review
Components with partial usage or context dependencies:
- WaterBillsSimple.jsx (check ActivityView)
- WaterBillsContext.jsx (check if used by WaterBillsSimple)
- ListManagementContext.jsx (verify ListManagementView usage)

### Critical Decision Required
- Mobile PWA entire directory - needs recovery or removal decision

## File Count Summary
- **Definitely Orphaned:** 9 files
- **Semi-Orphaned:** 3 files  
- **Needs Investigation:** 4+ backend route files
- **At Risk:** Entire mobile-app directory

## Storage Impact
Removing definitely orphaned files would clean up approximately 15-20 component files and their associated imports, reducing codebase complexity and potential confusion for agents.