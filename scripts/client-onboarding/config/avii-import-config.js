/**
 * AVII Import Configuration
 * Centralized configuration for AVII import scripts
 * 
 * Created: November 12, 2025
 * Purpose: Support quarterly billing for AVII client imports
 */

export const AVII_IMPORT_CONFIG = {
  clientId: 'AVII',
  
  // AVII uses quarterly billing for both HOA Dues and Water Bills
  billingFrequency: {
    hoaDues: 'quarterly',
    waterBills: 'quarterly'
  },
  
  // Fiscal year configuration
  fiscalYear: {
    startMonth: 7,  // July (fiscal year runs July 1 - June 30)
    startDay: 1,
    description: 'FY 2026 runs from July 1, 2025 to June 30, 2026'
  },
  
  // Timezone configuration
  timezone: 'America/Cancun',
  
  // Account definitions (customize as needed for AVII)
  accounts: {
    bank: {
      id: 'bank-001',
      name: 'AVII Bank Account',
      type: 'bank',
      currency: 'USD'
    },
    cash: {
      id: 'cash-001',
      name: 'AVII Cash Account',
      type: 'cash',
      currency: 'USD'
    }
  },
  
  // Year-end balances for FY 2025 (ended June 30, 2025)
  // AVII started collecting data July 1, 2025 (start of FY 2026)
  yearEndBalances: {
    year: '2025',
    balances: {
      'bank-001': 0,  // Zero balance as of June 30, 2025 (before data collection started)
      'cash-001': 0
    },
    note: 'Initial FY 2025 year-end snapshot. AVII started collecting data July 1, 2025 (FY 2026).'
  },
  
  // HOA Dues configuration
  hoaDuesConfig: {
    penaltyDays: 30,           // 30-day grace period for quarterly bills
    penaltyRate: 0.05,         // 5% monthly penalty
    dueDay: 1,                 // Due on 1st of quarter start month
    compoundPenalty: true,     // Compound penalties on unpaid amounts
    duesFrequency: 'quarterly' // Quarterly billing
  },
  
  // Water Bills configuration
  waterBillsConfig: {
    billingPeriod: 'quarterly', // Quarterly billing (bill IDs: 2026-Q1, 2026-Q2, etc.)
    penaltyDays: 30,           // 30-day grace period (more time for larger quarterly bills)
    penaltyRate: 0.05,         // 5% monthly penalty
    compoundPenalty: true,     // Compound penalties
    allowCreditBalance: true,  // Allow credit balances
    autoApplyCredit: true      // Automatically apply credits to new bills
  },
  
  // Account name mappings for transaction import
  accountMappings: {
    'AVII Bank Account': 'bank-001',
    'AVII Bank': 'bank-001',
    'Cash Account': 'cash-001',
    'Cash': 'cash-001'
  }
};

export default AVII_IMPORT_CONFIG;
