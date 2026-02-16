/**
 * System Errors API Service
 * Handles System Error Monitor endpoints (SuperAdmin only for read/acknowledge).
 */

import { getAuthInstance } from '../firebaseClient';
import { config } from '../config';

const API_BASE_URL = config.api.baseUrl;

async function getAuthHeaders() {
  const auth = getAuthInstance();
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  const token = await currentUser.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Get unacknowledged system errors
 * @param {number} limit - Max errors to return (default 50)
 * @returns {Promise<{ errors: Array, count: number }>}
 */
export async function getSystemErrors(limit = 50) {
  const headers = await getAuthHeaders();
  const query = `?limit=${encodeURIComponent(limit)}`;
  const response = await fetch(`${API_BASE_URL}/api/system/errors${query}`, {
    method: 'GET',
    headers,
    credentials: 'include',
    cache: 'no-store',
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.error || `API Error: ${response.status}`);
  }
  return result;
}

/**
 * Acknowledge a single error
 * @param {string} errorId - Document ID
 */
export async function acknowledgeError(errorId) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/system/errors/${errorId}/acknowledge`, {
    method: 'PUT',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result?.error || `API Error: ${response.status}`);
  }
}

/**
 * Acknowledge all unacknowledged errors
 * @returns {Promise<{ acknowledged: number }>}
 */
export async function acknowledgeAllErrors() {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/system/errors/acknowledge-all`, {
    method: 'PUT',
    headers,
    credentials: 'include',
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.error || `API Error: ${response.status}`);
  }
  return result;
}

/**
 * Log a frontend error (for EM-3 error capture)
 * @param {Object} params
 * @param {string} params.module - Module name (e.g. 'auth', 'payment')
 * @param {string} params.message - Error message
 * @param {string} [params.details] - Stack trace or details
 * @returns {Promise<{ id: string }>}
 */
export async function logFrontendError({ module, message, details }) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/system/logError`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      source: 'frontend',
      module: module || 'general',
      message: String(message),
      details: details ? String(details) : '',
      // Schema expansion — enriched context
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      url: typeof window !== 'undefined' ? window.location.href : null,
      version: (typeof window !== 'undefined' && window.__SAMS_VERSION__) ? window.__SAMS_VERSION__ : 'unknown',
      environment: (typeof window !== 'undefined' && window.location.hostname.includes('localhost')) ? 'development' : 'production',
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.error || `API Error: ${response.status}`);
  }
  return result;
}
