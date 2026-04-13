/**
 * HOA credit aggregation — single source for dashboard + HOADuesView + PWA.
 * Pure functions only (safe for browser bundles; no DateService / firebase-admin).
 *
 * @module shared/utils/hoaCreditTotals
 */

/**
 * Current credit balance in centavos from one unit's slice of `units/creditBalances` (history journal).
 * Same algorithm as legacy getCreditBalance in creditBalanceUtils (amount-only rollup).
 *
 * @param {Object|null|undefined} creditDoc - Unit entry under creditBalances root doc
 * @returns {number} Balance in centavos (signed)
 */
export function getCreditBalanceCentavos(creditDoc) {
  if (!creditDoc?.history || !Array.isArray(creditDoc.history)) {
    return 0;
  }
  return creditDoc.history.reduce((sum, entry) => {
    const amount = typeof entry.amount === 'number' ? entry.amount : 0;
    return sum + amount;
  }, 0);
}

/**
 * Sum positive unit credits in centavos from full `creditBalances` document data (Firestore).
 * Aligns with dashboard / pre-pay logic (only credits > 0).
 *
 * @param {Record<string, object>} allCreditData - `creditBalances` doc .data()
 * @param {string[]} unitIds - Real unit ids (caller excludes pseudo-units)
 * @returns {number}
 */
export function totalCreditCentavosPositiveFromCreditBalancesRoot(allCreditData, unitIds) {
  let total = 0;
  for (const id of unitIds) {
    const c = getCreditBalanceCentavos(allCreditData[id] || {});
    if (c > 0) total += c;
  }
  return total;
}

/**
 * Sum creditBalance in pesos from HOA year API payload (positive only).
 * Matches useDashboardData pre-paid / Account Balances deduction aggregation.
 *
 * @param {Record<string, { creditBalance?: number }>|null|undefined} duesDataByUnitId
 * @returns {number}
 */
export function totalCreditPesosPositiveFromDuesYearRecord(duesDataByUnitId) {
  let sum = 0;
  for (const [unitId, unitData] of Object.entries(duesDataByUnitId || {})) {
    if (unitId === 'creditBalances' || unitId.startsWith('creditBalances')) continue;
    const creditBalance = unitData?.creditBalance || 0;
    if (creditBalance > 0) sum += creditBalance;
  }
  return sum;
}

/**
 * Footer total credit — same math as HOADuesView.calculateTotalCredit(): sum per visible unit (all signed values, pesos).
 *
 * @param {Record<string, { creditBalance?: number }>} duesDataByUnitId
 * @param {Array<{ unitId: string }>} units
 * @returns {number}
 */
export function totalCreditPesosFromDuesDataByUnitsList(duesDataByUnitId, units) {
  return units.reduce((total, unit) => {
    const unitData = duesDataByUnitId[unit.unitId];
    return total + (unitData?.creditBalance || 0);
  }, 0);
}
