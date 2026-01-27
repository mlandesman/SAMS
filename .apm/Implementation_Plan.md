# SAMS Implementation Plan

**Version:** v1.9.2 | **Build:** 260124.1800  
**Last Updated:** January 24, 2026 — Sprint W1 (Water Bills UI) now current, #115 moved to B2  
**Product Owner:** Michael Landesman  
**Development:** Cursor APM Framework (AI Agents)

---

## Reference Documents

All planning and backlog management is maintained in the Agile documentation:

| Document | Purpose |
|----------|---------|
| [Project Overview](../SAMS-Docs/apm_session/Agile/Project_Overview.md) | Business context, features, user roles |
| [Project Understanding](../SAMS-Docs/apm_session/Agile/Project_Understanding.md) | Historical context, decision rationale |
| [Sprint Groups](../SAMS-Docs/apm_session/Agile/Sprint_Groups.md) | Detailed backlog with all issues by sprint |
| [Roadmap & Timeline](../SAMS-Docs/apm_session/Agile/Roadmap_and_Timeline.md) | Sprint sequence, deadlines, completion log |

**Production URL:** https://sams.sandyland.com.mx  
**Mobile PWA:** https://mobile.sams.sandyland.com.mx

---

## Current Sprint

### Sprint W1: Water Bills Quarterly UI
**Status:** 📋 READY TO START  
**Issue:** #105 (105B phase)  
**Priority:** HIGH — Complete quarterly billing UI  
**Estimated Effort:** 4-6 hours  
**Deadline:** March 15, 2026 (Q1 billing)

**Objective:** Complete the quarterly billing UI refactor for AVII. The minimal generator (105A) is complete. 105B requires marrying the correct calculation logic to the existing UI and updating the History tab.

**Key Context:**
- Structural change to bills documents broke UI display
- Minimal path has correct calculation logic
- UI code exists but is bypassed
- Month pulldown was off by one (may be fixed)
- Review fix scripts and manual edits from Jan 20

**Reference Files:**
- Fix scripts: `scripts/fix-consumption-misallocation.js`, `scripts/correct-water-bills-from-readings.js`
- Test results: `test-results/Water Bill Corrections 20-Jan-2026/`
- Task 103 log: Off-by-one month fix and migration script
- Task 105A log: Minimal quarterly generator implementation

---

## Recently Completed

### Sprint U1: Document Upload for UPC ✅ COMPLETE
**Completed:** January 24, 2026  
**Issue:** #153 — Add document upload in UPC  
**Duration:** ~4-5 hours  
**Quality:** ⭐⭐⭐⭐⭐

**Deliverables:**
- Document upload UI in UPC modal
- Document upload before payment recording
- Backend integration for document storage
- Transaction edit fixes (type preservation, document preservation)

**Files:** 9 files, ~274 lines added  
**Commit:** `b53d843`

---

## Known Blockers

*None currently*

---

## Hard Deadlines

| Deadline | Issue | Description |
|----------|-------|-------------|
| **March 15, 2026** | #105 | Water Bills quarterly display (Q1 billing) |
| **June 2026** | #124 | Year-End centavos bug (AVII year-end) |

---

## Manager Agent Instructions

When closing Tasks or Sprints, update these documents:

1. **Sprint_Groups.md** — Move completed issues to "Completed Sprints Archive"
2. **Roadmap_and_Timeline.md** — Update "Current Sprint", "Sprint Completion Log"
3. **This file** — Update "Current Sprint" section with next sprint details

Always update `Last Updated` timestamps when modifying documents.

---

## Historical Record

Completed work through v1.8.0 is documented in:
- `SAMS-Docs/COMPLETED_WORK_ARCHIVE_v0.3.0.md` (early milestones)
- Previous Implementation_Plan.md snapshots in `.apm/` directory
- GitHub closed issues: https://github.com/mlandesman/SAMS/issues?q=is%3Aclosed

---

*This document was restructured on January 24, 2026 to align with the new Agile framework. Historical milestone details have been archived.*
