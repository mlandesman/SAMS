# BROKEN SCRIPTS - DO NOT USE

These scripts were created as a rewrite that bypassed the backend API validation system.

## Problems with these scripts:
- Direct Firestore writes bypass backend validation
- No audit logging (missing auditLogs collection)
- No balance updates via backend
- No transaction linking through backend API
- Metadata stored in documents instead of separate collection
- Breaks all business rules validation

## What was wrong:
The working scripts called backend API endpoints like `createTransaction()` which:
- Validates all field requirements
- Writes audit logs
- Updates account balances
- Handles transaction linking
- Stores metadata properly
- Enforces business rules

These scripts bypass ALL of that by writing directly to Firestore.

## Use instead:
- `/scripts/client-onboarding/` - Contains working API-calling scripts
- These scripts call backend controllers that handle validation properly

## Date archived:
July 9, 2025

## Reason:
Complete rewrite that threw away working validation system