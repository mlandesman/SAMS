import { config } from '../config';
import { getCurrentUser, getAuthInstance } from '../firebaseClient';

// Cache object to store results by client - persists between renders
const accountsCache = {};

/**
 * Fetches the current account balances for a client
 * @param {string} clientId - The client ID
 * @param {boolean} [skipCache=false] - If true, bypasses cache and forces fresh data
 * @param {Object} [options={}] - Optional query options
 * @param {string} [options.asOfDate] - Optional YYYY-MM-DD for historical balances
 * @returns {Promise<Object>} Object with cash and bank totals
 */
export async function getClientAccountBalances(clientId, skipCache = false, options = {}) {
  if (!clientId) {
    console.error('No client ID provided to getClientAccountBalances');
    return null;
  }

  const { asOfDate } = options;
  const cacheKey = asOfDate ? `${clientId}::${asOfDate}` : clientId;

  // Use cached result if available and not skipping cache
  if (!skipCache && accountsCache[cacheKey]) {
    console.log(`Using cached account balances for key: ${cacheKey}`);
    return accountsCache[cacheKey];
  }

  console.log(`Fetching account balances for key: ${cacheKey}`);
  
  try {
    // Get authentication token
    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error('Failed to get authentication token');
    }

    const query = asOfDate ? `?asOfDate=${encodeURIComponent(asOfDate)}` : '';
    const response = await fetch(`${config.api.baseUrl}/clients/${clientId}/balances/current${query}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch balances');
    }
    
    // Create result object matching the expected format
    const result = {
      cashBalance: data.data.cashBalance,
      bankBalance: data.data.bankBalance,
      accounts: data.data.accounts,
      lastUpdated: data.data.lastUpdated,
      historicalLookup: data.data.historicalLookup || null
    };
    
    // Cache the result
    accountsCache[cacheKey] = result;
    
    return result;
  } catch (error) {
    console.error('Error fetching client account balances:', error);
    return null;
  }
}

/**
 * Clears the accounts cache for a specific client or all clients
 * @param {string} [clientId] - The client ID. If not provided, clears cache for all clients
 */
export function clearAccountsCache(clientId = null) {
  if (clientId) {
    console.log(`Clearing accounts cache for client: ${clientId}`);
    Object.keys(accountsCache).forEach((key) => {
      if (key === clientId || key.startsWith(`${clientId}::`)) {
        delete accountsCache[key];
      }
    });
  } else {
    console.log('Clearing all accounts cache');
    Object.keys(accountsCache).forEach(key => {
      delete accountsCache[key];
    });
  }
}

/**
 * Get a specific account by ID or name
 * @param {string} clientId - The client ID
 * @param {string} accountIdOrName - The account ID or name to find
 * @returns {Promise<Object|null>} The account object or null if not found
 */
export async function getAccount(clientId, accountIdOrName) {
  const balances = await getClientAccountBalances(clientId);
  
  if (!balances || !balances.accounts) {
    return null;
  }
  
  return balances.accounts.find(
    acc => acc.id === accountIdOrName || acc.name === accountIdOrName
  ) || null;
}

/**
 * Gets an account balance from the year-end snapshot
 * @param {string} clientId - The client ID
 * @param {string} year - The year in YYYY format
 * @returns {Promise<Object|null>} Object with accounts array and balance totals
 */
export async function getYearEndBalances(clientId, year) {
  if (!clientId || !year) {
    console.error('Client ID and year are required for getYearEndBalances');
    return null;
  }

  console.log(`Fetching year-end balances for client ${clientId} year ${year}`);
  
  try {
    // Get authentication token
    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error('Failed to get authentication token');
    }

    // Call the new API endpoint
    const response = await fetch(`${config.api.baseUrl}/clients/${clientId}/balances/year-end/${year}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 404) {
      console.error(`Year-end snapshot for client ${clientId} year ${year} not found`);
      return null;
    }
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch year-end balances');
    }
    
    return {
      cashBalance: data.data.cashBalance,
      bankBalance: data.data.bankBalance,
      accounts: data.data.accounts,
      snapshotDate: data.data.snapshotDate,
      createdAt: data.data.createdAt
    };
  } catch (error) {
    console.error('Error fetching year-end balances:', error);
    return null;
  }
}
