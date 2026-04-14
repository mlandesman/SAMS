# BUDGET-PROJ-1 Phase A — Implementation-Ready Design Contract

**Task ID:** `BUDGET-PROJ-1-PHASE-A-DESIGN`  
**Date:** 2026-04-14  
**Issue:** #165  
**Validation client (Phase B):** AVII  

This document is the **authoritative implementation contract** for Phase B. It incorporates and locks the product decisions from `.apm/BUDGET_PROJ_Design_Baseline_2026-04-14.md` where they apply to the Budget vs Actual (BvA) toggle.

---

## 1) Locked product decisions (verbatim)

The following are **fixed** for v1; do not re-open during implementation:

1. **No new “Projected Actual” column** (save space).
2. **Use existing variance columns** to show projected drift in projected mode.
3. **No two-page combined report** in v1.
4. **% variance when annual budget is zero** = **—** (em dash), not `0.00%`.
5. **Default mode** = **YTD** (existing behavior).
6. **Optional later enhancement only:** auto-default to projected mode if FY elapsed **> 60%** (not in Phase B unless explicitly re-scoped).
7. **Validation target client** = **AVII**.

---

## 2) Scope guardrails (anti–scope creep)

### In scope (Phase B implementation)

- Two-way report mode on existing BvA: **YTD** vs **Projected FY-End**.
- Math, API query parameter, UI toggle, HTML/PDF/CSV/text parity for variance semantics.
- Favorable / unfavorable coloring consistent with existing BvA sign rules.

### Explicitly out of scope (this sprint / this contract)

- **Dedicated fiscal health / cash-runway report**, cumulative cash floor, Lens B charts, recovery-lag modeling (per baseline, **future** work — **BUDGET-PROJ-2+**).
- **Two-page** or side-by-side combined YTD + Projected output.
- **New top-level route** unless a future IA proves unavoidable (default: **reuse** `ReportsView` tab `budget-actual`).
- **Auto default to Projected when FY > 60%** (documented as optional future only).

---

## 3) Math contract (locked)

### 3.1 Definitions

- **FY bounds:** Same as today: `getFiscalYearBounds(effectiveFiscalYear, fiscalYearStartMonth)` in `budgetActualDataService.js` — `startDate`, `endDate`, report “as of” `now = getNow()` (DateService, America/Cancun).
- **elapsedFraction:**  
  `elapsedFraction = elapsedTime / fiscalYearDuration`  
  where `elapsedTime = min(max(now - start, 0), fiscalYearDuration)` and `fiscalYearDuration = end - start` (same millisecond-based durations as existing `actualPercentOfYearElapsed`).  
  This is **numerically equivalent** to “elapsed portion of FY” and can be documented as elapsed/total on the same contiguous interval (day-level rounding is **not** required if ms ratio matches product intent).
- **Important:** For **projection math only**, use **`actualPercentOfYearElapsed`** (or the raw `elapsedFraction` derived as above) **without** applying the existing **>95% → 100%** proration adjustment used for **YTD budget** rows. The 95% rule remains **only** for YTD `ytdBudget` calculation in YTD mode as today. Projection must stay a linear run-rate through the true elapsed portion of the year.

### 3.2 Guardrails

- If `elapsedFraction === 0` (first instant of FY or invalid clock edge): **do not divide**. Return `projectedFYActual = null` / sentinel; render variance cells as **—** and skip favorable/unfavorable class for those cells (or neutral style). Phase B must add a unit test for this edge.
- If `elapsedFraction >= 1` (on or after FY end date): `projectedFYActual = ytdActual` (year complete; run-rate equals realized).

### 3.3 Core formulas (per category, centavos)

Let `ytdActual` be the **same positive-magnitude convention** as today in `budgetActualDataService.js` (income positive, expenses as positive magnitude for comparison).

- `projectedFYActual = round( ytdActual / elapsedFraction )` in integer centavos (use a single consistent rounding policy, e.g. `Math.round`, documented in code comments).

**Variance ($) — Projected FY-End mode** (compare projected year-end actual to **annual** budget):

| Type    | Variance ($) (projected mode)                         | Favorable when |
|---------|--------------------------------------------------------|----------------|
| Income  | `projectedFYActual - annualBudget`                     | variance ≥ 0   |
| Expense | `annualBudget - projectedFYActual`                   | variance ≥ 0   |

**Variance (%) — Projected FY-End mode**

- If `annualBudget > 0`: `variancePercent = (variance / annualBudget) * 100` (sign follows variance).
- If `annualBudget === 0`: display **—** (em dash), **never** `0.00%`.

