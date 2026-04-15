/**
 * Node built-in test runner (no Jest transform required for this package).
 * Run: node --test utils/__tests__/budgetActualVarianceMath.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  projectedFYActualCentavos,
  computeCategoryVariances,
  computeSectionTotalVariances
} from '../budgetActualVarianceMath.js';

describe('projectedFYActualCentavos', () => {
  it('returns null when no FY has elapsed', () => {
    assert.equal(projectedFYActualCentavos(4000000, 0), null);
    assert.equal(projectedFYActualCentavos(4000000, -0.1), null);
  });

  it('at 40% elapsed, scales YTD', () => {
    assert.equal(projectedFYActualCentavos(4000000, 0.4), 10000000);
  });

  it('at or after FY end, equals YTD', () => {
    assert.equal(projectedFYActualCentavos(9000000, 1), 9000000);
    assert.equal(projectedFYActualCentavos(9000000, 1.2), 9000000);
  });
});

describe('computeCategoryVariances projected', () => {
  const frac = 0.4;

  it('income: projected vs annual', () => {
    const r = computeCategoryVariances('income', 1200000000, 480000000, 400000000, 'projected', frac);
    assert.equal(r.projectedYearEndAmount, 1000000000);
    assert.equal(r.variance, -200000000);
    assert.ok(Math.abs(r.variancePercent - -100 / 6) < 0.0001);
  });

  it('HOA dues (fixed assessment) locks projected year-end to annual budget', () => {
    const r = computeCategoryVariances('income', 12000000, 4800000, 4000000, 'projected', 0.4, {
      incomeFixedAssessment: true
    });
    assert.equal(r.projectedYearEndAmount, 12000000);
    assert.equal(r.variance, 0);
    assert.equal(r.variancePercent, 0);
  });

  it('fixed assessment flag ignored when annual budget is zero', () => {
    const r = computeCategoryVariances('income', 0, 0, 4000000, 'projected', 0.4, {
      incomeFixedAssessment: true
    });
    assert.equal(r.projectedYearEndAmount, 10000000);
  });

  it('expense: annual minus projected', () => {
    const r = computeCategoryVariances('expense', 350000000, 140000000, 180000000, 'projected', frac);
    assert.equal(r.projectedYearEndAmount, 450000000);
    assert.equal(r.variance, -100000000);
    assert.ok(Math.abs(r.variancePercent - (-100000000 / 350000000) * 100) < 0.0001);
  });

  it('annual budget zero yields null percent', () => {
    const r = computeCategoryVariances('expense', 0, 0, 40000000, 'projected', frac);
    assert.equal(r.projectedYearEndAmount, 100000000);
    assert.equal(r.variance, -100000000);
    assert.equal(r.variancePercent, null);
  });

  it('expense: zero YTD with annual budget uses annual as projected year-end (not $0 run-rate)', () => {
    const r = computeCategoryVariances('expense', 5000000, 2000000, 0, 'projected', 0.4);
    assert.equal(r.projectedYearEndAmount, 5000000);
    assert.equal(r.variance, 0);
    assert.equal(r.variancePercent, 0);
  });
});

describe('computeCategoryVariances ytd', () => {
  it('null percent when ytd budget zero', () => {
    const r = computeCategoryVariances('expense', 0, 0, 50000, 'ytd', 0.5);
    assert.equal(r.variance, -50000);
    assert.equal(r.variancePercent, null);
  });
});

describe('computeSectionTotalVariances', () => {
  it('matches aggregate projection for income', () => {
    const frac = 0.25;
    const r = computeSectionTotalVariances('income', 10000000, 2500000, 2000000, 'projected', frac);
    assert.equal(r.variance, -2000000);
  });
});
