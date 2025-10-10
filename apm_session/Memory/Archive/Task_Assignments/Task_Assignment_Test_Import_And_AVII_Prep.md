# Task Assignment - Test Import System and Prepare AVII for Parallel Production

**Date:** September 29, 2025  
**Priority:** HIGH - Production Preparation  
**Estimated Effort:** 1-2 Implementation Agent sessions  
**Agent Type:** Implementation Agent
**Branch:** Use current branch `fix-transaction-date-timezone`

---

## Task Overview

Test the modernized import system with MTC data in the development environment, then prepare AVII for parallel production use alongside Google Sheets. This involves selective purging, importing current data, and validating the results.

**Goals:**
1. Verify selective purge/import works correctly with MTC data
2. Load AVII data for near-production parallel testing
3. Validate data integrity and cross-references
4. Document any issues or adjustments needed

---

## Phase 1: Test MTC Import in Dev (0.5 sessions)

### Task 1.1: Prepare for MTC Test

**Check current environment:**
```bash
cd /scripts/client-onboarding
echo $FIRESTORE_ENV  # Should be 'dev'
```

**Review available data:**
```bash
ls -la /MTCdata/*.json
```

### Task 1.2: Selective Purge MTC Variable Data

**Purge only variable data (preserve users and config):**
```bash
# Dry run first to see what will be deleted
node purge-prod-client-selective.js --client MTC --only transactions,hoadues,units --dry-run

# If looks correct, run actual purge
node purge-prod-client-selective.js --client MTC --only transactions,hoadues,units
```

### Task 1.3: Import MTC Variable Data

**Import using selective import:**
```bash
# Import units, transactions, and HOA dues
./run-complete-import-selective.sh MTC --only units,transactions,hoadues
```

**Note:** The system will automatically handle dependencies (categories, vendors, etc.)

### Task 1.4: Validate MTC Import

**Run validation script:**
```bash
node validate-hoa-transaction-links.js --client MTC
```

**Manual checks:**
1. Check Firebase Console for data integrity
2. Verify transaction IDs follow correct format
3. Confirm HOA dues payments are linked to transactions
4. Check credit balances are accurate

### Acceptance Criteria - Phase 1
- [ ] MTC variable data successfully purged
- [ ] MTC data imported without errors
- [ ] HOA-Transaction links validated
- [ ] No data corruption detected
- [ ] Credit balances match expected values

---

## Phase 2: Prepare AVII Data (0.5 sessions)

### Task 2.1: Locate AVII Data

**Check for existing AVII data:**
```bash
# Look for AVIIdata directory
ls -la /AVIIdata/
# Or check other locations mentioned in scripts
ls -la ../../AVIIdata/
```

**If AVII data doesn't exist:**
- Request current AVII export from Google Sheets
- Follow same JSON format as MTCdata

### Task 2.2: Review AVII Data Structure

**Examine AVII data files:**
```bash
# Check structure matches expected format
head -20 AVIIdata/Transactions.json
head -20 AVIIdata/HOADues.json
head -20 AVIIdata/Units.json
```

**Document any differences from MTC structure**

### Task 2.3: Create AVII Import Plan

**Consider AVII-specific requirements:**
1. Different unit structure or naming?
2. Different HOA dues amounts?
3. Special categories or vendors?
4. Unique business rules?

### Acceptance Criteria - Phase 2
- [ ] AVII data located and accessible
- [ ] Data structure reviewed and documented
- [ ] Any AVII-specific requirements identified
- [ ] Import plan created

---

## Phase 3: Import AVII for Parallel Production (0.5 sessions)

### Task 3.1: Selective Purge AVII Data

**IMPORTANT:** Be extra careful since this will be used for parallel production

```bash
# Dry run to verify
node purge-prod-client-selective.js --client AVII --skip-users --skip-clients --dry-run

# Purge all except users and client config
node purge-prod-client-selective.js --client AVII --skip-users --skip-clients
```

### Task 3.2: Import AVII Data

```bash
# Full import except users (they should already exist)
./run-complete-import-selective.sh AVII ../../AVIIdata --skip-users
```

### Task 3.3: Validate AVII Import

**Run comprehensive validation:**
```bash
node validate-hoa-transaction-links.js --client AVII
```

**Production readiness checks:**
1. Verify all transactions imported correctly
2. Check HOA dues payments and balances
3. Confirm unit ownership information
4. Test credit balance calculations
5. Verify running balances

### Task 3.4: Document Results

Create report: `AVII_IMPORT_VALIDATION_REPORT.md`

Include:
- Import statistics (counts, success rates)
- Any data anomalies found
- Validation results
- Readiness for parallel production
- Recommended monitoring points

### Acceptance Criteria - Phase 3
- [ ] AVII data successfully imported
- [ ] All validations pass
- [ ] No data integrity issues
- [ ] Documentation complete
- [ ] Ready for parallel production testing

---

## Phase 4: Create Ongoing Import Process (0.5 sessions)

### Task 4.1: Create Import Scripts for Regular Updates

**Create wrapper scripts for easy execution:**

`scripts/client-onboarding/update-avii-from-sheets.sh`:
```bash
#!/bin/bash
# Script to update AVII data from Google Sheets export

echo "Updating AVII data from Google Sheets export..."
echo "This will preserve users and client configuration"

# Add safety checks and logging
```

### Task 4.2: Document Parallel Operation Process

Create: `PARALLEL_OPERATION_GUIDE.md`

Document:
1. How to export from Google Sheets
2. How to run selective import
3. What to check after import
4. How to handle discrepancies
5. Rollback procedures if needed

### Task 4.3: Set Up Monitoring

**Create comparison queries:**
- Transaction counts between systems
- HOA dues payment totals
- Credit balance comparisons
- Monthly collection summaries

### Acceptance Criteria - Phase 4
- [ ] Update scripts created
- [ ] Process documented
- [ ] Monitoring queries defined
- [ ] Team can run updates independently

---

## Important Considerations

### Data Integrity
- Always run dry-run before actual purge
- Validate after every import
- Keep backups of Google Sheets data

### Parallel Operation
- AVII will run in SAMS while maintaining Google Sheets
- Need to track which is source of truth
- Plan for eventual cutover

### Testing Priorities
1. Transaction integrity
2. HOA payment linking
3. Credit balance accuracy
4. Running balance calculations

---

## Success Metrics

- Zero data loss during import
- All HOA payments correctly linked to transactions
- Credit balances match Google Sheets
- System ready for parallel production use
- Clear process for ongoing updates

---

## Next Steps After Completion

1. Begin parallel operation with AVII
2. Monitor for discrepancies
3. Gather user feedback
4. Plan for full production cutover
5. Consider automating the import process

Start with Phase 1 to test the system with MTC data before moving to AVII production preparation.