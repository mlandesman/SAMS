import {
  calendarToFiscalMonth,
  fiscalToCalendarMonth,
  getFiscalYear,
  getFiscalYearBounds,
  getFiscalMonthName,
  getFiscalMonthNames,
  getFiscalYearLabel,
  getCurrentFiscalMonth,
  getFiscalQuarter,
  isFiscalYear
} from '../fiscalYearUtils';

describe('Fiscal Year Utilities', () => {
  describe('calendarToFiscalMonth', () => {
    describe('Calendar Year (January start)', () => {
      it('should return same month for calendar year', () => {
        expect(calendarToFiscalMonth(1, 1)).toBe(1);
        expect(calendarToFiscalMonth(6, 1)).toBe(6);
        expect(calendarToFiscalMonth(12, 1)).toBe(12);
      });
    });

    describe('July-June Fiscal Year (AVII)', () => {
      it('should convert calendar months correctly', () => {
        expect(calendarToFiscalMonth(7, 7)).toBe(1);   // July is month 1
        expect(calendarToFiscalMonth(8, 7)).toBe(2);   // August is month 2
        expect(calendarToFiscalMonth(12, 7)).toBe(6);  // December is month 6
        expect(calendarToFiscalMonth(1, 7)).toBe(7);   // January is month 7
        expect(calendarToFiscalMonth(6, 7)).toBe(12);  // June is month 12
      });
    });

    describe('October-September Fiscal Year', () => {
      it('should convert calendar months correctly', () => {
        expect(calendarToFiscalMonth(10, 10)).toBe(1);  // October is month 1
        expect(calendarToFiscalMonth(12, 10)).toBe(3);  // December is month 3
        expect(calendarToFiscalMonth(1, 10)).toBe(4);   // January is month 4
        expect(calendarToFiscalMonth(9, 10)).toBe(12);  // September is month 12
      });
    });

    describe('All 12 fiscal year configurations', () => {
      it('should handle all possible start months', () => {
        for (let startMonth = 1; startMonth <= 12; startMonth++) {
          // First month should always be 1
          expect(calendarToFiscalMonth(startMonth, startMonth)).toBe(1);
          
          // Last month should always be 12
          const lastMonth = startMonth === 1 ? 12 : startMonth - 1;
          expect(calendarToFiscalMonth(lastMonth, startMonth)).toBe(12);
        }
      });
    });

    describe('Edge cases', () => {
      it('should handle invalid inputs', () => {
        expect(() => calendarToFiscalMonth(0, 7)).toThrow();
        expect(() => calendarToFiscalMonth(13, 7)).toThrow();
        expect(() => calendarToFiscalMonth(-1, 7)).toThrow();
        expect(() => calendarToFiscalMonth(6, 0)).toThrow();
        expect(() => calendarToFiscalMonth(6, 13)).toThrow();
        expect(() => calendarToFiscalMonth(null, 7)).toThrow();
        expect(() => calendarToFiscalMonth(6, null)).toThrow();
        expect(() => calendarToFiscalMonth(undefined, 7)).toThrow();
      });
    });
  });

  describe('fiscalToCalendarMonth', () => {
    describe('Calendar Year (January start)', () => {
      it('should return same month for calendar year', () => {
        expect(fiscalToCalendarMonth(1, 1)).toBe(1);
        expect(fiscalToCalendarMonth(6, 1)).toBe(6);
        expect(fiscalToCalendarMonth(12, 1)).toBe(12);
      });
    });

    describe('July-June Fiscal Year (AVII)', () => {
      it('should convert fiscal months correctly', () => {
        expect(fiscalToCalendarMonth(1, 7)).toBe(7);   // Month 1 = July
        expect(fiscalToCalendarMonth(2, 7)).toBe(8);   // Month 2 = August
        expect(fiscalToCalendarMonth(6, 7)).toBe(12);  // Month 6 = December
        expect(fiscalToCalendarMonth(7, 7)).toBe(1);   // Month 7 = January
        expect(fiscalToCalendarMonth(12, 7)).toBe(6);  // Month 12 = June
      });
    });

    describe('All 12 fiscal year configurations', () => {
      it('should be inverse of calendarToFiscalMonth', () => {
        for (let startMonth = 1; startMonth <= 12; startMonth++) {
          for (let calMonth = 1; calMonth <= 12; calMonth++) {
            const fiscalMonth = calendarToFiscalMonth(calMonth, startMonth);
            expect(fiscalToCalendarMonth(fiscalMonth, startMonth)).toBe(calMonth);
          }
        }
      });
    });

    describe('Edge cases', () => {
      it('should handle invalid inputs', () => {
        expect(() => fiscalToCalendarMonth(0, 7)).toThrow();
        expect(() => fiscalToCalendarMonth(13, 7)).toThrow();
        expect(() => fiscalToCalendarMonth(6, 0)).toThrow();
        expect(() => fiscalToCalendarMonth(6, 13)).toThrow();
      });
    });
  });

  describe('getFiscalYear', () => {
    describe('Calendar Year (January start)', () => {
      it('should return calendar year', () => {
        expect(getFiscalYear(new Date('2025-01-15'), 1)).toBe(2025);
        expect(getFiscalYear(new Date('2025-12-31'), 1)).toBe(2025);
      });
    });

    describe('July-June Fiscal Year (AVII)', () => {
      it('should return correct fiscal year', () => {
        expect(getFiscalYear(new Date('2025-07-01'), 7)).toBe(2025);  // Start of FY2025
        expect(getFiscalYear(new Date('2025-08-15'), 7)).toBe(2025);  // Aug 2025 in FY2025
        expect(getFiscalYear(new Date('2026-06-30'), 7)).toBe(2025);  // End of FY2025
        expect(getFiscalYear(new Date('2025-06-30'), 7)).toBe(2024);  // End of FY2024
        expect(getFiscalYear(new Date('2025-01-15'), 7)).toBe(2024);  // Jan 2025 in FY2024
      });
    });

    describe('October-September Fiscal Year', () => {
      it('should return correct fiscal year', () => {
        expect(getFiscalYear(new Date('2025-10-01'), 10)).toBe(2025);
        expect(getFiscalYear(new Date('2025-12-31'), 10)).toBe(2025);
        expect(getFiscalYear(new Date('2026-09-30'), 10)).toBe(2025);
        expect(getFiscalYear(new Date('2025-09-30'), 10)).toBe(2024);
      });
    });

    describe('Leap year handling', () => {
      it('should handle February 29', () => {
        expect(getFiscalYear(new Date('2024-02-29'), 1)).toBe(2024);
        expect(getFiscalYear(new Date('2024-02-29'), 7)).toBe(2023);  // Feb in FY2023 for July start
      });
    });

    describe('Edge cases', () => {
      it('should handle invalid inputs', () => {
        expect(() => getFiscalYear('not a date', 7)).toThrow();
        expect(() => getFiscalYear(new Date(), 0)).toThrow();
        expect(() => getFiscalYear(new Date(), 13)).toThrow();
        expect(() => getFiscalYear(null, 7)).toThrow();
      });
    });
  });

  describe('getFiscalYearBounds', () => {
    describe('Calendar Year', () => {
      it('should return Jan 1 to Dec 31', () => {
        const bounds = getFiscalYearBounds(2025, 1);
        expect(bounds.startDate).toEqual(new Date('2025-01-01'));
        expect(bounds.endDate).toEqual(new Date('2025-12-31'));
      });
    });

    describe('July-June Fiscal Year', () => {
      it('should return correct bounds', () => {
        const bounds = getFiscalYearBounds(2025, 7);
        expect(bounds.startDate).toEqual(new Date('2025-07-01'));
        expect(bounds.endDate).toEqual(new Date('2026-06-30'));
      });
    });

    describe('Edge cases', () => {
      it('should handle all start months', () => {
        for (let startMonth = 1; startMonth <= 12; startMonth++) {
          const bounds = getFiscalYearBounds(2025, startMonth);
          expect(bounds.startDate.getMonth() + 1).toBe(startMonth);
          
          const endMonth = startMonth === 1 ? 12 : startMonth - 1;
          expect(bounds.endDate.getMonth() + 1).toBe(endMonth);
        }
      });
    });
  });

  describe('getFiscalMonthName', () => {
    describe('Basic functionality', () => {
      it('should return correct month names for calendar year', () => {
        expect(getFiscalMonthName(1, 1)).toBe('January');
        expect(getFiscalMonthName(12, 1)).toBe('December');
      });

      it('should return correct month names for July fiscal year', () => {
        expect(getFiscalMonthName(1, 7)).toBe('July');
        expect(getFiscalMonthName(6, 7)).toBe('December');
        expect(getFiscalMonthName(7, 7)).toBe('January');
        expect(getFiscalMonthName(12, 7)).toBe('June');
      });

      it('should support short names', () => {
        expect(getFiscalMonthName(1, 7, { short: true })).toBe('Jul');
        expect(getFiscalMonthName(12, 7, { short: true })).toBe('Jun');
      });
    });

    describe('Edge cases', () => {
      it('should handle invalid inputs', () => {
        expect(() => getFiscalMonthName(0, 7)).toThrow();
        expect(() => getFiscalMonthName(13, 7)).toThrow();
      });
    });
  });

  describe('getFiscalMonthNames', () => {
    it('should return calendar months for January start', () => {
      const months = getFiscalMonthNames(1);
      expect(months).toEqual([
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ]);
    });

    it('should return fiscal months for July start', () => {
      const months = getFiscalMonthNames(7);
      expect(months).toEqual([
        'July', 'August', 'September', 'October', 'November', 'December',
        'January', 'February', 'March', 'April', 'May', 'June'
      ]);
    });

    it('should support short names', () => {
      const months = getFiscalMonthNames(7, { short: true });
      expect(months[0]).toBe('Jul');
      expect(months[11]).toBe('Jun');
    });

    it('should always return 12 months', () => {
      for (let startMonth = 1; startMonth <= 12; startMonth++) {
        const months = getFiscalMonthNames(startMonth);
        expect(months).toHaveLength(12);
      }
    });
  });

  describe('getFiscalYearLabel', () => {
    it('should return plain year for calendar year', () => {
      expect(getFiscalYearLabel(2025, 1)).toBe('2025');
    });

    it('should return FY prefix for fiscal year', () => {
      expect(getFiscalYearLabel(2025, 7)).toBe('FY 2025');
      expect(getFiscalYearLabel(2025, 10)).toBe('FY 2025');
    });

    it('should handle all fiscal year configurations', () => {
      for (let startMonth = 2; startMonth <= 12; startMonth++) {
        expect(getFiscalYearLabel(2025, startMonth)).toBe('FY 2025');
      }
    });
  });

  describe('getCurrentFiscalMonth', () => {
    it('should return current fiscal month for today', () => {
      const today = new Date();
      const currentCalendarMonth = today.getMonth() + 1;
      
      // For calendar year
      expect(getCurrentFiscalMonth(today, 1)).toBe(currentCalendarMonth);
      
      // For July fiscal year
      const expectedFiscalMonth = calendarToFiscalMonth(currentCalendarMonth, 7);
      expect(getCurrentFiscalMonth(today, 7)).toBe(expectedFiscalMonth);
    });

    it('should work with specific dates', () => {
      expect(getCurrentFiscalMonth(new Date('2025-07-15'), 7)).toBe(1);
      expect(getCurrentFiscalMonth(new Date('2025-01-15'), 7)).toBe(7);
    });

    it('should default to today when no date provided', () => {
      const result = getCurrentFiscalMonth(undefined, 1);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(12);
    });
  });

  describe('getFiscalQuarter', () => {
    it('should return correct quarters', () => {
      expect(getFiscalQuarter(1)).toBe(1);   // Month 1 in Q1
      expect(getFiscalQuarter(2)).toBe(1);   // Month 2 in Q1
      expect(getFiscalQuarter(3)).toBe(1);   // Month 3 in Q1
      expect(getFiscalQuarter(4)).toBe(2);   // Month 4 in Q2
      expect(getFiscalQuarter(7)).toBe(3);   // Month 7 in Q3
      expect(getFiscalQuarter(10)).toBe(4);  // Month 10 in Q4
      expect(getFiscalQuarter(12)).toBe(4);  // Month 12 in Q4
    });

    it('should handle all 12 months', () => {
      for (let month = 1; month <= 12; month++) {
        const quarter = getFiscalQuarter(month);
        expect(quarter).toBeGreaterThanOrEqual(1);
        expect(quarter).toBeLessThanOrEqual(4);
        expect(quarter).toBe(Math.ceil(month / 3));
      }
    });

    it('should handle invalid inputs', () => {
      expect(() => getFiscalQuarter(0)).toThrow();
      expect(() => getFiscalQuarter(13)).toThrow();
    });
  });

  describe('isFiscalYear', () => {
    it('should return false for calendar year', () => {
      expect(isFiscalYear(1)).toBe(false);
    });

    it('should return true for any other start month', () => {
      for (let startMonth = 2; startMonth <= 12; startMonth++) {
        expect(isFiscalYear(startMonth)).toBe(true);
      }
    });

    it('should handle invalid inputs', () => {
      expect(() => isFiscalYear(0)).toThrow();
      expect(() => isFiscalYear(13)).toThrow();
    });
  });

  describe('Real-world scenarios', () => {
    describe('Payment recording', () => {
      it('should correctly identify current month for payment', () => {
        const paymentDate = new Date('2025-08-15');
        const fiscalMonth = getCurrentFiscalMonth(paymentDate, 7);
        expect(fiscalMonth).toBe(2); // August is month 2 in July fiscal year
      });
    });

    describe('Past due calculations', () => {
      it('should determine if payment is in correct fiscal year', () => {
        const dueDate = new Date('2025-06-30');
        const paymentDate = new Date('2025-07-01');
        
        const dueFiscalYear = getFiscalYear(dueDate, 7);
        const paymentFiscalYear = getFiscalYear(paymentDate, 7);
        
        expect(dueFiscalYear).toBe(2024);
        expect(paymentFiscalYear).toBe(2025);
        expect(paymentFiscalYear).toBeGreaterThan(dueFiscalYear); // Payment is late
      });
    });

    describe('Year-to-date calculations', () => {
      it('should get correct months for YTD', () => {
        const currentDate = new Date('2025-10-15');
        const fiscalYear = getFiscalYear(currentDate, 7);
        const currentFiscalMonth = getCurrentFiscalMonth(currentDate, 7);
        
        expect(fiscalYear).toBe(2025);
        expect(currentFiscalMonth).toBe(4); // October is month 4
        
        // YTD would include months 1-4 (July-October)
        const ytdMonths = [];
        for (let fm = 1; fm <= currentFiscalMonth; fm++) {
          ytdMonths.push(fiscalToCalendarMonth(fm, 7));
        }
        expect(ytdMonths).toEqual([7, 8, 9, 10]);
      });
    });

    describe('Quarter boundaries', () => {
      it('should identify quarter for reporting', () => {
        const date = new Date('2025-12-15');
        const fiscalMonth = getCurrentFiscalMonth(date, 7);
        const quarter = getFiscalQuarter(fiscalMonth);
        
        expect(fiscalMonth).toBe(6); // December is month 6
        expect(quarter).toBe(2); // Month 6 is in Q2
      });
    });
  });
});