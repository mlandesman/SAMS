# Client Logos and Icons are not appearing

**Issue ID**: ISSUE-20250807_1450  
**Created**: 2025-08-07 14:50:34  
**Priority**: 🔥 HIGH  
**Module**: Document Management  
**Status**: 🔴 OPEN  

---

## Description

When we upload icon and logo images via the Edit Client modal, the files get uploaded to the bucket but are not callled in for the model itself of the Client Selector.\n

## Impact Assessment

Poor User Experience

## Steps to Reproduce

The AVII logo was uploaded and stored in gs://sams-sandyland-prod.firebasestorage.app/icons/AVII/icon_1754595552128_AVII Small.png.  The firestore record for this file is stored in /clients/AVII.branding.logoUrl: https://firebasestorage.googleapis.com/v0/b/sams-sandyland-prod.firebasestorage.app/o/logos%2FAVII%2F1754595551080_Logo-transparent-background.png?alt=media but it is not displayed even in the Edit Modal when opened again.  The image is stored properly and displayed when first uploading.\n

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
**Labels**: high-priority, documents  
**Assignee**: Unassigned  
**Milestone**: Current Sprint
