import { jest } from '@jest/globals';

jest.unstable_mockModule('../../../shared/logger.js', () => ({
  logInfo: jest.fn(),
  logDebug: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn()
}));

const { __testables } = await import('../generateUPCData.js');

describe('generateUPCData HOA remaining math', () => {
  test('keeps quarterly HOA bill when only authoritative base remaining exists', () => {
    const rawData = {
      hoaDues: [
        {
          billId: '2026-Q3',
          billType: 'hoa',
          fiscalYear: 2026,
          quarter: 3,
          isQuarterly: true,
          description: 'HOA Dues Q3 2026',
          originalCentavos: 30000,
          paidCentavos: 30000,
          basePaidCentavos: 0,
          penaltyCentavos: 0,
          penaltyPaidCentavos: 30000,
          dueDate: '2026-01-01T00:00:00.000Z'
        }
      ],
      waterBills: [],
      projectBills: []
    };

    const bills = __testables.computePerBillRemaining(rawData, [], []);

    expect(bills).toHaveLength(1);
    expect(bills[0].billId).toBe('2026-Q3');
    expect(bills[0].remainingCentavos).toBe(30000);
    expect(bills[0].totalRemainingCentavos).toBe(30000);
    expect(bills[0].status).toBe('partial');
  });

  test('uses component formulas for normal HOA partial-payment case', () => {
    const rawData = {
      hoaDues: [
        {
          billId: '2026-Q4',
          billType: 'hoa',
          fiscalYear: 2026,
          quarter: 4,
          isQuarterly: true,
          description: 'HOA Dues Q4 2026',
          originalCentavos: 30000,
          paidCentavos: 20200,
          basePaidCentavos: 20000,
          penaltyCentavos: 1000,
          penaltyPaidCentavos: 200,
          dueDate: '2026-04-01T00:00:00.000Z'
        }
      ],
      waterBills: [],
      projectBills: []
    };

    const bills = __testables.computePerBillRemaining(rawData, [], []);

    expect(bills).toHaveLength(1);
    expect(bills[0].remainingCentavos).toBe(10000);
    expect(bills[0].penaltyRemainingCentavos).toBe(800);
    expect(bills[0].totalRemainingCentavos).toBe(10800);
    expect(bills[0].status).toBe('partial');
  });

  test('does not change water remaining behavior', () => {
    const rawData = {
      hoaDues: [],
      waterBills: [
        {
          billId: '2026-01',
          billType: 'water',
          description: 'Water Bill 2026-01',
          originalCentavos: 10000,
          paidCentavos: 8000,
          penaltyCentavos: 500,
          penaltyPaidCentavos: 0,
          dueDate: '2026-02-01T00:00:00.000Z'
        }
      ],
      projectBills: []
    };

    const bills = __testables.computePerBillRemaining(rawData, [], []);

    expect(bills).toHaveLength(1);
    expect(bills[0].remainingCentavos).toBe(2000);
    expect(bills[0].penaltyRemainingCentavos).toBe(500);
    expect(bills[0].totalRemainingCentavos).toBe(2500);
  });
});

describe('generateUPCData penalty recalculation skip behavior', () => {
  test('does not skip HOA penalty recalculation when total paid masks unpaid base', async () => {
    const rawData = {
      hoaDues: [
        {
          billId: '2026-Q3',
          originalCentavos: 10000,
          paidCentavos: 10000,
          basePaidCentavos: 0,
          penaltyPaidCentavos: 10000,
          penaltyCentavos: 0,
          dueDate: '2025-01-01T00:00:00.000Z'
        }
      ],
      waterBills: [],
      config: {
        penaltyRate: 0.1,
        penaltyDays: 10
      }
    };

    await __testables.recalculatePenaltiesForRawData(rawData, new Date('2025-03-01T00:00:00.000Z'));

    expect(rawData.hoaDues[0].penaltyCentavos).toBeGreaterThan(0);
  });

  test('keeps water skip behavior unchanged when base is covered', async () => {
    const rawData = {
      hoaDues: [],
      waterBills: [
        {
          billId: '2026-01',
          originalCentavos: 10000,
          paidCentavos: 10000,
          basePaidCentavos: 0,
          penaltyPaidCentavos: 10000,
          penaltyCentavos: 777,
          dueDate: '2025-01-01T00:00:00.000Z'
        }
      ],
      config: {
        penaltyRate: 0.1,
        penaltyDays: 10
      }
    };

    await __testables.recalculatePenaltiesForRawData(rawData, new Date('2025-03-01T00:00:00.000Z'));

    expect(rawData.waterBills[0].penaltyCentavos).toBe(777);
  });
});

