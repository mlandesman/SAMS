# Task Assignment: WB_DATA_FIX - Systematic Water Bills Data Architecture Fix

**Task ID:** WB_DATA_FIX  
**Priority:** 🚨 CRITICAL  
**Estimated Effort:** 4-6 hours  
**Agent Type:** Implementation Agent  
**Phase:** Priority 0A - Water Bills Critical Fixes  

## Mission Statement

**FINAL FIX:** This is our 4th pass through the same Water Bills data flow issues. We must systematically investigate and fix ALL backend aggregatedData generation and frontend consumption to achieve 100% accuracy and convention compliance. **NO MORE ITERATIONS.**

## Critical Context

**Current Problem:** Unit 105 shows $1.00 instead of $301.50+ in payment modal due to multiple backend architecture violations:
- Naming convention violations (`billAmount` vs `displayBillAmount`)
- Currency unit violations (centavos vs pesos in API responses)
- Missing penalty calculations for overdue amounts
- Frontend components using wrong field names

**Architecture Rules (MANDATORY):**
1. **Storage:** ALL amounts stored as INTEGER CENTAVOS in Firestore
2. **Backend Math:** ALL calculations performed in INTEGER CENTAVOS
3. **API Response:** ALL amounts converted to PESOS (floating point, 2 decimals)
4. **Frontend:** ALL money values received as PESOS, NO math required

**Field Naming Convention:**
- `displayFIELD_NAME` = UI-ready pesos for direct display
- Raw field names = Backend centavos for calculations ONLY when display unavailable

## Phase 1: Backend aggregatedData Investigation & Fix

### Task 1.1: Document Current aggregatedData Structure
**File:** `backend/services/waterDataService.js`  
**Objective:** Map ALL fields in aggregatedData and identify violations

**Deliverables:**
- Complete field mapping document
- Naming convention violation list
- Currency unit violation list
- Missing penalty calculation identification

**Acceptance Criteria:**
- Every field documented with intended usage
- All violations clearly identified with examples
- Root cause analysis for each violation

### Task 1.2: Fix Backend Architecture Violations
**Files:** `backend/services/waterDataService.js`, `backend/routes/waterRoutes.js`  
**Objective:** Implement correct naming conventions and currency conversions

**Required Fixes:**
1. **Naming Convention Fix:**
   - `billAmount` → `displayBillAmount` (for UI consumption)
   - Keep raw `billAmount` for backend calculations
   - Ensure ALL UI-consumable fields have `display` prefix

2. **Currency Conversion Fix:**
   - Convert ALL `display` fields from centavos → pesos at API layer
   - Ensure 2 decimal place rounding
   - Validate Unit 105 shows correct values

3. **Penalty Calculation Fix:**
   - Implement proper penalty calculations for overdue amounts
   - Ensure penalties included in `displayDue` calculation
   - Fix `displayDue = displayBillAmount + displayOverdue + displayPenalties`

**Acceptance Criteria:**
- Unit 105 shows $301.50+ in payment modal (not $1.00)
- All `display` fields contain pesos (not centavos)
- All naming conventions followed
- Zero linting errors

### Task 1.3: Comprehensive Testing & Validation
**Objective:** Verify aggregatedData is 100% accurate

**Test Cases:**
- Unit 105: Verify $301.50+ total calculation
- Multiple units with different overdue/penalty scenarios
- Edge cases: zero amounts, maximum amounts
- Currency conversion accuracy

**Acceptance Criteria:**
- All test cases pass
- Payment modal shows correct totals
- Dashboard water card shows correct amounts
- No floating point precision errors

## Phase 2: Frontend Consumption Investigation & Fix

### Task 2.1: Map Frontend aggregatedData Usage
**Files:** All Water Bills UI components  
**Objective:** Document which components use which fields

**Components to Audit:**
- `WaterPaymentModal.jsx`
- `WaterBillsList.jsx`
- `WaterHistoryGrid.jsx`
- `DashboardView.jsx` (water card)
- `WaterBillsContext.jsx`

**Deliverables:**
- Component field usage map
- Incorrect field usage identification
- Frontend math elimination plan

### Task 2.2: Fix Frontend Component Field Usage
**Objective:** Ensure all components use correct aggregatedData fields

**Required Changes:**
1. **Update Field References:**
   - Replace `billAmount` with `displayBillAmount` in UI components
   - Use `displayDue` instead of calculating totals
   - Remove any frontend currency math

2. **Eliminate Frontend Calculations:**
   - Remove any remaining frontend math on currency values
   - Ensure single source of truth compliance
   - Display values directly with formatting only

**Acceptance Criteria:**
- All components use `display` prefixed fields
- Zero frontend currency calculations
- Consistent data display across all components

## Phase 3: Payment System Validation

### Task 3.1: Audit Recent Penalty/Payment Code
**Files:** Recent commits from this week  
**Objective:** Ensure penalty calculations and payment distributions use corrected structure

**Code to Review:**
- Penalty calculation services
- Payment processing services
- Any code using aggregatedData structure

**Required Actions:**
- Update field references to use correct naming
- Ensure currency conversions are correct
- Validate calculations use proper data sources

## Success Criteria

### Technical Requirements
- ✅ Unit 105 payment modal shows $301.50+ (not $1.00)
- ✅ All `display` fields contain pesos (not centavos)
- ✅ All naming conventions followed (`display` prefix for UI)
- ✅ Zero frontend currency calculations
- ✅ Single source of truth architecture maintained

### Quality Requirements
- ✅ Zero linting errors
- ✅ All test cases pass
- ✅ Comprehensive documentation
- ✅ No breaking changes to existing functionality

### Business Requirements
- ✅ Payment decisions based on accurate totals
- ✅ Dashboard shows correct financial data
- ✅ Foundation ready for HOA Dues refactor

## Documentation Requirements

**Create Comprehensive Documentation:**
1. **Architecture Document:** Complete data flow from Firestore → Frontend
2. **Field Reference:** Every field with usage rules and examples
3. **Testing Results:** All test cases with before/after evidence
4. **Migration Guide:** For future developers

## Critical Success Factors

1. **NO MORE ITERATIONS:** This must be the final fix
2. **SYSTEMATIC APPROACH:** Document everything before fixing
3. **COMPREHENSIVE TESTING:** Verify all scenarios work
4. **ARCHITECTURE COMPLIANCE:** Zero violations of centavos→pesos rules

## Files to Modify

**Backend:**
- `backend/services/waterDataService.js` (primary)
- `backend/routes/waterRoutes.js` (API conversion layer)
- `backend/controllers/waterBillsController.js` (if needed)

**Frontend:**
- `frontend/sams-ui/src/components/water/WaterPaymentModal.jsx`
- `frontend/sams-ui/src/components/water/WaterBillsList.jsx`
- `frontend/sams-ui/src/components/water/WaterHistoryGrid.jsx`
- `frontend/sams-ui/src/views/DashboardView.jsx`
- `frontend/sams-ui/src/context/WaterBillsContext.jsx`

## Testing Strategy

1. **Unit Testing:** Individual field calculations
2. **Integration Testing:** Full payment modal flow
3. **Regression Testing:** All existing functionality
4. **User Acceptance:** Manual verification of Unit 105

## Risk Mitigation

- **Backup:** Document current state before changes
- **Incremental:** Fix one component at a time
- **Validation:** Test after each major change
- **Rollback:** Keep ability to revert if issues arise

---

**This task assignment represents our FINAL attempt to fix Water Bills data flow. Success here enables us to move forward with HOA Dues refactor and Statement of Account development.**
