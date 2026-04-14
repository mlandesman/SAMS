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
 * @param {'income'|'expense'} categoryType
 * @param {number} annualBudgetCentavos
 * @param {number} ytdBudgetCentavos
 * @param {number} ytdActualCentavos — positive magnitude for expenses
 * @param {'ytd'|'projected'} reportMode
 * @param {number} projectionElapsedFraction — 0..1, raw FY progress (no 95% cap)
 * @returns {{ variance: number|null, variancePercent: number|null }}
 */
export function computeCategoryVariances(
  categoryType,
  annualBudgetCentavos,
  ytdBudgetCentavos,
  ytdActualCentavos,
  reportMode,
  projectionElapsedFraction
) {
  const annual = Number(annualBudgetCentavos) || 0;
  const ytdBudget = Number(ytdBudgetCentavos) || 0;
  const ytdActual = Number(ytdActualCentavos) || 0;

  if (reportMode === 'projected') {
    const projected = projectedFYActualCentavos(ytdActual, projectionElapsedFraction);
    if (projected === null) {
      return { variance: null, variancePercent: null };
    }
    if (categoryType === 'income') {
      const variance = projected - annual;
      const variancePercent = annual > 0 ? (variance / annual) * 100 : null;
      return { variance, variancePercent };
    }
    const variance = annual - projected;
    const variancePercent = annual > 0 ? (variance / annual) * 100 : null;
    return { variance, variancePercent };
  }

  if (categoryType === 'income') {
    const variance = ytdActual - ytdBudget;
    const variancePercent = ytdBudget > 0 ? (variance / ytdBudget) * 100 : null;
    return { variance, variancePercent };
  }
  const variance = ytdBudget - ytdActual;
  const variancePercent = ytdBudget > 0 ? (variance / ytdBudget) * 100 : null;
  return { variance, variancePercent };
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
  projectionElapsedFraction
) {
  return computeCategoryVariances(
    sectionType,
    totalAnnualCentavos,
    totalYtdBudgetCentavos,
    totalYtdActualCentavos,
    reportMode,
    projectionElapsedFraction
  );
}
