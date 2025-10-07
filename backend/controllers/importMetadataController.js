import { getDb } from '../firebase.js';
import { getNow } from '../services/DateService.js';

/**
 * Import Metadata Controller
 * Handles creation of import metadata records for all import operations
 */

/**
 * Create import metadata record
 * @param {string} clientId - The client ID
 * @param {Object} metadata - The metadata to store
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
export async function createImportMetadata(clientId, metadata) {
  try {
    // Validate required fields
    if (!clientId) {
      return { success: false, error: 'Client ID is required' };
    }

    if (!metadata) {
      return { success: false, error: 'Metadata is required' };
    }

    const requiredFields = ['type', 'documentId', 'documentPath', 'source', 'importScript'];
    for (const field of requiredFields) {
      if (!metadata[field]) {
        return { success: false, error: `Missing required field: ${field}` };
      }
    }

    // Validate type
    const validTypes = ['category', 'vendor', 'transaction', 'unit', 'user', 'hoa-dues', 'paymentMethod', 'yearEndBalance'];
    if (!validTypes.includes(metadata.type)) {
      return { success: false, error: `Invalid type: ${metadata.type}. Must be one of: ${validTypes.join(', ')}` };
    }

    // Create metadata document with timestamp
    const metadataDoc = {
      type: metadata.type,
      documentId: metadata.documentId,
      documentPath: metadata.documentPath,
      source: metadata.source,
      importDate: getNow(), // Use getNow() for timezone consistency
      originalData: metadata.originalData || {},
      importScript: metadata.importScript
    };

    // Get database reference
    const db = await getDb();
    
    // Write to clients/{clientId}/importMetadata
    const metadataRef = db.collection(`clients/${clientId}/importMetadata`);
    const docRef = await metadataRef.add(metadataDoc);

    return { 
      success: true, 
      id: docRef.id 
    };

  } catch (error) {
    console.error('Error creating import metadata:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to create import metadata' 
    };
  }
}

