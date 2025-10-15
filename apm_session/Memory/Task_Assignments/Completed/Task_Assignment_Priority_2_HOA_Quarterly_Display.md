---
task_id: HOA-Quarterly-Display-Priority-2
priority: 🔥 HIGH (Priority 2 - Foundation for Statement of Account)
agent_type: Implementation Agent
status: READY_FOR_ASSIGNMENT
created: 2025-10-14
approved_by: Manager Agent
approval_date: 2025-10-14
estimated_effort: 4-5 hours
memory_log_path: apm_session/Memory/Task_Completion_Logs/Priority_2_HOA_Quarterly_Display_2025-10-14.md
dependencies: 
  - Priority 1: Water Bills Split Transactions (COMPLETE)
  - Fiscal Year Support (COMPLETE - existing)
  - Client Configuration System (COMPLETE - existing)
enables:
  - Priority 3: HOA Penalties (works with quarterly display)
  - Priority 4: Statement of Account Report (quarterly view for AVII)
parallel_work: Can run in parallel with Priority 1B (frontend vs backend)
---

# Task Assignment: Priority 2 - HOA Dues Quarterly Collection Display

## Objective
Implement quarterly display/grouping logic for HOA Dues when client is configured for quarterly billing (AVII). Data still stored monthly (required for penalties), but displayed in quarterly groups.

## Strategic Context

### Foundation Chain for Statement of Account
1. ✅ **Priority 1:** Water Bills Split Transactions - COMPLETE
2. 🔄 **Priority 1B:** Water Bills Cascade Delete - In Progress (backend)
3. 🎯 **Priority 2:** HOA Quarterly Display - THIS TASK (frontend)
4. ⏭️ **Priority 3:** HOA Penalties - Next
5. ⏭️ **Priority 4:** Statement of Account - Goal

**Why Now:** Statement of Account needs quarterly view for AVII client reports. Can run in parallel with Priority 1B since this is pure frontend, Priority 1B is pure backend.

---

## Business Context

### AVII Client Requirement
- **Billing Frequency:** Quarterly (not monthly like MTC)
- **Quarters:** Jul-Sep, Oct-Dec, Jan-Mar, Apr-Jun (fiscal year based)
- **Payment Expectation:** Full quarter payment (3 months) at once
- **Storage:** Still monthly (required for penalty calculations)
- **Display:** Group by quarters

### MTC Client Requirement
- **Billing Frequency:** Monthly
- **Display:** Current monthly view (no changes)
- **Behavior:** Should not be affected by this task

---

## Key Architecture Decision

**Configuration-Driven Display Logic:**
```javascript
// Read from client config
const duesFrequency = config.feeStructure.duesFrequency; // "monthly" or "quarterly"

if (duesFrequency === "quarterly") {
  // Display quarterly groups
} else {
  // Display monthly (current behavior)
}
```

**Critical:** Data still stored monthly - this is DISPLAY ONLY logic.

---

## Implementation Approach

### Phase 1: Configuration Reading (1 hour)

#### Step 1.1: Client Config Integration
- **File:** Frontend HOA Dues component
- **Read:** `/clients/{clientId}/config.feeStructure.duesFrequency`
- **Values:** "monthly" (default) or "quarterly"
- **Fallback:** If not set, assume "monthly"

#### Step 1.2: Fiscal Year Calendar
Already exists in system:
- Fiscal year: July 1 - June 30
- Q1: Jul-Sep (months 0-2)
- Q2: Oct-Dec (months 3-5)
- Q3: Jan-Mar (months 6-8)
- Q4: Apr-Jun (months 9-11)

---

### Phase 2: Quarterly Display Logic (2-3 hours)

#### Step 2.1: Group Monthly Data by Quarter
Transform monthly dues data into quarterly groups:

```javascript
function groupByQuarter(monthlyDuesData) {
  const quarters = [
    { name: 'Q1 (Jul-Sep)', months: [0, 1, 2], data: [] },
    { name: 'Q2 (Oct-Dec)', months: [3, 4, 5], data: [] },
    { name: 'Q3 (Jan-Mar)', months: [6, 7, 8], data: [] },
    { name: 'Q4 (Apr-Jun)', months: [9, 10, 11], data: [] }
  ];
  
  // Group months into quarters
  monthlyDuesData.forEach((monthData, index) => {
    const quarter = Math.floor(index / 3);
    quarters[quarter].data.push(monthData);
  });
  
  // Calculate quarter totals
  quarters.forEach(q => {
    q.totalDue = q.data.reduce((sum, m) => sum + m.scheduledAmount, 0);
    q.totalPaid = q.data.reduce((sum, m) => sum + m.paidAmount, 0);
    q.status = q.totalPaid >= q.totalDue ? 'paid' : 
                q.totalPaid > 0 ? 'partial' : 'unpaid';
  });
  
  return quarters;
}
```

#### Step 2.2: Quarterly Table View
Replace monthly rows with quarterly rows when `duesFrequency === "quarterly"`:

**Monthly View (MTC):**
```
| Month     | Amount Due | Paid | Status  |
|-----------|------------|------|---------|
| July 2025 | $400       | $400 | PAID    |
| Aug 2025  | $400       | $0   | UNPAID  |
```

**Quarterly View (AVII):**
```
| Quarter        | Amount Due | Paid  | Status   |
|----------------|------------|-------|----------|
| Q1 (Jul-Sep)   | $1,200     | $1,200| PAID     |
| Q2 (Oct-Dec)   | $1,200     | $400  | PARTIAL  |
```

