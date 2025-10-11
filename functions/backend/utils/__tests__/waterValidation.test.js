import { 
  validateMeterReading,
  validateBillingDates,
  validatePaymentAmount,
  validateBatchReadings,
  sanitizeMeterReading,
  sanitizeUnitId,
  validateUnitId
} from '../requestValidator.js';

describe('Water Validation Layer', () => {
  
  describe('validateMeterReading', () => {
    test('accepts valid reading', () => {
      const result = validateMeterReading(1234.56);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
    
    test('rejects negative reading', () => {
      const result = validateMeterReading(-10);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Reading cannot be negative');
    });
    
    test('warns on high consumption', () => {
      const result = validateMeterReading(1500, 1200);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('High consumption detected: 300 m³');
    });
    
    test('rejects too many decimal places', () => {
      const result = validateMeterReading(123.456);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Reading can have maximum 2 decimal places');
    });
    
    test('rejects value over maximum', () => {
      const result = validateMeterReading(1000000);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Reading exceeds maximum meter value (999999)');
    });
    
    test('rejects non-numeric values', () => {
      const result = validateMeterReading('abc');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Reading must be a valid number');
    });
    
    test('rejects NaN', () => {
      const result = validateMeterReading(NaN);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Reading must be a valid number');
    });
  });
  
  describe('validateBillingDates', () => {
    test('accepts valid dates', () => {
      const result = validateBillingDates('2025-08-01', '2025-08-11');
      expect(result.valid).toBe(true);
    });
    
    test('rejects due date before billing date', () => {
      const result = validateBillingDates('2025-08-11', '2025-08-01');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Due date must be after billing date');
    });
    
    test('rejects due date more than 30 days after billing', () => {
      const result = validateBillingDates('2025-08-01', '2025-09-15');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Due date cannot be more than 30 days after billing date');
    });
    
    test('rejects invalid billing date', () => {
      const result = validateBillingDates('invalid-date', '2025-08-11');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid billing date');
    });
    
    test('rejects invalid due date', () => {
      const result = validateBillingDates('2025-08-01', 'invalid-date');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid due date');
    });
  });
  
  describe('validatePaymentAmount', () => {
    test('accepts valid payment', () => {
      const result = validatePaymentAmount(50, 5000); // $50 payment, $50 bill
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
    
    test('warns on overpayment', () => {
      const result = validatePaymentAmount(100, 5000); // $100 payment, $50 bill
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Payment is more than 150% of bill amount');
    });
    
    test('warns on small partial payment', () => {
      const result = validatePaymentAmount(3, 5000); // $3 payment, $50 bill
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Payment is less than 10% of bill amount');
    });
    
    test('rejects negative payment', () => {
      const result = validatePaymentAmount(-10, 5000);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Payment amount must be positive');
    });
    
    test('rejects zero payment', () => {
      const result = validatePaymentAmount(0, 5000);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Payment amount must be positive');
    });
  });
  
  describe('validateBatchReadings', () => {
    test('accepts valid batch', () => {
      const readings = [
        { unitId: '101', value: 1234.56 },
        { unitId: '102', value: 2345.67 }
      ];
      const result = validateBatchReadings(readings);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.readings.length).toBe(2);
    });
    
    test('rejects non-array', () => {
      const result = validateBatchReadings('not-an-array');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Readings must be an array');
    });
    
    test('rejects empty array', () => {
      const result = validateBatchReadings([]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one reading is required');
    });
    
    test('validates each reading', () => {
      const readings = [
        { unitId: '101', value: -10 }, // Invalid
        { unitId: '102', value: 2345.67 } // Valid
      ];
      const result = validateBatchReadings(readings);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Reading 1 (101): Reading cannot be negative');
    });
    
    test('requires unitId', () => {
      const readings = [
        { value: 1234.56 } // Missing unitId
      ];
      const result = validateBatchReadings(readings);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Reading 1: unitId is required');
    });
    
    test('requires numeric value', () => {
      const readings = [
        { unitId: '101', value: 'abc' }
      ];
      const result = validateBatchReadings(readings);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Reading 1: value must be a number');
    });
  });
  
  describe('sanitizeMeterReading', () => {
    test('cleans string input with commas', () => {
      expect(sanitizeMeterReading('1,234.56')).toBe(1234.56);
    });
    
    test('cleans string input with spaces', () => {
      expect(sanitizeMeterReading(' 123.45 ')).toBe(123.45);
    });
    
    test('rounds to 2 decimals', () => {
      expect(sanitizeMeterReading(123.456789)).toBe(123.46);
    });
    
    test('handles integer strings', () => {
      expect(sanitizeMeterReading('123')).toBe(123);
    });
    
    test('returns null for invalid string', () => {
      expect(sanitizeMeterReading('abc')).toBe(null);
    });
    
    test('returns null for null input', () => {
      expect(sanitizeMeterReading(null)).toBe(null);
    });
    
    test('returns null for undefined', () => {
      expect(sanitizeMeterReading(undefined)).toBe(null);
    });
    
    test('handles negative numbers', () => {
      expect(sanitizeMeterReading(-123.456)).toBe(-123.46);
    });
  });
  
  describe('sanitizeUnitId', () => {
    test('trims whitespace', () => {
      expect(sanitizeUnitId(' 101 ')).toBe('101');
    });
    
    test('handles numeric strings', () => {
      expect(sanitizeUnitId('101')).toBe('101');
      expect(sanitizeUnitId('202')).toBe('202');
    });
    
    test('returns empty string for non-string', () => {
      expect(sanitizeUnitId(null)).toBe('');
      expect(sanitizeUnitId(undefined)).toBe('');
      expect(sanitizeUnitId(123)).toBe('');
    });
  });
  
  describe('validateUnitId', () => {
    test('accepts valid AVII unit IDs', () => {
      expect(validateUnitId('101').valid).toBe(true);
      expect(validateUnitId('102').valid).toBe(true);
      expect(validateUnitId('201').valid).toBe(true);
      expect(validateUnitId('202').valid).toBe(true);
    });
    
    test('rejects non-3-digit IDs', () => {
      const result = validateUnitId('10');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unit ID must be a 3-digit number (e.g., "101", "102")');
    });
    
    test('rejects non-numeric IDs', () => {
      const result = validateUnitId('A01');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unit ID must be a 3-digit number (e.g., "101", "102")');
    });
    
    test('rejects null/undefined', () => {
      expect(validateUnitId(null).valid).toBe(false);
      expect(validateUnitId(undefined).valid).toBe(false);
      expect(validateUnitId('').valid).toBe(false);
    });
  });
});

console.log('All validation tests defined');