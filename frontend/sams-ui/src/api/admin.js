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
 * Bulk generate statements for all units in a client with streaming progress
 * @param {string} clientId - The client ID
 * @param {number} fiscalYear - Optional fiscal year (defaults to current)
 * @param {string} language - Language ('english' or 'spanish')
 * @param {Function} onProgress - Callback for progress updates: (progress) => void
 * @returns {Promise<Object>} Response with generation results
 */
export async function bulkGenerateStatements(clientId, fiscalYear = null, language = 'english', onProgress = null) {
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
    
    const response = await fetch(`${API_BASE_URL}/admin/bulk-statements/generate`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Handle streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult = null;
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const data = JSON.parse(line);
          
          if (data.type === 'progress' && onProgress) {
            // Call progress callback
            onProgress(data);
          } else if (data.type === 'complete') {
            // Final result
            finalResult = data;
          }
        } catch (e) {
          console.warn('Failed to parse progress line:', line, e);
        }
      }
    }
    
    // Parse any remaining buffer
    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer);
        if (data.type === 'complete') {
          finalResult = data;
        }
      } catch (e) {
        console.warn('Failed to parse final buffer:', buffer, e);
      }
    }
    
    if (finalResult && finalResult.success) {
      console.log(`✅ Bulk generation complete: ${finalResult.data.generated} successful, ${finalResult.data.failed} failed`);
      return finalResult;
    } else {
      console.error('❌ Failed to generate bulk statements:', finalResult?.error);
      throw new Error(finalResult?.error || 'Bulk generation failed');
    }
    
  } catch (error) {
    console.error('❌ Error bulk generating statements:', error);
    throw error;
  }
}
