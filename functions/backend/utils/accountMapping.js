/**
 * Account Mapping Utility - CORRECTED IMPLEMENTATION
 * Maps import account names to standardized account structure
 * 
 * ARCHITECTURE:
 * - accountId: Unique identifier for specific accounts (bank-cibanco-001, cash-001)
 * - accountType: Category for balance aggregation (bank, cash)  
 * - account: Display name for user interfaces (CiBanco, Cash)
 */

// MTC-specific account mapping (import account name → standardized structure)
const MTC_ACCOUNT_MAPPING = {
  // Import account names from MTC JSON
  'MTC Bank': {
    accountId: 'bank-001',
    accountType: 'bank', 
    account: 'CiBanco'
  },
  'Cash Account': {
    accountId: 'cash-001',
    accountType: 'cash',
    account: 'Cash'
  }
};

// Frontend account name mapping for new transactions
const FRONTEND_ACCOUNT_NAME_MAPPING = {
  // Specific account name mappings
  'Petty Cash': {
    accountId: 'cash-petty-001',
    accountName: 'Petty Cash',
    accountType: 'cash'
  },
  'MTC Bank Account': {
    accountId: 'bank-mtc-001',
    accountName: 'MTC Bank Account',
    accountType: 'bank'
  },
  // Legacy type mappings
  'Bank': {
    accountId: 'bank-mtc-001',
    accountName: 'MTC Bank Account',
    accountType: 'bank'
  },
  'Cash': {
    accountId: 'cash-petty-001',
    accountName: 'Petty Cash',
    accountType: 'cash'
  }
};

// Account lookup by ID
const ACCOUNT_DETAILS = {
  'bank-mtc-001': {
    accountType: 'bank',
    accountName: 'MTC Bank Account',
    fullName: 'MTC Bank Account'
  },
  'cash-petty-001': {
    accountType: 'cash',
    accountName: 'Petty Cash', 
    fullName: 'Petty Cash'
  }
};

/**
 * Apply account mapping to transaction data
 * Handles both import data and frontend transaction creation
 * 
 * @param {Object} transactionData - Raw transaction data
 * @returns {Object} - Enhanced transaction data with complete account structure
 */
export function applyAccountMapping(transactionData) {
  const mappedData = { ...transactionData };
  
  // Priority 1: If transaction already has accountId, ensure consistency
  if (mappedData.accountId) {
    const accountDetails = ACCOUNT_DETAILS[mappedData.accountId];
    if (accountDetails) {
      // Fill in missing fields for consistency
      if (!mappedData.accountType) mappedData.accountType = accountDetails.accountType;
      if (!mappedData.account) mappedData.account = accountDetails.account;
    }
    return mappedData;
  }
  
  // Priority 2: Map import account names (e.g., "MTC Bank" from JSON)
  // Check both "Account" (MTC JSON format) and "account" (standard format)
  const importAccountName = mappedData.Account || mappedData.account;
  if (importAccountName && MTC_ACCOUNT_MAPPING[importAccountName]) {
    const mapping = MTC_ACCOUNT_MAPPING[importAccountName];
    mappedData.accountId = mapping.accountId;
    mappedData.accountType = mapping.accountType;
    mappedData.account = mapping.account; // Standardize the name
    
    console.log(`🔄 Mapped import account "${importAccountName}" → accountId "${mapping.accountId}" + accountType "${mapping.accountType}"`);
    return mappedData;
  }
  
  // Priority 3: Frontend account name mapping (including accountType for legacy)
  const frontendAccountName = mappedData.account || mappedData.accountType;
  if (frontendAccountName && FRONTEND_ACCOUNT_NAME_MAPPING[frontendAccountName]) {
    const mapping = FRONTEND_ACCOUNT_NAME_MAPPING[frontendAccountName];
    mappedData.accountId = mapping.accountId;
    mappedData.accountName = mapping.accountName;
    mappedData.accountType = mapping.accountType;
    
    // Remove legacy 'account' field to avoid duplication
    delete mappedData.account;
    
    console.log(`🔄 Mapped frontend account "${frontendAccountName}" → accountId "${mapping.accountId}" + accountName "${mapping.accountName}" + accountType "${mapping.accountType}"`);
    return mappedData;
  }
  
  return mappedData;
}

/**
 * Validate that transaction has proper account references
 */
export function validateAccountFields(transactionData) {
  const errors = [];
  
  // Must have accountId and accountType (accountName is optional)
  if (!transactionData.accountId || !transactionData.accountType) {
    errors.push('Transaction must specify both accountId and accountType');
  }
  
  // If accountId and accountType are provided, accept as valid
  // accountName is optional and will be resolved from account lookup
  if (transactionData.accountId && transactionData.accountType) {
    // Valid account structure - accountName is optional
    return {
      isValid: true,
      errors: []
    };
  }
  
  // For unknown accounts, validate accountType is present (accountName not required)
  if (transactionData.accountId && !transactionData.accountType && !ACCOUNT_DETAILS[transactionData.accountId]) {
    errors.push(`Unknown accountId: "${transactionData.accountId}" - must provide accountType for validation`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get available accounts for frontend dropdowns
 */
export function getAvailableAccounts() {
  return Object.entries(ACCOUNT_DETAILS).map(([accountId, details]) => ({
    accountId,
    accountType: details.accountType,
    account: details.account,
    fullName: details.fullName
  }));
}

/**
 * Get accounts grouped by type for balance aggregation
 */
export function getAccountsByType() {
  const accountsByType = {};
  
  Object.entries(ACCOUNT_DETAILS).forEach(([accountId, details]) => {
    if (!accountsByType[details.accountType]) {
      accountsByType[details.accountType] = [];
    }
    accountsByType[details.accountType].push({
      accountId,
      account: details.account,
      fullName: details.fullName
    });
  });
  
  return accountsByType;
}

/**
 * Import mapping for MTC data (used by import scripts)
 */
export function getMTCImportMapping() {
  return MTC_ACCOUNT_MAPPING;
}

export { MTC_ACCOUNT_MAPPING, FRONTEND_ACCOUNT_NAME_MAPPING, ACCOUNT_DETAILS };