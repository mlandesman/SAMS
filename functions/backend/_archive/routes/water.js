// routes/water.js
import express from 'express';
import { authenticateUserWithProfile, enforceClientAccess } from '../middleware/clientAuth.js';
import { waterDataService } from '../services/waterDataService.js';
// Water routes will be handled in waterReadings.js
// This file can be removed once projects/waterBills routing is cleaned up
import {
  generateBills,
  getBills,
  getConfig
} from '../controllers/waterBillsController.js';

const router = express.Router({ mergeParams: true });

// Apply authentication to all routes
router.use(authenticateUserWithProfile);

// Apply client access validation to all routes
router.use(enforceClientAccess);

// Reading routes removed - handled in waterReadings.js

// ============= BILL GENERATION =============
// POST /api/clients/:clientId/projects/waterBills/bills/generate
router.post('/bills/generate', generateBills);

// GET /api/clients/:clientId/projects/waterBills/bills/:year/:month
router.get('/bills/:year/:month', getBills);

// ============= CONFIGURATION =============
// GET /api/clients/:clientId/water/config
router.get('/config', getConfig);

// ============= DATA AGGREGATION =============
// GET /api/clients/:clientId/water/data/:year?
router.get('/data/:year?', async (req, res) => {
  try {
    const { clientId, year } = req.params;
    const fiscalYear = year ? parseInt(year) : null;
    
    const data = await waterDataService.getYearData(clientId, fiscalYear);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching water data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/clients/:clientId/water/cache/clear
router.post('/cache/clear', async (req, res) => {
  try {
    const { clientId } = req.params;
    waterDataService.invalidate(clientId);
    
    res.json({
      success: true,
      message: `Cache cleared for client ${clientId}`
    });
  } catch (error) {
    console.error('Error clearing water cache:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;