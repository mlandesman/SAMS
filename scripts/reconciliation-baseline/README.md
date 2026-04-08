# Bank reconciliation — AVII baseline snapshot (reference)

**Purpose:** One place to record **which modules** shared AVII + MTC work will touch, and how to **restore** the last known-good tree from Git **without** maintaining duplicate runtime code in the repo.

## Baseline tag

| Tag | Meaning |
|-----|--------|
| `bank-recon-avii-baseline-2026-04-07` | Annotated tag on the commit that introduced this README (code state = parent commit, identical to `origin/feature/bank-recon` at creation time). |

**If you have local, uncommitted recon fixes:** they are **not** in any tag until you commit. After you commit and push the AVII-stable state you trust:

```bash
git tag -a bank-recon-avii-baseline-YYYY-MM-DD -m "AVII-stable recon before MTC work"
git push origin bank-recon-avii-baseline-YYYY-MM-DD
```

Use a **new dated tag** rather than force-moving an old one, so history stays auditable.

## Files to treat as the shared recon surface

Restore any subset with:

```bash
git checkout bank-recon-avii-baseline-2026-04-07 -- path/to/file
```

**Backend — sessions, import, match, accept**

- `functions/backend/controllers/reconciliationController.js`
- `functions/backend/routes/reconciliations.js`
- `functions/backend/services/reconciliationMatcher.js`
- `functions/backend/services/reconciliationNormalizer.js`
- `functions/backend/services/reconciliationMatchingPool.js`
- `functions/backend/services/reconciliationAutoFixService.js`
- `functions/backend/services/reconciliationReportService.js`
- `functions/backend/services/bankParsers/index.js`
- `functions/backend/services/bankParsers/scotiabankParser.js`
- `functions/backend/services/bankParsers/bbvaParser.js`

**Backend — adjustments & accounts (shared with Accounts → reconciliation)**

- `functions/backend/controllers/accountsController.js` (includes `createReconciliationAdjustments` and related account helpers)

**Frontend — full-page workbench + API**

- `frontend/sams-ui/src/views/ReconciliationView.jsx`
- `frontend/sams-ui/src/views/ReconciliationView.css`
- `frontend/sams-ui/src/api/reconciliation.js`

**Frontend — legacy “Submit Adjustments” modal (same Bank Adjustments path)**

- `frontend/sams-ui/src/components/AccountReconciliation.jsx`
- `frontend/sams-ui/src/components/AccountReconciliation.css`

**Routing (only if recon mount changes)**

- `frontend/sams-ui/src/App.jsx` (`/reconciliation` route)

## Restore everything in the list at once

From repo root (bash):

```bash
TAG=bank-recon-avii-baseline-2026-04-07
git checkout "$TAG" -- \
  functions/backend/controllers/reconciliationController.js \
  functions/backend/routes/reconciliations.js \
  functions/backend/services/reconciliationMatcher.js \
  functions/backend/services/reconciliationNormalizer.js \
  functions/backend/services/reconciliationMatchingPool.js \
  functions/backend/services/reconciliationAutoFixService.js \
  functions/backend/services/reconciliationReportService.js \
  functions/backend/services/bankParsers/index.js \
  functions/backend/services/bankParsers/scotiabankParser.js \
  functions/backend/services/bankParsers/bbvaParser.js \
  functions/backend/controllers/accountsController.js \
  frontend/sams-ui/src/views/ReconciliationView.jsx \
  frontend/sams-ui/src/views/ReconciliationView.css \
  frontend/sams-ui/src/api/reconciliation.js \
  frontend/sams-ui/src/components/AccountReconciliation.jsx \
  frontend/sams-ui/src/components/AccountReconciliation.css \
  frontend/sams-ui/src/App.jsx
```

Then review `git diff`, run tests / `scripts/pre-pr-checks.sh`, and commit.

## Optional: tarball of tagged tree (no extra copy in the repo)

```bash
git archive --format=tar.gz -o recon-baseline.tgz bank-recon-avii-baseline-2026-04-07 \
  functions/backend/controllers/reconciliationController.js \
  functions/backend/routes/reconciliations.js \
  functions/backend/services/reconciliationMatcher.js \
  functions/backend/services/reconciliationNormalizer.js \
  functions/backend/services/reconciliationMatchingPool.js \
  functions/backend/services/reconciliationAutoFixService.js \
  functions/backend/services/reconciliationReportService.js \
  functions/backend/services/bankParsers \
  functions/backend/controllers/accountsController.js \
  frontend/sams-ui/src/views/ReconciliationView.jsx \
  frontend/sams-ui/src/views/ReconciliationView.css \
  frontend/sams-ui/src/api/reconciliation.js \
  frontend/sams-ui/src/components/AccountReconciliation.jsx \
  frontend/sams-ui/src/components/AccountReconciliation.css \
  frontend/sams-ui/src/App.jsx
```

## MTC-only code

Place **client- or format-specific** logic in **wrappers, parsers, or options** (see `Feature_Flag_Requirements.md` / wrapper pattern). Keep this baseline list updated if new shared entry points appear.
