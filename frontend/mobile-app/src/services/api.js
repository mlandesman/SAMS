import { auth } from './firebase';
import { config } from '../config/index.js';

export const API_BASE_URL = config.api.baseUrl;

/**
 * Get the authorization header with Firebase ID token
 */
const getAuthHeaders = async () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No authenticated user');
  }
  
  const token = await user.getIdToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

/**
 * Handle API responses and errors
 */
const handleResponse = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.error || `API Error: ${response.status}`;
    throw new Error(message);
  }
  return response.json();
};

export const userAPI = {
  /**
   * Get user profile with client access
   */
  async getProfile() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/auth/user/profile`, { headers });
    return handleResponse(response);
  },

  /**
   * Update user profile
   */
  async updateProfile(profileData) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/auth/user/profile`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(profileData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update profile');
    }

    return response.json();
  },

  /**
   * Update user email
   */
  async updateEmail(newEmail) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/auth/user/email`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ newEmail })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update email');
    }

    return response.json();
  },

  /**
   * Update user password
   */
  async updatePassword(newPassword) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/auth/user/password`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ newPassword })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update password');
    }

    return response.json();
  },

  /**
   * Get available clients for user
   */
  async getClients() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/auth/user/clients`, { headers });
    return handleResponse(response);
  },

  /**
   * Select preferred client
   */
  async selectClient(clientId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/auth/user/select-client`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ clientId })
    });
    return handleResponse(response);
  },

  /**
   * Get current client context
   */
  async getCurrentClient() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/auth/user/current-client`, { headers });
    return handleResponse(response);
  }
};

export const clientAPI = {
  /**
   * Get categories for a client
   */
  async getCategories(clientId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/categories`, { headers });
    return handleResponse(response);
  },

  /**
   * Get vendors for a client
   */
  async getVendors(clientId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/vendors`, { headers });
    return handleResponse(response);
  },

  /**
   * Get accounts for a client
   */
  async getAccounts(clientId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/accounts`, { headers });
    return handleResponse(response);
  },

  /**
   * Get payment methods for a client
   */
  async getPaymentMethods(clientId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/paymentmethods`, { headers });
    return handleResponse(response);
  },

  /**
   * Create new transaction
   */
  async createTransaction(clientId, transactionData) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/transactions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(transactionData)
    });
    return handleResponse(response);
  },

  /**
   * Upload document
   */
  async uploadDocument(clientId, file, metadata = {}) {
    console.log('📤 Starting document upload (signed URL flow):', {
      clientId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      metadata,
      apiBaseUrl: API_BASE_URL,
      environment: import.meta.env.MODE
    });

    const user = auth.currentUser;
    if (!user) {
      console.error('❌ No authenticated user for document upload');
      throw new Error('No authenticated user');
    }
    
    try {
      const token = await user.getIdToken();
      console.log('🔑 Got auth token for upload');
      
      // Step 1: Request signed upload URL
      console.log('📤 Step 1: Requesting signed upload URL...');
      const uploadUrlResponse = await fetch(`${API_BASE_URL}/clients/${clientId}/documents/upload-url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type
        })
      });
      
      if (!uploadUrlResponse.ok) {
        const errorText = await uploadUrlResponse.text().catch(() => 'Unable to read error response');
        throw new Error(`Failed to get upload URL: ${errorText}`);
      }
      
      const { uploadUrl, objectPath, expiresAt } = await handleResponse(uploadUrlResponse);
      console.log('✅ Step 1 complete: Got signed upload URL', { objectPath, expiresAt });
      
      // Step 2: Upload file directly to Cloud Storage
      console.log('📤 Step 2: Uploading file directly to Cloud Storage...');
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type
        },
        body: file
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload file to Cloud Storage: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }
      console.log('✅ Step 2 complete: File uploaded to Cloud Storage');
      
      // Step 3: Finalize upload and save metadata to Firestore
      console.log('📤 Step 3: Finalizing upload and saving metadata...');
      const finalizeResponse = await fetch(`${API_BASE_URL}/clients/${clientId}/documents/finalize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          objectPath,
          originalFilename: file.name,
          documentType: metadata.documentType || 'receipt',
          category: metadata.category || 'expense_receipt',
          linkedTo: metadata.linkedTo || null,
          notes: metadata.notes || '',
          tags: metadata.tags || []
        })
      });
      
      if (!finalizeResponse.ok) {
        const errorText = await finalizeResponse.text().catch(() => 'Unable to read error response');
        console.error('❌ Finalize failed:', errorText);
        throw new Error(`Failed to finalize upload: ${errorText}`);
      }
      
      const result = await handleResponse(finalizeResponse);
      console.log('✅ Step 3 complete: Upload finalized successfully', result);
      return result;
      
    } catch (error) {
      console.error('❌ Upload error:', error);
      
      // Enhance error message for network/CORS issues
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error('Network error: Unable to connect to server. Please check your internet connection and try again.');
      } else if (error.message.includes('CORS')) {
        throw error; // Already has good message
      }
      
      throw error;
    }
  },

  /**
   * Upload multiple documents atomically for transaction linking
   */
  async uploadDocumentsForTransaction(clientId, files, documentType = 'receipt', category = 'expense_receipt') {
    console.log('📤 Starting atomic document upload for transaction:', {
      clientId,
      fileCount: files.length,
      files: files.map(f => ({ name: f.name, size: f.size, type: f.type }))
    });

    if (!files || files.length === 0) {
      return [];
    }

    try {
      const uploadPromises = files.map(async (file, index) => {
        const metadata = {
          documentType: documentType,
          category: category,
          linkedTo: null, // Will be updated after transaction creation
          notes: `Expense receipt ${index + 1}`,
          tags: ['expense', 'auto-uploaded']
        };

        console.log(`📄 Uploading document ${index + 1}/${files.length}: ${file.name}`);
        const result = await this.uploadDocument(clientId, file, metadata);
        console.log(`✅ Document ${index + 1} uploaded, full result:`, result);
        console.log(`✅ Document ${index + 1} document object:`, result.document);
        console.log(`✅ Document ${index + 1} ID:`, result.document?.id);
        return result.document;
      });

      const documents = await Promise.all(uploadPromises);
      console.log('✅ All documents uploaded successfully for transaction:', documents.map(d => d.id));
      return documents;
      
    } catch (error) {
      console.error('❌ Failed to upload documents for transaction:', error);
      throw new Error(`Failed to upload documents: ${error.message}`);
    }
  },

  /**
   * Update multiple documents with transaction ID
   */
  async linkDocumentsToTransaction(clientId, documentIds, transactionId) {
    console.log('🔗 Linking documents to transaction:', { clientId, documentIds, transactionId });
    console.log('🔗 Document IDs received:', documentIds);
    console.log('🔗 Document IDs type:', typeof documentIds, Array.isArray(documentIds));

    if (!documentIds || documentIds.length === 0) {
      console.log('ℹ️ No documents to link');
      return;
    }

    try {
      const linkPromises = documentIds.map(async (documentId) => {
        console.log(`🔗 Processing document ID: ${documentId} (type: ${typeof documentId})`);
        const linkMetadata = {
          linkedTo: {
            type: 'transaction',
            id: transactionId
          }
        };
        
        console.log(`🔗 Linking document ${documentId} to transaction ${transactionId} with metadata:`, linkMetadata);
        const updateResult = await this.updateDocumentMetadata(clientId, documentId, linkMetadata);
        console.log(`✅ Document ${documentId} link result:`, updateResult);
        return updateResult;
      });

      const results = await Promise.all(linkPromises);
      console.log('✅ All documents linked to transaction. Results:', results);
      
    } catch (error) {
      console.error('❌ Failed to link documents to transaction:', error);
      throw new Error(`Failed to link documents: ${error.message}`);
    }
  },

  /**
   * Get documents for a client
   */
  async getDocuments(clientId, filters = {}) {
    const headers = await getAuthHeaders();
    const queryParams = new URLSearchParams();
    
    if (filters.documentType) queryParams.append('documentType', filters.documentType);
    if (filters.category) queryParams.append('category', filters.category);
    if (filters.linkedToType) queryParams.append('linkedToType', filters.linkedToType);
    if (filters.linkedToId) queryParams.append('linkedToId', filters.linkedToId);
    if (filters.limit) queryParams.append('limit', filters.limit);
    
    const url = `${API_BASE_URL}/clients/${clientId}/documents${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await fetch(url, { headers });
    return handleResponse(response);
  },

  /**
   * Update document metadata
   */
  async updateDocumentMetadata(clientId, documentId, metadata) {
    console.log('🔄 Frontend: Starting updateDocumentMetadata call:', {
      clientId,
      documentId,
      metadata,
      url: `${API_BASE_URL}/clients/${clientId}/documents/${documentId}/metadata`
    });

    try {
      const headers = await getAuthHeaders();
      console.log('🔑 Frontend: Got auth headers for document update');
      
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/documents/${documentId}/metadata`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(metadata)
      });
      
      console.log('📬 Frontend: Document update response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Frontend: Document update failed:', response.status, errorText);
        throw new Error(`Document update failed: ${response.status} ${errorText}`);
      }
      
      const result = await handleResponse(response);
      console.log('✅ Frontend: Document update successful:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Frontend: Document update error:', error);
      throw error;
    }
  }
};

// Legacy functions for backward compatibility
export const getClients = () => userAPI.getClients();
export const getClientData = async (clientId) => {
  const [categories, vendors, accounts, paymentMethods] = await Promise.all([
    clientAPI.getCategories(clientId),
    clientAPI.getVendors(clientId),
    clientAPI.getAccounts(clientId),
    clientAPI.getPaymentMethods(clientId)
  ]);
  
  return { categories, vendors, accounts, paymentMethods };
};
export const createExpense = (clientId, expenseData) => clientAPI.createTransaction(clientId, expenseData);
export const getTransaction = async (clientId, transactionId) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/clients/${clientId}/transactions/${transactionId}`, { headers });
  return handleResponse(response);
};
export const validateClientAccess = async (clientId) => {
  try {
    const { clients } = await userAPI.getClients();
    return clients.some(client => client.id === clientId);
  } catch (error) {
    console.error('Error validating client access:', error);
    return false;
  }
};

// Cache management functions (keeping for PWA offline support)
export const cacheManager = {
  cacheFormData: (data) => {
    try {
      localStorage.setItem('sams_mobile_form_cache', JSON.stringify({
        ...data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Could not cache form data:', error);
    }
  },
  
  getCachedFormData: () => {
    try {
      const cached = localStorage.getItem('sams_mobile_form_cache');
      if (cached) {
        const data = JSON.parse(cached);
        if (Date.now() - data.timestamp < 3600000) {
          return data;
        }
        localStorage.removeItem('sams_mobile_form_cache');
      }
    } catch (error) {
      console.warn('Could not retrieve cached form data:', error);
    }
    return null;
  },
  
  clearFormCache: () => {
    try {
      localStorage.removeItem('sams_mobile_form_cache');
    } catch (error) {
      console.warn('Could not clear form cache:', error);
    }
  },
  
  cacheClientData: (clientId, data) => {
    try {
      localStorage.setItem(`sams_mobile_client_${clientId}`, JSON.stringify({
        ...data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Could not cache client data:', error);
    }
  },
  
  getCachedClientData: (clientId) => {
    try {
      const cached = localStorage.getItem(`sams_mobile_client_${clientId}`);
      if (cached) {
        const data = JSON.parse(cached);
        if (Date.now() - data.timestamp < 1800000) {
          return data;
        }
        localStorage.removeItem(`sams_mobile_client_${clientId}`);
      }
    } catch (error) {
      console.warn('Could not retrieve cached client data:', error);
    }
    return null;
  }
};

export const networkUtils = {
  isOnline: () => navigator.onLine,
  
  waitForNetwork: (timeout = 10000) => {
    return new Promise((resolve, reject) => {
      if (navigator.onLine) {
        resolve(true);
        return;
      }
      
      const timeoutId = setTimeout(() => {
        window.removeEventListener('online', onOnline);
        reject(new Error('Network timeout'));
      }, timeout);
      
      const onOnline = () => {
        clearTimeout(timeoutId);
        window.removeEventListener('online', onOnline);
        resolve(true);
      };
      
      window.addEventListener('online', onOnline);
    });
  }
};

export default {
  userAPI,
  clientAPI,
  getClients,
  getClientData,
  createExpense,
  getTransaction,
  validateClientAccess,
  cacheManager,
  networkUtils
};
