# APM Date Guidelines Update Plan

## Overview
Following the system-wide replacement of `new Date()` with `getNow()` for Cancun timezone consistency, we need to update all APM documentation to enforce this architectural decision.

## Updates Required

### 1. CRITICAL_CODING_GUIDELINES.md
Add new section:
- **NO new Date() calls** - Always use `getNow()` from DateService
- Exception: Date picker value processing (but default values should use `getNow()`)
- Enforcement: Code will be rejected if `new Date()` is found

### 2. Implementation Agent Guides
Update Implementation_Agent_Initiation_Prompt.md:
- Add to Operating Rules: "Never use `new Date()` - always use `getNow()` for current dates"
- Add to error examples: Using `new Date()` instead of `getNow()`

### 3. Manager Agent Review Process
Update Manager_Agent_Initiation_Prompt.md:
- Add to review checklist: "Verify no `new Date()` usage (except date picker processing)"
- Add to rejection criteria: "Code contains `new Date()` calls"

### 4. Task Assignment Guide
Add to technical requirements section:
- All dates must use `getNow()` from DateService
- Transaction IDs must reflect Cancun timezone
- Audit logs must use actual local time

### 5. Memory Log Guide
Add to code quality guidelines:
- Document any date handling approaches
- Flag any timezone-sensitive operations

## Review Criteria Updates

### Code Review Checklist Addition:
- [ ] No `new Date()` calls (search for pattern)
- [ ] All current date/time uses `getNow()`
- [ ] Date pickers properly initialized with `getNow()`
- [ ] Transaction IDs reflect correct Cancun date
- [ ] Audit timestamps are timezone-correct

### Automatic Rejection Triggers:
1. Code contains `new Date()` (except in date picker value processing)
2. Transaction ID generation doesn't use proper timezone
3. Audit logs use UTC instead of Cancun time

## Implementation Notes

### Search Pattern for Reviews:
```bash
# Find violations
grep -r "new Date()" --include="*.js" --include="*.jsx" --exclude-dir=node_modules
```

### Correct Patterns:
```javascript
// CORRECT
const now = getNow(); // Returns Cancun time
const today = getNow();

// WRONG
const now = new Date(); // Returns system/UTC time

// EXCEPTION (date picker processing)
const selectedDate = new Date(datePickerValue); // Processing user input
```

## Communication Template

When rejecting code with `new Date()`:
```
Code rejected due to timezone consistency violation:
- Found `new Date()` at [location]
- Must use `getNow()` from DateService instead
- This ensures all dates reflect Cancun timezone
- See CRITICAL_CODING_GUIDELINES.md for details
```

## Testing Requirements

All date-related code must be tested:
1. At midnight Cancun time
2. During timezone boundaries
3. With transaction ID generation
4. In audit log entries

## Long-term Benefits

1. **Consistency**: All dates throughout system reflect local time
2. **Debugging**: Easier to trace issues when all times are consistent
3. **User Experience**: Dates match user expectations
4. **Data Integrity**: Correct sorting and filtering
5. **Audit Compliance**: Accurate timestamps for legal/audit purposes