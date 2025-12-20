/**
 * Bill Calculation Utilities
 * 
 * ARCHITECTURAL PATTERN: Never store derived values. Calculate them on demand.
 * 
 * This module provides getter functions that calculate *Owed values from source fields,
 * eliminating stale data bugs that occur when source fields (like penaltyAmount) are
 * modified after derived fields were calculated.
 * 
 * USAGE:
 * - ALWAYS use these getters instead of accessing bill.baseOwed, bill.penaltyOwed, bill.totalOwed
 * - Call hydrateBillForResponse() at API boundaries before sending to frontend
 * 
 * @module billCalculations
 */

/**
 * Get remaining base amount owed
 * @param {Object} bill - Bill object with baseAmount/baseCharge/currentCharge and basePaid
 * @returns {number} Amount still owed in centavos
 */
export function getBaseOwed(bill) {
  // Support multiple field names for base amount (different modules use different names)
  const baseAmount = bill.baseAmount ?? bill.baseCharge ?? bill.currentCharge ?? 0;
  const basePaid = bill.basePaid ?? 0;
  return Math.max(0, baseAmount - basePaid);
}

/**
 * Get remaining penalty amount owed
 * @param {Object} bill - Bill object with penaltyAmount and penaltyPaid
 * @returns {number} Penalty still owed in centavos
 */
export function getPenaltyOwed(bill) {
  const penaltyAmount = bill.penaltyAmount ?? 0;
  const penaltyPaid = bill.penaltyPaid ?? 0;
  return Math.max(0, penaltyAmount - penaltyPaid);
}

/**
 * Get total amount still owed (base + penalty)
 * @param {Object} bill - Bill object
 * @returns {number} Total still owed in centavos
 */
export function getTotalOwed(bill) {
  return getBaseOwed(bill) + getPenaltyOwed(bill);
}

/**
 * Get total amount due (base + penalty, ignoring payments)
 * @param {Object} bill - Bill object
 * @returns {number} Total due in centavos
 */
export function getTotalDue(bill) {
  const baseAmount = bill.baseAmount ?? bill.baseCharge ?? bill.currentCharge ?? 0;
  const penaltyAmount = bill.penaltyAmount ?? 0;
  return baseAmount + penaltyAmount;
}

/**
 * Get total amount paid so far
 * @param {Object} bill - Bill object
 * @returns {number} Total paid in centavos
 */
export function getTotalPaid(bill) {
  const basePaid = bill.basePaid ?? 0;
  const penaltyPaid = bill.penaltyPaid ?? 0;
  return basePaid + penaltyPaid;
}

/**
 * Hydrate bill object with derived fields for API response/frontend
 * 
 * Call this at the END of processing, right before sending to frontend.
 * This adds the derived fields that the frontend expects, calculated fresh
 * from the current source field values.
 * 
 * @param {Object} bill - Bill object
 * @returns {Object} Bill with derived fields populated
 */
export function hydrateBillForResponse(bill) {
  return {
    ...bill,
    baseOwed: getBaseOwed(bill),
    penaltyOwed: getPenaltyOwed(bill),
    totalOwed: getTotalOwed(bill),
    totalDue: getTotalDue(bill),
    totalPaid: getTotalPaid(bill)
  };
}

/**
 * Hydrate an array of bills for API response
 * 
 * @param {Array<Object>} bills - Array of bill objects
 * @returns {Array<Object>} Bills with derived fields populated
 */
export function hydrateBillsForResponse(bills) {
  return bills.map(hydrateBillForResponse);
}
