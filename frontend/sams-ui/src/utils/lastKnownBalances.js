import { getFirestore, doc, getDoc } from 'firebase/firestore';

// Cache object to store results by client and month - persists between renders
const balanceCache = {};

/**
 * Recursively searches for the most recent balance snapshot
 * starting from the given date and moving backward month by month
 * @param {string} clientId - The client ID
 * @param {Date} endDate - The end date to search from
 * @param {number} maxAttempts - Maximum number of months to look back (default: 12)
 * @param {number} attempt - Current attempt number (used internally for recursion)
 * @returns {Promise<Object|null>} The balance snapshot or null if not found
 */
export async function lastKnownBalances(clientId, endDate, maxAttempts = 12, attempt = 0) {
  if (attempt >= maxAttempts) {
    console.error(`Failed to find balance snapshot after ${maxAttempts} attempts`);
    return null;
  }

  const db = getFirestore();
  const searchDate = new Date(endDate);
  
  // Adjust date for the current attempt (move back 'attempt' months)
  searchDate.setMonth(searchDate.getMonth() - attempt);
  
  // Format as YYYY-MM for document ID
  const yearMonth = `${searchDate.getFullYear()}-${String(searchDate.getMonth() + 1).padStart(2, '0')}`;
  
  // Create cache key
  const cacheKey = `${clientId}-${yearMonth}`;
  
  // Check if we've already searched this combination
  if (balanceCache[cacheKey] !== undefined) {
    console.log(`Using cached result for ${yearMonth}`);
    return balanceCache[cacheKey];
  }
  
  console.log(`Searching for balance snapshot: ${yearMonth} (attempt ${attempt + 1})`);
  
  // Try to get the document directly by ID
  const balanceDocRef = doc(db, `clients/${clientId}/balances`, yearMonth);
  const balanceDocSnap = await getDoc(balanceDocRef);
  
  if (balanceDocSnap.exists()) {
    // Found a balance document
    console.log(`Found balance snapshot for ${yearMonth}`);
    const result = { id: balanceDocSnap.id, ...balanceDocSnap.data() };
    
    // Store in cache for future lookups
    balanceCache[cacheKey] = result;
    
    return result;
  }
  
  // No document found for this month, cache negative result
  balanceCache[cacheKey] = null;
  
  // No document found for this month, try the previous month
  console.log(`No balance snapshot found for ${yearMonth}, trying previous month`);
  return lastKnownBalances(clientId, endDate, maxAttempts, attempt + 1);
}

/**
 * Clears the balance cache for a specific client or all clients
 * @param {string} [clientId] - The client ID. If not provided, clears cache for all clients
 */
export function clearBalanceCache(clientId = null) {
  if (clientId) {
    // Clear cache for specific client
    console.log(`Clearing balance cache for client: ${clientId}`);
    Object.keys(balanceCache).forEach(key => {
      if (key.startsWith(`${clientId}-`)) {
        delete balanceCache[key];
      }
    });
  } else {
    // Clear entire cache
    console.log('Clearing all balance cache');
    Object.keys(balanceCache).forEach(key => {
      delete balanceCache[key];
    });
  }
}