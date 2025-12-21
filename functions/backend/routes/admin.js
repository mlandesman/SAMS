/**
 * Admin Routes for SAMS Multi-Tenant System
 * Phase 8: User Access Control System - Task 8.3
 * 
 * Provides secure administrative functions for user and client management
 * Enforces proper role hierarchy and access control
 */

import express from 'express';
import { 
  authenticateUserWithProfile, 
  requirePermission,
  logSecurityEvent 
} from '../middleware/clientAuth.js';
import { validateUserFields } from '../middleware/fieldValidation.js';
import {
  createUser,
  getUsers,
  updateUser,
  addClientAccess,
  removeClientAccess,
  deleteUser,
  addUnitRoleAssignment,
  removeUnitRoleAssignment
} from '../controllers/userManagementController.js';
import clientOnboardingRoutes from './clientOnboarding.js';
import clientManagementRoutes from './clientManagement.js';
import importRoutes from './import.js';
import { getNow } from '../services/DateService.js';
import { bulkGenerateStatements, getBulkStatementProgress, bulkSendStatementEmails, getBulkEmailProgress } from '../controllers/bulkStatementController.js';

const router = express.Router();

// Apply authentication middleware to all admin routes
router.use(authenticateUserWithProfile);

/**
 * User Management Routes
 */

// Get all users (with proper filtering)
router.get('/users',
  requirePermission('users.view'),
  logSecurityEvent('ADMIN_USERS_VIEW'),
  getUsers
);

// Create new user
router.post('/users',
  requirePermission('users.create'),
  validateUserFields,
  logSecurityEvent('ADMIN_USER_CREATE'),
  createUser
);

// Update user profile and permissions
router.put('/users/:userId',
  requirePermission('users.manage'),
  validateUserFields,
  logSecurityEvent('ADMIN_USER_UPDATE'),
  updateUser
);

// Add client access to user
router.post('/users/:userId/clients',
  requirePermission('users.manage'),
  logSecurityEvent('ADMIN_USER_CLIENT_ACCESS_ADD'),
  addClientAccess
);

// Remove client access from user
router.delete('/users/:userId/clients/:clientId',
  requirePermission('users.manage'),
  logSecurityEvent('ADMIN_USER_CLIENT_ACCESS_REMOVE'),
  removeClientAccess
);

// REMOVED: Legacy manager assignment routes have been replaced by unit role assignment routes below

// Add unit role assignment to user (supports different roles per unit)
router.post('/users/:userId/unit-roles',
  requirePermission('system.admin'), // SuperAdmin only
  logSecurityEvent('ADMIN_USER_UNIT_ROLE_ASSIGNMENT_ADD'),
  addUnitRoleAssignment
);

// Remove unit role assignment from user
router.delete('/users/:userId/unit-roles',
  requirePermission('system.admin'), // SuperAdmin only
  logSecurityEvent('ADMIN_USER_UNIT_ROLE_ASSIGNMENT_REMOVE'),
  removeUnitRoleAssignment
);

// Delete user (SuperAdmin only)
router.delete('/users/:userId',
  requirePermission('system.admin'), // SuperAdmin only
  logSecurityEvent('ADMIN_USER_DELETE'),
  deleteUser
);

/**
 * Client Management Routes (Migrated from legacy /api paths)
 */

// Mount client onboarding routes (migrated from /api/onboarding)
router.use('/onboarding', clientOnboardingRoutes);

// Mount client management routes (migrated from /api/client-management)  
router.use('/client-management', clientManagementRoutes);

// Mount import routes (for data import/purge operations)
router.use('/import', importRoutes);

/**
 * Bulk Statement Generation Routes
 */

// Bulk generate statements for all units in a client
router.post('/bulk-statements/generate',
  requirePermission('system.admin'), // SuperAdmin only
  logSecurityEvent('ADMIN_BULK_STATEMENTS_GENERATE'),
  bulkGenerateStatements
);

// Get bulk statement generation progress (for polling)
router.get('/bulk-statements/progress/:clientId',
  requirePermission('system.admin'),
  getBulkStatementProgress
);

// Bulk send statement emails for all units in a client
router.post('/bulk-statements/email',
  requirePermission('system.admin'),
  logSecurityEvent('ADMIN_BULK_STATEMENTS_EMAIL'),
  bulkSendStatementEmails
);

// Get bulk email progress (for polling)
router.get('/bulk-statements/email/progress/:clientId',
  requirePermission('system.admin'),
  getBulkEmailProgress
);

/**
 * Production Configuration Routes (Public access for deployment)
 */

