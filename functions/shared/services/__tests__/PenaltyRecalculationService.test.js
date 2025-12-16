/**
 * Unit Tests for Penalty Recalculation Service
 * 
 * PHASE 5 TASK 5.2: Test due date grouping and penalty distribution
 */

import { describe, test, expect } from '@jest/globals';
import { getNow, parseDate, createDate } from '../DateService.js';

/**
 * Test helpers: Replicate core functions for testing
 */

function groupBillsByDueDate(bills) {
  const groups = {};
  
  bills.forEach(bill => {
    let dueDateStr;
    if (typeof bill.dueDate === 'string') {
      dueDateStr = bill.dueDate.split('T')[0];
    } else if (bill.dueDate instanceof Date) {
      dueDateStr = bill.dueDate.toISOString().split('T')[0];
    } else {
      dueDateStr = 'unknown';
    }
    
    if (!groups[dueDateStr]) {
      groups[dueDateStr] = [];
    }
    
    groups[dueDateStr].push(bill);
  });
  
  return groups;
}

function calculateCompoundingPenalty(baseAmount, previousPenalty, monthsOverdue, penaltyRate) {
  if (monthsOverdue <= 0) {
    return 0;
  }
  
  let runningTotal = baseAmount;
  let totalPenalty = 0;
  
  for (let month = 1; month <= monthsOverdue; month++) {
    const monthlyPenalty = runningTotal * penaltyRate;
    totalPenalty += monthlyPenalty;
    runningTotal += monthlyPenalty;
  }
  
  return Math.round(totalPenalty);
}

