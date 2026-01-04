/**
 * Credit Auto-Pay Report Routes
 * Manual trigger endpoints for credit auto-pay email reports
 * TASK-90 Phase 2
 */

import express from 'express';
import { handleManualTrigger } from '../controllers/creditAutoPayReportController.js';

const router = express.Router();

/**
 * Manual trigger endpoint for credit auto-pay reports
 * 
 * Examples:
 *   GET /api/reports/credit-auto-pay/send
 *   GET /api/reports/credit-auto-pay/send?client=MTC
 *   GET /api/reports/credit-auto-pay/send?client=AVII
 *   GET /api/reports/credit-auto-pay/send?dryRun=true
 *   GET /api/reports/credit-auto-pay/send?client=MTC&dryRun=true
 */
router.get('/send', handleManualTrigger);

export default router;
