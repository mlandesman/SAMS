# Budget Projection Design Baseline (Sprint BUDGET-PROJ-1)

Date: 2026-04-14  
Related Issue: #165  
Owner: Manager Agent (design-first planning artifact)

## 1) Why There Are Two "Budget" Sprints

This was duplicate naming, not two separate products.

- `BUDGET-PROJ-1` = baseline runway projection (the required first deliverable).
- `BUDGET-PROJ-2` = optional follow-on diagnostics/polish after baseline is trusted.

Decision:

- Treat both as one problem in two phases.
- Build and validate baseline first.
- Only then add advanced views.

## 2) Product Goal in Plain Language

We want to answer:

1. If we continue spending like we have so far this fiscal year, where do we finish at year-end?
2. Does that projected spending exceed our fixed budgeted income capacity (HOA dues)?
3. If yes, when does the projected line cross that capacity line?
4. If we remove categories (for example water), does the risk disappear (structural vs category-driven)?

Critical clarification:
- "Tracking to budget" is not the same as "cash is safe."
- The design must show both budget adherence and liquidity/cash stress.

## 2.1) What the Baseline Alone Misses

A pure budget-vs-actual projection can look healthy while bank balances still weaken due to:

- Non-budgeted expenses that still consume cash.
- Partially self-funded categories (for example water in AVII) where recovery is incomplete.
- Timing lag between outflows and recoveries.
- Special project cash cycles (collections and expenditures not moving in sync).

Therefore, the sprint should include two complementary lenses.

## 3) The Math (Simple, No Jargon)

Inputs:

- Fiscal year start and end dates.
- Today's date.
- YTD actual expenses (included categories only).
- Annual budgeted income capacity (included income categories only; default HOA dues).

Steps:

1. Compute fiscal-year progress:
  - `elapsedFraction = days from FY start to today / total FY days`
2. Compute projected full-year spend:
  - `projectedFYSpend = YTDActualSpend / elapsedFraction`
3. Build monthly projection line from FY start to FY end:
  - each month gets a proportional point between 0 and `projectedFYSpend`
4. Draw fixed income capacity as a flat horizontal line.
5. Detect first month where projected cumulative spend >= income capacity (crossover month).

Important:

- Use actual transaction timing (including uneven/quarterly spending), not rolling monthly averages.
- Projection ends at fiscal year end only (never beyond).

## 3.1) Two-Lens Calculation Model (Design Requirement)

### Lens A: Budget Adherence (Efficiency)
- Goal: "Are we spending as planned against the budget model?"
- This is the existing runway concept from issue #165.
- Primary output: projected year-end spend vs budgeted income capacity.

### Lens B: Cash Sustainability (Liquidity)
- Goal: "Will we run out of cash even if budget adherence looks acceptable?"
- Use cumulative net cash movement, not just budgeted lines:
  - Starting cash (bank + cash accounts at FY start or selected baseline date)
  - Plus realized inflows
  - Minus realized outflows
  - Plus projected inflow/outflow continuation through FY end
- Primary output: projected cash floor and month where cash drops below threshold (if any).

Minimum BUDGET-PROJ-1 requirement:
- Implement Lens A fully.
- Add Lens B as a baseline "cash-risk strip" or simple companion metric, even if full scenario modeling waits for BUDGET-PROJ-2.

## 4) Display Model (What User Sees)

For BUDGET-PROJ-1, reuse the existing Budget vs Actual layout and add a simple report mode toggle:

- `YTD` (existing behavior)
- `Projected FY-End` (new behavior)

No two-page combined output in phase 1. If both are needed, run the report twice.

Projected mode table behavior:

- Keep current column structure and width discipline.
- Do NOT add a "Projected Actual" column.
- Show projected drift using variance columns only:
  - `Variance ($)` = FY-end projected variance vs annual budget
  - `Variance (%)` = FY-end projected variance percent vs annual budget

Interpretation:

- YTD mode answers "How are we doing so far?"
- Projected mode answers "Where are we likely to land by fiscal year-end?"

## 5) Category Exclusion Control

Primary control:

- Multi-select "Exclude Categories" (category IDs under the hood).

Default preset:

- Include all categories.

Common preset for AVII:

- Exclude water-related categories for structural test.

Interpretation:

- If crossover disappears after excluding one category family, risk is category-driven.
- If crossover remains, risk is structural.

Client-specific defaults:

- MTC default lens emphasis: fixed-income runway (HOA dues dominated).
- AVII default lens emphasis: runway plus water recovery diagnostics (partial self-funding reality).

## 6) Reconciliation Gate (Must Pass Before Render)

Before showing chart:

- Recompute included YTD expense from transactions after exclusions.
- Compare against Budget-vs-Actual included YTD basis.
- If mismatch: block chart render and show data-integrity error.

No silent rendering on mismatched numbers.

## 7) Scope Split (Phase Contract)

### BUDGET-PROJ-1 (Active Now)

- Baseline projection engine
- Two-way report toggle (`YTD` vs `Projected FY-End`) in Budget vs Actual
- Projected variance columns only (no projected actual column)
- Reconciliation gate
- Manual validation with at least one live client fiscal period

### BUDGET-PROJ-2 (Later)

- Scenario overlays (best/base/worst)
- Additional diagnostic presets and explanatory tooltips
- Full liquidity engine with recovery-lag assumptions and configurable cash-floor thresholds
- Optional dedicated fiscal-health report and timeline graph
- Narrative polish/export enhancements

## 8) PO Decisions Locked (Apr 14, 2026)

1. Variance percent when annual budget is zero:
   - Use `—` (em dash), not `0.00%`.
2. Toggle default mode:
   - Default to `YTD` (current behavior).
   - Optional later enhancement: auto-default to `Projected FY-End` when fiscal year elapsed > 60%.
3. First validation client:
   - `AVII` (preferred due to Q4 relevance; MTC is earlier in fiscal cycle).

