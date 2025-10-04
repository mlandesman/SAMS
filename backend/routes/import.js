// backend/routes/import.js
import express from 'express';
const router = express.Router();
import { 
  getImportConfig, 
  executePurge, 
  executeImport, 
  getImportProgress 
} from '../controllers/importController.js';
import { authenticateUserWithProfile } from '../middleware/clientAuth.js';

// Get import configuration for a client
router.get('/:clientId/config', authenticateUserWithProfile, async (req, res) => {
  try {
    const { clientId } = req.params;
    const user = req.user;
    
    console.log(`📋 [IMPORT ROUTES] Getting import config for client: ${clientId}`);
    
    const config = await getImportConfig(user, clientId);
    
    if (!config) {
      return res.status(404).json({ 
        error: 'Import configuration not found or access denied' 
      });
    }
    
    res.json(config);
  } catch (error) {
    console.error('❌ [IMPORT ROUTES] Error getting import config:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute purge operation
router.post('/:clientId/purge', authenticateUserWithProfile, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { dryRun = false } = req.body;
    const user = req.user;
    
    console.log(`🗑️ [IMPORT ROUTES] Starting purge for client: ${clientId}, dryRun: ${dryRun}`);
    
    // Initialize progress in global state
    if (!global.importProgress) {
      global.importProgress = {};
    }
    
    global.importProgress[clientId] = {
      status: 'starting',
      clientId,
      dryRun,
      startTime: new Date().toISOString()
    };
    
    // Start purge in background (don't await)
    executePurge(user, clientId, { dryRun }).catch(error => {
      console.error('❌ [IMPORT ROUTES] Purge error:', error);
      if (global.importProgress[clientId]) {
        global.importProgress[clientId].status = 'error';
        global.importProgress[clientId].error = error.message;
      }
    });
    
    // Return immediately with initial progress
    res.json(global.importProgress[clientId]);
  } catch (error) {
    console.error('❌ [IMPORT ROUTES] Error starting purge:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute import operation
router.post('/:clientId/import', authenticateUserWithProfile, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { dataPath, dryRun = false, maxErrors = 3 } = req.body;
    const user = req.user;
    
    console.log(`📥 [IMPORT ROUTES] Starting import for client: ${clientId}, dataPath: ${dataPath}, dryRun: ${dryRun}`);
    
    // Initialize progress in global state
    if (!global.importProgress) {
      global.importProgress = {};
    }
    
    global.importProgress[clientId] = {
      status: 'starting',
      clientId,
      dataPath,
      dryRun,
      startTime: new Date().toISOString()
    };
    
    // Start import in background (don't await)
    executeImport(user, clientId, { 
      dataPath, 
      dryRun, 
      maxErrors 
    }).catch(error => {
      console.error('❌ [IMPORT ROUTES] Import error:', error);
      if (global.importProgress[clientId]) {
        global.importProgress[clientId].status = 'error';
        global.importProgress[clientId].error = error.message;
      }
    });
    
    // Return immediately with initial progress
    res.json(global.importProgress[clientId]);
  } catch (error) {
    console.error('❌ [IMPORT ROUTES] Error starting import:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get import progress
router.get('/:clientId/progress', authenticateUserWithProfile, async (req, res) => {
  try {
    const { clientId } = req.params;
    const user = req.user;
    
    console.log(`📊 [IMPORT ROUTES] Getting progress for client: ${clientId}`);
    
    const progress = await getImportProgress(user, clientId);
    
    if (!progress) {
      return res.status(404).json({ 
        error: 'Progress not found or access denied' 
      });
    }
    
    res.json(progress);
  } catch (error) {
    console.error('❌ [IMPORT ROUTES] Error getting progress:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
