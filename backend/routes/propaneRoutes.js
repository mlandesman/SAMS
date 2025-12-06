// routes/propaneRoutes.js
// Domain-focused propane routes
import express from 'express';
import { authenticateUserWithProfile, enforceClientAccess } from '../middleware/clientAuth.js';
import {
  getConfig,
  saveReadings,
  getReadings,
  getReadingsExistence,
  getAggregatedData
} from '../controllers/propaneController.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateUserWithProfile);

// ============= CONFIGURATION =============
// GET /propane/clients/:clientId/config
router.get('/clients/:clientId/config', enforceClientAccess, getConfig);

// ============= DATA AGGREGATION =============
// GET /propane/clients/:clientId/data/:year - Get aggregated year data
router.get('/clients/:clientId/data/:year', enforceClientAccess, getAggregatedData);

// ============= READINGS =============
// GET /propane/clients/:clientId/readings/exists/:year - Batch check which months have readings
router.get('/clients/:clientId/readings/exists/:year', enforceClientAccess, getReadingsExistence);

// GET /propane/clients/:clientId/readings/:year/:month - Get specific month
router.get('/clients/:clientId/readings/:year/:month', enforceClientAccess, getReadings);

// POST /propane/clients/:clientId/readings/:year/:month - Save readings
router.post('/clients/:clientId/readings/:year/:month', enforceClientAccess, saveReadings);

export default router;
