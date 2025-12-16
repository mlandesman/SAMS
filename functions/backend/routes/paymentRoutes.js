/**
 * Unified Payment Routes
 * 
 * Phase: Unified Payment System
 * Task: Task 2 - Controller Endpoints
 * Created: November 3, 2025
 * 
 * PURPOSE:
 * RESTful API routes for unified payments that span multiple modules
 * (HOA Dues and Water Bills).
 * 
 * ENDPOINTS:
 * - POST /payments/unified/preview - Preview payment allocation
 * - POST /payments/unified/record - Record payment to database
 * 
 * ARCHITECTURE:
 * - All routes require authentication
 * - Uses UnifiedPaymentController for business logic
 * - Follows existing SAMS route patterns
 */

import express from 'express';
import { 
  previewUnifiedPayment, 
  recordUnifiedPayment 
} from '../controllers/unifiedPaymentController.js';
import { authenticateUserWithProfile } from '../middleware/clientAuth.js';

const router = express.Router();

// Apply authentication to all unified payment routes
router.use(authenticateUserWithProfile);

/**
 * Preview unified payment allocation
 * 
 * POST /payments/unified/preview
 * 
 * Request Body:
 * {
 *   clientId: "MTC" | "AVII",
 *   unitId: string,
 *   amount: number (pesos),
 *   paymentDate: string (ISO 8601)
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   preview: {
 *     totalAmount: number,
 *     currentCreditBalance: number,
 *     newCreditBalance: number,
 *     hoa: { billsPaid: [], totalPaid: number, monthsAffected: [] },
 *     water: { billsPaid: [], totalPaid: number, billsAffected: [] },
 *     credit: { used: number, added: number, final: number },
 *     summary: { totalBills: number, totalAllocated: number }
 *   }
 * }
 */
router.post('/unified/preview', previewUnifiedPayment);

/**
 * Record unified payment to database
 * 
 * POST /payments/unified/record
 * 
 * Request Body:
 * {
 *   clientId: "MTC" | "AVII",
 *   unitId: string,
 *   amount: number (pesos),
 *   paymentDate: string (ISO 8601),
 *   paymentMethod: "wire" | "check" | "cash" | "zelle",
 *   reference?: string (optional bank reference),
 *   notes?: string (optional notes),
 *   preview: object (from preview endpoint)
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   result: {
 *     transactionIds: { hoa: [], water: [], credit: string },
 *     summary: { totalRecorded: number, billsPaid: number },
 *     timestamp: string
 *   }
 * }
 */
router.post('/unified/record', recordUnifiedPayment);

export default router;

