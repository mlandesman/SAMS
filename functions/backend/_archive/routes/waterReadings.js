// Water Routes - Readings and Bills
import express from 'express';
import { authenticateUserWithProfile, enforceClientAccess } from '../middleware/clientAuth.js';
import {
  saveReadings,
  getMonthReadings,
  getYearReadings
} from '../controllers/waterReadingsController.js';
import {
  generateBills,
  getBills,
  getConfig
} from '../controllers/waterBillsController.js';

const router = express.Router({ mergeParams: true });

// Auth middleware
router.use(authenticateUserWithProfile);
router.use(enforceClientAccess);

// POST /api/clients/:clientId/water/readings - Save readings
router.post('/readings', saveReadings);

// GET /api/clients/:clientId/water/readings/:year/:month - Get month
router.get('/readings/:year/:month', getMonthReadings);

// GET /api/clients/:clientId/water/readings/:year - Get year for history
router.get('/readings/:year', getYearReadings);

// ============= BILL ROUTES =============
// POST /api/clients/:clientId/water/bills/generate
router.post('/bills/generate', generateBills);

// GET /api/clients/:clientId/water/bills/:year/:month
router.get('/bills/:year/:month', getBills);

// GET /api/clients/:clientId/water/config
router.get('/config', getConfig);

export default router;