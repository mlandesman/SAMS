/**
 * MTC Import Configuration
 * Centralized configuration for MTC import scripts
 */

export const MTC_IMPORT_CONFIG = {
  clientId: 'MTC',
  
  // Account definitions
  accounts: {
    bank: {
      id: 'bank-001',
      name: 'MTC Bank',
      type: 'bank',
      currency: 'USD'
    },
    cash: {
      id: 'cash-001', 
      name: 'Cash Account',
      type: 'cash',
      currency: 'USD'
    }
  },
  
  // Year-end balances for 2024 (in cents)
  yearEndBalances: {
    year: '2024',
    balances: {
      'bank-001': 16408800,  // $164,088.00
      'cash-001': 500000     // $5,000.00
    }
  },
  
  // Account name mappings for transaction import
  accountMappings: {
    'MTC Bank': 'bank-001',
    'Cash Account': 'cash-001'
  }
};

export default MTC_IMPORT_CONFIG;