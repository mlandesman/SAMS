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

/**
 * Calculate how much of each bill has been satisfied according to the ledger.
 *
 * The ledger contains payment rows with allocations. This function matches
 * those allocations to bills and sums up what's been paid.
 *
 * @param {Array} ledgerRows - Rows from generateStatementData()
 * @param {Array} bills - Bills loaded by UPC (with billId, module type, period info)
 * @returns {Map<string, number>} Map of billId -> satisfiedCentavos
 */
export function calculateSatisfiedFromLedger(ledgerRows, bills) {
  const satisfiedMap = new Map();

  for (const bill of bills || []) {
    const billId = bill?.billId ?? bill?.period ?? bill?.billPeriod;
    if (billId) {
      satisfiedMap.set(billId, 0);
    }
  }

  for (const row of ledgerRows || []) {
    if (row?.type !== 'payment') continue;
    if (!row.allocations?.length) continue;

    for (const alloc of row.allocations) {
      const billId = matchAllocationToBill(alloc, bills);
      if (!billId || !satisfiedMap.has(billId)) continue;

      const current = satisfiedMap.get(billId) || 0;
      satisfiedMap.set(billId, current + Math.abs(alloc.amount || 0));
    }
  }

  return satisfiedMap;
}

/**
 * Match an allocation to a bill based on type and targetId.
 *
 * @param {Object} alloc - Allocation object from ledger row
 * @param {Array} bills - Bills to match against
 * @returns {string|null} billId if matched, null otherwise
 */
export function matchAllocationToBill(alloc, bills) {
  const targetId = alloc?.targetId;
  const type = alloc?.type;

  if (!targetId || !type || !Array.isArray(bills)) return null;

  for (const bill of bills) {
    const moduleType = normalizeModuleType(bill);

    if (type === 'hoa_month' && moduleType === 'hoa') {
      if (targetIdMatchesBill(targetId, bill)) {
        return getBillId(bill);
      }
    }

    if (type === 'water_consumption' && moduleType === 'water') {
      if (targetIdMatchesBill(targetId, bill)) {
        return getBillId(bill);
      }
    }

    if (type === 'water_penalty' && isWaterPenaltyBill(bill)) {
      if (targetIdMatchesBill(targetId, bill)) {
        return getBillId(bill);
      }
    }
  }

  return null;
}

/**
 * Check if allocation targetId matches a bill.
 *
 * @param {string} targetId - Allocation targetId
 * @param {Object} bill - Bill to match against
 * @returns {boolean} True if targetId matches the bill
 */
export function targetIdMatchesBill(targetId, bill) {
  if (!targetId || !bill) return false;

  // Water allocations use prefixes: water_{period} or water_penalty_{period}
  if (targetId.startsWith('water_penalty_') || targetId.startsWith('water_')) {
    const normalizedTarget = targetId
      .replace(/^water_penalty_/, '')
      .replace(/^water_/, '');
    const normalizedBillPeriod = normalizeBillPeriod(bill);
    return normalizedBillPeriod ? normalizedBillPeriod === normalizedTarget : false;
  }

  // HOA allocations use formats: Q{quarter}_{year} or month_{monthIndex}_{year}
  const quarterMatch = targetId.match(/^Q(\d{1,2})_(\d{4})$/);
  if (quarterMatch) {
    const quarter = parseInt(quarterMatch[1], 10);
    const year = parseInt(quarterMatch[2], 10);
    const billQuarter = getBillQuarter(bill);
    return billQuarter ? billQuarter.year === year && billQuarter.quarter === quarter : false;
  }

  const monthMatch = targetId.match(/^month_(\d{1,2})_(\d{4})$/);
  if (monthMatch) {
    const monthIndex = parseInt(monthMatch[1], 10);
    const year = parseInt(monthMatch[2], 10);
    const billMonth = getBillMonthIndex(bill);
    const billYear = getBillYear(bill);
    return billMonth !== null && billYear !== null
      ? billMonth === monthIndex && billYear === year
      : false;
  }

  return false;
}

function getBillId(bill) {
  return bill?.billId ?? bill?.period ?? bill?.billPeriod ?? null;
}

function normalizeModuleType(bill) {
  const raw = bill?.module ?? bill?._metadata?.moduleType ?? bill?.moduleType ?? '';
  if (!raw) return '';
  const normalized = String(raw).toLowerCase();
  if (normalized === 'hoadues') return 'hoa';
  return normalized;
}

function normalizeBillPeriod(bill) {
  const raw = getBillId(bill);
  if (!raw) return '';

  // Strip known prefixes
  const withoutPrefix = String(raw)
    .replace(/^(hoa|hoadues|water):/i, '')
    .replace(/^HOA-/, '')
    .replace(/^WATER-/, '');

  return withoutPrefix;
}

function getBillQuarter(bill) {
  const period = normalizeBillPeriod(bill);
  const match = period.match(/(\d{4})-Q(\d{1,2})/);
  if (!match) return null;
  return {
    year: parseInt(match[1], 10),
    quarter: parseInt(match[2], 10)
  };
}

function getBillMonthIndex(bill) {
  const explicit = bill?._hoaMetadata?.monthIndex ?? bill?._metadata?.monthIndex ?? bill?.monthIndex;
  if (explicit !== undefined && explicit !== null && !Number.isNaN(explicit)) {
    return parseInt(explicit, 10);
  }

  const period = normalizeBillPeriod(bill);
  const match = period.match(/(\d{4})-(\d{2})/);
  if (!match) return null;
  return parseInt(match[2], 10);
}

function getBillYear(bill) {
  const period = normalizeBillPeriod(bill);
  const match = period.match(/(\d{4})/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

function isWaterPenaltyBill(bill) {
  return Boolean(
    bill?.isPenalty ||
      bill?.penaltyOnly ||
      bill?.module === 'water_penalty' ||
      bill?._metadata?.isPenalty
  );
}
