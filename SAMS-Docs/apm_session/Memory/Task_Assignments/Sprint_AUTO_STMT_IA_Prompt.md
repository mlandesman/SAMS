# Sprint AUTO-STMT: Automated Monthly Statement Generation

## Sprint Overview

**Goal:** Add a scheduled Cloud Function that runs on the 1st of each month to automatically generate Statements of Account for all units across all clients, in both English and Spanish, store them in Firebase Storage, and index them in Firestore so they appear in the Mobile app's stored statements list.

**Deadline:** Must be deployed before April 1, 2026 (to generate March 2026 statements).

**Estimated Effort:** 4-6 hours  
**GitHub Issue:** TBD (create during implementation)

---

## Critical Rules

1. **ES6 modules only** — `import`/`export`, never `require`/`module.exports`
2. **Use `getNow()` from DateService** — never `new Date()`
3. **America/Cancun timezone** — all date logic must respect this
4. **Do not modify existing bulk generation logic** — extract and reuse, don't refactor

---

## Context: Existing Code

The "Generate All" button on the desktop SoA tab already does everything we need:

- **Frontend trigger:** `StatementOfAccountTab.jsx` → `bulkGenerateStatements()` from `api/admin.js`
- **API endpoint:** `POST /admin/bulk-statements/generate` (body: `{ clientId, language }`)
- **Backend handler:** `bulkStatementController.js` → `bulkGenerateStatements(req, res)`
- **Core flow:** Load units → For each unit: generate HTML → generate PDF → upload to Storage → write Firestore metadata
- **Storage path:** `clients/{clientId}/accountStatements/{fiscalYear}/{YYYY-MM-unitId-LANG.PDF}`
- **Firestore collection:** `clients/{clientId}/accountStatements/{docId}` with fields: `unitId`, `calendarYear`, `calendarMonth`, `fiscalYear`, `fiscalMonth`, `language`, `storagePath`, `fileName`, `storageUrl`, `reportGenerated`, `generatedBy`, `isPublic`
- **Mobile app query:** `where('unitId', '==', selectedUnitId)` + `orderBy('calendarYear', 'desc')` + `orderBy('calendarMonth', 'desc')`

The **Nightly Scheduler** (`functions/scheduled/nightlyScheduler.js`) runs at 3:00 AM America/Cancun daily and already orchestrates backup, exchange rates, dev sync, and monthly credit auto-pay reports.

---

## Task Breakdown

### STMT-1: Extract Core Generation Logic (1-2h)

Extract the core statement generation loop from `bulkGenerateStatements()` into a reusable function that doesn't depend on `req`/`res` Express objects.

**Create:** `functions/backend/services/scheduledStatementService.js`

```javascript
export async function generateMonthlyStatements(options = {}) {
  // options: { dryRun, forceDate }
  // 1. Determine the statement period (prior month)
  //    - Running on Apr 1 → generates for March 2026
  //    - Use getNow() to get current date, subtract 1 month for the statement period
  // 2. Get all active clients from Firestore
  // 3. For each client:
  //    a. Get all units
  //    b. For each unit, for each language (english, spanish):
  //       - Generate statement data (statementHtmlService)
  //       - Generate PDF (pdfService)
  //       - Upload to Storage (existing uploadToStorage)
  //       - Write metadata to Firestore (existing storeStatementMetadata)
  //    c. Log progress
  // 4. Return summary { clientsProcessed, unitsProcessed, statementsGenerated, errors }
}
```

**Key naming rule:** When running on the 1st of month N, the statement period is month N-1. The `calendarMonth` and `calendarYear` in metadata must reflect the prior month, not the current month.

**Important:** Reuse the existing `generatePdfForUnit()`, `uploadToStorage()`, and `storeStatementMetadata()` functions from `bulkStatementController.js`. If they are not already exported, export them.

### STMT-2: Add to Nightly Scheduler (1h)

Add TASK 5 to `nightlyScheduler.js` that runs only on the 1st of the month (same pattern as TASK 4 which runs on day 25).

```javascript
// TASK 5: Monthly Statement Generation
// Runs on the 1st of each month (Cancun time)
if (dayOfMonth === 1) {
  // Call generateMonthlyStatements()
  // Log results to the nightly scheduler run document
}
```

**Memory/timeout considerations:**
- The nightly scheduler currently has 1GiB memory and 540s timeout
- Generating PDFs for ~50 units × 2 languages = ~100 PDFs
- This may require increasing memory to 2GiB and timeout to 900s
- Alternatively, if it exceeds limits, create a separate scheduled function

**Secrets:** The bulk statement controller uses PDFShift for PDF generation. Check if `PDFSHIFT_API_KEY` needs to be added to the scheduler's secrets array.

### STMT-3: Handle Edge Cases (1h)

- **Duplicate prevention:** Before generating, check if statements for this client/unit/month/language already exist in Firestore. Skip if found (idempotent).
- **Error isolation:** If one unit fails, log the error and continue with the next unit. Don't let a single failure stop the entire run.
- **New clients:** Get the client list dynamically from Firestore (not hardcoded).
- **Empty units:** Skip units with no owners/no billing history.

### STMT-4: Testing + Deployment (1-2h)

- Test locally by calling `generateMonthlyStatements()` directly
- Verify statements appear in the mobile app's stored statements list
- Verify both EN and ES versions are generated and indexed
- Verify the naming convention: running in March generates February statements
- Deploy and verify the scheduler config in Firebase Console

---

## Acceptance Criteria

1. On the 1st of each month at ~3:00 AM Cancun time, statements are auto-generated
2. Both English and Spanish versions are generated for every unit
3. Statements are named for the prior month (running Apr 1 → March 2026 statements)
4. PDFs are uploaded to `clients/{clientId}/accountStatements/{fiscalYear}/` in Storage
5. Metadata is written to `clients/{clientId}/accountStatements/` in Firestore
6. Statements appear in the Mobile app's "Stored Statements" section for each unit
7. Duplicate statements are not created on re-runs (idempotent)
8. The `generatedBy` field indicates "scheduled" or "system" (not a user email)
9. Results are logged in the nightly scheduler run document

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `functions/backend/services/scheduledStatementService.js` |
| MODIFY | `functions/scheduled/nightlyScheduler.js` (add TASK 5) |
| MODIFY | `functions/backend/controllers/bulkStatementController.js` (export helper functions if needed) |

---

## Pre-PR Checklist

- [ ] `bash scripts/pre-pr-checks.sh main` passes
- [ ] No `new Date()` — only `getNow()`
- [ ] ES6 modules only
- [ ] Tested with at least one client's data
- [ ] Mobile app shows generated statements
- [ ] BugBot cycle until clean
