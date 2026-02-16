/**
 * Secure API Client for SAMS Multi-Tenant System
 * Phase 8: User Access Control System - Frontend Security
 * 
 * Provides authenticated and authorized API calls with client isolation
 * Automatically includes security headers and validates client access
 */

import { getCurrentUser } from '../firebaseClient';
import { useAuth } from '../context/AuthContext';
import { config } from '../config';
import React from 'react';
import { logFrontendError } from './systemErrors.js';

/**
 * Base API configuration
 */
const API_BASE_URL = config.api.baseUrl;

/**
 * Security error types
 */
export const SECURITY_ERRORS = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  CLIENT_ACCESS_DENIED: 'CLIENT_ACCESS_DENIED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_CLIENT: 'INVALID_CLIENT'
};

/**
 * Custom error class for security-related API errors
 */
export class SecurityError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Get authentication headers with Firebase ID token
 */
async function getAuthHeaders() {
  const currentUser = getCurrentUser();
  
  if (!currentUser) {
    throw new SecurityError('User not authenticated', SECURITY_ERRORS.UNAUTHORIZED);
  }

  // Get Firebase ID token from auth instance
  const { getAuthInstance } = await import('../firebaseClient');
  const auth = getAuthInstance();
  const token = await auth.currentUser?.getIdToken();
  
  if (!token) {
    throw new SecurityError('Failed to get authentication token', SECURITY_ERRORS.UNAUTHORIZED);
  }
  
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Validate property access before making API calls
 */
function validatePropertyAccess(samsUser, clientId) {
  if (!samsUser) {
    throw new SecurityError('User profile not loaded', SECURITY_ERRORS.UNAUTHORIZED);
  }

  if (!clientId) {
    throw new SecurityError('Client ID is required', SECURITY_ERRORS.INVALID_CLIENT);
  }

  // SuperAdmin can access any client
  if (samsUser.email === 'michael@landesman.com' || samsUser.globalRole === 'superAdmin') {
    return true;
  }

  // Check if user has access to this client
  if (!samsUser.propertyAccess?.[clientId]) {
    throw new SecurityError(
      `Access denied to client ${clientId}`, 
      SECURITY_ERRORS.CLIENT_ACCESS_DENIED,
      { clientId, userEmail: samsUser.email }
    );
  }

  return true;
}

/**
 * Report API errors to system error monitor (fire-and-forget).
 * Excludes /api/system/logError to prevent infinite loops.
 * Only reports 403 and 5xx — not 401 (normal re-auth) or network/abort errors.
 */
function reportApiError(url, method, status, errorMessage) {
  if (url.includes('/api/system/logError')) return;
  if (status === 401) return;
  if (status !== 403 && status < 500) return; // Report 403 and 5xx only
  logFrontendError({
    module: 'api',
    message: `API ${method} ${url} failed: ${status} - ${errorMessage}`,
    details: JSON.stringify({ url, method, status })
  }).catch(() => {});
}

/**
 * Enhanced fetch wrapper with security validation
 */
async function secureApiCall(url, options = {}, clientId = null, samsUser = null) {
  try {
    // Validate property access if clientId is provided
    if (clientId && samsUser) {
      validatePropertyAccess(samsUser, clientId);
    }

    // Get authentication headers
    const authHeaders = await getAuthHeaders();
    
    // Merge headers
    const headers = {
      ...authHeaders,
      ...options.headers
    };

    // Make the API call
    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers
    });

    // Handle HTTP errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error || 'Unknown error';
      const method = (options.method || 'GET').toUpperCase();

      // Report 403 and 5xx to system error monitor (fire-and-forget)
      reportApiError(url, method, response.status, errorMsg);

      switch (response.status) {
        case 401:
          throw new SecurityError(
            errorData.error || 'Authentication failed',
            SECURITY_ERRORS.UNAUTHORIZED
          );
        case 403:
          const errorCode = errorData.code === 'CLIENT_ACCESS_DENIED'
            ? SECURITY_ERRORS.CLIENT_ACCESS_DENIED
            : SECURITY_ERRORS.PERMISSION_DENIED;
          throw new SecurityError(
            errorData.error || 'Access denied',
            errorCode,
            errorData
          );
        default:
          throw new Error(`API Error ${response.status}: ${errorMsg}`);
      }
    }

    // Return response data
    return await response.json();
  } catch (error) {
    // Re-throw security errors as-is
    if (error instanceof SecurityError) {
      throw error;
    }
    
    // Wrap other errors
    throw new Error(`API call failed: ${error.message}`);
  }
}

/**
 * Secure API Client Class
 */
export class SecureApiClient {
  constructor(samsUser) {
    this.samsUser = samsUser;
  }

  /**
   * Update user context for permission validation
   */
  updateUser(samsUser) {
    this.samsUser = samsUser;
  }

  /**
   * Generic client-scoped API methods
   */
  
  // Transaction operations
  async getTransactions(clientId, filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    const url = `/clients/${clientId}/transactions${queryParams ? `?${queryParams}` : ''}`;
    return secureApiCall(url, { method: 'GET' }, clientId, this.samsUser);
  }

