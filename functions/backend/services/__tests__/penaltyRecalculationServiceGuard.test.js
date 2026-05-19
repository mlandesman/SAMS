/**
 * Guard tests for PenaltyRecalculationService (Stage 3 / Task 3.2a §5.1).
 *
 * Confirms that the recalc service refuses to emit a new `penaltyAmount` that
 * would drop below the bill's already-paid `penaltyPaid`, which would create
 * the impossible state observed on AVII unit 106 water:2026-Q2 where
 * `penaltyPaid = $338.89 > penaltyAmount = $220.38`.
 *
 * Confirms also that the guard does NOT alter normal-flow behavior where the
 * new penalty is >= the already-paid penalty.
 *
 * Tests exercise the shared service `recalculatePenalties` directly because
 * that is the single emission point for the penalty value the writer
 * subsequently persists; the backend wrapper also enforces the same invariant
 * defensively before its Firestore write.
 */

import { jest } from '@jest/globals';

jest.unstable_mockModule('../../../shared/logger.js', () => ({
  logInfo: jest.fn(),
  logDebug: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn()
}));

const { recalculatePenalties } = await import('../../../shared/services/PenaltyRecalculationService.js');
const { logWarn } = await import('../../../shared/logger.js');

describe('PenaltyRecalculationService — §5.1 write guard', () => {
  const config = { penaltyRate: 0.05, penaltyDays: 10 };

  // Pin asOfDate well past the bills' grace period so penalties are eligible.
  const asOfDate = new Date('2026-05-17T00:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('skips the penalty write when proposed newPenaltyAmount < currentPenaltyPaid (unit-106 water:2026-Q2 shape)', async () => {
    // Fixture mirrors AVII unit 106 water:2026-Q2 shape from Phase-2 doc:
    //   penaltyPaid = $338.89 (33889 centavos)
    //   currentPenaltyAmount = $338.89 (33889 centavos)
    //   recalc would propose a much lower penaltyAmount because base is
    //   nearly paid (small overdueAmount → small compounding penalty).
    // Concrete numbers: currentCharge $2,203.80 with paidAmount $2,193.80
    // leaves only $10 unpaid base. Compounding for several months past grace
    // produces a small number well below 33889.
    const bills = [
      {
        billId: '2026-Q2',
        currentCharge: 220380,
        paidAmount: 219380,
        penaltyAmount: 33889,
        penaltyPaid: 33889,
        status: 'partial',
        dueDate: '2026-01-01'
      }
    ];

    const result = await recalculatePenalties({
      clientId: 'AVII',
      moduleType: 'water',
      bills,
      asOfDate,
      config
    });

    expect(result.updatedBills).toHaveLength(1);
    const emitted = result.updatedBills[0];

    // Guard fired — the emitted penaltyAmount must NOT be below penaltyPaid.
    expect(emitted.penaltyAmount).toBeGreaterThanOrEqual(33889);
    // Specifically, the existing penaltyAmount must be preserved unchanged.
    expect(emitted.penaltyAmount).toBe(33889);

    expect(result.guardSkippedBills).toBeDefined();
    expect(result.guardSkippedBills).toHaveLength(1);
    expect(result.guardSkippedBills[0]).toMatchObject({
      billId: '2026-Q2',
      currentPenaltyAmount: 33889,
      currentPenaltyPaid: 33889
    });
    // proposedNewPenaltyAmount must be strictly less than penaltyPaid for the
    // guard to have fired in the first place.
    expect(result.guardSkippedBills[0].proposedNewPenaltyAmount).toBeLessThan(33889);

    // Structured warning with the documented diagnostic code must be emitted.
    expect(logWarn).toHaveBeenCalled();
    const [warnMessage, warnMeta] = logWarn.mock.calls[0];
    expect(warnMessage).toContain('PENALTY_RECALC_GUARD_SKIPPED');
    expect(warnMeta).toMatchObject({
      diagnosticCode: 'PENALTY_RECALC_GUARD_SKIPPED',
      clientId: 'AVII',
      moduleType: 'water',
      billId: '2026-Q2',
      currentPenaltyAmount: 33889,
      currentPenaltyPaid: 33889
    });
  });

  test('proceeds normally when proposed newPenaltyAmount >= currentPenaltyPaid', async () => {
    // Bill far enough past grace and with a large unpaid balance that the
    // computed penalty is large — and crucially, larger than penaltyPaid (0).
    const bills = [
      {
        billId: '2026-Q1',
        currentCharge: 500000,
        paidAmount: 0,
        penaltyAmount: 0,
        penaltyPaid: 0,
        status: 'unpaid',
        dueDate: '2026-01-01'
      }
    ];

    const result = await recalculatePenalties({
      clientId: 'AVII',
      moduleType: 'water',
      bills,
      asOfDate,
      config
    });

    expect(result.updatedBills).toHaveLength(1);
    const emitted = result.updatedBills[0];

    // Penalty must have been updated (positive value, write proceeds).
    expect(emitted.penaltyAmount).toBeGreaterThan(0);
    expect(emitted.totalAmount).toBe(500000 + emitted.penaltyAmount);
    expect(emitted.lastPenaltyUpdate).toBe(asOfDate.toISOString());

    // No guard skips.
    expect(result.guardSkippedBills).toBeUndefined();
    // No guard-skip warning emitted.
    const guardCalls = logWarn.mock.calls.filter(
      ([msg]) => typeof msg === 'string' && msg.includes('PENALTY_RECALC_GUARD_SKIPPED')
    );
    expect(guardCalls).toHaveLength(0);
  });
});
