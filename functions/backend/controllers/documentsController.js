import { getDb, getApp } from '../firebase.js';
import admin from 'firebase-admin';
import multer from 'multer';
import path from 'path';
import { getNow } from '../services/DateService.js';
import { randomUUID } from 'crypto';

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

// Generate storage path (UUID-based for signed URL approach)
function generateStoragePath(clientId, originalName) {
  const now = getNow();
  const year = now.getFullYear();
  const uuid = randomUUID();
  const extension = path.extname(originalName) || '';
  
  return `clients/${clientId}/documents/${year}/${uuid}${extension}`;
}

// Generate storage path (legacy - with documentId for backward compatibility)
function generateStoragePathWithId(clientId, documentId, originalName) {
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
    const storagePath = generateStoragePathWithId(clientId, documentId, file.originalname);
    
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
    
    console.log('📋 Get documents query:', {
      clientId,
      documentType,
      category,
      linkedToType,
      linkedToId,
      limit
    });
    
    const db = await getDb();
    let query = db.collection('clients').doc(clientId).collection('documents');
    
    // CRITICAL: Firestore composite index matching rules:
    // 1. All equality filters before orderBy must be in index field order
    // 2. Cannot combine filters from different indexes (e.g., documentType + linkedTo)
    // 3. Index order: isArchived, linkedTo.id, linkedTo.type, uploadedAt
    //    OR: isArchived, documentType, uploadedAt
    //    OR: isArchived, category, uploadedAt
    //    OR: isArchived, uploadedAt (basic)
    
    // Always apply isArchived filter first (required for all indexes)
    query = query.where('isArchived', '==', false);
    
    // Apply linkedTo filters if provided (use composite index with linkedTo)
    if (linkedToType && linkedToId) {
      // When using linkedTo filters, cannot also filter by documentType/category
      // (would require a different composite index)
      if (documentType || category) {
        console.warn('⚠️ Cannot combine linkedTo filters with documentType/category - ignoring documentType/category');
      }
      query = query.where('linkedTo.id', '==', linkedToId)
                   .where('linkedTo.type', '==', linkedToType);
    } else {
      // Apply documentType or category filters (use separate indexes)
      // Note: Cannot combine documentType + category (would need another index)
      if (documentType && category) {
        console.warn('⚠️ Cannot filter by both documentType and category - using documentType only');
        query = query.where('documentType', '==', documentType);
      } else if (documentType) {
        query = query.where('documentType', '==', documentType);
      } else if (category) {
        query = query.where('category', '==', category);
      }
    }
    
    // Add ordering and limit - must match index order
    query = query.orderBy('uploadedAt', 'desc')
                 .limit(parseInt(limit));
    
    console.log('📋 Executing query with filters (index order):', {
      queryOrder: [
        'isArchived',
        ...(linkedToType && linkedToId ? ['linkedTo.id', 'linkedTo.type'] : []),
        ...(documentType ? ['documentType'] : []),
        ...(category ? ['category'] : []),
        'uploadedAt (desc)'
      ],
      hasLinkedTo: !!(linkedToType && linkedToId),
      linkedToType,
      linkedToId,
      hasDocumentType: !!documentType,
      hasCategory: !!category,
      limit: parseInt(limit)
    });
    
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

/**
 * Generate signed URL for direct upload to Cloud Storage
 * POST /documents/upload-url
 * 
 * Input: { clientId, filename, contentType }
 * Output: { uploadUrl, objectPath, expiresAt }
 */
export const generateUploadUrl = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { filename, contentType } = req.body;
    
    console.log('📤 Generate upload URL request:', {
      clientId,
      filename,
      contentType,
      user: req.user?.email
    });
    
    // Validate input
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }
    
    if (!contentType) {
      return res.status(400).json({ error: 'Content-Type is required' });
    }
    
    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ];
    
    if (!allowedTypes.includes(contentType)) {
      return res.status(400).json({ 
        error: 'Invalid file type. Only PDF, JPEG, PNG, GIF, and WebP files are allowed.' 
      });
    }
    
    // Generate UUID-based object path
    const objectPath = generateStoragePath(clientId, filename);
    
    // Get Firebase Storage bucket (same pattern as Statement PDF uploads)
    const app = await getApp();
    const bucket = app.storage().bucket();
    console.log('📤 Storage bucket:', bucket.name);
    
    const file = bucket.file(objectPath);
    console.log('📤 File reference created:', objectPath);
    
    // Generate v4 signed URL for PUT upload (15 minutes expiration)
    const expiresAtMs = Date.now() + 15 * 60 * 1000; // 15 minutes from now (timestamp in ms)
    
    console.log('📤 Attempting to generate signed URL:', {
      objectPath,
      expiresAt: new Date(expiresAtMs).toISOString(),
      contentType,
      bucket: bucket.name,
      expiresTimestamp: expiresAtMs
    });
    
    // Try to generate signed URL (same pattern as Statement PDFs, but for client upload)
    let uploadUrl;
    try {
      [uploadUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: expiresAtMs,
        contentType: contentType
      });
      console.log('✅ Signed URL generated successfully');
    } catch (urlError) {
      console.error('❌ getSignedUrl failed:', {
        message: urlError.message,
        code: urlError.code,
        name: urlError.name,
        stack: urlError.stack
      });
      throw new Error(`Failed to generate signed URL: ${urlError.message}. This may require "Service Account Token Creator" role.`);
    }
    
    console.log('✅ Upload URL generated successfully:', {
      objectPath,
      expiresAt: new Date(expiresAtMs).toISOString(),
      uploadUrlLength: uploadUrl?.length || 0
    });
    
    res.status(200).json({
      uploadUrl,
      objectPath,
      expiresAt: new Date(expiresAtMs).toISOString()
    });
    
  } catch (error) {
    console.error('❌ Generate upload URL error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    res.status(500).json({ 
      error: 'Failed to generate upload URL',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Finalize document upload after file is uploaded to Cloud Storage
 * POST /documents/finalize
 * 
 * Input: { clientId, objectPath, originalFilename, documentType, category, linkedTo, notes, tags, ... }
 * Output: { documentId, downloadUrl, ... }
 */
export const finalizeUpload = async (req, res) => {
  console.log('📤 Finalize upload route HIT:', {
    method: req.method,
    url: req.url,
    path: req.path,
    params: req.params,
    clientId: req.params?.clientId,
    body: req.body
  });
  
  try {
    const { clientId } = req.params;
    const { 
      objectPath, 
      originalFilename,
      documentType = 'receipt',
      category = 'expense_receipt',
      linkedTo,
      notes,
      tags
    } = req.body;
    
    console.log('📤 Finalize upload request:', {
      clientId,
      objectPath,
      originalFilename,
      user: req.user?.email
    });
    
    // Validate input
    if (!objectPath) {
      return res.status(400).json({ error: 'objectPath is required' });
    }
    
    if (!originalFilename) {
      return res.status(400).json({ error: 'originalFilename is required' });
    }
    
    // Verify file exists in Cloud Storage
    const app = await getApp();
    const bucket = app.storage().bucket();
    const file = bucket.file(objectPath);
    
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ 
        error: 'File not found in storage. Upload may have failed or object path is incorrect.' 
      });
    }
    
    // Get file metadata (size, contentType)
    const [metadata] = await file.getMetadata();
    const fileSize = parseInt(metadata.size || '0', 10);
    const mimeType = metadata.contentType || 'application/octet-stream';
    
    // Validate file size (10MB limit)
    if (fileSize > 10 * 1024 * 1024) {
      // Delete oversized file
      await file.delete();
      return res.status(400).json({ 
        error: 'File too large. Maximum size is 10MB.' 
      });
    }
    
    // Make file publicly readable (adjust based on security requirements)
    await file.makePublic();
    
    // Generate download URL
    const downloadURL = `https://storage.googleapis.com/${bucket.name}/${objectPath}`;
    
    // Generate document ID
    const documentId = generateDocumentId();
    
    // Helper function to safely parse JSON strings
    const safeJsonParse = (value, defaultValue = null) => {
      if (value == null) return defaultValue;
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
        return defaultValue;
      }
      try {
        return JSON.parse(value);
      } catch (error) {
        console.warn('⚠️ Failed to parse JSON value:', { value, error: error.message });
        return defaultValue;
      }
    };
    
    // Create document record in Firestore
    const db = await getDb();
    const documentData = {
      id: documentId,
      filename: `${documentId}${path.extname(originalFilename)}`,
      originalName: originalFilename,
      mimeType: mimeType,
      fileSize: fileSize,
      uploadedBy: req.user?.email || 'unknown',
      uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
      clientId: clientId,
      
      // Document categorization
      documentType: documentType,
      category: category,
      
      // Linking to other records
      linkedTo: safeJsonParse(linkedTo, null),
      
      // File storage references
      storageRef: objectPath,
      downloadURL: downloadURL,
      
      // Metadata
      tags: safeJsonParse(tags, []),
      notes: notes || '',
      isArchived: false,
      
      // Security & audit
      accessLevel: 'admin',
      lastAccessed: admin.firestore.FieldValue.serverTimestamp(),
      accessCount: 0
    };
    
    await db.collection('clients').doc(clientId).collection('documents').doc(documentId).set(documentData);
    
    console.log(`✅ Document finalized successfully: ${documentId}`);
    
    res.status(201).json({
      success: true,
      documentId: documentId,
      downloadURL: downloadURL,
      document: documentData
    });
    
  } catch (error) {
    console.error('❌ Finalize upload error:', error);
    res.status(500).json({ error: 'Failed to finalize document upload' });
  }
};

export { upload };
