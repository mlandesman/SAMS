/**
 * Allocation Utilities
 *
 * Pure functions for splitting amounts by unit ownership with participation overrides.
 * Used by: Projects (special assessments), budget planning, HOA dues calculation.
 *
 * ARCHITECTURE:
 * - All amounts in CENTAVOS (integers) - no floating point for money
 * - Ownership percentages as decimals (0-1, e.g. 0.071 for 7.1%)
 * - Participation: 'in' (default) or 'out' - excluded units get zero, share rebalanced
 *
 * @module shared/utils/allocationUtils
 */

/**
 * Allocate a total amount across units by ownership, with participation overrides.
 *
 * @param {number} totalCentavos - Total amount to allocate (integer centavos)
 * @param {Object<string, number>} ownershipMap - unitId -> ownership decimal (0-1)
 * @param {Object<string, 'in'|'out'>} [participationMap] - unitId -> 'in'|'out'. Default 'in' if absent.
 * @returns {{ allocations: Object<string, number>, reconciliation: Object }}
 * @throws {Error} If zero units are 'in', or totalCentavos is invalid
 */
export function allocateByOwnership(totalCentavos, ownershipMap, participationMap = {}) {
  const total = Math.round(Number(totalCentavos));
  if (!Number.isInteger(total) || total < 0) {
    throw new Error('totalCentavos must be a non-negative integer');
  }

  if (!ownershipMap || typeof ownershipMap !== 'object') {
    throw new Error('ownershipMap must be an object');
  }

  // Build included units: participation 'out' or absent from ownership = excluded
  const includedUnits = [];
  let totalIncludedOwnership = 0;

  for (const [unitId, ownership] of Object.entries(ownershipMap)) {
    const pct = Number(ownership);
    if (Number.isNaN(pct) || pct < 0 || pct > 1) continue;

    const participation = participationMap[unitId];
    if (participation === 'out') continue;

    includedUnits.push({ unitId, ownership: pct });
    totalIncludedOwnership += pct;
  }

  if (includedUnits.length === 0) {
    throw new Error('At least one unit must be included (participation "in"). Zero units in.');
  }

  if (totalIncludedOwnership <= 0) {
    throw new Error('Total ownership of included units must be positive');
  }

  // Rebalance: each unit's share = ownership / totalIncludedOwnership
  const shares = includedUnits.map((u) => ({
    unitId: u.unitId,
    share: u.ownership / totalIncludedOwnership
  }));

  // Allocate using largest-remainder for centavos-safe rounding
  const allocations = {};
  const idealAmounts = shares.map((s) => ({
    unitId: s.unitId,
    ideal: total * s.share,
    floor: Math.floor(total * s.share),
    remainder: (total * s.share) % 1
  }));

  let allocated = 0;
  for (const { unitId, floor } of idealAmounts) {
    allocations[unitId] = floor;
    allocated += floor;
  }

  let remainder = total - allocated;

  if (remainder > 0) {
    // Sort by remainder descending, then unitId ascending for deterministic tie-break
    const sorted = [...idealAmounts].sort((a, b) => {
      const diff = b.remainder - a.remainder;
      if (diff !== 0) return diff;
      return a.unitId.localeCompare(b.unitId);
    });

    for (let i = 0; i < remainder && i < sorted.length; i++) {
      allocations[sorted[i].unitId] += 1;
    }
  }

  // Excluded units get zero allocation (explicit in output)
  for (const unitId of Object.keys(ownershipMap)) {
    if (participationMap[unitId] === 'out' && !(unitId in allocations)) {
      allocations[unitId] = 0;
    }
  }

  const sumAllocated = Object.values(allocations).reduce((s, v) => s + v, 0);

  return {
    allocations,
    reconciliation: {
      totalCentavos: total,
      sumAllocated,
      match: sumAllocated === total,
      includedCount: includedUnits.length,
      totalIncludedOwnership
    }
  };
}