describe('generateUPCData penalty recalc UPC-preview §5.1 guard (PENALTY_RECALC_GUARD_RATCHETED_UPC_PREVIEW)', () => {
  test('HOA: ratchets penaltyCentavos up to penaltyPaidCentavos when recalc would drop below paid', async () => {
    // Construct a bill where:
    //   - originalCentavos = 10000 (HOA base; partial-paid)
    //   - basePaidCentavos = 0 (so the skip at line 225 does NOT fire — recalc runs)
    //   - penaltyPaidCentavos = 50000 (already paid this much penalty)
    //   - penaltyCentavos = 60000 (current assessed)
    //   - dueDate very recent + low penaltyRate → recalc proposes a value LESS than 50000
    // Expectation: in-memory penaltyCentavos must NOT drop below 50000.
    const rawData = {
      hoaDues: [
        {
          billId: '2026-Q3',
          originalCentavos: 10000,
          paidCentavos: 50000,
          basePaidCentavos: 0,
          penaltyPaidCentavos: 50000,
          penaltyCentavos: 60000,
          dueDate: '2025-03-01T00:00:00.000Z'
        }
      ],
      waterBills: [],
      config: {
        // 1% penalty rate, 10 days grace — recalc should propose a value
        // far below the inflated 60000 / 50000 currently on the bill.
        penaltyRate: 0.01,
        penaltyDays: 10
      }
    };

    await __testables.recalculatePenaltiesForRawData(rawData, new Date('2025-03-15T00:00:00.000Z'));

    // The guard should ratchet penaltyCentavos up to 50000 (penaltyPaidCentavos)
    // rather than letting it fall to a recalc-proposed value below paid.
    expect(rawData.hoaDues[0].penaltyCentavos).toBeGreaterThanOrEqual(50000);
  });

  test('water: ratchets penaltyCentavos up to penaltyPaidCentavos when recalc would drop below paid', async () => {
    const rawData = {
      hoaDues: [],
      waterBills: [
        {
          billId: '2026-Q1',
          originalCentavos: 10000,
          paidCentavos: 50000,
          basePaidCentavos: 0,
          penaltyPaidCentavos: 50000,
          penaltyCentavos: 60000,
          dueDate: '2025-03-01T00:00:00.000Z'
        }
      ],
      config: {
        penaltyRate: 0.01,
        penaltyDays: 10
      }
    };

    await __testables.recalculatePenaltiesForRawData(rawData, new Date('2025-03-15T00:00:00.000Z'));

    expect(rawData.waterBills[0].penaltyCentavos).toBeGreaterThanOrEqual(50000);
  });

  test('HOA: does not ratchet when recalc result is greater than penaltyPaid (normal recalc growth)', async () => {
    // Sanity check: when the recalc proposes a value HIGHER than penaltyPaid,
    // the guard does NOT trigger and penaltyCentavos updates normally.
    const rawData = {
      hoaDues: [
        {
          billId: '2026-Q3',
          originalCentavos: 100000,
          paidCentavos: 1000,
          basePaidCentavos: 0,
          penaltyPaidCentavos: 1000,
          penaltyCentavos: 0,
          dueDate: '2024-12-01T00:00:00.000Z'
        }
      ],
      waterBills: [],
      config: {
        penaltyRate: 0.05,
        penaltyDays: 10
      }
    };

    await __testables.recalculatePenaltiesForRawData(rawData, new Date('2025-03-01T00:00:00.000Z'));

    // Recalc against a 100000-base bill 3 months overdue at 5%/period should
    // produce a penalty greater than the 1000 already paid; guard should NOT
    // suppress this normal upward recalculation.
    expect(rawData.hoaDues[0].penaltyCentavos).toBeGreaterThan(1000);
  });
});
