/**
 * Unit Tests for UnifiedPaymentWrapper
 * 
 * Tests the unified payment system that combines HOA and Water Bills
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnifiedPaymentWrapper } from '../unifiedPaymentWrapper.js';

// Mock dependencies
vi.mock('../../shared/services/DateService.js', () => ({
  getNow: () => new Date('2025-11-02T12:00:00Z')
}));

vi.mock('../../shared/services/PaymentDistributionService.js', () => ({
  calculatePaymentDistribution: vi.fn()
}));

vi.mock('../../shared/services/CreditBalanceService.js', () => ({
  getCreditBalance: vi.fn()
}));

vi.mock('../firebase.js', () => ({
  getDb: vi.fn()
}));

describe('UnifiedPaymentWrapper', () => {
  let wrapper;
  
  beforeEach(() => {
    wrapper = new UnifiedPaymentWrapper();
    vi.clearAllMocks();
  });

  describe('Priority Calculation', () => {
    const currentDate = new Date('2025-11-02');
    const fiscalYearStartMonth = 7; // July start
    
    it('should assign priority 1 to past due HOA bills', () => {
      const bill = {
        _metadata: { moduleType: 'hoa' },
        dueDate: '2025-10-01' // Past due
      };
      
      const priority = wrapper._calculatePriority(bill, currentDate, fiscalYearStartMonth);
      expect(priority).toBe(1);
    });
    
    it('should assign priority 2 to past due Water bills', () => {
      const bill = {
        _metadata: { moduleType: 'water' },
        dueDate: '2025-09-15' // Past due
      };
      
      const priority = wrapper._calculatePriority(bill, currentDate, fiscalYearStartMonth);
      expect(priority).toBe(2);
    });
    
    it('should assign priority 3 to current HOA bills', () => {
      const bill = {
        _metadata: { moduleType: 'hoa' },
        dueDate: '2025-11-01' // Current month
      };
      
      const priority = wrapper._calculatePriority(bill, currentDate, fiscalYearStartMonth);
      expect(priority).toBe(3);
    });
    
    it('should assign priority 4 to current Water bills', () => {
      const bill = {
        _metadata: { moduleType: 'water' },
        dueDate: '2025-11-05' // Current month
      };
      
      const priority = wrapper._calculatePriority(bill, currentDate, fiscalYearStartMonth);
      expect(priority).toBe(4);
    });
    
    it('should assign priority 5 to future HOA bills', () => {
      const bill = {
        _metadata: { moduleType: 'hoa' },
        dueDate: '2025-12-01' // Future
      };
      
      const priority = wrapper._calculatePriority(bill, currentDate, fiscalYearStartMonth);
      expect(priority).toBe(5);
    });
    
    it('should assign priority 99 to future Water bills (excluded)', () => {
      const bill = {
        _metadata: { moduleType: 'water' },
        dueDate: '2025-12-01' // Future - not allowed for water
      };
      
      const priority = wrapper._calculatePriority(bill, currentDate, fiscalYearStartMonth);
      expect(priority).toBe(99);
    });
  });

  describe('Current Period Detection', () => {
    it('should correctly identify current fiscal period', () => {
      // November 2025 with July fiscal start
      // Nov = month 11, July = month 7
      // Fiscal month index = 11 - 7 = 4
      const currentDate = new Date('2025-11-02');
      const dueDate = new Date('2025-11-01');
      const fiscalYearStartMonth = 7;
      
      const isCurrent = wrapper._isCurrentPeriod(dueDate, currentDate, fiscalYearStartMonth);
      expect(isCurrent).toBe(true);
    });
    
    it('should return false for different fiscal months', () => {
      const currentDate = new Date('2025-11-02');
      const dueDate = new Date('2025-10-01'); // Previous fiscal month
      const fiscalYearStartMonth = 7;
      
      const isCurrent = wrapper._isCurrentPeriod(dueDate, currentDate, fiscalYearStartMonth);
      expect(isCurrent).toBe(false);
    });
    
    it('should handle fiscal year boundary correctly', () => {
      // June 2026 (last month of fiscal year starting July 2025)
      const currentDate = new Date('2026-06-15');
      const dueDate = new Date('2026-06-01');
      const fiscalYearStartMonth = 7;
      
      const isCurrent = wrapper._isCurrentPeriod(dueDate, currentDate, fiscalYearStartMonth);
      expect(isCurrent).toBe(true);
    });
  });

  describe('Bill Prioritization and Sorting', () => {
    it('should filter out future water bills', () => {
      const bills = [
        {
          _metadata: { moduleType: 'hoa', priority: null },
          dueDate: '2025-12-01'
        },
        {
          _metadata: { moduleType: 'water', priority: null },
          dueDate: '2025-12-01'
        },
        {
          _metadata: { moduleType: 'water', priority: null },
          dueDate: '2025-10-01'
        }
      ];
      
      const currentDate = new Date('2025-11-02');
      const fiscalYearStartMonth = 7;
      
      const sorted = wrapper._prioritizeAndSortBills(bills, currentDate, fiscalYearStartMonth);
      
      // Should have 2 bills (filtered out 1 future water bill)
      expect(sorted.length).toBe(2);
      expect(sorted.every(b => b._metadata.priority < 99)).toBe(true);
    });
    
    it('should sort bills by priority', () => {
      const bills = [
        {
          _metadata: { moduleType: 'water', priority: null },
          dueDate: '2025-11-01', // Current water (priority 4)
          period: 'water-1'
        },
        {
          _metadata: { moduleType: 'hoa', priority: null },
          dueDate: '2025-10-01', // Past HOA (priority 1)
          period: 'hoa-1'
        },
        {
          _metadata: { moduleType: 'water', priority: null },
          dueDate: '2025-09-01', // Past water (priority 2)
          period: 'water-2'
        }
      ];
      
      const currentDate = new Date('2025-11-02');
      const fiscalYearStartMonth = 7;
      
      const sorted = wrapper._prioritizeAndSortBills(bills, currentDate, fiscalYearStartMonth);
      
      // Should be sorted: Past HOA (1), Past Water (2), Current Water (4)
      expect(sorted[0].period).toBe('hoa-1');
      expect(sorted[1].period).toBe('water-2');
      expect(sorted[2].period).toBe('water-1');
    });
    
    it('should sort by due date within same priority', () => {
      const bills = [
        {
          _metadata: { moduleType: 'hoa', priority: null },
          dueDate: '2025-09-01',
          period: 'hoa-sep'
        },
        {
          _metadata: { moduleType: 'hoa', priority: null },
          dueDate: '2025-08-01',
          period: 'hoa-aug'
        },
        {
          _metadata: { moduleType: 'hoa', priority: null },
          dueDate: '2025-10-01',
          period: 'hoa-oct'
        }
      ];
      
      const currentDate = new Date('2025-11-02');
      const fiscalYearStartMonth = 7;
      
      const sorted = wrapper._prioritizeAndSortBills(bills, currentDate, fiscalYearStartMonth);
      
      // All past due HOA, should be sorted oldest first
      expect(sorted[0].period).toBe('hoa-aug');
      expect(sorted[1].period).toBe('hoa-sep');
      expect(sorted[2].period).toBe('hoa-oct');
    });
  });

  describe('Distribution Splitting', () => {
    it('should split distribution by module type', () => {
      const distribution = {
        totalAvailableFunds: 10000,
        currentCreditBalance: 100,
        newCreditBalance: 150,
        creditUsed: 0,
        overpayment: 50,
        totalApplied: 9950,
        billPayments: [
          {
            billPeriod: '2026-00',
            amountPaid: 5000,
            baseChargePaid: 4500,
            penaltyPaid: 500,
            newStatus: 'paid'
          },
          {
            billPeriod: '2026-01',
            amountPaid: 4950,
            baseChargePaid: 4450,
            penaltyPaid: 500,
            newStatus: 'paid'
          }
        ]
      };
      
      const allBills = [
        {
          period: '2026-00',
          _metadata: { moduleType: 'hoa', monthIndex: 0 },
          _hoaMetadata: { month: 1, monthIndex: 0 }
        },
        {
          period: '2026-01',
          _metadata: { moduleType: 'water', monthIndex: 1 }
        }
      ];
      
      const result = wrapper._splitDistributionByModule(distribution, allBills);
      
      expect(result.hoa.billsPaid.length).toBe(1);
      expect(result.hoa.totalPaid).toBe(5000);
      expect(result.water.billsPaid.length).toBe(1);
      expect(result.water.totalPaid).toBe(4950);
      expect(result.credit.used).toBe(0);
      expect(result.credit.added).toBe(50);
    });
    
    it('should handle HOA-specific month formatting', () => {
      const distribution = {
        totalAvailableFunds: 5000,
        currentCreditBalance: 0,
        newCreditBalance: 0,
        creditUsed: 0,
        overpayment: 0,
        totalApplied: 5000,
        billPayments: [
          {
            billPeriod: '2026-00',
            amountPaid: 5000,
            baseChargePaid: 4500,
            penaltyPaid: 500,
            newStatus: 'paid'
          }
        ]
      };
      
      const allBills = [
        {
          period: '2026-00',
          _metadata: { moduleType: 'hoa', monthIndex: 0 },
          _hoaMetadata: { month: 7, monthIndex: 0 } // July
        }
      ];
      
      const result = wrapper._splitDistributionByModule(distribution, allBills);
      
      expect(result.hoa.monthsAffected.length).toBe(1);
      expect(result.hoa.monthsAffected[0].month).toBe(7);
      expect(result.hoa.monthsAffected[0].monthIndex).toBe(0);
    });
    
    it('should handle empty bill payments', () => {
      const distribution = {
        totalAvailableFunds: 1000,
        currentCreditBalance: 0,
        newCreditBalance: 1000,
        creditUsed: 0,
        overpayment: 1000,
        totalApplied: 0,
        billPayments: []
      };
      
      const allBills = [];
      
      const result = wrapper._splitDistributionByModule(distribution, allBills);
      
      expect(result.hoa.billsPaid.length).toBe(0);
      expect(result.water.billsPaid.length).toBe(0);
      expect(result.credit.added).toBe(1000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle bills with missing metadata gracefully', () => {
      const bills = [
        {
          _metadata: { moduleType: 'hoa' },
          dueDate: '2025-10-01'
          // Missing _hoaMetadata
        }
      ];
      
      const distribution = {
        billPayments: [
          {
            billPeriod: '2026-00',
            amountPaid: 1000
          }
        ]
      };
      
      const allBills = [
        {
          period: '2026-00',
          _metadata: { moduleType: 'hoa', monthIndex: 0 }
          // Missing _hoaMetadata
        }
      ];
      
      // Should not throw
      expect(() => wrapper._splitDistributionByModule(distribution, allBills)).not.toThrow();
    });
    
    it('should handle bills with invalid due dates', () => {
      const bill = {
        _metadata: { moduleType: 'hoa' },
        dueDate: 'invalid-date'
      };
      
      const currentDate = new Date('2025-11-02');
      
      // Should not throw, should handle gracefully
      expect(() => wrapper._calculatePriority(bill, currentDate, 7)).not.toThrow();
    });
  });
});