**Totals rows (income table / expense table)**

- Compute using **aggregated** `totalYtdActual`, `totalAnnualBudget` for that section with the **same** `elapsedFraction`:  
  `projectedTotalFYActual = round(totalYtdActual / elapsedFraction)`  
  then apply the same income/expense variance formulas to totals. This matches the sum of per-line projected variances under linear run-rate.

### 3.4 YTD mode (unchanged contract)

- Retain existing `percentOfYearElapsed` (including **>95% → 100%** behavior) for **YTD Budget** only.
- Variance ($) and (%) exactly as implemented today:
  - Income: `ytdActual - ytdBudget`; % = `variance / ytdBudget` when `ytdBudget > 0`.
  - Expense: `ytdBudget - ytdActual`; % = `variance / ytdBudget` when `ytdBudget > 0`.

### 3.5 Percent display alignment (Phase B)

- **Projected mode:** annual budget zero → **—** (locked).
- **YTD mode:** today’s code uses `0` when `ytdBudget === 0`; Phase B **should** render **—** when the **denominator is zero** for consistency and to match the spirit of the locked PO (optional micro-spec: at minimum, fix **annualBudget === 0** rows in projected mode per lock; YTD mode denominator is `ytdBudget` — recommend **—** when `ytdBudget === 0` as a single UX rule).

---

## 4) UI / UX contract

### 4.1 Control

- **Placement:** `BudgetActualTab.jsx` — inside the existing `budget-actual-controls` row, **after** fiscal year and language selectors, **before** Generate. Use a compact **two-segment control**: `YTD` | `Projected FY-End` (exact English labels; Spanish table title strings can follow existing translation pattern in HTML service).
- **Default:** `YTD`.
- **Persistence:** Session-only (local React state) unless a later task adds user preference storage — **not required** for Phase B.

### 4.2 Regeneration behavior

- Mode is sent to the backend on **Generate** (and export). Changing mode **without** clicking Generate must either clear the preview or show a non-modal inline hint: **“Click Generate to refresh the report.”** (pick one behavior in Phase B; prefer **clear preview + hint** to avoid stale mixed semantics.)

### 4.3 Report chrome (HTML/PDF)

- Add a **visible mode line** under the report title or in the header block, e.g.  
  - `Variance basis: Year-to-date (vs prorated budget)`  
  - `Variance basis: Projected fiscal year-end (run-rate vs annual budget)`  
- **Do not** add a “Projected Actual” column. **Annual Budget**, **YTD Budget**, **YTD Actual** column headers stay **unchanged**; a one-line explanation clarifies that in Projected mode only the **variance columns** change meaning.

### 4.4 Sections outside income/expense category tables

- **Special Assessments** and **Unit Credit Accounts** layouts today are **not** the six-column budget table. **No change** to their structure for v1. If a future phase needs projection there, that is a **new** task.

---

## 5) Rendering rules — zero budget / zero activity

- **Row visibility:** Keep existing rule: include row if `annualBudget > 0 || ytdActual > 0`.
- **annualBudget === 0, ytdActual > 0:**  
  - **Projected mode:** `projectedFYActual` is finite; **Variance ($)** is still defined by §3.3; **Variance (%)** = **—**.
- **Favorable / unfavorable CSS:** unchanged rule: `variance >= 0` → favorable class; `< 0` → unfavorable. When variance is undefined (edge guard), use **neutral** (no green/red) or **—** only.

---

## 6) API contract (Phase B)

- Add optional query parameter on existing endpoints, e.g. `reportMode=ytd|projected` (names are implementation choice; must be documented in `reportService.js`).
- Default when omitted: **`ytd`** (backward compatible).
- Apply to:  
  `GET .../budget-actual/data`, `GET .../budget-actual/html`, `POST .../budget-actual/export` (CSV + PDF).

**Response metadata:** Include `reportMode` echo and `elapsedFraction` (optional, for QA) in JSON payload only — not required in HTML if header text suffices.

---

## 7) File-level implementation plan (Phase B)