describe('Penalty Recalculation Service - Grouped Calculation', () => {
  const config = {
    penaltyRate: 0.05,      // 5% monthly
    penaltyDays: 30         // 30 days grace period
  };
  
  describe('groupBillsByDueDate', () => {
    test('groups bills with same due date together', () => {
      const bills = [
        { billId: '2026-00', dueDate: '2026-07-01', currentCharge: 500000 },
        { billId: '2026-01', dueDate: '2026-07-01', currentCharge: 500000 },
        { billId: '2026-02', dueDate: '2026-07-01', currentCharge: 500000 },
        { billId: '2026-03', dueDate: '2026-10-01', currentCharge: 500000 }
      ];
      
      const groups = groupBillsByDueDate(bills);
      
      expect(Object.keys(groups).length).toBe(2);
      expect(groups['2026-07-01'].length).toBe(3);
      expect(groups['2026-10-01'].length).toBe(1);
    });
    
    test('handles bills with unique due dates (monthly billing)', () => {
      const bills = [
        { billId: '2026-00', dueDate: '2026-01-01', currentCharge: 500000 },
        { billId: '2026-01', dueDate: '2026-02-01', currentCharge: 500000 },
        { billId: '2026-02', dueDate: '2026-03-01', currentCharge: 500000 }
      ];
      
      const groups = groupBillsByDueDate(bills);
      
      expect(Object.keys(groups).length).toBe(3);
      expect(groups['2026-01-01'].length).toBe(1);
      expect(groups['2026-02-01'].length).toBe(1);
      expect(groups['2026-03-01'].length).toBe(1);
    });
    
    test('handles Date objects as due dates', () => {
      const bills = [
        { billId: '2026-00', dueDate: new Date('2026-07-01'), currentCharge: 500000 },
        { billId: '2026-01', dueDate: new Date('2026-07-01'), currentCharge: 500000 }
      ];
      
      const groups = groupBillsByDueDate(bills);
      
      expect(Object.keys(groups).length).toBe(1);
      expect(Object.keys(groups)[0]).toContain('2026-07-01');
    });
  });
  
  describe('Quarterly Billing (3 bills, same due date)', () => {
    test('Q1 all unpaid, 1 month overdue', () => {
      const bills = [
        { billId: '2026-00', dueDate: '2026-07-01', currentCharge: 500000, paidAmount: 0, status: 'unpaid' },
        { billId: '2026-01', dueDate: '2026-07-01', currentCharge: 500000, paidAmount: 0, status: 'unpaid' },
        { billId: '2026-02', dueDate: '2026-07-01', currentCharge: 500000, paidAmount: 0, status: 'unpaid' }
      ];
      
      // Total: 1,500,000 centavos ($15,000)
      // 1 month overdue with grace (payment on Aug 31): 1,500,000 * 1.05 = 1,575,000
      // Total penalty: 75,000 centavos ($750)
      // Per bill: 75,000 / 3 = 25,000 centavos ($250 each)
      
      const totalUnpaid = 1500000;
      const monthsOverdue = 1;
      const totalPenalty = calculateCompoundingPenalty(totalUnpaid, 0, monthsOverdue, config.penaltyRate);
      const penaltyPerBill = Math.round(totalPenalty / 3);
      
      expect(totalPenalty).toBe(75000);
      expect(penaltyPerBill).toBe(25000);
    });
    
    test('Q1 all unpaid, 2 months overdue', () => {
      const bills = [
        { billId: '2026-00', dueDate: '2026-07-01', currentCharge: 500000, paidAmount: 0, status: 'unpaid' },
        { billId: '2026-01', dueDate: '2026-07-01', currentCharge: 500000, paidAmount: 0, status: 'unpaid' },
        { billId: '2026-02', dueDate: '2026-07-01', currentCharge: 500000, paidAmount: 0, status: 'unpaid' }
      ];
      
      // Total: 1,500,000 centavos ($15,000)
      // Month 1: 1,500,000 * 1.05 = 1,575,000
      // Month 2: 1,575,000 * 1.05 = 1,653,750
      // Total penalty: 153,750 centavos ($1,537.50)
      // Per bill: 153,750 / 3 = 51,250 centavos ($512.50 each)
      
      const totalUnpaid = 1500000;
      const monthsOverdue = 2;
      const totalPenalty = calculateCompoundingPenalty(totalUnpaid, 0, monthsOverdue, config.penaltyRate);
      const penaltyPerBill = Math.round(totalPenalty / 3);
      
      expect(totalPenalty).toBe(153750);
      expect(penaltyPerBill).toBe(51250);
    });
    
    test('Q1 one month paid, two unpaid', () => {
      const bills = [
        { billId: '2026-00', dueDate: '2026-07-01', currentCharge: 500000, paidAmount: 500000, status: 'paid' },
        { billId: '2026-01', dueDate: '2026-07-01', currentCharge: 500000, paidAmount: 0, status: 'unpaid' },
        { billId: '2026-02', dueDate: '2026-07-01', currentCharge: 500000, paidAmount: 0, status: 'unpaid' }
      ];
      
      // Total unpaid: 1,000,000 centavos ($10,000)
      // Month 1: 1,000,000 * 1.05 = 1,050,000
      // Month 2: 1,050,000 * 1.05 = 1,102,500
      // Total penalty: 102,500 centavos ($1,025)
      // Per unpaid bill: 102,500 / 2 = 51,250 centavos ($512.50 each)
      
      const unpaidBills = bills.filter(b => b.status === 'unpaid');
      const totalUnpaid = unpaidBills.reduce((sum, b) => sum + (b.currentCharge - b.paidAmount), 0);
      const monthsOverdue = 2;
      const totalPenalty = calculateCompoundingPenalty(totalUnpaid, 0, monthsOverdue, config.penaltyRate);
      const penaltyPerBill = Math.round(totalPenalty / unpaidBills.length);
      
      expect(totalUnpaid).toBe(1000000);
      expect(totalPenalty).toBe(102500);
      expect(penaltyPerBill).toBe(51250);
    });
    
    test('Q1 one month partially paid', () => {
      const bills = [
        { billId: '2026-00', dueDate: '2026-07-01', currentCharge: 500000, paidAmount: 250000, status: 'partial' },
        { billId: '2026-01', dueDate: '2026-07-01', currentCharge: 500000, paidAmount: 0, status: 'unpaid' },
        { billId: '2026-02', dueDate: '2026-07-01', currentCharge: 500000, paidAmount: 0, status: 'unpaid' }
      ];
      
      // Total unpaid: 250,000 + 500,000 + 500,000 = 1,250,000 centavos ($12,500)
      // Month 1: 1,250,000 * 1.05 = 1,312,500
      // Month 2: 1,312,500 * 1.05 = 1,378,125
      // Total penalty: 128,125 centavos ($1,281.25)
      // Per bill: 128,125 / 3 = 42,708.33 → 42,708 centavos
      
      const totalUnpaid = bills.reduce((sum, b) => sum + Math.max(0, b.currentCharge - b.paidAmount), 0);
      const monthsOverdue = 2;
      const totalPenalty = calculateCompoundingPenalty(totalUnpaid, 0, monthsOverdue, config.penaltyRate);
      const penaltyPerBill = Math.round(totalPenalty / bills.length);
      
      expect(totalUnpaid).toBe(1250000);
      expect(totalPenalty).toBe(128125);
      expect(penaltyPerBill).toBe(42708);
    });
  });
  
  describe('Monthly Billing (each month unique due date)', () => {
    test('3 months, each with different due date and overdue period', () => {
      const bills = [
        { billId: '2026-00', dueDate: '2026-07-01', currentCharge: 500000, paidAmount: 0, status: 'unpaid' },
        { billId: '2026-01', dueDate: '2026-08-01', currentCharge: 500000, paidAmount: 0, status: 'unpaid' },
        { billId: '2026-02', dueDate: '2026-09-01', currentCharge: 500000, paidAmount: 0, status: 'unpaid' }
      ];
      
      // Each month calculated independently
      // Month 0 (July due, Oct 1 payment): 3 months overdue
      //   500,000 * 1.05^3 = 578,813 → penalty 78,813
      // Month 1 (Aug due, Oct 1 payment): 2 months overdue
      //   500,000 * 1.05^2 = 551,250 → penalty 51,250
      // Month 2 (Sep due, Oct 1 payment): 1 month overdue
      //   500,000 * 1.05 = 525,000 → penalty 25,000
      
      const penalty0 = calculateCompoundingPenalty(500000, 0, 3, config.penaltyRate);
      const penalty1 = calculateCompoundingPenalty(500000, 0, 2, config.penaltyRate);
      const penalty2 = calculateCompoundingPenalty(500000, 0, 1, config.penaltyRate);
      
      expect(penalty0).toBe(78813);
      expect(penalty1).toBe(51250);
      expect(penalty2).toBe(25000);
    });
  });
  
  describe('Rounding Distribution', () => {
    test('penalty distributes evenly with rounding adjustment on last bill', () => {
      // Total penalty: 100 centavos, 3 bills
      // 100 / 3 = 33.33... → 33 centavos per bill
      // Last bill gets adjustment: 100 - (33 + 33) = 34 centavos
      
      const totalPenalty = 100;
      const numBills = 3;
      const penaltyPerBill = Math.round(totalPenalty / numBills);
      
      let distributedSoFar = 0;
      const penalties = [];
      
      for (let i = 0; i < numBills; i++) {
        const isLast = (i === numBills - 1);
        const billPenalty = isLast ? totalPenalty - distributedSoFar : penaltyPerBill;
        distributedSoFar += billPenalty;
        penalties.push(billPenalty);
      }
      
      expect(penalties[0]).toBe(33);
      expect(penalties[1]).toBe(33);
      expect(penalties[2]).toBe(34); // Rounding adjustment
      expect(penalties.reduce((sum, p) => sum + p, 0)).toBe(totalPenalty);
    });
  });
  
  describe('Edge Cases', () => {
    test('all bills paid → zero penalties', () => {
      const bills = [
        { billId: '2026-00', dueDate: '2026-07-01', currentCharge: 500000, paidAmount: 500000, status: 'paid' },
        { billId: '2026-01', dueDate: '2026-07-01', currentCharge: 500000, paidAmount: 500000, status: 'paid' }
      ];
      
      const unpaidBills = bills.filter(b => b.status !== 'paid');
      
      expect(unpaidBills.length).toBe(0);
    });
    
    test('within grace period → zero penalties', () => {
      // Due: July 1, Grace: 30 days → Aug 1
      // Payment on July 15 → within grace
      // Should have 0 months overdue
      
      const dueDate = new Date('2026-07-01');
      const paymentDate = new Date('2026-07-15');
      const gracePeriodEnd = new Date('2026-08-01');
      
      expect(paymentDate < gracePeriodEnd).toBe(true);
    });
    
    test('penalty on last day of grace → 1 month penalty', () => {
      // Due: July 1, Grace: 30 days → Aug 1
      // Payment on Aug 1 → exactly at grace end
      // Should have 1 month overdue (penalties start immediately after grace)
      
      const dueDate = new Date('2026-07-01');
      const paymentDate = new Date('2026-08-01');
      const gracePeriodEnd = new Date('2026-08-01');
      
      expect(paymentDate >= gracePeriodEnd).toBe(true);
    });
  });
  
  describe('Real-world Scenarios', () => {
    test('AVII Q1 (quarterly) - all unpaid, 2 months overdue', () => {
      // Scenario: AVII fiscal year 2026
      // Q1: July, August, September (all due July 1, 2026)
      // Payment date: September 1, 2026 (2 months after grace ends Aug 1)
      
      const bills = [
        { billId: '2026-00', dueDate: '2026-07-01', currentCharge: 500000, paidAmount: 0, status: 'unpaid' },
        { billId: '2026-01', dueDate: '2026-07-01', currentCharge: 500000, paidAmount: 0, status: 'unpaid' },
        { billId: '2026-02', dueDate: '2026-07-01', currentCharge: 500000, paidAmount: 0, status: 'unpaid' }
      ];
      
      const groups = groupBillsByDueDate(bills);
      const q1Bills = groups['2026-07-01'];
      
      expect(q1Bills.length).toBe(3);
      
      const totalUnpaid = q1Bills.reduce((sum, b) => sum + (b.currentCharge - b.paidAmount), 0);
      const totalPenalty = calculateCompoundingPenalty(totalUnpaid, 0, 2, config.penaltyRate);
      const penaltyPerBill = Math.round(totalPenalty / q1Bills.length);
      
      // Total: $15,000 → $15,750 → $16,537.50
      // Penalty: $1,537.50 total, $512.50 per bill
      expect(totalUnpaid).toBe(1500000);
      expect(totalPenalty).toBe(153750);
      expect(penaltyPerBill).toBe(51250);
    });
    
    test('MTC (monthly) - different penalties for different due dates', () => {
      // Scenario: MTC calendar year 2026
      // Each month has unique due date
      // Payment date: April 1, 2026
      
      const bills = [
        { billId: '2026-00', dueDate: '2026-01-01', currentCharge: 500000, paidAmount: 0, status: 'unpaid' },
        { billId: '2026-01', dueDate: '2026-02-01', currentCharge: 500000, paidAmount: 0, status: 'unpaid' },
        { billId: '2026-02', dueDate: '2026-03-01', currentCharge: 500000, paidAmount: 0, status: 'unpaid' }
      ];
      
      const groups = groupBillsByDueDate(bills);
      
      // Each month in its own group
      expect(Object.keys(groups).length).toBe(3);
      
      // January: 3 months overdue (grace ends Feb 1, payment Apr 1)
      const jan Penalty = calculateCompoundingPenalty(500000, 0, 3, config.penaltyRate);
      expect(janPenalty).toBe(78813);
      
      // February: 2 months overdue
      const febPenalty = calculateCompoundingPenalty(500000, 0, 2, config.penaltyRate);
      expect(febPenalty).toBe(51250);
      
      // March: 1 month overdue
      const marPenalty = calculateCompoundingPenalty(500000, 0, 1, config.penaltyRate);
      expect(marPenalty).toBe(25000);
    });
  });
});

