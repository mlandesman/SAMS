/**
 * Unit tests for allocationUtils.allocateByOwnership
 * PM5A Allocation Engine v2 verification
 */

import { allocateByOwnership } from '../allocationUtils.js';

describe('allocateByOwnership', () => {
  const OWNERSHIP_3_UNITS = {
    '1A': 0.25,
    '2A': 0.50,
    '2B': 0.25
  };

  test('all units in - baseline', () => {
    const { allocations, reconciliation } = allocateByOwnership(10000, OWNERSHIP_3_UNITS, {});
    expect(allocations['1A']).toBe(2500);
    expect(allocations['2A']).toBe(5000);
    expect(allocations['2B']).toBe(2500);
    expect(reconciliation.sumAllocated).toBe(10000);
    expect(reconciliation.match).toBe(true);
    expect(reconciliation.includedCount).toBe(3);
  });

  test('one unit out - MTC 2B-like (2B excluded)', () => {
    const { allocations, reconciliation } = allocateByOwnership(10000, OWNERSHIP_3_UNITS, { '2B': 'out' });
    expect(allocations['2B']).toBe(0);
    // 1A and 2A split: 1A 25/(25+50)=1/3, 2A 50/75=2/3
    expect(allocations['1A'] + allocations['2A']).toBe(10000);
    expect(allocations['1A']).toBe(3333); // floor(10000/3)
    expect(allocations['2A']).toBe(6667); // remainder goes to 2A (larger share)
    expect(reconciliation.sumAllocated).toBe(10000);
    expect(reconciliation.match).toBe(true);
    expect(reconciliation.includedCount).toBe(2);
  });

  test('multiple units out', () => {
    const ownership = { A: 0.1, B: 0.2, C: 0.3, D: 0.4 };
    const { allocations, reconciliation } = allocateByOwnership(10000, ownership, { B: 'out', D: 'out' });
    expect(allocations['B']).toBe(0);
    expect(allocations['D']).toBe(0);
    // A and C: A 0.1/0.4=25%, C 0.3/0.4=75%
    expect(allocations['A'] + allocations['C']).toBe(10000);
    expect(allocations['A']).toBe(2500);
    expect(allocations['C']).toBe(7500);
    expect(reconciliation.match).toBe(true);
  });

  test('only one unit remains in', () => {
    const { allocations, reconciliation } = allocateByOwnership(10000, OWNERSHIP_3_UNITS, { '2A': 'out', '2B': 'out' });
    expect(allocations['1A']).toBe(10000);
    expect(allocations['2A']).toBe(0);
    expect(allocations['2B']).toBe(0);
    expect(reconciliation.match).toBe(true);
    expect(reconciliation.includedCount).toBe(1);
  });

  test('validation error when zero units in', () => {
    expect(() => allocateByOwnership(10000, OWNERSHIP_3_UNITS, { '1A': 'out', '2A': 'out', '2B': 'out' }))
      .toThrow('At least one unit must be included');
  });

  test('centavos-safe rounding - sum equals total', () => {
    const ownership = { A: 0.333, B: 0.333, C: 0.334 };
    const { allocations, reconciliation } = allocateByOwnership(100, ownership, {});
    const sum = allocations['A'] + allocations['B'] + allocations['C'];
    expect(sum).toBe(100);
    expect(reconciliation.match).toBe(true);
  });

  test('deterministic tie-break by unitId', () => {
    const ownership = { A: 0.5, B: 0.5 };
    const { allocations } = allocateByOwnership(1, ownership, {});
    expect(allocations['A'] + allocations['B']).toBe(1);
    // One gets 1, one gets 0. Tie-break: unitId ascending, so A before B
    expect(allocations['A']).toBe(1);
    expect(allocations['B']).toBe(0);
  });

  test('excluded unit in output with zero', () => {
    const { allocations } = allocateByOwnership(10000, OWNERSHIP_3_UNITS, { '2B': 'out' });
    expect(allocations['2B']).toBe(0);
  });
});
