# Implementation Agent - Complete Task

As an Implementation Agent, you will now mark your task as complete and prepare final documentation. This ensures proper handoff and project continuity.

## Task Completion Process

### 1. Pre-Completion Quality Gate (MANDATORY)

Before marking complete, run automated and manual checks against the full branch diff.

#### 1a. Run Automated Checks
```bash
bash scripts/pre-pr-checks.sh main
```
This checks for: `new Date()` violations, dead/unused files, navigation targets without matching routes, and CommonJS in frontend code. **Fix all issues before proceeding.**

#### 1b. Manual Code Review (Review `git diff main...HEAD`)
You MUST review the full diff and check for these patterns that automated tools miss:

- **Dead code from pivots**: If you created a component/file and later abandoned it in favor of a different approach, DELETE the abandoned file. Don't leave it in the branch.
- **Unused imports**: If you removed usage of a component but left its `import` statement, remove the import.
- **State reset on context changes**: For every component that uses `selectedUnitId`, `currentClient`, or similar context values — verify that local state (loaded data, selections, errors, displayed content) resets when those values change. Add a `useEffect` cleanup if missing.
- **Data unit consistency**: When a component falls back between two data sources (e.g., `accountStatus?.value ?? currentStatus?.value`), verify both sources return the same units (pesos vs centavos, strings vs objects). Convert in the fallback if they differ.
- **Role/permission alignment**: For every `onClick={() => navigate('/route')}`, verify the user who can SEE the clickable element also has PERMISSION to access that route. Check `RoleProtectedRoute` wrappers in `App.jsx`. If a card is visible to all users but links to a role-restricted route, gate the `onClick` or use role-appropriate targets.

#### 1c. Standard Validation
- [ ] All acceptance criteria are met
- [ ] Code is tested and working
- [ ] Documentation is complete
- [ ] Memory Bank is updated
- [ ] No outstanding issues
- [ ] Quality gate script passes with zero issues
- [ ] Manual review completed for state/data/permission patterns

### 2. Create Completion Summary

Update your Memory Bank log with a completion section:

```markdown
## Task Completion Summary

### Completion Details
- **Completed Date**: [Current date/time]
- **Total Duration**: [Time taken]
- **Final Status**: ✅ Complete

### Deliverables Produced
1. **[Deliverable 1]**
   - Location: [File path]
   - Description: [What it does]
   
2. **[Deliverable 2]**
   - Location: [File path]
   - Description: [What it does]

### Implementation Highlights
- [Key feature implemented]
- [Important algorithm used]
- [Notable optimization made]

### Technical Decisions
1. **[Decision 1]**: [What and why]
2. **[Decision 2]**: [What and why]

### Code Statistics
- Files Created: [List]
- Files Modified: [List]
- Total Lines: [Approximate]
- Test Coverage: [Percentage]

### Testing Summary
- Unit Tests: [Number] tests, [Pass rate]
- Integration Tests: [Number] tests, [Pass rate]
- Manual Testing: [What was tested]
- Edge Cases: [Handled scenarios]

### Known Limitations
- [Limitation 1 and workaround]
- [Limitation 2 and future consideration]

### Future Enhancements
- [Possible improvement 1]
- [Possible improvement 2]
```

### 3. Validate Against Requirements

Create a checklist showing requirement fulfillment:

```markdown
## Acceptance Criteria Validation

From Task Assignment:
- ✅ [Criterion 1]: [How it was met]
- ✅ [Criterion 2]: [How it was met]
- ✅ [Criterion 3]: [How it was met]

Additional Achievements:
- ✅ [Extra feature or improvement]
```

### 4. Document Integration Points

If your task interfaces with other components:

```markdown
## Integration Documentation

### Interfaces Created
- **[Interface 1]**: [Purpose and usage]
- **[Interface 2]**: [Purpose and usage]

### Dependencies
- Depends on: [What this task needs]
- Depended by: [What needs this task]

### API/Contract
```[language]
[Key interfaces or contracts]
```
```

### 5. Provide Usage Examples

Include examples for future reference:

```markdown
## Usage Examples

### Example 1: [Basic Usage]
```[language]
[Code example]
```

### Example 2: [Advanced Usage]
```[language]
[Code example]
```
```

### 6. Final Code Snapshot

Include key code sections:

```markdown
## Key Implementation Code

### [Component Name]
```[language]
[Core implementation code]
```
**Purpose**: [What this does]
**Notes**: [Important details]
```

### 7. Lessons Learned

Document insights for future tasks:

```markdown
## Lessons Learned
- **What Worked Well**: [Successful approaches]
- **Challenges Faced**: [Difficulties and solutions]
- **Time Estimates**: [Actual vs estimated]
- **Recommendations**: [For similar future tasks]
```

### 8. Handoff Information

Prepare for Manager review:

```markdown
## Handoff to Manager

### Review Points
- [Key area 1 to review]
- [Key area 2 to review]
- [Specific feedback needed]

### Testing Instructions
1. [How to test feature 1]
2. [How to test feature 2]

### Deployment Notes
- [Any special deployment steps]
- [Configuration requirements]
- [Environment considerations]
```

### 9. Update Task Status

Final status update:
```markdown
## Final Status
- **Task**: [ID] - [Name]
- **Status**: ✅ COMPLETE
- **Ready for**: Manager Review
- **Memory Bank**: Fully Updated
- **Blockers**: None
```

### 10. Completion Checklist

Ensure everything is done:
- [ ] All code committed
- [ ] Tests passing
- [ ] Documentation complete
- [ ] Memory Bank updated
- [ ] Integration verified
- [ ] Examples provided
- [ ] Handoff notes prepared

## After Completion

1. Save all updates to Memory Bank
2. Notify Manager of completion (through Memory Bank)
3. Be available for review feedback
4. Prepare for next task assignment

Mark your task as complete and create the comprehensive completion documentation.