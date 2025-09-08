# Sandyland Management System (SAMS)
## Technical Design Overview

---

## Project Purpose
Create a private, professional-grade property management system optimized for Sandyland Properties, balancing clean design, high efficiency, and secure multi-client support.

---

## Technology Stack
- Backend: Node.js (ES Modules), Express.js, Firebase Admin SDK
- Database: Google Firestore (multi-tenant under `/clients/{clientId}`)
- Frontend: React (Vite-based setup), JavaScript (ES Modules), CSS
- Storage: Firebase Storage (for logos/icons per client)
- Hosting: Firebase Hosting (planned)

---

## Collection Structure (Summary)
- `/clients/{clientId}`
  - Associations (formerly properties)
  - Units
  - Owners
  - Transactions
  - Projects
  - Lists
    - Vendors
    - Categories
    - Logos (iconUrl and logoUrl references)

---

## Key Design Principles
- Multi-client architecture (Sandyland Properties + future clients)
- Lightweight, mobile-first responsive frontend
- Clear client context switching (e.g., logo, color scheme, "Change Client" behavior)
- All triggers and automation controlled through app/web, **not** Google Sheets
- Flexible project and special assessment tracking
- Extendable for CRM-lite features in future phases
- Authentication via Firebase Auth (planned for future)
- Consistent branding through client-specific logo/icon/color settings

---

## CRUD Scope (Updated May 2025)
Each major collection supports full CRUD operations via modular controller files in `backend/controllers/`.
These controllers are used by Express routes to handle API requests.
Audit logging is implemented for create, update, and delete actions via `backend/utils/auditLogger.js`.

---

## Storage Convention (New Section)
- Logos: `/logos/{clientId}/logo.png`
- Icons: `/icons/{clientId}/icon.png`
- File URL fields stored in Firestore under each `client` document as `logoUrl` and `iconUrl`.

---

## Branding Requirements (New Section)
- Dynamic UI color theming based on `primaryColor` and `accentColor` fields.
- Title bar, sidebar, and background elements adjust per active client.
- Logo and icon dynamically loaded at login/account switch.

---

## Frontend Framework (Updated May 2025)

- Built with React (Vite-based setup)
- Key Layout Components:
    - `MainLayout.jsx`: Manages the overall page structure.
    - `Sidebar.jsx`: Navigation and client switching.
    - `ActivityActionBar.jsx`: Top bar for client name and actions specific to each activity.
    - `SplashScreen.jsx`: Initial view before client selection.
    - `TransactionTable.jsx`: Main content display for transactions.
    - `ClientSwitchModal.jsx`: Modal for selecting the active client.
- Styling: Primarily custom CSS (e.g., `App.css`, `Layout.css`, component-specific CSS).
- Responsive layout designed for various screen sizes.
- Dynamic client-specific branding (logo, name) is a core requirement.