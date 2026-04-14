/**
 * Pure helpers for Budget vs Actual variance (BUDGET-PROJ-1).
 * Amounts are integer centavos. elapsedFraction is 0..1 from FY timing.
 */

/**
 * @param {number} ytdActualCentavos
 * @param {number} elapsedFraction — portion of FY elapsed (0..1), NOT the 95% prorated budget adjustment
 * @returns {number|null} projected full-year actual in centavos, or null if undefined (no elapsed time)
 */
export function projectedFYActualCentavos(ytdActualCentavos, elapsedFraction) {
  const ytd = Number(ytdActualCentavos) || 0;
  if (elapsedFraction <= 0) {
    return null;
  }
  if (elapsedFraction >= 1) {
    return Math.round(ytd);
  }
  return Math.round(ytd / elapsedFraction);
}

/**
 * Display amount for "Projected year-end" column (centavos).
 * HOA dues (fixed annual assessment with a budget): always annual budget — legal liability, not payment-date run-rate.
 */
export function projectedYearEndDisplayCentavos(
  categoryType,
  ytdActualCentavos,
  annualBudgetCentavos,
  projectionElapsedFraction,
  options = {}
) {
  const { incomeFixedAssessment = false } = options;
  const annual = Number(annualBudgetCentavos) || 0;
  const ytdActual = Number(ytdActualCentavos) || 0;

  if (
    categoryType === 'income' &&
    incomeFixedAssessment &&
    annual > 0
  ) {
    return Math.round(annual);
  }
  return projectedFYActualCentavos(ytdActual, projectionElapsedFraction);
}

/**
 * @param {'income'|'expense'} categoryType
 * @param {number} annualBudgetCentavos
 * @param {number} ytdBudgetCentavos
 * @param {number} ytdActualCentavos — positive magnitude for expenses
 * @param {'ytd'|'projected'} reportMode
 * @param {number} projectionElapsedFraction — 0..1, raw FY progress (no 95% cap)
 * @param {{ incomeFixedAssessment?: boolean }} [options]
 * @returns {{ variance: number|null, variancePercent: number|null, projectedYearEndAmount?: number|null }}
 */
export function computeCategoryVariances(
  categoryType,
  annualBudgetCentavos,
  ytdBudgetCentavos,
  ytdActualCentavos,
  reportMode,
  projectionElapsedFraction,
  options = {}
) {
  const { incomeFixedAssessment = false } = options;
  const annual = Number(annualBudgetCentavos) || 0;
  const ytdBudget = Number(ytdBudgetCentavos) || 0;
  const ytdActual = Number(ytdActualCentavos) || 0;

  if (reportMode === 'projected') {
    const projected = projectedYearEndDisplayCentavos(
      categoryType,
      ytdActual,
      annual,
      projectionElapsedFraction,
      { incomeFixedAssessment }
    );
    if (projected === null) {
      return {
        variance: null,
        variancePercent: null,
        projectedYearEndAmount: null
      };
    }
    if (categoryType === 'income') {
      const variance = projected - annual;
      const variancePercent =
        annual > 0 ? (variance / annual) * 100 : null;
      return { variance, variancePercent, projectedYearEndAmount: projected };
    }
    const variance = annual - projected;
    const variancePercent = annual > 0 ? (variance / annual) * 100 : null;
    return { variance, variancePercent, projectedYearEndAmount: projected };
  }

  if (categoryType === 'income') {
    const variance = ytdActual - ytdBudget;
    const variancePercent = ytdBudget > 0 ? (variance / ytdBudget) * 100 : null;
    return { variance, variancePercent, projectedYearEndAmount: null };
  }
  const variance = ytdBudget - ytdActual;
  const variancePercent = ytdBudget > 0 ? (variance / ytdBudget) * 100 : null;
  return { variance, variancePercent, projectedYearEndAmount: null };
}

/**
 * @param {'income'|'expense'} sectionType
 * @param {number} totalAnnualCentavos
 * @param {number} totalYtdBudgetCentavos
 * @param {number} totalYtdActualCentavos
 * @param {'ytd'|'projected'} reportMode
 * @param {number} projectionElapsedFraction
 */
export function computeSectionTotalVariances(
  sectionType,
  totalAnnualCentavos,
  totalYtdBudgetCentavos,
  totalYtdActualCentavos,
  reportMode,
  projectionElapsedFraction,
  options = {}
) {
  return computeCategoryVariances(
    sectionType,
    totalAnnualCentavos,
    totalYtdBudgetCentavos,
    totalYtdActualCentavos,
    reportMode,
    projectionElapsedFraction,
    options
  );
}
