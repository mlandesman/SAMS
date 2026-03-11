# Roadmap and Timeline

*Sprint sequencing with deadlines and dependencies*

---

## Production Status: v1.15.0
**Deployed:** March 10, 2026 | **Sprint PASSKEY-AUTH: Passkey Authentication**

### Core Capabilities (Complete)
- ✅ Double-entry accounting (expenses, deposits, splits)
- ✅ HOA Dues collection with UPC payment allocation
- ✅ Statement of Account (PDF, CSV, Email)
- ✅ Water Bills with quarterly billing (AVII) — Full UI Complete
- ✅ Budget Management and Budget vs Actual reporting
- ✅ Year-End Processing (MTC 2025 complete)
- ✅ Document storage for Expense Entries
- ✅ Mobile/PWA for Maintenance Workers and Admin Expense Entry
- ✅ Dashboard cards for client status overview
- ✅ Water Consumption Report (Issue #129)
- ✅ Projects Module with Bids, Documents, and Financial Lifecycle (PM1-9)
- ✅ System Error Monitor with centralized error capture (Sprint EM)
- ✅ Passkey authentication (WebAuthn) — Face ID, Touch ID, fingerprint login
- ✅ Admin passkey management — invite, list, revoke credentials

---

## Hard Deadlines

| Deadline | Issue | Description |
|----------|-------|-------------|
| ~~**March 15, 2026**~~ | ~~#105~~ | ~~Water Bills quarterly display fix~~ ✅ COMPLETE (Jan 27) |
| ~~**~30 days**~~ | ~~Polling-1~~ | ~~Vote recording for upcoming project approvals~~ ✅ COMPLETE (Feb 3) |
| ~~**July 2026**~~ | ~~#124~~ | ~~Year-End 100x centavos bug~~ ✅ Fixed in Sprint F (#124) + systemic cleanup in Sprint CX (#181) |
| **TBD** | #122 | Gmail OAuth (before Google deprecates app passwords) |

---

## Sprint Sequence

### 📋 Upcoming Sprints

| Order | Sprint | Theme | Est | Key Issues/Tasks |
|-------|--------|-------|-----|------------------|
| ~~1~~ | ~~**MOBILE-OWNER-V1**~~ | ~~Mobile Owner PWA~~ | ~~6-8h~~ | ~~#132, #147, #193~~ ✅ COMPLETE (Feb 27, 2026) |
| ~~2~~ | ~~**PM-Finance**~~ | ~~Project Financial Integration~~ | ~~~38h~~ | ~~PM5–PM9~~ ✅ COMPLETE (Mar 9, 2026) |
| ~~3~~ | ~~**PASSKEY-AUTH**~~ | ~~Passkey Authentication~~ | ~~~15h~~ | ~~#189, PK1–PK4~~ ✅ COMPLETE (Mar 10, 2026) |
| 4 | **D** | PWA/Mobile Enhancements | 12-16h | #184, #133, #109, #51, #47 — Mobile app improvements |
| 5 | **WA** | WhatsApp Notifications | 6-8h | #178 — Payment confirmations, poll alerts, task notices |
| 6 | **Polling-2+** | Notifications + Committee Filters | 6-8h | Polling-2 tasks + #207 (committee-based vote filtering) |
| 7 | **E** | Admin & Settings | 7-9h | #194, #182, #106, #102, #50, #159 |
| 8 | **UC** | Unified Client Architecture | 24-30h | Epic #54 — expand beyond HOA to non-HOA client types (#200-#206) |
| 9 | **G** | Future Features | TBD | #157, #138, #148, #121, #96, #53, #68, #165, #176 |

**Current Focus**: Sprint PASSKEY-AUTH complete. Passkey auth deployed. Next: determine priority — Sprint D (PWA/Mobile Enhancements) or Sprint WA (WhatsApp Notifications).

**Mobile PWA Future Enhancements** (carry to Sprint D or G):
- Budget card: live budget data integration (#176)
- Projects card: live project status data
- Vote Needed card: new card for open polls requiring user action

**Schedule Note (Mar 10, 2026)**: Sprint PASSKEY-AUTH ✅ COMPLETE (PR #233, 41 files, +2,537/-782 lines). WebAuthn passkey authentication deployed. Password login retained as fallback for admin bootstrap. Sprint PM-Finance-Next also completed (PRs #215–#226) on Mar 9. #189 closed. Sprint sequence renumbered — Sprint D (PWA/Mobile) now next, ahead of WhatsApp, since passkey auth unblocks external user deployment.

**Schedule Note (Feb 25, 2026)**: Sprint B4 merged to main. Added Epic #54 (Unified Client Architecture) with 7 child issues (#200-#206) as Sprint UC. Scope is explicit expansion beyond HOA to include non-HOA client types (SingleUnit and Portfolio). Placed after WA, D, PM-Finance, and Polling enhancements per PO decision — system needs stable Projects, Budgets, and Statements before onboarding portfolio clients. PM-Finance moved ahead of Polling-2 per priority alignment.

**Schedule Note (Feb 21, 2026)**: Sprint B3-Fix completed and merged (PR #192). All 5 bugs closed. Production stabilized. Reprioritized: Sprint B4 (#195 user-level UI) and Sprint Recon (#188 historical balance) moved ahead of WhatsApp. #49 closed — superseded by #189 (Passkey auth).

---

### ⏸️ Intentionally Deferred

| Item | Reason | Review Trigger |
|------|--------|----------------|
| ~~PM-Finance (PM5-9)~~ | ~~Touches UPC and SoA core engines~~ | ✅ COMPLETE (Mar 9, 2026) |
| #90 Credit Auto-Pay | Monitoring via email override | Q2 2026 |
| Sprint B3 bugs (#124, #52) | Manual workarounds exist, no user impact | Before July 2026 for #124 |

---

## Recent Hotfix Log

| Version | Date | Issue | Notes |
|---------|------|-------|-------|
| v1.11.1 | Jan 30, 2026 | SoA skip logic for non-WaterBills clients | Agent shortcut caused edge case bug |
| v1.11.2 | Jan 31, 2026 | SoA fix for water-only payments | Edge case: water bill payment without HOA Dues |

**Lesson Learned**: Changes to conditional logic in shared services (statementDataService.js) have broader blast radius. Test edge cases with both MTC (no water) and AVII (quarterly water).

---

## Sprint Completion Log

| Sprint | Completed | Issues Closed |
|--------|-----------|---------------|
| PASSKEY-AUTH (Passkey Authentication) | Mar 10, 2026 | #189 — PR #233 (PK1–PK4) |
| PM-Finance-Next (Project Financial Cycle) | Mar 9, 2026 | PM5–PM9 — PRs #215–#226 |
| MOBILE-OWNER-V1 (Mobile Owner PWA) | Feb 27, 2026 | #132, #147, #193 |
| Recon (Bank Reconciliation Tools) | Feb 26, 2026 | #188 — PR #208 |
| B4 (User-Level UI Fix) | Feb 24, 2026 | #195 — PR #199 |
| B3-Fix (Production Stabilization) | Feb 21, 2026 | #191, #190, #186, #187, #43 — PR #192 |
| EM (System Error Monitor) | Feb 16, 2026 | #171 — PR #185 |
| CX (Currency Conversion Discipline) | Feb 15, 2026 | #181, #180, #179 — PR #183 |
| F (Infrastructure & Tech Debt) | Feb 6, 2026 | #124, #52, #146, #63, #155 — PRs #172-#177 |
| Cleanup-1 (UI Polish & Code Hygiene) | Feb 5, 2026 | #160, #167, #97, #84, #154, #164, #168 — PR #170 |
| Polling-1 (Complete Voting System) | Feb 3, 2026 | V1-V4: Backend, Admin UI, Email Link, Integration |
| PM (Project Management PM1-4) | Jan 29, 2026 | Projects module, Bids, Documents |
| CL1 (Changelog Feature) | Jan 28, 2026 | #158 |
| B2 (General Bug Fixes #1) | Jan 28, 2026 | #115, #60, #156, #108 |
| W1 (Water Bills Quarterly UI) | Jan 27, 2026 | #105 |
| U1 (Document Upload) | Jan 24, 2026 | #153 |
| A (Quick Wins) | Jan 19, 2026 | #152, #145, #134, #110 |
| C1 (Water Report) | Jan 22, 2026 | #129 |
| C (Reports) | Jan 20, 2026 | #94, #56 |

---

## Key Context for Prioritization

**System Usage**: SAMS is primarily used by Michael (admin). Passkey authentication is now deployed, unblocking mobile app deployment to unit owners. External users will authenticate via passkey invites.

**Sprint Timing Driver**: Real-world operational deadlines drive priority, not theoretical best practices. Features are accelerated when immediate data collection needs arise (e.g., Projects for collecting proposals).

**Core Engine Caution**: UPC (transaction journal) and Statement of Account (billing/notification) are the two main engines. Sprints touching these require stability periods first.

---

## Document Maintenance

**Manager Agents**: Update this document when:
- Sprint status changes (started, completed)
- Issues are added, moved, or closed
- Deadlines are identified or changed

**Sync with**: `Sprint_Groups.md` for detailed issue lists

---

*Last Updated: March 10, 2026 — Sprint PASSKEY-AUTH ✅ COMPLETE (#189, PR #233). Sprint PM-Finance-Next ✅ COMPLETE (PRs #215–#226). Passkey authentication deployed. Next: Sprint D (PWA/Mobile) or Sprint WA (WhatsApp).*
