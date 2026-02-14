// backend/routes/units.js
import { logDebug, logInfo, logWarn, logError } from '../../shared/logger.js';
import express from 'express';
import { createUnit, updateUnit, deleteUnit, listUnits, updateUnitManagers, addUnitEmail } from '../controllers/unitsController.js';
import { authenticateUserWithProfile } from '../middleware/clientAuth.js';
import { getDb } from '../firebase.js';

const router = express.Router({ mergeParams: true });

// GET /api/clients/:clientId/units - List all units for a client
router.get('/', authenticateUserWithProfile, async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }

    logDebug(`📋 Fetching units for client: ${clientId}`);
    const units = await listUnits(clientId);
    
    res.json({
      success: true,
      data: units,
      count: units.length
    });
  } catch (error) {
    logError('❌ Error fetching units:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch units' 
    });
  }
});

// POST /api/clients/:clientId/units - Create a new unit
router.post('/', authenticateUserWithProfile, async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    const unitData = req.body;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }

    if (!unitData.unitId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Unit ID is required' 
      });
    }

    logDebug(`➕ Creating unit for client: ${clientId}`, unitData);
    
    // Use unitId as document ID for consistent referencing
    const unitId = await createUnit(clientId, unitData, unitData.unitId);
    
    res.json({
      success: true,
      id: unitId,
      message: 'Unit created successfully'
    });
  } catch (error) {
    logError('❌ Error creating unit:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create unit' 
    });
  }
});

// PUT /api/clients/:clientId/units/:unitId - Update a unit
router.put('/:unitId', authenticateUserWithProfile, async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    const { unitId } = req.params;
    const unitData = req.body;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }

    if (!unitId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Unit ID is required' 
      });
    }

    logDebug(`✏️ Updating unit ${unitId} for client: ${clientId}`, unitData);
    
    const success = await updateUnit(clientId, unitId, unitData);
    
    if (success) {
      res.json({
        success: true,
        message: 'Unit updated successfully'
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update unit' 
      });
    }
  } catch (error) {
    logError('❌ Error updating unit:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update unit' 
    });
  }
});

// DELETE /api/clients/:clientId/units/:unitId - Delete a unit
router.delete('/:unitId', authenticateUserWithProfile, async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    const { unitId } = req.params;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }

    if (!unitId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Unit ID is required' 
      });
    }

    logDebug(`🗑️ Deleting unit ${unitId} for client: ${clientId}`);
    
    const success = await deleteUnit(clientId, unitId);
    
    if (success) {
      res.json({
        success: true,
        message: 'Unit deleted successfully'
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to delete unit' 
      });
    }
  } catch (error) {
    logError('❌ Error deleting unit:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete unit' 
    });
  }
});

// PUT /api/clients/:clientId/units/:unitId/managers - Update unit managers
router.put('/:unitId/managers', authenticateUserWithProfile, async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    const { unitId } = req.params;
    const { managers } = req.body;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }

    if (!unitId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Unit ID is required' 
      });
    }

    if (!Array.isArray(managers)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Managers must be an array' 
      });
    }

    logDebug(`👥 Updating managers for unit ${unitId} in client: ${clientId}`, managers);
    
    const success = await updateUnitManagers(clientId, unitId, managers);
    
    if (success) {
      res.json({
        success: true,
        message: 'Unit managers updated successfully'
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update unit managers' 
      });
    }
  } catch (error) {
    logError('❌ Error updating unit managers:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update unit managers' 
    });
  }
});

// POST /api/clients/:clientId/units/:unitId/emails - Add email to unit
router.post('/:unitId/emails', authenticateUserWithProfile, async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    const { unitId } = req.params;
    const { email } = req.body;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }

    if (!unitId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Unit ID is required' 
      });
    }

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email is required' 
      });
    }

    logDebug(`📧 Adding email to unit ${unitId} in client: ${clientId}`, email);
    
    const success = await addUnitEmail(clientId, unitId, email);
    
    if (success) {
      res.json({
        success: true,
        message: 'Email added to unit successfully'
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to add email to unit' 
      });
    }
  } catch (error) {
    logError('❌ Error adding email to unit:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to add email to unit' 
    });
  }
});

// GET /api/clients/:clientId/units/user-access - Get units accessible by current user
router.get('/user-access', authenticateUserWithProfile, async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    const user = req.user;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }

    logDebug(`🔑 Fetching user accessible units for client: ${clientId}`);
    logDebug(`🔑 User samsProfile:`, JSON.stringify(user.samsProfile, null, 2));
    logDebug(`🔑 User email:`, user.email);
    logDebug(`🔑 User globalRole:`, user.samsProfile?.globalRole);
    
    const db = await getDb();
    const unitsRef = db.collection('clients').doc(clientId).collection('units');
    
    // Get user's client access
    const propertyAccess = user.getPropertyAccess(clientId);
    if (!propertyAccess) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied to this client' 
      });
    }

    let units = [];

    // Admin users can see all units
    if (propertyAccess.role === 'admin' || user.samsProfile?.globalRole === 'admin' || user.samsProfile?.globalRole === 'superAdmin') {
      const unitsSnapshot = await unitsRef.get();
      units = unitsSnapshot.docs.map(doc => ({
        unitId: doc.id,
        ...doc.data()
      }));
    } else {
      // Start with the primary unit from propertyAccess
      if (propertyAccess.unitId) {
        const unitDoc = await unitsRef.doc(propertyAccess.unitId).get();
        if (unitDoc.exists) {
          const unitData = unitDoc.data();
          units.push({
            unitId: unitDoc.id,
            ...unitData
          });
        }
      }
      
      // Check for additional unitAssignments within the propertyAccess
      const additionalAssignments = propertyAccess.unitAssignments || [];
      
      logDebug(`🔑 Additional unit assignments:`, JSON.stringify(additionalAssignments, null, 2));
      
      // Add additional units the user manages
      for (const assignment of additionalAssignments) {
        if (assignment.unitId) {
          const unitDoc = await unitsRef.doc(assignment.unitId).get();
          if (unitDoc.exists) {
            const unitData = unitDoc.data();
            units.push({
              unitId: unitDoc.id,
              role: assignment.role,
              ...unitData
            });
          }
        }
      }
    }
    
    logDebug(`✅ Found ${units.length} accessible units for user`);
    logDebug(`✅ Units:`, units.map(u => ({ unitId: u.unitId, address: u.address })));
    
    res.json(units);
    
  } catch (error) {
    logError('❌ Error fetching user accessible units:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch user accessible units' 
    });
  }
});

export default router;
