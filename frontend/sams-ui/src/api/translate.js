/**
 * Translation API Service
 * Frontend wrapper for DeepL translation endpoint
 * 
 * Usage:
 *   import { translateToSpanish } from '../api/translate';
 *   const result = await translateToSpanish('Hello world');
 *   if (result.success) {
 *     console.log(result.translatedText); // "Hola mundo"
 *   }
 */

import { getCurrentUser } from '../firebaseClient';
import { config } from '../config';

const API_BASE_URL = config.api.baseUrl;

/**
 * Get authentication headers
 */
async function getAuthHeaders() {
  const currentUser = getCurrentUser();
  
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  const { getAuthInstance } = await import('../firebaseClient');
  const auth = getAuthInstance();
  const token = await auth.currentUser?.getIdToken();
  
  if (!token) {
    throw new Error('Failed to get authentication token');
  }
  
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Translate English text to Spanish via DeepL
 * @param {string} text - English text to translate
 * @returns {Promise<Object>} Translation result
 * @returns {boolean} result.success - Whether translation succeeded
 * @returns {string} result.translatedText - Spanish translation (if success)
 * @returns {number} result.billedCharacters - Number of characters translated
 * @returns {string} result.error - Error message (if failed)
 */
export async function translateToSpanish(text) {
  try {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return {
        success: false,
        error: 'Text is required for translation'
      };
    }

    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/translate`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ text })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Translation failed');
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Translation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
