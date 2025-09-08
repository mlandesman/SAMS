/**
 * Fetches authorized clients for the current user via secure API
 * @returns {Promise<Array<{id: string, fullName: string, [key: string]: any}>>}
 */

import { config } from '../config';
export async function fetchClients() {
  try {
    // Get authentication headers
    const { getCurrentUser } = await import('../firebaseClient');
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      console.warn('User not authenticated, returning empty client list');
      return [];
    }

    // Get Firebase ID token
    const { getAuthInstance } = await import('../firebaseClient');
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      console.warn('Failed to get authentication token, returning empty client list');
      return [];
    }

    // Make secure API call to get authorized clients
    const API_BASE_URL = config.api.baseUrl;
    const response = await fetch(`${API_BASE_URL}/clients`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn(`API Error ${response.status}: ${errorData.error || 'Unknown error'}`);
      return [];
    }

    const clients = await response.json();
    console.log('✅ Secure clients fetched:', clients.length);
    return clients;
    
  } catch (error) {
    console.error('❌ Error fetching authorized clients:', error);
    return [];
  }
}