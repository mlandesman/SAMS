/**
 * Client-Specific Account Mapping Configuration
 * 
 * Provides account mappings for different clients during import
 * Each client can have their own account naming conventions
 * 
 * Created: September 29, 2025
 */

// MTC-specific account mapping (import account name → standardized structure)
const MTC_MAPPING = {
  'MTC Bank': {
    accountId: 'bank-001',
    accountType: 'bank',
    account: 'CiBanco'
  },
  'Cash Account': {
    accountId: 'cash-001',
    accountType: 'cash',
    account: 'Cash'
  },
  'Cash': {
    accountId: 'cash-001',
    accountType: 'cash',
    account: 'Cash'
  }
};

// AVII-specific account mapping
const AVII_MAPPING = {
  'AVII Bank': {
    accountId: 'bank-001',
    accountType: 'bank',
    account: 'Primary Bank'
  },
  'AVII Cash': {
    accountId: 'cash-001',
    accountType: 'cash',
    account: 'Cash'
  },
  'Bank Account': {
    accountId: 'bank-001',
    accountType: 'bank',
    account: 'Primary Bank'
  },
  'Cash': {
    accountId: 'cash-001',
    accountType: 'cash',
    account: 'Cash'
  },
  'Petty Cash': {
    accountId: 'cash-002',
    accountType: 'cash',
    account: 'Petty Cash'
  }
};

// Add more client mappings as needed
const CLIENT_MAPPINGS = {
  MTC: MTC_MAPPING,
  AVII: AVII_MAPPING
};

/**
 * Get account mapping for a specific client
 * @param {string} clientId - Client identifier
 * @returns {Object} Account mapping configuration
 */
export function getClientImportMapping(clientId) {
  const mapping = CLIENT_MAPPINGS[clientId];
  
  if (!mapping) {
    console.warn(`⚠️ No account mapping found for client: ${clientId}`);
    return {};
  }
  
  return mapping;
}

/**
 * Get all configured clients
 * @returns {string[]} Array of client IDs
 */
export function getConfiguredClients() {
  return Object.keys(CLIENT_MAPPINGS);
}

/**
 * Validate if client has account mappings
 * @param {string} clientId - Client identifier
 * @returns {boolean} True if client has mappings
 */
export function hasClientMapping(clientId) {
  return !!CLIENT_MAPPINGS[clientId];
}

/**
 * Get account details by import name
 * @param {string} clientId - Client identifier
 * @param {string} importAccountName - Account name from import data
 * @returns {Object|null} Account details or null
 */
export function getAccountByImportName(clientId, importAccountName) {
  const clientMapping = getClientImportMapping(clientId);
  return clientMapping[importAccountName] || null;
}

/**
 * Get all accounts for a client
 * @param {string} clientId - Client identifier
 * @returns {Object[]} Array of account details
 */
export function getClientAccounts(clientId) {
  const clientMapping = getClientImportMapping(clientId);
  
  return Object.entries(clientMapping).map(([importName, details]) => ({
    importName,
    ...details
  }));
}

/**
 * Add or update client account mapping
 * @param {string} clientId - Client identifier
 * @param {string} importAccountName - Account name from import
 * @param {Object} accountDetails - Account mapping details
 */
export function addClientAccountMapping(clientId, importAccountName, accountDetails) {
  if (!CLIENT_MAPPINGS[clientId]) {
    CLIENT_MAPPINGS[clientId] = {};
  }
  
  CLIENT_MAPPINGS[clientId][importAccountName] = accountDetails;
  
  console.log(`✅ Added account mapping for ${clientId}: ${importAccountName} → ${accountDetails.accountId}`);
}

/**
 * Export all mappings for documentation
 * @returns {Object} All client mappings
 */
export function exportAllMappings() {
  return CLIENT_MAPPINGS;
}

// Export individual mappings for backward compatibility
export { MTC_MAPPING, AVII_MAPPING };