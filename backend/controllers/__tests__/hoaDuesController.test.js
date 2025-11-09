/**
 * Unit Tests for HOA Dues Controller
 * 
 * PHASE 5 TASK 5.1: Test frequency-aware due date calculation
 */

import { describe, test, expect } from '@jest/globals';
import { createDate, toISOString } from '../../../shared/services/DateService.js';

/**
 * Test helper: Calculate frequency-aware due date
 * (Replicated from hoaDuesController.js for testing)
 */
function calculateFrequencyAwareDueDate(fiscalMonthIndex, fiscalYear, frequency, fiscalYearStartMonth) {
  if (fiscalMonthIndex < 0 || fiscalMonthIndex > 11) {
    throw new Error(`fiscalMonthIndex must be 0-11, got ${fiscalMonthIndex}`);
  }
  
  if (!['monthly', 'quarterly'].includes(frequency)) {
    throw new Error(`Unsupported duesFrequency: ${frequency}. Expected 'monthly' or 'quarterly'.`);
  }
  
  // For monthly, each fiscal month has its own due date
  if (frequency === 'monthly') {
    const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
    const calendarYear = fiscalYear + Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
    
    const dueDate = createDate(calendarYear, calendarMonth + 1, 1);
    return toISOString(dueDate);
  }
  
  // For quarterly, months share due dates by quarter
  if (frequency === 'quarterly') {
    const quarterStartFiscalMonth = Math.floor(fiscalMonthIndex / 3) * 3;
    const calendarMonth = ((fiscalYearStartMonth - 1) + quarterStartFiscalMonth) % 12;
    const calendarYear = fiscalYear + Math.floor(((fiscalYearStartMonth - 1) + quarterStartFiscalMonth) / 12);
    
    const dueDate = createDate(calendarYear, calendarMonth + 1, 1);
    return toISOString(dueDate);
  }
  
  throw new Error(`Unsupported frequency: ${frequency}`);
}