// Enable Unit Management for All Clients
router.get('/enable-unit-management',
  authenticateUserWithProfile,
  requirePermission('system.admin'),
  logSecurityEvent('ADMIN_ENABLE_UNIT_MANAGEMENT'),
  async (req, res) => {
  try {
    console.log('🔧 Starting Unit Management enablement for all clients via web endpoint...');
    
    const { getDb } = await import('../firebase.js');
    const db = await getDb();
    const results = {
      success: true,
      message: 'Unit Management enablement completed',
      details: {
        processed: 0,
        updated: 0,
        created: 0,
        alreadyEnabled: 0,
        errors: []
      }
    };
    
    // Get all clients
    const clientsSnapshot = await db.collection('clients').get();
    
    if (clientsSnapshot.empty) {
      return res.json({
        success: true,
        message: 'No clients found to process',
        details: results.details
      });
    }
    
    for (const clientDoc of clientsSnapshot.docs) {
      const clientId = clientDoc.id;
      results.details.processed++;
      
      try {
        console.log(`🔍 Processing client: ${clientId}`);
        
        // Get client's list configuration
        const listsConfigRef = db.doc(`clients/${clientId}/config/lists`);
        const listsConfigDoc = await listsConfigRef.get();
        
        if (listsConfigDoc.exists) {
          const currentConfig = listsConfigDoc.data();
          
          // Check if units is already enabled
          if (currentConfig.unit === true) {
            console.log(`✅ Unit Management already enabled for ${clientId}`);
            results.details.alreadyEnabled++;
            continue;
          }
          
          // Update configuration to enable units
          await listsConfigRef.update({
            unit: true,
            updatedAt: getNow(),
            updatedBy: 'admin-web-endpoint'
          });
          
          console.log(`✅ Updated Unit Management for ${clientId}`);
          results.details.updated++;
          
        } else {
          // Create new configuration with default lists including units
          const defaultConfig = {
            vendor: true,
            category: true,
            method: true,
            unit: true,
            exchangerates: true,
            createdAt: getNow(),
            createdBy: 'admin-web-endpoint'
          };
          
          await listsConfigRef.set(defaultConfig);
          console.log(`✅ Created new configuration with Unit Management for ${clientId}`);
          results.details.created++;
        }
        
      } catch (error) {
        console.error(`❌ Error processing client ${clientId}:`, error);
        results.details.errors.push({
          clientId,
          error: error.message
        });
      }
    }
    
    console.log(`📊 Unit Management enablement completed:`, results.details);
    
    res.json(results);
    
  } catch (error) {
    console.error('❌ Error enabling Unit Management:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to enable Unit Management',
      error: error.message
    });
  }
});

// Test Unit Management Configuration
router.get('/test-unit-management', authenticateUserWithProfile, requirePermission('system.admin'), async (req, res) => {
  try {
    console.log('🧪 Testing Unit Management configuration for all clients...');
    
    const { getDb } = await import('../firebase.js');
    const db = await getDb();
    const results = {
      success: true,
      message: 'Unit Management testing completed',
      clients: []
    };
    
    // Get all clients
    const clientsSnapshot = await db.collection('clients').get();
    
    if (clientsSnapshot.empty) {
      return res.json({
        success: true,
        message: 'No clients found to test',
        clients: []
      });
    }
    
    for (const clientDoc of clientsSnapshot.docs) {
      const clientId = clientDoc.id;
      const clientResult = {
        clientId,
        unitsEnabled: false,
        configExists: false,
        unitsCount: 0,
        status: 'unknown'
      };
      
      try {
        // Check client configuration
        const listsConfigDoc = await db.doc(`clients/${clientId}/config/lists`).get();
        
        if (listsConfigDoc.exists) {
          clientResult.configExists = true;
          const config = listsConfigDoc.data();
          clientResult.unitsEnabled = config.unit === true;
        }
        
        // Count units in database
        const unitsSnapshot = await db.collection(`clients/${clientId}/units`).get();
        clientResult.unitsCount = unitsSnapshot.size;
        
        // Determine status
        if (clientResult.configExists && clientResult.unitsEnabled) {
          clientResult.status = 'enabled';
        } else if (clientResult.configExists && !clientResult.unitsEnabled) {
          clientResult.status = 'disabled';
        } else {
          clientResult.status = 'no-config';
        }
        
        results.clients.push(clientResult);
        
      } catch (error) {
        clientResult.status = 'error';
        clientResult.error = error.message;
        results.clients.push(clientResult);
      }
    }
    
    console.log(`✅ Unit Management testing completed for ${results.clients.length} clients`);
    
    res.json(results);
    
  } catch (error) {
    console.error('❌ Error testing Unit Management:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test Unit Management',
      error: error.message
    });
  }
});

/**
 * System Administration Routes (SuperAdmin only)
 */

// Get system statistics
router.get('/stats',
  requirePermission('system.admin'),
  logSecurityEvent('ADMIN_STATS_VIEW'),
  async (req, res) => {
    try {
      // TODO: Implement system statistics
      res.json({
        success: true,
        stats: {
          totalUsers: 0,
          totalClients: 0,
          activeUsers: 0,
          lastUpdated: getNow().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch system statistics' });
    }
  }
);

// Get audit logs
router.get('/audit-logs',
  requirePermission('system.admin'),
  logSecurityEvent('ADMIN_AUDIT_LOGS_VIEW'),
  async (req, res) => {
    try {
      // TODO: Implement audit log retrieval
      res.json({
        success: true,
        logs: [],
        message: 'Audit log system coming soon'
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  }
);

/**
 * Security Testing Endpoints (Development only)
 */
if (process.env.NODE_ENV === 'development') {
  // Test client access validation
  router.get('/test/client-access/:clientId',
    logSecurityEvent('ADMIN_TEST_CLIENT_ACCESS'),
    async (req, res) => {
      const { clientId } = req.params;
      const user = req.user;
      
      res.json({
        success: true,
        test: 'client-access',
        clientId: clientId,
        userEmail: user.email,
        // Note: Middleware uses hasPropertyAccess/getPropertyAccess (not hasClientAccess/getClientAccess)
        hasAccess: user.hasPropertyAccess?.(clientId),
        userRole: user.getPropertyAccess?.(clientId)?.role || null,
        isSuperAdmin: user.isSuperAdmin()
      });
    }
  );

  // Test permission checking
  router.get('/test/permission/:permission',
    logSecurityEvent('ADMIN_TEST_PERMISSION'),
    async (req, res) => {
      const { permission } = req.params;
      const user = req.user;
      
      res.json({
        success: true,
        test: 'permission',
        permission: permission,
        userEmail: user.email,
        hasPermission: user.isSuperAdmin(), // Simplified for testing
        userProfile: user.samsProfile ? 'loaded' : 'not loaded'
      });
    }
  );
}

export default router;