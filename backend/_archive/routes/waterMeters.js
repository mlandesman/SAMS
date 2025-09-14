import express from 'express';
import { 
  authenticateUserWithProfile, 
  enforceClientAccess, 
  requirePermission 
} from '../middleware/clientAuth.js';
// Temporarily commented - waterMeterController.js was removed
// import {
//   saveWaterReadings,
//   getWaterReadings,
//   getLatestReadings,
//   generateWaterBills,
//   getWaterBills,
//   getWaterBill,
//   recordWaterPayment,
//   getWaterPayments,
//   getOutstandingBalances,
//   getUnitWaterMeter,
//   bulkGenerateBills,
//   getAllWaterDataForYear
// } from '../controllers/waterMeterController.js';
import {
  validateReadingsInput,
  validateBillGeneration,
  validatePaymentInput,
  sanitizeWaterInputs
} from '../middleware/waterValidation.js';

const router = express.Router({ mergeParams: true });

router.use(authenticateUserWithProfile);
router.use(enforceClientAccess);

// Routes temporarily disabled - waterMeterController.js was removed
// TODO: Remove this file or reimplement with new water billing system

export default router;