# Mobile Owner V1 — Research Notes

**Sprint:** MOBILE-OWNER-V1  
**Date:** 2026-02-27

## R1 — Running Balance Source

Running balance is computed **server-side** in `generateStatementData.js`.

- **File:** `functions/backend/services/generateStatementData.js` lines 271-305
- **Function:** `generateLedgerData()` — cumulative `balanceCentavos` computed row-by-row, converted via `centavosToPesos()`
- **Data shape:** Each row in `lineItems[]` has a `balance` field (number, in pesos)
- **Consumed via:** `dashboard-summary` endpoint returns `lineItems[]` with running balances already computed

No client-side computation needed.

## R2 — Current Status Data Source

The `dashboard-summary` endpoint provides all data needed for the owner dashboard.

- **Endpoint:** `GET /reports/:clientId/statement/dashboard-summary?unitId=XXX`
- **Backend file:** `functions/backend/routes/reports.js` line 434
- **Backend function:** `statementDataService.buildDashboardSummary()` in `functions/backend/services/statementDataService.js`
- **Returned shape:** `{ amountDue, creditBalance, nextPaymentDueDate, nextPaymentAmount, lastPayment, owners, ownerNames, ytdMonthsPaid, ytdTotal, summary, lineItems[] }`
- Each `lineItem` has: `{ date, description, charge, payment, balance, type, isFuture }`

## R3 — Desktop Hook Reference

Desktop hook `useUnitAccountStatus` at `frontend/sams-ui/src/hooks/useUnitAccountStatus.js`:
- Calls `reportService.getDashboardSummary(clientId, unitId, null)`
- Falls back to `reportService.getStatementData()` + `deriveFromFullStatement()` if dashboard-summary fails
- Returns `{ data, loading, error }`

Mobile adaptation:
- Direct `fetch()` with `API_BASE_URL` from `config/index.js` and Firebase auth token
- Same fallback derivation logic ported inline
- No `reportService` in mobile — raw fetch only

## R4 — Auth Context Shape (Mobile)

Mobile `useAuth()` from `hooks/useAuthStable.jsx` provides:
- `samsUser` — full SAMS user profile
- `currentClient` — string clientId (NOT an object like desktop)
- `isAdmin` — boolean computed from `globalRole`
- `firebaseUser` — Firebase user object for token retrieval
- `login`, `logout`, `selectClient`

`samsUser.clientAccess[clientId]` contains:
- `.unitAssignments` — array of `{ unitId, role }` (new structure)
- `.unitId` + `.role` — legacy flat structure (backward compat)

## R5 — API Call Pattern (Mobile)

```javascript
import { config } from '../config/index.js';
import { auth } from '../services/firebase';

const token = await auth.currentUser.getIdToken();
const response = await fetch(
  `${config.api.baseUrl}/reports/${clientId}/statement/dashboard-summary?unitId=${unitId}`,
  { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
);
const json = await response.json();
// data is in json.data or json directly (check response shape)
```