describe('calculateFrequencyAwareDueDate', () => {
  describe('Monthly Billing (MTC - Calendar Year)', () => {
    test('fiscal month 0 (January) → due date January 1, 2026', () => {
      const result = calculateFrequencyAwareDueDate(0, 2026, 'monthly', 1);
      expect(result).toContain('2026-01-01');
    });
    
    test('fiscal month 1 (February) → due date February 1, 2026', () => {
      const result = calculateFrequencyAwareDueDate(1, 2026, 'monthly', 1);
      expect(result).toContain('2026-02-01');
    });
    
    test('fiscal month 11 (December) → due date December 1, 2026', () => {
      const result = calculateFrequencyAwareDueDate(11, 2026, 'monthly', 1);
      expect(result).toContain('2026-12-01');
    });
  });
  
  describe('Monthly Billing (AVII - Fiscal Year July-June)', () => {
    test('fiscal month 0 (July) → due date July 1, 2026', () => {
      const result = calculateFrequencyAwareDueDate(0, 2026, 'monthly', 7);
      expect(result).toContain('2026-07-01');
    });
    
    test('fiscal month 5 (December) → due date December 1, 2026', () => {
      const result = calculateFrequencyAwareDueDate(5, 2026, 'monthly', 7);
      expect(result).toContain('2026-12-01');
    });
    
    test('fiscal month 6 (January) → due date January 1, 2027 (wraps to next calendar year)', () => {
      const result = calculateFrequencyAwareDueDate(6, 2026, 'monthly', 7);
      expect(result).toContain('2027-01-01');
    });
    
    test('fiscal month 11 (June) → due date June 1, 2027 (wraps to next calendar year)', () => {
      const result = calculateFrequencyAwareDueDate(11, 2026, 'monthly', 7);
      expect(result).toContain('2027-06-01');
    });
  });
  
  describe('Quarterly Billing - Q1 (July, August, September)', () => {
    test('fiscal month 0 (July) → due date July 1, 2026', () => {
      const result = calculateFrequencyAwareDueDate(0, 2026, 'quarterly', 7);
      expect(result).toContain('2026-07-01');
    });
    
    test('fiscal month 1 (August) → due date July 1, 2026 (same as Q1 start)', () => {
      const result = calculateFrequencyAwareDueDate(1, 2026, 'quarterly', 7);
      expect(result).toContain('2026-07-01');
    });
    
    test('fiscal month 2 (September) → due date July 1, 2026 (same as Q1 start)', () => {
      const result = calculateFrequencyAwareDueDate(2, 2026, 'quarterly', 7);
      expect(result).toContain('2026-07-01');
    });
  });
  
  describe('Quarterly Billing - Q2 (October, November, December)', () => {
    test('fiscal month 3 (October) → due date October 1, 2026', () => {
      const result = calculateFrequencyAwareDueDate(3, 2026, 'quarterly', 7);
      expect(result).toContain('2026-10-01');
    });
    
    test('fiscal month 4 (November) → due date October 1, 2026 (same as Q2 start)', () => {
      const result = calculateFrequencyAwareDueDate(4, 2026, 'quarterly', 7);
      expect(result).toContain('2026-10-01');
    });
    
    test('fiscal month 5 (December) → due date October 1, 2026 (same as Q2 start)', () => {
      const result = calculateFrequencyAwareDueDate(5, 2026, 'quarterly', 7);
      expect(result).toContain('2026-10-01');
    });
  });
  
  describe('Quarterly Billing - Q3 (January, February, March) - Wraps to next calendar year', () => {
    test('fiscal month 6 (January) → due date January 1, 2027', () => {
      const result = calculateFrequencyAwareDueDate(6, 2026, 'quarterly', 7);
      expect(result).toContain('2027-01-01');
    });
    
    test('fiscal month 7 (February) → due date January 1, 2027 (same as Q3 start)', () => {
      const result = calculateFrequencyAwareDueDate(7, 2026, 'quarterly', 7);
      expect(result).toContain('2027-01-01');
    });
    
    test('fiscal month 8 (March) → due date January 1, 2027 (same as Q3 start)', () => {
      const result = calculateFrequencyAwareDueDate(8, 2026, 'quarterly', 7);
      expect(result).toContain('2027-01-01');
    });
  });
  
  describe('Quarterly Billing - Q4 (April, May, June) - In next calendar year', () => {
    test('fiscal month 9 (April) → due date April 1, 2027', () => {
      const result = calculateFrequencyAwareDueDate(9, 2026, 'quarterly', 7);
      expect(result).toContain('2027-04-01');
    });
    
    test('fiscal month 10 (May) → due date April 1, 2027 (same as Q4 start)', () => {
      const result = calculateFrequencyAwareDueDate(10, 2026, 'quarterly', 7);
      expect(result).toContain('2027-04-01');
    });
    
    test('fiscal month 11 (June) → due date April 1, 2027 (same as Q4 start)', () => {
      const result = calculateFrequencyAwareDueDate(11, 2026, 'quarterly', 7);
      expect(result).toContain('2027-04-01');
    });
  });
  
  describe('Error Handling', () => {
    test('invalid fiscalMonthIndex (negative) → throws error', () => {
      expect(() => {
        calculateFrequencyAwareDueDate(-1, 2026, 'monthly', 1);
      }).toThrow('fiscalMonthIndex must be 0-11');
    });
    
    test('invalid fiscalMonthIndex (> 11) → throws error', () => {
      expect(() => {
        calculateFrequencyAwareDueDate(12, 2026, 'monthly', 1);
      }).toThrow('fiscalMonthIndex must be 0-11');
    });
    
    test('unsupported frequency (semi-annually) → throws error', () => {
      expect(() => {
        calculateFrequencyAwareDueDate(0, 2026, 'semi-annually', 1);
      }).toThrow('Unsupported duesFrequency');
    });
    
    test('unsupported frequency (annual) → throws error', () => {
      expect(() => {
        calculateFrequencyAwareDueDate(0, 2026, 'annual', 1);
      }).toThrow('Unsupported duesFrequency');
    });
  });
  
  describe('Edge Cases', () => {
    test('fiscal year boundary - MTC December to January', () => {
      const dec = calculateFrequencyAwareDueDate(11, 2026, 'monthly', 1);
      const jan = calculateFrequencyAwareDueDate(0, 2027, 'monthly', 1);
      
      expect(dec).toContain('2026-12-01');
      expect(jan).toContain('2027-01-01');
    });
    
    test('fiscal year boundary - AVII June to July', () => {
      const june = calculateFrequencyAwareDueDate(11, 2026, 'monthly', 7);
      const july = calculateFrequencyAwareDueDate(0, 2027, 'monthly', 7);
      
      expect(june).toContain('2027-06-01');
      expect(july).toContain('2027-07-01');
    });
    
    test('quarterly - all Q1 months have identical due date', () => {
      const month0 = calculateFrequencyAwareDueDate(0, 2026, 'quarterly', 7);
      const month1 = calculateFrequencyAwareDueDate(1, 2026, 'quarterly', 7);
      const month2 = calculateFrequencyAwareDueDate(2, 2026, 'quarterly', 7);
      
      expect(month0).toBe(month1);
      expect(month1).toBe(month2);
      expect(month0).toContain('2026-07-01');
    });
    
    test('quarterly - Q1 and Q2 have different due dates', () => {
      const q1 = calculateFrequencyAwareDueDate(0, 2026, 'quarterly', 7);
      const q2 = calculateFrequencyAwareDueDate(3, 2026, 'quarterly', 7);
      
      expect(q1).not.toBe(q2);
      expect(q1).toContain('2026-07-01');
      expect(q2).toContain('2026-10-01');
    });
  });
  
  describe('Real-world Scenarios', () => {
    test('MTC (monthly, calendar year) - all 12 months have unique due dates', () => {
      const dueDates = [];
      for (let i = 0; i < 12; i++) {
        dueDates.push(calculateFrequencyAwareDueDate(i, 2026, 'monthly', 1));
      }
      
      // All dates should be unique
      const uniqueDates = new Set(dueDates);
      expect(uniqueDates.size).toBe(12);
      
      // First and last should be January and December
      expect(dueDates[0]).toContain('2026-01-01');
      expect(dueDates[11]).toContain('2026-12-01');
    });
    
    test('AVII (quarterly, fiscal year) - only 4 unique due dates', () => {
      const dueDates = [];
      for (let i = 0; i < 12; i++) {
        dueDates.push(calculateFrequencyAwareDueDate(i, 2026, 'quarterly', 7));
      }
      
      // Only 4 unique dates (one per quarter)
      const uniqueDates = new Set(dueDates);
      expect(uniqueDates.size).toBe(4);
      
      // Check the 4 quarters
      expect(dueDates[0]).toContain('2026-07-01'); // Q1
      expect(dueDates[3]).toContain('2026-10-01'); // Q2
      expect(dueDates[6]).toContain('2027-01-01'); // Q3
      expect(dueDates[9]).toContain('2027-04-01'); // Q4
    });
  });
});

