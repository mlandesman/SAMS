// Credit Balance Routes
// Domain-independent credit balance operations
// Provides clean API abstraction over underlying storage

import express from 'express';
import { CreditController } from '../controllers/creditController.js';

const router = express.Router();
const creditController = new CreditController();

// Credit balance operations
router.get('/:clientId/:unitId', creditController.getCreditBalance);
router.post('/:clientId/:unitId', creditController.updateCreditBalance);

// Credit history operations
router.get('/:clientId/:unitId/history', creditController.getCreditHistory);
router.post('/:clientId/:unitId/history', creditController.addCreditHistoryEntry);

export default router;

