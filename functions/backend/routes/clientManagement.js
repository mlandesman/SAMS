/**
 * Client Management Routes
 * SuperAdmin-only CRUD operations for client management
 * 
 * Phase 12: Client Management CRUD Prerequisites
 * Implementation Date: June 26, 2025
 */

import express from 'express';
import multer from 'multer';
import { getStorage } from 'firebase-admin/storage';
import { authenticateUserWithProfile, requirePermission } from '../middleware/clientAuth.js';
import { 
  createClientFromTemplate, 
  validateClientData, 
  updateClientWithMetadata,
  validateClientIdFormat,
  LOGO_UPLOAD_CONFIG 
} from '../templates/clientTemplates.js';
import { getDb } from '../firebase.js';
import { logDebug, logInfo, logWarn, logError } from '../../../shared/logger.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { getNow } from '../services/DateService.js';

const router = express.Router();

// Configure multer for logo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: LOGO_UPLOAD_CONFIG.maxFileSize
  },
  fileFilter: (req, file, cb) => {
    if (LOGO_UPLOAD_CONFIG.allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${LOGO_UPLOAD_CONFIG.allowedTypes.join(', ')}`));
    }
  }
});

// Apply authentication to all routes
router.use(authenticateUserWithProfile);

// Middleware to enforce SuperAdmin access for all client management routes
const requireSuperAdmin = (req, res, next) => {
  if (!req.user.isSuperAdmin()) {
    logWarn(`🚫 Non-SuperAdmin ${req.user.email} attempted to access client management`);
    return res.status(403).json({ 
      error: 'Access denied. SuperAdmin privileges required.',
      code: 'SUPERADMIN_REQUIRED'
    });
  }
  logDebug(`✅ SuperAdmin ${req.user.email} accessing client management`);
  next();
};

router.use(requireSuperAdmin);

/**
 * GET /api/client-management/check-client-id/:clientId
 * Check if client ID is available (SuperAdmin only)
 */
router.get('/check-client-id/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Validate client ID format first
    const formatValidation = validateClientIdFormat(clientId);
    if (!formatValidation.isValid) {
      return res.status(400).json({ 
        error: formatValidation.error,
        available: false,
        clientId: clientId 
      });
    }
    
    const db = await getDb();
    const clientDoc = await db.collection('clients').doc(clientId).get();
    
    res.json({ 
      available: !clientDoc.exists,
      clientId: clientId 
    });
  } catch (error) {
    logError('Error checking client ID availability:', error);
    res.status(500).json({ error: 'Failed to check client ID availability' });
  }
});

/**
 * GET /api/client-management
 * List all clients (SuperAdmin only)
 */
router.get('/', async (req, res) => {
  try {
    logDebug(`🔍 SuperAdmin ${req.user.email} fetching all clients`);
    
    const db = await getDb();
    const snapshot = await db.collection('clients').get();
    
    logDebug(`🔍 [CLIENT-MGMT] Found ${snapshot.size} documents in clients collection`);
    
    const clients = [];
    snapshot.forEach(doc => {
      // Skip backup documents
      if (doc.id.includes('_backup_')) {
        logDebug(`⏭️ [CLIENT-MGMT] Skipping backup document: ${doc.id}`);
        return;
      }
      
      logDebug(`🔍 [CLIENT-MGMT] Processing client: ${doc.id}`, Object.keys(doc.data()));
      const clientData = doc.data();
      
      // Use standard template structure (after migration)
      const summary = {
        fullName: clientData.basicInfo?.fullName || 'Unnamed Client',
        displayName: clientData.basicInfo?.displayName,
        status: clientData.basicInfo?.status || 'active',
        clientType: clientData.basicInfo?.clientType || 'HOA_Management',
        logoUrl: clientData.branding?.logoUrl,
        iconUrl: clientData.branding?.iconUrl,
        createdAt: clientData.metadata?.createdAt,
        lastModified: clientData.metadata?.lastModified
      };
      
      clients.push({
        id: doc.id,
        ...clientData,
        summary
      });
      
      logDebug(`✅ [CLIENT-MGMT] Added client: ${doc.id} with summary:`, summary);
    });
    
    // Sort clients by full name
    clients.sort((a, b) => (a.summary.fullName || '').localeCompare(b.summary.fullName || ''));
    
    await writeAuditLog({
      module: 'client_management',
      action: 'list_all',
      parentPath: 'clients',
      docId: null,
      friendlyName: `Listed ${clients.length} clients`,
      notes: `SuperAdmin ${req.user.email} listed all clients`,
      userId: req.user.uid
    });
    
    logDebug(`✅ SuperAdmin ${req.user.email} fetched ${clients.length} clients`);
    logDebug(`🔍 [CLIENT-MGMT] Final client list:`, clients.map(c => ({id: c.id, fullName: c.summary?.fullName})));
    
    res.json({
      success: true,
      data: clients,
      count: clients.length
    });
    
  } catch (error) {
    logError('❌ Error listing clients:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to list clients',
      message: error.message 
    });
  }
});

/**
 * GET /api/client-management/:clientId
 * Get specific client details (SuperAdmin only)
 */
router.get('/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    logDebug(`🔍 SuperAdmin ${req.user.email} fetching client: ${clientId}`);
    
    const db = await getDb();
    const clientDoc = await db.collection('clients').doc(clientId).get();
    
    if (!clientDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Client not found',
        clientId
      });
    }
    
    const clientData = {
      id: clientDoc.id,
      ...clientDoc.data()
    };
    
    await writeAuditLog({
      module: 'client_management',
      action: 'view',
      parentPath: `clients/${clientId}`,
      docId: clientId,
      friendlyName: clientData.basicInfo?.fullName || 'Unnamed Client',
      notes: `SuperAdmin ${req.user.email} viewed client details`,
      userId: req.user.uid
    });
    
    logDebug(`✅ SuperAdmin ${req.user.email} fetched client: ${clientId}`);
    res.json({
      success: true,
      data: clientData
    });
    
  } catch (error) {
    logError('❌ Error fetching client:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch client',
      message: error.message 
    });
  }
});

/**
 * POST /api/client-management
 * Create new client (SuperAdmin only)
 */
router.post('/', async (req, res) => {
  try {
    const clientData = req.body;
    logDebug(`🔨 SuperAdmin ${req.user.email} creating new client:`, clientData.basicInfo?.fullName);
    
    // Validate client data
    const validation = validateClientData(clientData);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: validation.errors
      });
    }
    
    // Check if client ID is provided and valid
    const db = await getDb();
    const clientId = clientData.basicInfo?.clientId;
    
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'Client ID is required in basicInfo.clientId field'
      });
    }
    
    // Validate Client ID format
    const formatValidation = validateClientIdFormat(clientId);
    if (!formatValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: formatValidation.error
      });
    }
    
    // Check if client ID already exists
    const existingClient = await db.collection('clients').doc(clientId).get();
    if (existingClient.exists) {
      return res.status(409).json({
        success: false,
        error: `Client ID '${clientId}' already exists. Please choose a different ID.`
      });
    }
    
    // Create client from template
    const newClient = createClientFromTemplate(clientData, req.user.uid);
    
    // Save to Firestore using user-provided Client ID
    await db.collection('clients').doc(clientId).set(newClient);
    
    await writeAuditLog({
      module: 'client_management',
      action: 'create',
      parentPath: `clients/${clientId}`,
      docId: clientId,
      friendlyName: newClient.basicInfo.fullName,
      notes: `SuperAdmin ${req.user.email} created new client`,
      userId: req.user.uid
    });
    
    logDebug(`✅ SuperAdmin ${req.user.email} created client: ${clientId}`);
    res.status(201).json({
      success: true,
      data: {
        id: clientId,
        ...newClient
      },
      message: 'Client created successfully'
    });
    
  } catch (error) {
    logError('❌ Error creating client:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create client',
      message: error.message 
    });
  }
});

/**
 * PUT /api/client-management/:clientId
 * Update existing client (SuperAdmin only)
 */
router.put('/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const updates = req.body;
    logDebug(`🔧 SuperAdmin ${req.user.email} updating client: ${clientId}`);
    
    // Validate updates
    logDebug('🔍 Validating client data:', JSON.stringify(updates, null, 2));
    const validation = validateClientData(updates);
    logDebug('📋 Validation result:', JSON.stringify(validation, null, 2));
    
    if (!validation.isValid) {
      logError('❌ Validation failed with errors:', validation.errors);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: validation.errors
      });
    }
    
    const db = await getDb();
    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Client not found',
        clientId
      });
    }
    
    const existingClient = clientDoc.data();
    const updatedClient = updateClientWithMetadata(existingClient, updates, req.user.uid);
    
    // Save updates
    await clientRef.set(updatedClient);
    
    await writeAuditLog({
      module: 'client_management',
      action: 'update',
      parentPath: `clients/${clientId}`,
      docId: clientId,
      friendlyName: updatedClient.basicInfo?.fullName || 'Unnamed Client',
      notes: `SuperAdmin ${req.user.email} updated client`,
      userId: req.user.uid
    });
    
    logDebug(`✅ SuperAdmin ${req.user.email} updated client: ${clientId}`);
    res.json({
      success: true,
      data: {
        id: clientId,
        ...updatedClient
      },
      message: 'Client updated successfully'
    });
    
  } catch (error) {
    logError('❌ Error updating client:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update client',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/client-management/:clientId
 * Placeholder delete endpoint (returns "Feature Coming Soon")
 */
router.delete('/:clientId', async (req, res) => {
  const { clientId } = req.params;
  
  logDebug(`🚫 SuperAdmin ${req.user.email} attempted to delete client: ${clientId} - Feature not implemented`);
  
  await writeAuditLog({
    module: 'client_management',
    action: 'delete_attempted',
    parentPath: `clients/${clientId}`,
    docId: clientId,
    friendlyName: 'Client Delete Attempt',
    notes: `SuperAdmin ${req.user.email} attempted client deletion - feature not implemented`,
    userId: req.user.uid
  });
  
  res.status(501).json({
    success: false,
    error: 'Feature Coming Soon',
    message: 'Client deletion functionality is not yet implemented. This feature will be available in a future update.',
    featureStatus: 'PLANNED',
    clientId
  });
});

/**
 * POST /api/client-management/:clientId/logo
 * Upload client logo (SuperAdmin only)
 */
router.post('/:clientId/logo', upload.single('logo'), async (req, res) => {
  try {
    const { clientId } = req.params;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No logo file provided'
      });
    }
    
    logDebug(`📤 SuperAdmin ${req.user.email} uploading logo for client: ${clientId}`);
    
    // Verify client exists
    const db = await getDb();
    const clientDoc = await db.collection('clients').doc(clientId).get();
    
    if (!clientDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Client not found',
        clientId
      });
    }
    
    // Upload to Firebase Storage
    const bucket = getStorage().bucket();
    const fileName = `${LOGO_UPLOAD_CONFIG.storageFolder.logos}/${clientId}/${Date.now()}_${file.originalname}`;
    const fileRef = bucket.file(fileName);
    
    await fileRef.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
        metadata: {
          uploadedBy: req.user.uid,
          uploadedAt: getNow().toISOString(),
          clientId: clientId,
          originalName: file.originalname
        }
      }
    });
    
    // Make file publicly accessible
    await fileRef.makePublic();
    
    // Get proper Firebase Storage public URL
    const logoUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;
    
    // Update client with logo URL
    const clientData = clientDoc.data();
    const updatedClient = updateClientWithMetadata(
      clientData, 
      { branding: { ...clientData.branding, logoUrl } }, 
      req.user.uid
    );
    
    await db.collection('clients').doc(clientId).set(updatedClient);
    
    await writeAuditLog({
      module: 'client_management',
      action: 'logo_upload',
      parentPath: `clients/${clientId}`,
      docId: clientId,
      friendlyName: clientData.basicInfo?.fullName || 'Unnamed Client',
      notes: `SuperAdmin ${req.user.email} uploaded logo: ${file.originalname}`,
      userId: req.user.uid
    });
    
    logDebug(`✅ SuperAdmin ${req.user.email} uploaded logo for client: ${clientId}`);
    res.json({
      success: true,
      data: {
        logoUrl,
        fileName: file.originalname,
        size: file.size,
        uploadedAt: getNow().toISOString()
      },
      message: 'Logo uploaded successfully'
    });
    
  } catch (error) {
    logError('❌ Error uploading logo:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to upload logo',
      message: error.message 
    });
  }
});

/**
 * POST /api/client-management/:clientId/icon
 * Upload client icon (SuperAdmin only)
 */
router.post('/:clientId/icon', upload.single('icon'), async (req, res) => {
  try {
    const { clientId } = req.params;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No icon file provided'
      });
    }
    
    logDebug(`📤 SuperAdmin ${req.user.email} uploading icon for client: ${clientId}`);
    
    // Verify client exists
    const db = await getDb();
    const clientDoc = await db.collection('clients').doc(clientId).get();
    
    if (!clientDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Client not found',
        clientId
      });
    }
    
    // Upload to Firebase Storage
    const bucket = getStorage().bucket();
    const fileName = `${LOGO_UPLOAD_CONFIG.storageFolder.icons}/${clientId}/icon_${Date.now()}_${file.originalname}`;
    const fileRef = bucket.file(fileName);
    
    await fileRef.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
        metadata: {
          uploadedBy: req.user.uid,
          uploadedAt: getNow().toISOString(),
          clientId: clientId,
          originalName: file.originalname,
          type: 'icon'
        }
      }
    });
    
    // Make file publicly accessible
    await fileRef.makePublic();
    
    // Get proper Firebase Storage public URL
    const iconUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;
    
    // Update client with icon URL
    const clientData = clientDoc.data();
    const updatedClient = updateClientWithMetadata(
      clientData, 
      { branding: { ...clientData.branding, iconUrl } }, 
      req.user.uid
    );
    
    await db.collection('clients').doc(clientId).set(updatedClient);
    
    await writeAuditLog({
      module: 'client_management',
      action: 'icon_upload',
      parentPath: `clients/${clientId}`,
      docId: clientId,
      friendlyName: clientData.basicInfo?.fullName || 'Unnamed Client',
      notes: `SuperAdmin ${req.user.email} uploaded icon: ${file.originalname}`,
      userId: req.user.uid
    });
    
    logDebug(`✅ SuperAdmin ${req.user.email} uploaded icon for client: ${clientId}`);
    res.json({
      success: true,
      data: {
        logoUrl: iconUrl, // Keep same field name for compatibility
        fileName: file.originalname,
        size: file.size,
        uploadedAt: getNow().toISOString()
      },
      message: 'Icon uploaded successfully'
    });
    
  } catch (error) {
    logError('❌ Error uploading icon:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to upload icon',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/client-management/:clientId/icon
 * Remove client icon (SuperAdmin only)
 */
router.delete('/:clientId/icon', async (req, res) => {
  try {
    const { clientId } = req.params;
    logDebug(`🗑️ SuperAdmin ${req.user.email} removing icon for client: ${clientId}`);
    
    const db = await getDb();
    const clientDoc = await db.collection('clients').doc(clientId).get();
    
    if (!clientDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Client not found',
        clientId
      });
    }
    
    const clientData = clientDoc.data();
    const currentIconUrl = clientData.branding?.iconUrl;
    
    if (!currentIconUrl) {
      return res.status(404).json({
        success: false,
        error: 'No icon found for this client'
      });
    }
    
    // Remove icon URL from client data
    const updatedClient = updateClientWithMetadata(
      clientData, 
      { branding: { ...clientData.branding, iconUrl: null } }, 
      req.user.uid
    );
    
    await db.collection('clients').doc(clientId).set(updatedClient);
    
    // TODO: Actually delete the file from Firebase Storage
    // This would require parsing the URL to get the file path
    
    await writeAuditLog({
      module: 'client_management',
      action: 'icon_remove',
      parentPath: `clients/${clientId}`,
      docId: clientId,
      friendlyName: clientData.basicInfo?.fullName || 'Unnamed Client',
      notes: `SuperAdmin ${req.user.email} removed icon`,
      userId: req.user.uid
    });
    
    logDebug(`✅ SuperAdmin ${req.user.email} removed icon for client: ${clientId}`);
    res.json({
      success: true,
      message: 'Icon removed successfully'
    });
    
  } catch (error) {
    logError('❌ Error removing icon:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to remove icon',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/client-management/:clientId/logo
 * Remove client logo (SuperAdmin only)
 */
router.delete('/:clientId/logo', async (req, res) => {
  try {
    const { clientId } = req.params;
    logDebug(`🗑️ SuperAdmin ${req.user.email} removing logo for client: ${clientId}`);
    
    const db = await getDb();
    const clientDoc = await db.collection('clients').doc(clientId).get();
    
    if (!clientDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Client not found',
        clientId
      });
    }
    
    const clientData = clientDoc.data();
    const currentLogoUrl = clientData.branding?.logoUrl;
    
    if (!currentLogoUrl) {
      return res.status(404).json({
        success: false,
        error: 'No logo found for this client'
      });
    }
    
    // Remove logo URL from client data
    const updatedClient = updateClientWithMetadata(
      clientData, 
      { branding: { ...clientData.branding, logoUrl: null } }, 
      req.user.uid
    );
    
    await db.collection('clients').doc(clientId).set(updatedClient);
    
    // TODO: Actually delete the file from Firebase Storage
    // This would require parsing the URL to get the file path
    
    await writeAuditLog({
      module: 'client_management',
      action: 'logo_remove',
      parentPath: `clients/${clientId}`,
      docId: clientId,
      friendlyName: clientData.basicInfo?.fullName || 'Unnamed Client',
      notes: `SuperAdmin ${req.user.email} removed logo`,
      userId: req.user.uid
    });
    
    logDebug(`✅ SuperAdmin ${req.user.email} removed logo for client: ${clientId}`);
    res.json({
      success: true,
      message: 'Logo removed successfully'
    });
    
  } catch (error) {
    logError('❌ Error removing logo:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to remove logo',
      message: error.message 
    });
  }
});

export default router;