# Roadmap and Timeline

*Sprint sequencing with deadlines and dependencies*

---

## Production Status: v1.13.0
**Deployed:** February 16, 2026 | **Sprint EM: System Error Monitor**

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
- ✅ Projects Module with Bids and Documents (PM1-4)
- ✅ System Error Monitor with centralized error capture (Sprint EM)

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
| 1 | **WA** | WhatsApp Notifications | 6-8h | #178 — Payment confirmations, poll alerts, task notices |
| 2 | **D** | PWA/Mobile Enhancements | 12-16h | #193, #184, #147, #133, #132, #109, #51, #47 |
| 3 | **PM-Finance** | Project Financial Integration | ~12h | PM5, PM6, PM7 — Assessment allocation, SoA integration, UPC payment |
| 4 | **Polling-2+** | Notifications + Committee Filters | 6-8h | Polling-2 tasks + #207 (committee-based vote filtering) |
| 5 | **E** | Admin & Settings | 7-9h | #194, #182, #106, #102, #50, #159 |
| 6 | **UC** | Unified Client Architecture | 24-30h | Epic #54 — expand beyond HOA to non-HOA client types (#200-#206) |
| 7 | **G** | Future Features | TBD | #189, #157, #138, #148, #121, #96, #53, #68, #165, #176 |

**Current Focus**: Sprint WA — WhatsApp Notifications (Sprint Recon merged, PR #208; BugBot follow-up merged via PR #209)

**Schedule Note (Feb 25, 2026)**: Sprint B4 merged to main. Added Epic #54 (Unified Client Architecture) with 7 child issues (#200-#206) as Sprint UC. Scope is explicit expansion beyond HOA to include non-HOA client types (SingleUnit and Portfolio). Placed after WA, D, PM-Finance, and Polling enhancements per PO decision — system needs stable Projects, Budgets, and Statements before onboarding portfolio clients. PM-Finance moved ahead of Polling-2 per priority alignment.

**Schedule Note (Feb 21, 2026)**: Sprint B3-Fix completed and merged (PR #192). All 5 bugs closed. Production stabilized. Reprioritized: Sprint B4 (#195 user-level UI) and Sprint Recon (#188 historical balance) moved ahead of WhatsApp. #49 closed — superseded by #189 (Passkey auth).

---

### ⏸️ Intentionally Deferred

| Item | Reason | Review Trigger |
|------|--------|----------------|
| PM-Finance (PM5-7) | Touches UPC and SoA core engines | After CX complete + stability period |
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

**System Usage**: SAMS is currently a single-user system (Michael). Mobile app not deployed to unit owners yet. "Users" receive output (reports) only.

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

*Last Updated: February 27, 2026 — Sprint Recon and BugBot follow-up merged (PRs #208 and #209). Current focus remains Sprint WA. Sprint UC confirms Issue #54 expansion beyond HOA to non-HOA client types.*
