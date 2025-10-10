# Client Onboarding Checklist

This checklist ensures safe and successful client data import into SAMS production.

## Pre-Import Preparation

### 1. Client Setup in SAMS
- [ ] **Create client via Client Management system**
  - Client name, code, email address configured
  - Basic settings and preferences set
  - Client accessible in SAMS interface

### 2. Data Preparation
- [ ] **All 7 required data files present**
  - Categories.json
  - Vendors.json  
  - Units.json
  - UnitSizes.json
  - Transactions.json
  - HOADues.json
  - AutoCategorize.json

- [ ] **Data format validation completed**
  ```bash
  node scripts/client-onboarding/validate-client-data.js --client CLIENTID --data-dir /path/to/data
  ```

- [ ] **Data quality checks passed**
  - No missing required fields
  - Valid date formats (YYYY-MM-DD)
  - Consistent UnitIDs across files
  - Valid email addresses
  - Categories/Vendors referenced in transactions exist

### 3. Production Backup
- [ ] **Complete production backup created**
  ```bash
  node scripts/client-onboarding/backup-before-import.js --client CLIENTID
  ```

- [ ] **Backup verification completed**
  - Backup file created and accessible
  - Backup metadata logged
  - Rollback procedures tested

## Import Process

### 4. Dry Run Validation
- [ ] **Dry run import completed successfully**
  ```bash
  node scripts/client-onboarding/import-client-data.js --client CLIENTID --data-dir /path/to/data --dry-run
  ```

- [ ] **Dry run results reviewed**
  - No critical errors reported
  - Data volume matches expectations
  - Import time estimates acceptable

### 5. Production Import
- [ ] **Import timing confirmed**
  - Import scheduled during off-peak hours
  - No other maintenance activities planned
  - Key stakeholders notified

- [ ] **Import execution**
  ```bash
  node scripts/client-onboarding/import-client-data.js --client CLIENTID --data-dir /path/to/data
  ```

- [ ] **Import monitoring**
  - Progress monitored in real-time
  - Error rates within acceptable limits (<5%)
  - System performance stable during import

### 6. Import Sequence Verification
- [ ] **Categories imported** (dependencies first)
- [ ] **Vendors imported** (dependencies first)
- [ ] **Units and UnitSizes imported** (property structure)
- [ ] **AutoCategorize rules imported** (processing logic)
- [ ] **Transactions imported** (main financial data)
- [ ] **HOADues imported** (linked data)

## Post-Import Validation

### 7. Data Verification
- [ ] **Record counts verified**
  - Categories: Expected vs Actual count
  - Vendors: Expected vs Actual count  
  - Units: Expected vs Actual count
  - Transactions: Expected vs Actual count
  - HOADues: Expected vs Actual count

- [ ] **Data integrity checks**
  ```bash
  node scripts/client-onboarding/validate-client-data.js --client CLIENTID --verify-import
  ```

- [ ] **Sample data verification**
  - Random sample of transactions reviewed
  - Unit ownership data verified
  - HOA dues calculations checked

### 8. System Functionality Testing
- [ ] **Client access verified**
  - Client selectable in interface
  - Data displays correctly
  - No error messages in console

- [ ] **Core features tested**
  - Transaction viewing and filtering
  - Report generation
  - Unit management access
  - Category and vendor lists

- [ ] **Financial calculations verified**
  - Account balances correct
  - HOA dues calculations accurate
  - Report totals match expected values

### 9. Performance Verification
- [ ] **System performance stable**
  - Response times normal
  - No memory issues detected
  - Other clients unaffected

- [ ] **Database performance**
  - Query performance acceptable
  - No index issues detected
  - Storage usage within limits

## Final Steps

### 10. Documentation and Cleanup
- [ ] **Import results documented**
  - Final record counts logged
  - Any issues encountered documented
  - Import timing and performance metrics recorded

- [ ] **Audit trail completed**
  - All import activities logged
  - User access events recorded
  - System changes documented

- [ ] **Cleanup tasks completed**
  - Temporary files removed
  - Import scripts output archived
  - Backup files properly stored

### 11. User Access and Training
- [ ] **User accounts created**
  - Client administrators identified
  - User accounts created in Firebase Auth
  - Permissions assigned correctly

- [ ] **Initial user training scheduled**
  - System access instructions provided
  - Basic navigation training planned
  - Support contact information shared

## Rollback Procedures (If Needed)

### Emergency Rollback Steps
1. **Stop all import processes immediately**
2. **Assess impact and data integrity**
3. **Execute rollback procedure**
   ```bash
   node scripts/client-onboarding/rollback-client-import.js --client CLIENTID --backup-id BACKUP_ID
   ```
4. **Verify system stability after rollback**
5. **Document rollback reasons and lessons learned**

### When to Consider Rollback
- Error rate exceeds 5% during import
- Critical data integrity issues discovered
- System performance severely impacted
- Import process hangs or fails repeatedly

## Import Performance Benchmarks

### Expected Import Times
- **Small client** (< 1,000 records): 5-15 minutes
- **Medium client** (1,000-5,000 records): 15-30 minutes
- **Large client** (5,000+ records): 30-60 minutes

### Success Criteria
- Import completion rate > 95%
- Error rate < 5%
- System performance impact < 10%
- Post-import validation 100% pass rate

## Support and Escalation

### Internal Support
- **Primary Contact**: System Administrator
- **Technical Support**: Development Team
- **Business Support**: Client Relations

### Escalation Triggers
- Import fails repeatedly (3+ attempts)
- Data integrity issues discovered
- System performance severely impacted
- Client access issues persist post-import

## Sign-off

### Import Completion Sign-off
- [ ] **Technical Lead Approval**
  - Import completed successfully
  - All technical validations passed
  - System performance stable

- [ ] **Business Lead Approval**  
  - Data accuracy verified
  - Client requirements met
  - Ready for user access

- [ ] **Client Administrator Approval**
  - System access confirmed
  - Initial testing completed
  - Ready for operational use

---

**Import Date**: _________________  
**Client ID**: ___________________  
**Completed By**: _______________  
**Approved By**: _______________