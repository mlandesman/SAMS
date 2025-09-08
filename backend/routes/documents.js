import express from 'express';
import { 
  authenticateUserWithProfile, 
  enforceClientAccess, 
  requirePermission,
  logSecurityEvent 
} from '../middleware/clientAuth.js';
import {
  uploadDocument,
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

// Document management routes with proper security
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
