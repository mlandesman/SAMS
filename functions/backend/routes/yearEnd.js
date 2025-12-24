import express from 'express';
const router = express.Router();
import { 
  authenticateUserWithProfile, 
  enforceClientAccess, 
  requirePermission,
  logSecurityEvent 
} from '../middleware/clientAuth.js';
import * as yearEndController from '../controllers/yearEndController.js';

// Apply security middleware to all year-end routes
router.use(authenticateUserWithProfile);
router.use(enforceClientAccess);

/**
 * GET /api/clients/:clientId/year-end/preview/:closingYear
 * Preview year-end data for a fiscal year
 */
router.get('/preview/:closingYear',
  requirePermission('client.manage'),
  logSecurityEvent('YEAR_END_PREVIEW'),
  yearEndController.previewYearEnd
);

/**
 * POST /api/clients/:clientId/year-end/execute
 * Execute year-end processing (create new year dues, snapshot balances)
 */
router.post('/execute',
  requirePermission('client.manage'),
  logSecurityEvent('YEAR_END_EXECUTE'),
  yearEndController.executeYearEnd
);

/**
 * GET /api/clients/:clientId/year-end/report/:closingYear
 * Generate Board Report PDF
 */
router.get('/report/:closingYear',
  requirePermission('reports.view'),
  logSecurityEvent('YEAR_END_REPORT'),
  yearEndController.generateBoardReport
);

export default router;

