/**
 * API functions for document management
 */

import { getAuthInstance } from '../firebaseClient';

import { config } from '../config/index.js';

const API_BASE_URL = config.api.baseUrl;

/**
 * Get the authorization header with Firebase ID token
 */
const getAuthHeaders = async () => {
  const auth = getAuthInstance();
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

/**
 * Upload document
 */
export async function uploadDocument(clientId, file, metadata = {}) {
  const auth = getAuthInstance();
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error('No authenticated user');
  }
  
  const token = await user.getIdToken();
  const formData = new FormData();
  formData.append('file', file);
  
  // Add metadata to form data
  if (metadata.documentType) formData.append('documentType', metadata.documentType);
  if (metadata.category) formData.append('category', metadata.category);
  if (metadata.linkedTo) formData.append('linkedTo', JSON.stringify(metadata.linkedTo));
  if (metadata.notes) formData.append('notes', metadata.notes);
  if (metadata.tags) formData.append('tags', JSON.stringify(metadata.tags));
  
  const response = await fetch(`${API_BASE_URL}/clients/${clientId}/documents/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
      // Note: Don't set Content-Type for FormData, let browser set it with boundary
    },
    body: formData
  });
  
  return handleResponse(response);
}

/**
 * Get documents for a client
 */
export async function getDocuments(clientId, filters = {}) {
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
}

/**
 * Get a specific document
 */
export async function getDocument(clientId, documentId) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/clients/${clientId}/documents/${documentId}`, { headers });
  return handleResponse(response);
}

/**
 * Delete a document
 */
export async function deleteDocument(clientId, documentId) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/clients/${clientId}/documents/${documentId}`, {
    method: 'DELETE',
    headers
  });
  return handleResponse(response);
}

/**
 * Update document metadata
 */
export async function updateDocumentMetadata(clientId, documentId, metadata) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/clients/${clientId}/documents/${documentId}/metadata`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(metadata)
  });
  return handleResponse(response);
}

/**
 * Get documents linked to a specific transaction
 */
export async function getTransactionDocuments(clientId, transactionId) {
  return getDocuments(clientId, {
    linkedToType: 'transaction',
    linkedToId: transactionId
  });
}

/**
 * Upload multiple documents atomically for transaction linking
 */
export async function uploadDocumentsForTransaction(clientId, files, documentType = 'receipt', category = 'expense_receipt') {
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
      const result = await uploadDocument(clientId, file, metadata);
      console.log(`✅ Document ${index + 1} uploaded:`, result.document?.id);
      return result.document;
    });

    const documents = await Promise.all(uploadPromises);
    console.log('✅ All documents uploaded successfully for transaction:', documents.map(d => d.id));
    return documents;
    
  } catch (error) {
    console.error('❌ Failed to upload documents for transaction:', error);
    throw new Error(`Failed to upload documents: ${error.message}`);
  }
}

/**
 * Update multiple documents with transaction ID
 */
export async function linkDocumentsToTransaction(clientId, documentIds, transactionId) {
  console.log('🔗 Linking documents to transaction:', { clientId, documentIds, transactionId });

  if (!documentIds || documentIds.length === 0) {
    console.log('ℹ️ No documents to link');
    return;
  }

  try {
    const linkPromises = documentIds.map(async (documentId) => {
      const linkMetadata = {
        linkedTo: {
          type: 'transaction',
          id: transactionId
        }
      };
      
      console.log(`🔗 Linking document ${documentId} to transaction ${transactionId}`);
      return await updateDocumentMetadata(clientId, documentId, linkMetadata);
    });

    await Promise.all(linkPromises);
    console.log('✅ All documents linked to transaction');
    
  } catch (error) {
    console.error('❌ Failed to link documents to transaction:', error);
    throw new Error(`Failed to link documents: ${error.message}`);
  }
}
