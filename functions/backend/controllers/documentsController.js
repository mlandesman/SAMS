import { getDb, getApp } from '../firebase.js';
import admin from 'firebase-admin';
import multer from 'multer';
import path from 'path';
import { getNow } from '../services/DateService.js';

// Configure multer for file uploads
const storage = multer.memoryStorage(); // Store files in memory for Firebase upload
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow PDF, JPEG, PNG, and common image formats
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPEG, PNG, GIF, and WebP files are allowed.'), false);
    }
  }
});

// Generate unique document ID
function generateDocumentId() {
  return `doc_${getNow().getTime()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Generate storage path
function generateStoragePath(clientId, documentId, originalName) {
  const now = getNow();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const extension = path.extname(originalName);
  
  return `clients/${clientId}/documents/${year}/${month}/${documentId}${extension}`;
}

// Upload document
export const uploadDocument = async (req, res) => {
  console.log('📤 Document upload request received:', {
    clientId: req.params.clientId,
    user: req.user?.email,
    file: req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : 'NO FILE',
    body: req.body
  });

  try {
    const { clientId } = req.params;
    const { documentType = 'receipt', category = 'expense_receipt', linkedTo, notes, tags } = req.body;
    const file = req.file;
    
    if (!file) {
      console.error('❌ No file provided in upload request');
      return res.status(400).json({ error: 'No file provided' });
    }

    console.log('✅ File validation passed, proceeding with upload');

    const db = await getDb();
    // Use the properly initialized Firebase app
    const app = await getApp();
    const bucket = app.storage().bucket();
    
    // Generate document metadata
    const documentId = generateDocumentId();
    const storagePath = generateStoragePath(clientId, documentId, file.originalname);
    
    console.log('📁 Storage path generated:', storagePath);

    // Upload file to Firebase Storage
    const fileUpload = bucket.file(storagePath);
    const blobStream = fileUpload.createWriteStream({
      metadata: {
        contentType: file.mimetype,
        metadata: {
          clientId: clientId,
          documentId: documentId,
          uploadedBy: req.user?.email || 'unknown',
          originalName: file.originalname
        }
      }
    });

    blobStream.on('error', (error) => {
      console.error('❌ Storage upload error:', error);
      res.status(500).json({ error: 'Failed to upload file to storage' });
    });

    blobStream.on('finish', async () => {
      console.log('📦 File uploaded to storage, saving metadata...');
      try {
        // Make file publicly readable (you may want to adjust this based on security requirements)
        await fileUpload.makePublic();
        
        // Get download URL
        const downloadURL = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
        
        // Helper function to safely parse JSON strings from FormData
        const safeJsonParse = (value, defaultValue = null) => {
          // Handle null, undefined, or already-parsed values
          if (value == null) {
            return defaultValue;
          }
          
          // If already an object/array (shouldn't happen with FormData, but be defensive)
          if (typeof value !== 'string') {
            return value;
          }
          
          // Handle empty strings or string representations of null/undefined
          const trimmed = value.trim();
          if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
            return defaultValue;
          }
          
          // Try to parse as JSON
          try {
            return JSON.parse(value);
          } catch (error) {
            console.warn('⚠️ Failed to parse JSON value, using default:', { value, error: error.message });
            return defaultValue;
          }
        };
        
        // Create document record in Firestore
        const documentData = {
          id: documentId,
          filename: `${documentId}${path.extname(file.originalname)}`,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          uploadedBy: req.user?.email || 'unknown',
          uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
          clientId: clientId,
          
          // Document categorization
          documentType: documentType,
          category: category,
          
          // Linking to other records - safely parse from FormData
          linkedTo: safeJsonParse(linkedTo, null),
          
          // File storage references
          storageRef: storagePath,
          downloadURL: downloadURL,
          
          // Metadata - safely parse from FormData
          tags: safeJsonParse(tags, []),
          notes: notes || '',
          isArchived: false,
          
          // Security & audit
          accessLevel: 'admin',
          lastAccessed: admin.firestore.FieldValue.serverTimestamp(),
          accessCount: 0
        };

        await db.collection('clients').doc(clientId).collection('documents').doc(documentId).set(documentData);
        
        console.log(`✅ Document uploaded successfully: ${documentId}`);
        res.status(201).json({
          success: true,
          document: documentData
        });
        
      } catch (firestoreError) {
        console.error('❌ Firestore save error:', firestoreError);
        res.status(500).json({ error: 'Failed to save document metadata' });
      }
    });

    blobStream.end(file.buffer);
    
  } catch (error) {
    console.error('❌ Upload document error:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
};

// Get documents for a client
export const getDocuments = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { documentType, category, linkedToType, linkedToId, limit = 50 } = req.query;
    
    const db = await getDb();
    let query = db.collection('clients').doc(clientId).collection('documents');
    
    // Apply filters
    if (documentType) {
      query = query.where('documentType', '==', documentType);
    }
    if (category) {
      query = query.where('category', '==', category);
    }
    if (linkedToType && linkedToId) {
      query = query.where('linkedTo.type', '==', linkedToType)
                   .where('linkedTo.id', '==', linkedToId);
    }
    
    // Add ordering and limit
    query = query.where('isArchived', '==', false)
                 .orderBy('uploadedAt', 'desc')
                 .limit(parseInt(limit));
    
    const snapshot = await query.get();
    const documents = [];
    
    snapshot.forEach(doc => {
      documents.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    res.json({ documents });
    
  } catch (error) {
    console.error('❌ Get documents error:', error);
    res.status(500).json({ error: 'Failed to retrieve documents' });
  }
};

// Get a specific document
export const getDocument = async (req, res) => {
  try {
    const { clientId, documentId } = req.params;
    
    const db = await getDb();
    const docRef = db.collection('clients').doc(clientId).collection('documents').doc(documentId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Update access tracking
    await docRef.update({
      lastAccessed: admin.firestore.FieldValue.serverTimestamp(),
      accessCount: admin.firestore.FieldValue.increment(1)
    });
    
    res.json({
      id: doc.id,
      ...doc.data()
    });
    
  } catch (error) {
    console.error('❌ Get document error:', error);
    res.status(500).json({ error: 'Failed to retrieve document' });
  }
};

// Delete document
export const deleteDocument = async (req, res) => {
  try {
    const { clientId, documentId } = req.params;
    
    const db = await getDb();
    // Use the properly initialized Firebase app
    const app = await getApp();
    const bucket = app.storage().bucket();
    
    // Get document metadata first
    const docRef = db.collection('clients').doc(clientId).collection('documents').doc(documentId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const docData = doc.data();
    
    try {
      // Delete file from storage
      if (docData.storageRef) {
        const file = bucket.file(docData.storageRef);
        await file.delete();
        console.log(`🗑️ Deleted file from storage: ${docData.storageRef}`);
      }
    } catch (storageError) {
      console.warn('⚠️ Failed to delete file from storage (may not exist):', storageError.message);
      // Continue with metadata deletion even if storage deletion fails
    }
    
    // Delete document metadata
    await docRef.delete();
    console.log(`🗑️ Deleted document metadata: ${documentId}`);
    
    res.json({ 
      success: true, 
      message: 'Document deleted successfully',
      documentId: documentId
    });
    
  } catch (error) {
    console.error('❌ Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
};

// Update document metadata
export const updateDocumentMetadata = async (req, res) => {
  console.log('🔄 Document metadata update request:', {
    clientId: req.params.clientId,
    documentId: req.params.documentId,
    body: req.body,
    user: req.user?.email
  });

  try {
    const { clientId, documentId } = req.params;
    const { documentType, category, linkedTo, notes, tags } = req.body;
    
    const db = await getDb();
    const docRef = db.collection('clients').doc(clientId).collection('documents').doc(documentId);
    
    // Check if document exists
    const doc = await docRef.get();
    if (!doc.exists) {
      console.error('❌ Document not found:', documentId);
      return res.status(404).json({ error: 'Document not found' });
    }
    
    console.log('📄 Document found, current data:', doc.data());
    
    // Prepare update data
    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user?.email || 'unknown'
    };
    
    if (documentType !== undefined) updateData.documentType = documentType;
    if (category !== undefined) updateData.category = category;
    if (linkedTo !== undefined) updateData.linkedTo = linkedTo;
    if (notes !== undefined) updateData.notes = notes;
    if (tags !== undefined) updateData.tags = tags;
    
    console.log('🔄 About to update document with data:', updateData);
    
    // Update document
    await docRef.update(updateData);
    console.log('✅ Firestore update() call completed');
    
    // Verify the update succeeded by reading it back
    const updatedDoc = await docRef.get();
    const finalData = updatedDoc.data();
    
    console.log('✅ Document update completed. Final data:', finalData);
    
    // Double-check that linkedTo field exists in the final data
    if (updateData.linkedTo && !finalData.linkedTo) {
      console.error('🚨 CRITICAL: linkedTo field was not saved! Expected:', updateData.linkedTo, 'Got:', finalData.linkedTo);
      throw new Error('Document update verification failed: linkedTo field not saved');
    }
    
    console.log('✅ Document update verification successful');
    
    res.json({
      success: true,
      document: {
        id: updatedDoc.id,
        ...finalData
      }
    });
    
  } catch (error) {
    console.error('❌ Update document metadata error:', error);
    res.status(500).json({ error: 'Failed to update document metadata' });
  }
};

export { upload };
