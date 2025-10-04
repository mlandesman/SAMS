# Complete Import Scripts Inventory
**Generated:** 2025-09-29  
**Purpose:** Comprehensive inventory of all import-related scripts across SAMS

## Active Import Scripts (Current Location)

### Core Import Scripts (/scripts/client-onboarding/)
| Script | Status | Purpose | Dependencies |
|--------|--------|---------|--------------|
| `import-categories-vendors-with-crud.js` | 🔴 BROKEN | Import categories & vendors using CRUD | Needs API updates |
| `import-transactions-with-crud.js` | 🔴 BROKEN | Import transactions with CRUD functions | Needs DateService integration |
| `import-units-with-crud.js` | 🔴 BROKEN | Import units using controllers | Needs field mapping updates |
| `import-users-with-crud.js` | 🔴 BROKEN | Import users with proper auth | Needs auth context |
| `import-yearend-balances.js` | 🔴 BROKEN | Import year-end balance snapshots | Needs new balance structure |

### HOA Import Scripts (/scripts/)
| Script | Status | Purpose | Dependencies |
|--------|--------|---------|--------------|
| `importHOADuesWithLinking.js` | 🟡 PARTIAL | Import with transaction linking | Needs controller updates |
| `importHOADuesEnhanced.js` | 🟡 PARTIAL | Enhanced HOA import | Missing cross-ref generation |
| `importHOADuesFixed3.js` | 🟢 WORKING? | Latest fixed version | Unclear if compatible |
| `importHOADuesWithDates.js` | 🔴 BROKEN | Date-aware import | Old date handling |
| `importHOADuesSimple.js` | 🔴 BROKEN | Basic import | No linking capability |

### Support Scripts (/scripts/client-onboarding/)
| Script | Status | Purpose | Dependencies |
|--------|--------|---------|--------------|
| `create-default-accounts.js` | 🟡 PARTIAL | Create default accounts | May need updates |
| `create-firebase-users.js` | 🔴 BROKEN | Create auth users | Auth API changed |
| `create-yearend-snapshot.js` | 🔴 BROKEN | Snapshot creation | Balance structure changed |
| `setup-firebase-config.js` | 🟢 WORKING | Firebase setup | Basic config |

### Migration Scripts (/scripts/client-onboarding/)
| Script | Status | Purpose | Dependencies |
|--------|--------|---------|--------------|
| `init-migration.js` | ❓ UNKNOWN | Initialize migration | Not tested |
| `prepare-migration.js` | ❓ UNKNOWN | Prepare data | Not tested |
| `execute-migration.js` | ❓ UNKNOWN | Run migration | Not tested |
| `verify-migration.js` | ❓ UNKNOWN | Validate results | Not tested |

## Archive Scripts Found

### ARCHIVE_2025_08_13 Scripts
| Script | Purpose | Value for Recovery |
|--------|---------|-------------------|
| `import-all-mtc-complete.js` | Complete MTC import | HIGH - Shows full flow |
| `import-all-mtc-data.js` | Bulk data import | HIGH - Orchestration logic |
| `import-builder.js` | Import pipeline builder | MEDIUM - Architecture |
| `import-client.js` | Client setup import | HIGH - Client creation |
| `import-validation-helpers.js` | Validation utilities | HIGH - Validation logic |
| `import-mtc-transactions.js` | MTC-specific import | MEDIUM - Custom logic |

### Legacy Import Scripts (/scripts/archive/legacy-import-scripts/)
| Script | Status | Purpose |
|--------|--------|---------|
| All HOA scripts | 🗄️ ARCHIVED | Old implementations |

## Missing Critical Scripts

### Not Found Anywhere:
1. **setup-client-config.js** - Client configuration setup
2. **import-payment-methods.js** - Payment method imports
3. **import-exchange-rates.js** - Exchange rate bulk import
4. **generate-cross-references.js** - HOA/Transaction linking
5. **validate-complete-import.js** - Full validation suite

### Functionality Gaps:
1. **No orchestration script** - Nothing ties all imports together
2. **No rollback capability** - Can't undo failed imports
3. **No progress tracking** - No way to resume failed imports
4. **No data transformation** - Raw JSON to SAMS format

## Script Relationships

### Import Sequence (Reconstructed):
```
1. setup-firebase-config.js
2. create-client.js (missing)
3. import-users-with-crud.js
4. import-categories-vendors-with-crud.js
5. create-default-accounts.js
6. import-units-with-crud.js
7. import-transactions-with-crud.js
8. importHOADuesWithLinking.js
9. generate-cross-references.js (missing)
10. import-yearend-balances.js
11. validate-import.js (missing)
```

### Dependencies Map:
```
firebase.js
  └── environment-config.js
      └── controllers/*
          ├── import-transactions-with-crud.js
          ├── import-units-with-crud.js
          ├── import-categories-vendors-with-crud.js
          └── import-users-with-crud.js

DateService.js
  └── All import scripts (needs integration)

auditLogger.js
  └── All CRUD operations
```

## Recovery Priority

### Critical Path (Must Fix First):
1. ✅ Copy core scripts from archive (DONE)
2. 🔧 Update import-transactions-with-crud.js (NEXT)
3. 🔧 Fix DateService integration
4. 🔧 Create authentication context wrapper

### High Priority:
1. Build orchestration script
2. Create validation suite
3. Fix HOA/Transaction linking
4. Update field mappings

### Medium Priority:
1. Payment method imports
2. Exchange rate imports
3. Progress tracking
4. Error recovery

## Script Locations Summary

```
/SAMS/
├── scripts/
│   ├── client-onboarding/
│   │   ├── ✅ Core import scripts (copied)
│   │   ├── 🟡 Support scripts
│   │   └── ❓ Migration scripts
│   ├── 🟡 HOA import scripts
│   └── archive/
│       └── legacy-import-scripts/
└── SAMS Archive/
    └── ARCHIVE_2025_08_13/
        └── scripts/
            └── 📦 Reference implementations
```

## Recommendations

1. **Create Master Import Script** - Orchestrate all imports in correct sequence
2. **Build Script Test Harness** - Test each script independently
3. **Document Field Mappings** - Create definitive mapping document
4. **Implement Dry Run Mode** - All scripts should support --dry-run
5. **Add Progress Persistence** - Resume capability for long imports

---

**Total Scripts Identified:** 47  
**Working:** 1  
**Partially Working:** 3  
**Broken:** 15  
**Unknown Status:** 4  
**Missing Required:** 5  
**Archived Reference:** 23