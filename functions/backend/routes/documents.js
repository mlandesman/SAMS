import express from 'express';
import { 
  authenticateUserWithProfile, 
  enforceClientAccess, 
  requirePermission,
  logSecurityEvent 
} from '../middleware/clientAuth.js';
import {
  uploadDocument, // Legacy endpoint - kept for backward compatibility
  generateUploadUrl, // New: Signed URL generation
  finalizeUpload, // New: Finalize upload after direct GCS upload
  getDocuments,
  getDocument,
  deleteDocument,
  updateDocumentMetadata,
  upload
} from '../controllers/documentsController.js';

const router = express.Router({ mergeParams: true }); // mergeParams to access clientId from parent route

// Apply security middleware to all document routes
router.use(authenticateUserWithProfile);
router.use(enforceClientAccess);

// NEW: Signed URL-based upload flow (recommended approach - works in Dev and Prod)
// Step 1: Generate signed upload URL
router.post('/upload-url',
  requirePermission('documents.upload'),
  logSecurityEvent('DOCUMENT_UPLOAD_URL_REQUEST'),
  generateUploadUrl
);

// Step 2: Finalize upload after client uploads directly to GCS
router.post('/finalize',
  requirePermission('documents.upload'),
  logSecurityEvent('DOCUMENT_UPLOAD_FINALIZE'),
  finalizeUpload
);

// LEGACY: Multipart upload endpoint (kept for backward compatibility, but broken in Prod)
// TODO: Remove this once client is updated to use signed URL flow
router.post('/upload', 
  requirePermission('documents.upload'),
  logSecurityEvent('DOCUMENT_UPLOAD'),
  upload.single('file'),
  uploadDocument
);

router.get('/', 
  requirePermission('documents.view'),
  logSecurityEvent('DOCUMENT_LIST'),
  getDocuments
);

router.get('/:documentId', 
  requirePermission('documents.view'),
  logSecurityEvent('DOCUMENT_VIEW'),
  getDocument
);

router.delete('/:documentId', 
  requirePermission('documents.delete'),
  logSecurityEvent('DOCUMENT_DELETE'),
  deleteDocument
);

router.put('/:documentId/metadata', 
  requirePermission('documents.upload'), // Treat metadata update as upload permission
  logSecurityEvent('DOCUMENT_UPDATE'),
  updateDocumentMetadata
);

export default router;
