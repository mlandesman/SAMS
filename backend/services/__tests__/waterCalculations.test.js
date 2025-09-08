import { WaterMeterService } from '../waterMeterService.js';

describe('Water Calculation Engine', () => {
  let service;
  
  beforeEach(() => {
    service = new WaterMeterService();
  });
  
  describe('calculateConsumption', () => {
    test('calculates normal consumption', () => {
      const result = service.calculateConsumption(1234, 1180);
      expect(result.consumption).toBe(54);
      expect(result.warnings).toEqual([]);
    });
    
    test('handles meter rollover', () => {
      const result = service.calculateConsumption(100, 9950);
      expect(result.consumption).toBe(150);
      expect(result.warning).toBe('Meter rollover detected');
    });
    
    test('warns on high consumption', () => {
      const result = service.calculateConsumption(1450, 1200);
      expect(result.consumption).toBe(250);
      expect(result.warnings).toContain('Unusually high consumption');
    });
    
    test('rejects negative readings', () => {
      expect(() => service.calculateConsumption(-10, 100))
        .toThrow('Readings cannot be negative');
    });
    
    test('handles zero consumption', () => {
      const result = service.calculateConsumption(1000, 1000);
      expect(result.consumption).toBe(0);
      expect(result.warnings).toEqual([]);
    });
    
    test('detects invalid rollover', () => {
      expect(() => service.calculateConsumption(100, 9000))
        .toThrow('Invalid consumption: 1100. Check readings.');
    });
  });
  
  describe('applyCompoundPenalty', () => {
    test('calculates 5% compound penalty for 2 months', () => {
      const result = service.applyCompoundPenalty(100000, 0.05, 2);
      expect(result.penalty).toBe(10250); // (1.05^2 - 1) * 100000 = 10250
      expect(result.totalWithPenalty).toBe(110250);
      expect(result.effectiveRate).toBeCloseTo(10.25, 2);
    });
    
    test('returns zero penalty for on-time payment', () => {
      const result = service.applyCompoundPenalty(100000, 0.05, 0);
      expect(result.penalty).toBe(0);
      expect(result.totalWithPenalty).toBe(100000);
      expect(result.effectiveRate).toBe(0);
    });
    
    test('calculates single month penalty', () => {
      const result = service.applyCompoundPenalty(100000, 0.05, 1);
      expect(result.penalty).toBe(5000); // 5% of 100000
      expect(result.totalWithPenalty).toBe(105000);
      expect(result.effectiveRate).toBeCloseTo(5, 2);
    });
    
    test('handles negative months (treats as 0)', () => {
      const result = service.applyCompoundPenalty(100000, 0.05, -1);
      expect(result.penalty).toBe(0);
      expect(result.totalWithPenalty).toBe(100000);
      expect(result.monthsLate).toBe(0);
    });
    
    test('calculates high compound penalty for many months', () => {
      const result = service.applyCompoundPenalty(100000, 0.05, 12);
      // (1.05^12 - 1) * 100000 ≈ 79585
      expect(result.penalty).toBeGreaterThan(70000);
      expect(result.effectiveRate).toBeGreaterThan(70);
    });
  });
  
  describe('handleCreditBalance', () => {
    test('applies partial credit', () => {
      const result = service.handleCreditBalance(50000, 20000);
      expect(result.amountDue).toBe(30000);
      expect(result.creditUsed).toBe(20000);
      expect(result.creditRemaining).toBe(0);
      expect(result.originalAmount).toBe(50000);
    });
    
    test('handles excess credit', () => {
      const result = service.handleCreditBalance(30000, 50000);
      expect(result.amountDue).toBe(0);
      expect(result.creditUsed).toBe(30000);
      expect(result.creditRemaining).toBe(20000);
      expect(result.originalAmount).toBe(30000);
    });
    
    test('handles zero credit', () => {
      const result = service.handleCreditBalance(50000, 0);
      expect(result.amountDue).toBe(50000);
      expect(result.creditUsed).toBe(0);
      expect(result.creditRemaining).toBe(0);
    });
    
    test('handles negative credit (treats as 0)', () => {
      const result = service.handleCreditBalance(50000, -1000);
      expect(result.amountDue).toBe(50000);
      expect(result.creditUsed).toBe(0);
      expect(result.creditRemaining).toBe(0);
    });
    
    test('handles exact credit match', () => {
      const result = service.handleCreditBalance(50000, 50000);
      expect(result.amountDue).toBe(0);
      expect(result.creditUsed).toBe(50000);
      expect(result.creditRemaining).toBe(0);
    });
  });
  
  describe('calculateDaysLate', () => {
    test('calculates days late correctly', () => {
      const dueDate = new Date('2025-08-01');
      const currentDate = new Date('2025-08-11');
      const result = service.calculateDaysLate(dueDate, currentDate);
      expect(result).toBe(10);
    });
    
    test('returns 0 for on-time', () => {
      const dueDate = new Date('2025-08-11');
      const currentDate = new Date('2025-08-11');
      const result = service.calculateDaysLate(dueDate, currentDate);
      expect(result).toBe(0);
    });
    
    test('returns 0 for early payment', () => {
      const dueDate = new Date('2025-08-11');
      const currentDate = new Date('2025-08-01');
      const result = service.calculateDaysLate(dueDate, currentDate);
      expect(result).toBe(0);
    });
    
    test('uses current date when not provided', () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 5); // 5 days ago
      const result = service.calculateDaysLate(dueDate);
      expect(result).toBeGreaterThanOrEqual(5);
    });
    
    test('handles string dates', () => {
      const result = service.calculateDaysLate('2025-08-01', '2025-08-15');
      expect(result).toBe(14);
    });
  });
  
  describe('calculateWaterCharges', () => {
    const config = {
      ratePerM3: 5000, // 50.00 MXN per m³
      penaltyRate: 0.05,
      penaltyDays: 10
    };
    
    test('calculates basic charge without penalty', () => {
      const result = service.calculateWaterCharges(54.78, config, 0);
      expect(result.subtotal).toBe(273900);
      expect(result.penalty).toBe(0);
      expect(result.total).toBe(273900);
    });
    
    test('applies penalty after grace period', () => {
      const result = service.calculateWaterCharges(54.78, config, 15);
      expect(result.subtotal).toBe(273900);
      expect(result.penalty).toBe(13695); // 5% of 273900
      expect(result.total).toBe(287595);
    });
    
    test('no penalty within grace period', () => {
      const result = service.calculateWaterCharges(54.78, config, 10);
      expect(result.subtotal).toBe(273900);
      expect(result.penalty).toBe(0);
      expect(result.total).toBe(273900);
    });
    
    test('handles zero consumption', () => {
      const result = service.calculateWaterCharges(0, config, 0);
      expect(result.subtotal).toBe(0);
      expect(result.penalty).toBe(0);
      expect(result.total).toBe(0);
    });
  });
});