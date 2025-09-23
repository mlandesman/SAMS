# Load MTC into production

**Issue ID**: ISSUE-20250708_1046  
**Created**: 2025-07-08 10:46:56  
**Priority**: 🚨 CRITICAL  
**Module**: Database  
**Status**: 🔴 OPEN  

---

## Description

Pending Refactoring Completion -- When the Dev system is done but before we deploy the code, we need to (1) purge the production db and (2) import the current MTC data into the new structures.  We have scripts written already for the recursive purge to ensure no ghosts but we need to throughly review the import script based on the refactoring steps we just completed.\n

## Impact Assessment

PRODUCTION BLOCKER

## Steps to Reproduce



## Environment

- **Affected Environment**: [ ] Development [ ] Staging [ ] Production
- **Browser/Device**: 
- **User Role**: 

## Acceptance Criteria

- [ ] Issue is resolved
- [ ] No regression in other functionality
- [ ] Testing completed
- [ ] Documentation updated (if needed)

## Related Issues

None

## Notes

Created via SAMS issue creation tool

---

**Created by**: Product Manager  
**Labels**: critical, database  
**Assignee**: Unassigned  
**Milestone**: Current Sprint
