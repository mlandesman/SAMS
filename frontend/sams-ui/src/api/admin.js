/**
 * Admin API Service
 * 
 * Handles communication with the backend for admin operations
 */

import { getCurrentUser, getAuthInstance } from '../firebaseClient';
import { config } from '../config';
const API_BASE_URL = config.api.baseUrl;

/**
 * Get authentication headers with Firebase ID token
 */
async function getAuthHeaders() {
  const auth = getAuthInstance();
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  try {
    const token = await currentUser.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  } catch (error) {
    console.error('Failed to get auth token:', error);
    throw new Error('Authentication failed');
  }
}

/**
 * Get bulk statement generation progress
 * @param {string} clientId - The client ID
 * @returns {Promise<Object|null>} Progress data or null if no generation in progress
 */
export async function getBulkStatementProgress(clientId) {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/admin/bulk-statements/progress/${clientId}`, {
      method: 'GET',
      headers,
      credentials: 'include'
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.data;
    
  } catch (error) {
    console.error('❌ Error getting bulk progress:', error);
    return null;
  }
}

/**
 * Bulk generate statements for all units in a client with polling-based progress
 * @param {string} clientId - The client ID
 * @param {number} fiscalYear - Optional fiscal year (defaults to current)
 * @param {string} language - Language ('english' or 'spanish')
 * @param {Function} onProgress - Callback for progress updates: (progress) => void
 * @returns {Promise<Object>} Response with generation results
 */
export async function bulkGenerateStatements(clientId, fiscalYear = null, language = 'english', onProgress = null) {
  let pollingInterval = null;
  
  try {
    console.log(`🚀 Bulk generating statements for client: ${clientId}`);
    
    const headers = await getAuthHeaders();
    
    const body = {
      clientId,
      language
    };
    
    if (fiscalYear !== null) {
      body.fiscalYear = fiscalYear;
    }
    
    // Start polling for progress updates
    if (onProgress) {
      pollingInterval = setInterval(async () => {
        try {
          const progress = await getBulkStatementProgress(clientId);
          if (progress) {
            onProgress({
              current: progress.current,
              total: progress.total,
              generated: progress.generated,
              failed: progress.failed,
              message: progress.message,
              status: progress.status
            });
          }
        } catch (pollError) {
          console.warn('Progress polling error:', pollError);
        }
      }, 1000); // Poll every second
    }
    
    // Make the generate request (this will complete when all statements are done)
    const response = await fetch(`${API_BASE_URL}/admin/bulk-statements/generate`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(body)
    });
    
    // Stop polling
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Bulk generation complete: ${result.data.generated} successful, ${result.data.failed} failed`);
      
      // Send final progress update
      if (onProgress) {
        onProgress({
          current: result.data.totalUnits,
          total: result.data.totalUnits,
          generated: result.data.generated,
          failed: result.data.failed,
          message: `Complete: ${result.data.generated} generated, ${result.data.failed} failed`,
          status: 'complete'
        });
      }
      
      return { success: true, data: result.data };
    } else {
      console.error('❌ Failed to generate bulk statements:', result.error);
      throw new Error(result.error || 'Bulk generation failed');
    }
    
  } catch (error) {
    // Stop polling on error
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    console.error('❌ Error bulk generating statements:', error);
    throw error;
  }
}
