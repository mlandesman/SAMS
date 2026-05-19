/**
 * Guard tests for waterBillsService.setUnitCurrentCharge (Stage 3 / Task 3.2a §5.3).
 *
 * Confirms that writes which would lower `bills.units.{unitId}.currentCharge`
 * below the unit's existing `basePaid` are refused with the diagnostic code
 * `WATERBILLS_CURRENTCHARGE_GUARD_BLOCKED` (no `force`), or proceed with the
 * `WATERBILLS_CURRENTCHARGE_GUARD_FORCED` warning when `force: true` is passed
 * — preventing recurrence of the unit-106 water:2026-Q1 impossible state
 * (`currentCharge = 0` with `basePaid = $1,789.74`).
 *
 * Confirms also that normal-flow writes (`newCurrentCharge >= existingBasePaid`)
 * proceed silently and apply the field update.
 */

import { jest } from '@jest/globals';

const mockBillData = {
  '2026-Q1': {
    fiscalYear: 2026,
    bills: {
      units: {
        '106': {
          basePaid: 178974,
          currentCharge: 178974,
          status: 'paid'
        }
      }
    }
  }
};

let writtenUpdates = [];

const mockDocGet = jest.fn(async function () {
  const data = mockBillData[this._docId];
  return {
    exists: data !== undefined,
    data: () => data
  };
});

const mockDocUpdate = jest.fn(async function (patch) {
  writtenUpdates.push({ docId: this._docId, patch });
});

function makeDocChain(docId) {
  const docObj = {
    _docId: docId,
    get: mockDocGet,
    update: mockDocUpdate
  };
  return docObj;
}

const mockDb = {
  collection: jest.fn(() => ({
    doc: jest.fn(() => ({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            doc: jest.fn((docId) => makeDocChain(docId))
          }))
        }))
      }))
    }))
  }))
};

jest.unstable_mockModule('../../firebase.js', () => ({
  getDb: jest.fn(async () => mockDb)
}));

jest.unstable_mockModule('../waterDataService.js', () => ({
  waterDataService: {
    invalidate: jest.fn()
  }
}));

jest.unstable_mockModule('../penaltyRecalculationService.js', () => ({
  default: { recalculatePenaltiesForClient: jest.fn() }
}));

jest.unstable_mockModule('../../../shared/logger.js', () => ({
  logInfo: jest.fn(),
  logDebug: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn()
}));

const waterBillsServiceModule = await import('../waterBillsService.js');
const waterBillsService = waterBillsServiceModule.default;
const { logWarn } = await import('../../../shared/logger.js');

