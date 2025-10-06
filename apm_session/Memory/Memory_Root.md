---
memory_strategy: dynamic-md
memory_log_format: markdown
---

# SAMS - APM Dynamic Memory Bank Root

Implementation Plan Phase Summaries are to be stored here; detailed Task Memory Logs are stored in Markdown format in the sub-directories.

## Project Context

**Project:** SAMS (Sandy's Accounting Management System)
**Objective:** Complete critical features to achieve production-ready status for parallel operation with Google Sheets systems
**Key Focus Areas:**
- Water Bills module completion with car/boat wash billing
- API architecture refactoring to domain-specific endpoints
- PWA recovery and mobile admin functionality
- Automated reporting with bilingual (English/Spanish) support

**Technical Context:**
- Frontend: React/Vite on localhost:5173
- Backend: Node.js/Express on localhost:5001
- PWA: localhost:5174 (broken, needs recovery)
- Database: Firebase/Firestore
- Production: sams.sandyland.com.mx

**Critical Constraints:**
- No backward compatibility needed (fresh system)
- User approval required for all commits
- Linear workflow with single Implementation Agent at a time
- Leverage existing HOA patterns for Water Bills features
- Bilingual support required throughout

## Phase Summaries

### Phase 12 - Production Deployment Success (COMPLETED - October 6, 2025)
**Status:** ✅ COMPLETED AND PRODUCTION-READY
**Duration:** 1 Manager Agent session
**Key Achievements:**
- Successfully deployed refactored backend with domain-specific routes to production
- Fixed backend import path issues (moved data-augmentation-utils.js to backend/utils/)
- Updated Vercel configuration with proper build commands and dependencies
- Updated frontend to use new domain-specific routes (/admin/import/preview)
- Verified Exchange Rates Firebase Functions still running (scheduled daily at 3:00 AM)
- Cleaned up old sams-ui project from Vercel dashboard
- All core functionality working - authentication, transactions, CORS properly configured

**Technical Impact:**
- Production backend now running on Vercel with clean domain-specific architecture
- Frontend successfully communicating with new backend (HTTP 200, proper CORS)
- Import functionality partially working (file path issue identified for new agent session)
- Clean deployment configuration with proper environment variables
- Exchange Rates automated functions verified operational

**Production URLs:**
- Frontend: `https://sams.sandyland.com.mx`
- Backend: `https://backend-hla1k6lsj-michael-landesmans-projects.vercel.app`
- Mobile: `https://mobile.sams.sandyland.com.mx` (pending sync with new backend)

**Known Issues:**
- Import functionality has file path issue (MTCdata not accessible on server) - assigned to new agent session

### Phase 01 - ClientSwitchModal Navigation Fix (COMPLETED - January 16, 2025)
**Status:** ✅ COMPLETED AND ARCHIVED
**Duration:** 1 Implementation Agent session
**Key Achievements:**
- Fixed ClientSwitchModal navigation to Settings page for superAdmin new client onboarding
- Resolved route protection issues preventing superAdmin access to Settings without client context
- Fixed MTC paymentMethods import collection name mismatch (paymentTypes → paymentMethods)
- All 7 payment methods successfully imported to correct collection path

**Technical Impact:**
- SuperAdmin users can now navigate from "-New Client-" to Settings page
- Data Management section accessible for new client onboarding
- MTC paymentMethods collection now properly accessible to application code
- Maintained security restrictions for non-superAdmin users

**Files Modified:**
- `frontend/sams-ui/src/components/ClientSwitchModal.jsx`
- `frontend/sams-ui/src/App.jsx`
- `frontend/sams-ui/src/components/security/ClientProtectedRoute.jsx`
- `frontend/sams-ui/src/views/SettingsView.jsx`
- `backend/services/importService.js`

**Archive Location:** `apm_session/Memory/Archive/Phase_01_ClientSwitchModal_Fix/`
**Git Commit:** 38ed6f6 - Fix paymentMethods import: Change collection name from paymentTypes to paymentMethods