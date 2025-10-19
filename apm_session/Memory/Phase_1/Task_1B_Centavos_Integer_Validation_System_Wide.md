# Task Assignment for Implementation Agent

## Task Identification
- **Task ID**: Task 1B - Centavos Integer Validation System-Wide
- **Task Name**: Fix Floating Point Contamination in All Centavos Writes
- **Phase**: Credit Balance Migration & HOA Dues Refactor Preparation (Phase 1B)
- **Assigned Agent**: Implementation Agent

## Project Context

SAMS uses a centavos architecture where all financial amounts are stored as integers in Firestore to eliminate floating point precision errors. However, JavaScript's floating point math is contaminating our centavos fields with values like `3972.9999999999995` and `189978.00000000023`.

**Critical Discovery:** The schema-less nature of Firebase + lack of integer validation means floating point contamination is happening system-wide, not just in Credit Balances or Water Bills.

**Strategic Goal:** Fix this at the source in the backend before writes reach Firestore. The frontend should never have to deal with JavaScript floating point issues or Firestore's lack of field type enforcement.

## Task Requirements

### Objective
Systematically find all Firestore writes containing centavos fields and implement integer validation/rounding before the write operation.

### Specific Deliverables

1. **Backend Audit Report**
   - Complete inventory of all Firestore write operations
   - Identification of all centavos fields being written
   - Current contamination examples found in production data

2. **Integer Validation Utility**
   - `backend/utils/centavosValidation.js`
   - Function to clean floating point contamination
   - Tolerance-based rounding (within 0.2 centavos = round, beyond = error)

3. **System-Wide Implementation**
   - All CRUD operations updated with centavos validation
   - All financial calculations validated before Firestore writes
   - Zero floating point contamination in production

4. **Data Cleanup Script**
   - Clean existing contaminated data in Firestore
   - Verify all centavos fields are proper integers
   - Backup and rollback procedures

### Technical Specifications

- **Technologies**: Node.js, Firebase Admin SDK, Firestore
- **Architecture**: Backend validation layer before all Firestore writes
- **Tolerance**: Within 0.2 centavos = round to nearest integer, beyond = throw error
- **Scope**: ALL backend services, controllers, and utilities

### Guiding Notes

**Integer Validation Logic:**
```javascript
export function validateCentavos(value, fieldName) {
  // Handle null/undefined
  if (value === null || value === undefined) return 0;
  
  // Convert to number if string
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // Check if already integer
  if (Number.isInteger(numValue)) return numValue;
  
  // Check tolerance (within 0.2 centavos)
  const rounded = Math.round(numValue);
  const difference = Math.abs(numValue - rounded);
  
  if (difference <= 0.2) {
    console.warn(`Centavos rounding: ${fieldName} ${numValue} → ${rounded}`);
    return rounded;
  }
  
  // Beyond tolerance - throw error
  throw new Error(`CRITICAL: ${fieldName} floating point error: ${numValue} (difference: ${difference})`);
}
```

**Search Strategy:**
1. **Find all Firestore writes** - Search for `.set()`, `.update()`, `.add()` operations
2. **Identify centavos fields** - Look for fields ending in `Amount`, `Balance`, `Due`, `Paid`, etc.
3. **Check calculation sources** - Trace back to see where floating point math occurs
4. **Apply validation** - Wrap all centavos values before Firestore writes

**Files to Audit:**
- `backend/services/*` - All service files
- `backend/controllers/*` - All controller files  
- `backend/routes/*` - All route handlers
- `backend/utils/*` - Utility functions
- `backend/scripts/*` - Migration and utility scripts

### Dependencies

- **Requires**: Phase 1A (Credit Balance Migration) completion
- **Enables**: Clean centavos architecture for all modules
- **Affects**: ALL financial operations system-wide

### Constraints

- **Zero Breaking Changes**: All existing functionality must continue working
- **Performance**: Validation must be fast (no significant overhead)
- **Data Integrity**: Clean existing contaminated data
- **Tolerance**: 0.2 centavos rounding tolerance (practical for real-world usage)
- **Branch Workflow**: MANDATORY - All work in feature branch, never main branch

### Acceptance Criteria

- [ ] **Audit Complete**: All Firestore write operations identified and documented
- [ ] **Centavos Fields Mapped**: Complete inventory of all centavos fields in system
- [ ] **Validation Utility**: `centavosValidation.js` implemented with tolerance-based rounding
- [ ] **System-Wide Implementation**: All centavos writes validated before Firestore operations
- [ ] **Data Cleanup**: Existing contaminated data cleaned and verified
- [ ] **Testing Complete**: All financial operations tested with floating point inputs
- [ ] **Documentation**: Complete implementation guide for future centavos operations
- [ ] **Zero Contamination**: No floating point values in centavos fields in production
- [ ] **Branch Workflow**: All work completed in feature branch with proper PR process

## Resources

- **Implementation Plan**: `apm_session/Implementation_Plan.md` (Priority 0B - Phase 1B)
- **Detailed Plan**: `apm_session/CREDIT_BALANCE_HOA_REFACTOR_PLAN.md` (Phase 1B details)
- **Memory Bank**: `apm_session/Memory/Phase_1/` (create if needed)
- **Water Bills Foundation**: Reference for existing centavos patterns
- **Credit Balance Migration**: Phase 1A completion for context

## Working Instructions

### **CRITICAL: Branch Workflow Requirements**
**MANDATORY:** All development work MUST be done in feature branches, never directly in main branch.

1. **Create feature branch**: `git checkout -b feature/task-1b-centavos-validation`
2. **Commit incrementally**: Commit work every 1-2 hours to preserve progress
3. **Push regularly**: `git push origin feature/task-1b-centavos-validation`
4. **Create PR when complete**: Submit PR for Manager review before merging
5. **Never work in main**: All development in feature branch only

### **APM Workflow**
1. **Initialize as Implementation Agent**: `/apm-init implement`
2. **Load this task**: `/load-task clipboard`
3. **Begin work**: `/implement start`
4. **Log progress regularly** to Memory Bank
5. **Complete task**: `/implement complete`

## Memory Bank Logging

Create entries in: `apm_session/Memory/Phase_1/Task_1B_Centavos_Integer_Validation_Log.md`

Include:
- Audit findings (all Firestore writes identified)
- Centavos fields inventory
- Validation utility implementation decisions
- System-wide implementation approach
- Data cleanup results
- Test results with floating point inputs
- Performance impact measurements
- Any blockers or issues encountered

## Questions or Clarifications

If you need clarification:
1. Document the question in Memory Bank
2. Mark task as blocked with reason
3. Await Manager response

**Expected Duration**: 8-12 hours
**Priority**: CRITICAL (affects entire financial architecture)
**Risk Level**: LOW (backend-only changes, no frontend impact)

---

**Ready to fix floating point contamination system-wide!**