  async createTransaction(clientId, transactionData) {
    return secureApiCall(
      `/clients/${clientId}/transactions`,
      {
        method: 'POST',
        body: JSON.stringify(transactionData)
      },
      clientId,
      this.samsUser
    );
  }

  async updateTransaction(clientId, transactionId, transactionData) {
    return secureApiCall(
      `/clients/${clientId}/transactions/${transactionId}`,
      {
        method: 'PUT',
        body: JSON.stringify(transactionData)
      },
      clientId,
      this.samsUser
    );
  }

  async deleteTransaction(clientId, transactionId) {
    return secureApiCall(
      `/clients/${clientId}/transactions/${transactionId}`,
      { method: 'DELETE' },
      clientId,
      this.samsUser
    );
  }

  // Document operations
  async getDocuments(clientId) {
    return secureApiCall(
      `/clients/${clientId}/documents`,
      { method: 'GET' },
      clientId,
      this.samsUser
    );
  }

  async uploadDocument(clientId, file, metadata = {}) {
    const formData = new FormData();
    formData.append('file', file);
    Object.keys(metadata).forEach(key => {
      formData.append(key, metadata[key]);
    });

    // Get auth headers without Content-Type (FormData sets it)
    const authHeaders = await getAuthHeaders();
    delete authHeaders['Content-Type']; // Let browser set multipart boundary

    return secureApiCall(
      `/clients/${clientId}/documents/upload`,
      {
        method: 'POST',
        headers: authHeaders,
        body: formData
      },
      clientId,
      this.samsUser
    );
  }

  async deleteDocument(clientId, documentId) {
    return secureApiCall(
      `/clients/${clientId}/documents/${documentId}`,
      { method: 'DELETE' },
      clientId,
      this.samsUser
    );
  }

  // Unit operations
  async getUnits(clientId) {
    return secureApiCall(
      `/clients/${clientId}/units`,
      { method: 'GET' },
      clientId,
      this.samsUser
    );
  }

  async createUnit(clientId, unitData) {
    return secureApiCall(
      `/clients/${clientId}/units`,
      {
        method: 'POST',
        body: JSON.stringify(unitData)
      },
      clientId,
      this.samsUser
    );
  }

  // Client management (SuperAdmin/Admin only)
  async getClients() {
    return secureApiCall('/clients', { method: 'GET' });
  }

  async createClient(clientData) {
    return secureApiCall(
      '/clients',
      {
        method: 'POST',
        body: JSON.stringify(clientData)
      }
    );
  }

  // User management
  async getUserProfile() {
    return secureApiCall('/user/profile', { method: 'GET' });
  }

  async updateUserProfile(profileData) {
    return secureApiCall(
      '/user/profile',
      {
        method: 'PUT',
        body: JSON.stringify(profileData)
      }
    );
  }

  async getUserClients() {
    return secureApiCall('/user/clients', { method: 'GET' });
  }

  // System operations (SuperAdmin only)
  async getSystemUsers() {
    return secureApiCall('/admin/users', { method: 'GET' });
  }

  async createUser(userData) {
    return secureApiCall(
      '/admin/users',
      {
        method: 'POST',
        body: JSON.stringify(userData)
      }
    );
  }

  async updateUser(userId, userData) {
    return secureApiCall(
      `/admin/users/${userId}`,
      {
        method: 'PUT',
        body: JSON.stringify(userData)
      }
    );
  }

  async deleteUser(userId) {
    return secureApiCall(
      `/admin/users/${userId}`,
      {
        method: 'DELETE'
      }
    );
  }

  async addManagerAssignment(userId, clientId, unitId) {
    return secureApiCall(
      `/admin/users/${userId}/manager-assignments`,
      {
        method: 'POST',
        body: JSON.stringify({ clientId, unitId })
      }
    );
  }

  async removeManagerAssignment(userId, clientId, unitId) {
    return secureApiCall(
      `/admin/users/${userId}/manager-assignments`,
      {
        method: 'DELETE',
        body: JSON.stringify({ clientId, unitId })
      }
    );
  }

  async addUnitRoleAssignment(userId, clientId, unitId, role, contactName = null, contactEmail = null) {
    const body = { clientId, unitId, role };
    if (contactName) body.contactName = contactName;
    if (contactEmail) body.contactEmail = contactEmail;
    
    return secureApiCall(
      `/admin/users/${userId}/unit-roles`,
      {
        method: 'POST',
        body: JSON.stringify(body)
      }
    );
  }

  async removeUnitRoleAssignment(userId, clientId, unitId) {
    return secureApiCall(
      `/admin/users/${userId}/unit-roles`,
      {
        method: 'DELETE',
        body: JSON.stringify({ clientId, unitId })
      }
    );
  }
}

/**
 * Create API client instance with current user context
 */
export function createSecureApiClient(samsUser) {
  return new SecureApiClient(samsUser);
}

/**
 * Hook for using secure API client in React components
 */
export function useSecureApi() {
  const { samsUser } = useAuth();
  
  return React.useMemo(() => {
    return createSecureApiClient(samsUser);
  }, [samsUser]);
}

export default SecureApiClient;