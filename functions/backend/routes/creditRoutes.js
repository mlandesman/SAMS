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
router.delete('/:clientId/:unitId/history/:transactionId', creditController.deleteCreditHistoryEntry);

// Admin credit history operations (by entry ID)
router.delete('/:clientId/:unitId/history/entry/:entryId', creditController.deleteCreditHistoryEntryById);
router.put('/:clientId/:unitId/history/entry/:entryId', creditController.updateCreditHistoryEntry);

export default router;

