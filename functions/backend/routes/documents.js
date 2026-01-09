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
  upload,
  uploadMiddleware
} from '../controllers/documentsController.js';

const router = express.Router({ mergeParams: true }); // mergeParams to access clientId from parent route

// Apply security middleware to all document routes
router.use(authenticateUserWithProfile);
router.use(enforceClientAccess);

// Document management routes with proper security
router.post('/upload', 
  requirePermission('documents.upload'),
  logSecurityEvent('DOCUMENT_UPLOAD'),
  (req, res, next) => {
    // Log request details for debugging - especially important for mobile vs desktop differences
    const contentType = req.headers['content-type'] || '';
    const isMultipart = contentType.toLowerCase().startsWith('multipart/form-data');
    
    console.log('📤 Document upload route - Request details:', {
      contentType: contentType,
      isMultipart: isMultipart,
      contentLength: req.headers['content-length'],
      method: req.method,
      url: req.url,
      clientId: req.params.clientId,
      userAgent: req.headers['user-agent'],
      origin: req.headers['origin'],
      // Check for mobile-specific headers
      isMobile: /Mobile|iPhone|Android/i.test(req.headers['user-agent'] || ''),
      transferEncoding: req.headers['transfer-encoding'],
      // Check if body was already consumed
      bodyAlreadyRead: req.readableEnded || req.body !== undefined
    });
    
    // Warn if body might have been consumed
    if (!isMultipart) {
      console.warn('⚠️ WARNING: Content-Type is not multipart/form-data:', contentType);
    }
    
    if (req.readableEnded) {
      console.error('❌ CRITICAL: Request body stream already ended before multer!');
    }
    
    // Set longer timeout for mobile uploads (they're slower)
    const isMobile = /Mobile|iPhone|Android/i.test(req.headers['user-agent'] || '');
    if (isMobile) {
      req.setTimeout(120000); // 2 minutes for mobile
      res.setTimeout(120000);
      console.log('📱 Mobile device detected - extended timeout to 120s');
    }
    
    next();
  },
  uploadMiddleware,
  (err, req, res, next) => {
    // Handle multer errors specifically for this route
    if (err) {
      console.error('📤 Multer error in upload route:', {
        name: err.name,
        code: err.code,
        message: err.message,
        stack: err.stack
      });
      
      if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File too large. Maximum size is 10MB.' });
        }
        return res.status(400).json({ error: `File upload error: ${err.message}` });
      }
      
      // Handle "Unexpected end of form" from busboy
      if (err.message && err.message.includes('Unexpected end of form')) {
        console.error('📤 Busboy "Unexpected end of form" - Request may have been truncated');
        return res.status(400).json({ 
          error: 'File upload incomplete. The request was truncated. Please try again with a smaller file or check your network connection.',
          code: 'UPLOAD_INCOMPLETE'
        });
      }
    }
    next(err);
  },
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
