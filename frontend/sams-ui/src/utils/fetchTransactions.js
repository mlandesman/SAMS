import { fetchTransactions as fetchTransactionsAPI } from '../api/transaction';

/**
 * Fetches all transactions for a client between startDate and endDate.
 * Now uses the secure backend API instead of direct Firestore access.
 *
 * @param {Object} params
 * @param {string} params.clientId - e.g., "MTC"
 * @param {Date} params.startDate - Start of filter range
 * @param {Date} params.endDate - End of filter range
 * @returns {Promise<Array>} Array of transaction objects
 */
export async function fetchTransactions({ clientId, startDate, endDate, unitId, language = 'EN' }) {
  try {
    // Use the API method with filters
    const transactions = await fetchTransactionsAPI(clientId, {
      startDate,
      endDate,
      ...(unitId && { unitId }),
      language
    });
    
    // The API returns transactions already sorted by date desc
    return transactions;
  } catch (err) {
    console.error('❌ Failed to fetch transactions:', err);
    return [];
  }
}