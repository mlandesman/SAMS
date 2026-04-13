---
memory_log_path: /Users/michael/Projects/SAMS/SAMS-Docs/apm_session/Memory/Task_Completion_Logs/PROD_HOTFIX_Recon_Upload_RawBody_Busboy_2026-04-13.md
task_id: PROD-HOTFIX-RECON-UPLOAD-RAWBODY
status: Complete
branch: fix/recon-upload-rawbody-busboy
---

# PROD Hotfix Completion Log — Reconciliation Upload RawBody Busboy

## Root-cause rationale

Production upload failures (`Unexpected end of form`) were caused by multipart parsing behavior across Firebase/Cloud Run request handling. The import route depended on Multer stream parsing and a JSON/base64 fallback path, which is fragile for this transport mismatch and increases complexity/risk.  

The fix uses route-local Busboy parsing over `req.rawBody` (already buffered by platform) so parsing is deterministic and does not rely on live stream integrity in this endpoint.

## Files changed and why

1. `functions/backend/routes/reconciliations.js`
   - Replaced Multer-based parser on `POST /clients/:clientId/reconciliations/:sessionId/import` with rawBody Busboy parser.
   - Added strict contract validation:
     - `bankFile` required, max 1
     - `statementPdf` optional, max 1
     - reject unknown file fields
     - reject empty bank file
   - Added typed 400 responses:
     - `UPLOAD_PARSE_FAILED`
     - `UPLOAD_MISSING_BANK_FILE`
     - `UPLOAD_INVALID_FIELD`
     - `UPLOAD_TOO_MANY_FILES`
     - `UPLOAD_EMPTY_FILE`
   - Added structured upload observability logs (attempt / parsed / failed) with metadata only.
   - Preserved existing auth and `requirePermission('accounts.manage')` gates and existing controller contract (`req.files` shape).

2. `functions/package.json`
3. `functions/package-lock.json`
4. `functions/backend/package.json`
5. `functions/backend/package-lock.json`
   - Added direct `busboy` dependency for deploy/runtime consistency in both package scopes used in this repository.

## Frontend cleanup status

`frontend/sams-ui/src/api/reconciliation.js` currently already uses a single multipart upload path (no JSON/base64 fallback remains), so no additional frontend change was required in this hotfix branch.

## Before/after parser behavior

### Before
- Route used Multer stream parsing and supported JSON/base64 fallback behavior.
- Malformed/truncated multipart paths could surface as `Unexpected end of form` in production transport.

### After
- Route parses multipart payload via Busboy using `req.rawBody`.
- Single upload contract path; no JSON/base64 fallback behavior needed.
- Parsing/contract errors return typed 400 responses with explicit error codes.
- Upload metadata is logged structurally without file content.

## Test evidence

### 1) Required quality gate
Command:
```bash
bash scripts/pre-pr-checks.sh main
```
Observed:
- `No frontend changes detected. Skipping checks.`

### 2) Parser manual validation — bank file only
Command (Node smoke test invoking route-local `importUploadParser` with multipart rawBody):
```bash
node - <<'EOF'
// omitted in log; executed in session
EOF
```
Observed key output:
- `BANK_ONLY_FILES {"bankFile":[{"originalname":"bank.csv","mimetype":"text/csv","size":30}],"statementPdf":[]}`
- Parser log stage `parsed` with route/client/session/content-type/content-length/rawBody metadata.

### 3) Parser manual validation — bank file + PDF
Observed key output:
- `BANK_PLUS_PDF_FILES {"bankFile":[{"originalname":"bank.csv","mimetype":"text/csv","size":30}],"statementPdf":[{"originalname":"statement.pdf","mimetype":"application/pdf","size":15}]}`

### 4) Typed error contract validation
Observed key outputs:
- Missing bank file:
  - status `400`
  - code `UPLOAD_MISSING_BANK_FILE`
- Unknown field:
  - status `400`
  - code `UPLOAD_INVALID_FIELD`
- Empty bank file:
  - status `400`
  - code `UPLOAD_EMPTY_FILE`
- Too many `bankFile` uploads:
  - status `400`
  - code `UPLOAD_TOO_MANY_FILES`

### 5) Syntax safety checks
Commands:
```bash
node --check functions/backend/routes/reconciliations.js
node --check frontend/sams-ui/src/api/reconciliation.js
```
Observed:
- Both commands completed without syntax errors.

## Risks / known limitations

- End-to-end authenticated `curl` against deployed endpoint was not executed in this session due auth/token context; parser behavior was validated directly through the route middleware with real multipart rawBody payload generation.
- Global middleware comments and Multer error handlers still exist for other upload routes; this change is intentionally scoped only to reconciliation import.

## Acceptance criteria mapping

- Reconciliation import no longer depends on Multer stream parsing for this route: ✅
- Route parses multipart via Busboy + `req.rawBody`: ✅
- Single upload pathway (frontend fallback removed/already absent): ✅
- Typed 400 parser/validation errors: ✅
- `pre-pr-checks.sh main` executed and documented: ✅
- No reconciliation business logic changes: ✅
