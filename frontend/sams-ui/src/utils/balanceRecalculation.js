import { config } from '../config';
import { getCurrentUser, getAuthInstance } from '../firebaseClient';
import { clearAccountsCache } from './clientAccounts';

/**
 * Recalculates client account balances from year-end snapshot using backend API
 * @param {string} clientId - The client ID
 * @param {string} startYear - The year to start from (optional - backend will auto-determine)
 * @returns {Promise<Object>} Updated account balances
 */
export async function recalculateClientBalances(clientId, startYear = null) {
  console.log(`🔄 Frontend: Recalculating balances for client ${clientId}...`);
  
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

    // Call the new POST API endpoint
    const response = await fetch(`${config.api.baseUrl}/clients/${clientId}/balances/recalculate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...(startYear && { startYear }), // Only include startYear if provided
        forceRebuild: false
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      // Special handling for missing accountType errors
      if (data.error && data.error.includes('missing a valid accountType')) {
        console.error(`❌ ${data.error}`);
        // Still return the zero balances data if provided
        if (data.data) {
          return data.data;
        }
      }
      throw new Error(data.error || 'Failed to recalculate balances');
    }
    
    // Clear the accounts cache for this client since balances were recalculated
    clearAccountsCache(clientId);
    
    const usedYear = data.data.sourceSnapshot ? data.data.sourceSnapshot.substring(0, 4) : 'auto-determined';
    console.log(`✅ Frontend: Successfully rebuilt account balances from ${usedYear} snapshot`);
    console.log(`Processed ${data.data.processedTransactions} transactions`);
    
    // Display the updated balances
    console.log('Updated account balances:');
    data.data.accounts.forEach(account => {
      console.log(`${account.name} (${account.id}): ${account.balance}`);
    });
    
    return data.data;
    
  } catch (error) {
    console.error(`❌ Frontend: Error rebuilding balances:`, error);
    throw error;
  }
}
