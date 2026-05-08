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