| Area | File | Change |
|------|------|--------|
| Routes | `functions/backend/routes/reports.js` | Parse `reportMode`, validate, pass to data/html/text/export generators. |
| Data | `functions/backend/services/budgetActualDataService.js` | Branch variance + optional `projectedFYActual` internal; expose mode in `reportInfo`; keep centavos integer math; DateService only. |
| HTML | `functions/backend/services/budgetActualHtmlService.js` | Header mode line; `formatPercent` support for null → `—`; row/total rendering for projected variances. |
| Text | `functions/backend/services/budgetActualTextService.js` | Parity with HTML for exports that use text pipeline. |
| CSV/PDF | Same routes + HTML service | Ensure export uses same `reportMode`. |
| Frontend API | `frontend/sams-ui/src/services/reportService.js` | Append `reportMode` query param on get/export helpers. |
| UI | `frontend/sams-ui/src/components/reports/BudgetActualTab.jsx` | Segmented toggle, state, pass mode to `reportService`; regenerate UX. |
| Styles | `frontend/sams-ui/src/components/reports/BudgetActualTab.css` | Spacing for toggle (minimal). |
| Mobile | `frontend/mobile-app/...` | **Out of scope for Phase B minimum** unless MA requires parity; if in scope later, mirror query param in `useBudgetStatus` / HOA dashboard fetch. |

**Feature flag:** Per SAMS engineering rules, gate new `reportMode` behavior behind a feature flag if MA requires it; flag name to be chosen in Phase B kickoff.

**No new route** in default plan.

---

## 8) Phase B — Test checklist

### Manual (AVII primary)

1. **YTD default:** Open Reports → Budget vs Actual → Generate → confirm mode YTD, variances match pre-change baseline (regression).
2. **Toggle + refresh:** Switch to Projected FY-End → Generate → header shows projected basis; variance columns change; no new column.
3. **Math spot-check:** Pick one income + one expense category; hand-verify `projectedFYActual` and variance using §3 with on-screen `% FY elapsed` vs internal `elapsedFraction` (QA may read JSON `reportInfo`).
4. **annualBudget = 0:** Category with spend but no annual budget → **—** in **Variance (%)** in projected mode.
5. **Favorable / unfavorable:** Sign flip sanity for income vs expense (same as YTD semantics).
6. **Exports:** CSV + PDF in **both** modes; `%` shows `—` not `0.00%` when annual budget zero.
7. **Spanish UI** (AVII default): labels readable; no layout overflow in control row.
8. **Near FY end:** Confirm projection uses true elapsed fraction (no accidental application of 95% rule to projection denominator).

### Automated (recommended)

- Unit tests in `functions/backend/services/__tests__/` (or existing test home) for `budgetActualDataService` projection math:  
  - mid-year known fractions;  
  - `annualBudget === 0` → null or sentinel percent;  
  - `elapsedFraction` edge → no throw, **—** path;  
  - income vs expense sign conventions;  
  - totals aggregation consistency.

### Reconciliation gate (chart phase only)

- Baseline §6 reconciliation (BvA vs chart YTD) applies when a **chart** or second lens ships — **not** a blocker for the toggle-only Phase B unless those components are merged in the same PR.

---

## 9) AVII worked example (illustrative numbers)

**Assumptions for teaching the contract** (Phase B replaces with live export):  
- `elapsedFraction = 0.40` (40% of FY elapsed, Cancun dates).  
- Currency in pesos for readability; implementation stays in **centavos**.

| Category (representative) | Type | Annual budget | YTD actual (40% FY) | projectedFYActual (= YTD / 0.40) | Variance ($) projected | Variance (%) projected |
|---------------------------|------|---------------|-------------------|----------------------------------|--------------------------|-------------------------|
| HOA Dues (Cuotas) | Income | $1,200,000 | $400,000 | $1,000,000 | $1,000,000 − $1,200,000 = **−$200,000** (unfavorable) | −200k / 1,200k ≈ **−16.67%** |
| Water | Expense | $350,000 | $180,000 | $450,000 | $350,000 − $450,000 = **−$100,000** (unfavorable) | −100k / 350k ≈ **−28.57%** |
| Maintenance: Pool | Expense | $0 | $40,000 | $100,000 | $0 − $100,000 = **−$100,000** (unfavorable) | **—** (annual budget zero) |

**Interpretation:** At 40% through the year, dues collections are **behind** the run-rate needed to hit the annual income budget; water spend is **high** vs annual budget at projected year-end; pool spend has **no annual budget** so only dollar drift is shown, percent is suppressed.

---

## 10) Open risks / assumptions (for Manager)

1. **Preflight:** Phase A documentation was prepared while `scripts/assert-clean-ready.sh` **failed** (dirty working tree). Phase B IA must run preflight clean and create `feature/budget-proj-1-phase-b-…` from clean `main` before coding.
2. **Integer math:** `ytdActual / elapsedFraction` must be specified in code to avoid double drift; document chosen rounding in the service header.
3. **Optional mobile parity** not locked in this contract — confirm with MA if mobile-app fetches must accept `reportMode` in the same release.

---

**End of design contract**