describe('waterBillsService.setUnitCurrentCharge — §5.3 write guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    writtenUpdates = [];
    // Reset fixture to a known state for each test.
    mockBillData['2026-Q1'] = {
      fiscalYear: 2026,
      bills: {
        units: {
          '106': {
            basePaid: 178974,
            currentCharge: 178974,
            status: 'paid'
          }
        }
      }
    };
  });

  test('refuses the write and throws WATERBILLS_CURRENTCHARGE_GUARD_BLOCKED when newCurrentCharge < existingBasePaid and force is not set (unit-106 water:2026-Q1 fixture)', async () => {
    // Reproduce the unit-106 water:2026-Q1 mechanism: basePaid = $1,789.74,
    // an attempt to write currentCharge = 0 (the impossible-state shape).
    await expect(
      waterBillsService.setUnitCurrentCharge('AVII', '2026-Q1', '106', 0)
    ).rejects.toMatchObject({
      code: 'WATERBILLS_CURRENTCHARGE_GUARD_BLOCKED',
      diagnostic: {
        clientId: 'AVII',
        billDocId: '2026-Q1',
        unitId: '106',
        existingBasePaid: 178974,
        proposedNewCurrentCharge: 0
      }
    });

    // No Firestore write must have occurred.
    expect(writtenUpdates).toHaveLength(0);

    // Structured warning with the documented diagnostic code must be emitted.
    expect(logWarn).toHaveBeenCalled();
    const blockedCalls = logWarn.mock.calls.filter(
      ([msg]) => typeof msg === 'string' && msg.includes('WATERBILLS_CURRENTCHARGE_GUARD_BLOCKED')
    );
    expect(blockedCalls).toHaveLength(1);
    expect(blockedCalls[0][1]).toMatchObject({
      diagnosticCode: 'WATERBILLS_CURRENTCHARGE_GUARD_BLOCKED',
      clientId: 'AVII',
      billDocId: '2026-Q1',
      unitId: '106',
      existingBasePaid: 178974,
      proposedNewCurrentCharge: 0
    });
  });

  test('proceeds with a forced warning when newCurrentCharge < existingBasePaid and force: true is set', async () => {
    const result = await waterBillsService.setUnitCurrentCharge(
      'AVII',
      '2026-Q1',
      '106',
      0,
      { force: true }
    );

    expect(result).toMatchObject({
      written: true,
      forced: true,
      existingBasePaid: 178974,
      newCurrentCharge: 0
    });

    // Firestore update did happen.
    expect(writtenUpdates).toHaveLength(1);
    expect(writtenUpdates[0]).toMatchObject({
      docId: '2026-Q1',
      patch: { 'bills.units.106.currentCharge': 0 }
    });

    // Forced-warning log emitted.
    const forcedCalls = logWarn.mock.calls.filter(
      ([msg]) => typeof msg === 'string' && msg.includes('WATERBILLS_CURRENTCHARGE_GUARD_FORCED')
    );
    expect(forcedCalls).toHaveLength(1);
    expect(forcedCalls[0][1]).toMatchObject({
      diagnosticCode: 'WATERBILLS_CURRENTCHARGE_GUARD_FORCED',
      clientId: 'AVII',
      billDocId: '2026-Q1',
      unitId: '106',
      existingBasePaid: 178974,
      proposedNewCurrentCharge: 0
    });
  });

  test('writes silently and identically to pre-fix behavior when newCurrentCharge >= existingBasePaid', async () => {
    // Normal-flow write: raise currentCharge above existing basePaid.
    const result = await waterBillsService.setUnitCurrentCharge(
      'AVII',
      '2026-Q1',
      '106',
      200000
    );

    expect(result).toMatchObject({
      written: true,
      forced: false,
      existingBasePaid: 178974,
      newCurrentCharge: 200000
    });

    expect(writtenUpdates).toHaveLength(1);
    expect(writtenUpdates[0]).toMatchObject({
      docId: '2026-Q1',
      patch: { 'bills.units.106.currentCharge': 200000 }
    });

    // No guard logs of any kind.
    const guardCalls = logWarn.mock.calls.filter(
      ([msg]) =>
        typeof msg === 'string' &&
        (msg.includes('WATERBILLS_CURRENTCHARGE_GUARD_BLOCKED') ||
          msg.includes('WATERBILLS_CURRENTCHARGE_GUARD_FORCED'))
    );
    expect(guardCalls).toHaveLength(0);
  });

  test('applies the same §5.3 guard when an external db is injected (Prod-replay path)', async () => {
    await expect(
      waterBillsService.setUnitCurrentCharge('AVII', '2026-Q1', '106', 0, {}, mockDb)
    ).rejects.toMatchObject({
      code: 'WATERBILLS_CURRENTCHARGE_GUARD_BLOCKED',
      diagnostic: {
        existingBasePaid: 178974,
        proposedNewCurrentCharge: 0
      }
    });
    expect(writtenUpdates).toHaveLength(0);

    writtenUpdates = [];
    const forced = await waterBillsService.setUnitCurrentCharge(
      'AVII', '2026-Q1', '106', 0, { force: true }, mockDb
    );
    expect(forced).toMatchObject({ written: true, forced: true });
    expect(writtenUpdates).toHaveLength(1);
  });
});