#### Step 2.3: Expandable Quarter Details (Optional Enhancement)
When user clicks quarterly row, expand to show monthly breakdown:

```
| Quarter        | Amount Due | Paid  | Status   | [▼]
|----------------|------------|-------|----------|
| Q1 (Jul-Sep)   | $1,200     | $1,200| PAID     |
  ├─ July 2025   |   $400     | $400  | PAID     |
  ├─ Aug 2025    |   $400     | $400  | PAID     |
  └─ Sep 2025    |   $400     | $400  | PAID     |
```

**Note:** This is nice-to-have, not required. Focus on basic quarterly display first.

---

### Phase 3: Partial Payment Tracking (1 hour)

#### Step 3.1: Running Balance Within Quarter
Track payments across the 3 months in a quarter:

```javascript
function calculateQuarterStatus(quarterMonths) {
  const totalDue = quarterMonths.reduce((sum, m) => sum + m.scheduledAmount, 0);
  const totalPaid = quarterMonths.reduce((sum, m) => sum + m.paidAmount, 0);
  const remaining = totalDue - totalPaid;
  
  return {
    totalDue,
    totalPaid,
    remaining,
    status: totalPaid >= totalDue ? 'paid' : 
            totalPaid > 0 ? 'partial' : 'unpaid',
    percentPaid: Math.round((totalPaid / totalDue) * 100)
  };
}
```

#### Step 3.2: Payment Status Indicators
- **PAID** (Green): Full quarter paid (totalPaid >= totalDue)
- **PARTIAL** (Yellow): Some payments made (0 < totalPaid < totalDue)
- **UNPAID** (Red): No payments (totalPaid === 0)
- **OVERDUE** (Red with warning): Past due date with balance remaining

---

## Files to Modify (Frontend Only)

### Primary File
- **`frontend/sams-ui/src/components/hoa/HOADuesTable.jsx`** (or equivalent)
  - Add quarterly grouping logic
  - Toggle between monthly/quarterly view
  - Calculate quarter totals

### Supporting Files (If Needed)
- **`frontend/sams-ui/src/views/HOADuesView.jsx`** - Pass config to table
- **`frontend/sams-ui/src/api/configAPI.js`** - Fetch duesFrequency if not already available

---

## Testing Requirements

### Test Case 1: MTC Client (Monthly)
1. Login and select MTC client
2. Navigate to HOA Dues
3. **Verify:** Monthly view displays (no changes to current behavior)
4. **Verify:** All months shown individually

### Test Case 2: AVII Client (Quarterly) - If Config Set
1. Login and select AVII client
2. **First:** Check if `config.feeStructure.duesFrequency = "quarterly"` exists
3. If not, manually set in Firebase Console for testing
4. Navigate to HOA Dues
5. **Verify:** Quarterly view displays (Q1-Q4)
6. **Verify:** Quarter totals calculated correctly
7. **Verify:** Payment status accurate (paid/partial/unpaid)

### Test Case 3: Partial Payment Tracking
1. Create partial payment for AVII quarter
2. **Verify:** Quarter shows PARTIAL status
3. **Verify:** Remaining amount displayed correctly
4. **Verify:** Monthly data still accessible (for penalties)

### Test Case 4: Data Validation
1. Verify monthly data NOT modified (still stored monthly)
2. Verify can still access individual month details if needed
3. Verify switching clients (MTC ↔ AVII) shows correct view

---

## Critical Implementation Notes

### Data Integrity
- **DO NOT modify storage** - Monthly data must remain for penalties
- **Display logic only** - Transform for presentation
- **Reversible** - Can switch back to monthly view anytime

### Configuration Management
- **Data-driven** - Read from client config
- **Graceful fallback** - Default to monthly if config missing
- **No hardcoding** - Never hardcode AVII = quarterly

### Performance
- **Lightweight** - Just grouping/summing existing data
- **No API calls** - Use already-loaded HOA Dues data
- **Fast rendering** - Simple calculations

---

## Success Criteria

### Functional Requirements
- ✅ AVII client shows quarterly view (when config set)
- ✅ MTC client shows monthly view (unchanged)
- ✅ Quarter totals calculated correctly
- ✅ Payment status accurate (paid/partial/unpaid)
- ✅ Partial payments tracked across quarters
- ✅ Monthly data still accessible for penalties

### Technical Requirements
- ✅ Configuration-driven (no hardcoding)
- ✅ Pure display logic (no storage changes)
- ✅ Graceful fallback to monthly
- ✅ Performance acceptable (instant rendering)

### Quality Requirements
- ✅ Professional appearance matching monthly view
- ✅ Clear quarter labels (Q1 Jul-Sep, etc.)
- ✅ Consistent with SAMS UI design
- ✅ No linter errors

---

## Deliverables

1. **Enhanced HOA Dues Table** - Quarterly view support
2. **Configuration Integration** - Read duesFrequency from config
3. **Quarter Grouping Logic** - Transform monthly to quarterly display
4. **Testing Results** - Both MTC and AVII verified
5. **Memory Log** - Complete documentation

---

**Manager Agent Approval:** This task is READY FOR ASSIGNMENT as Priority 2. Pure frontend work that can run in parallel with Priority 1B backend work. Provides quarterly display foundation for Statement of Account report.

**Estimated Effort:** 4-5 hours  
**Can Run in Parallel:** Yes (frontend only, Priority 1B is backend only)

