// routes/waterRoutes.js
// Clean domain-focused water routes that internally handle Firebase structure
import express from 'express';
import { authenticateUserWithProfile, enforceClientAccess } from '../middleware/clientAuth.js';
import waterBillsService from '../services/waterBillsService.js';
import waterReadingsService from '../services/waterReadingsService.js';
import { centavosToPesos } from '../utils/currencyUtils.js';
import { 
  recordWaterPayment, 
  getWaterPaymentHistory, 
  getUnpaidBillsSummary 
} from '../controllers/waterPaymentsController.js';
import { 
  generateBills, 
  getBillingConfig, 
  recalculatePenalties, 
  getPenaltySummary 
} from '../controllers/waterBillsController.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateUserWithProfile);

/**
 * Convert aggregatedData from centavos (backend storage) to pesos (frontend display)
 * 
 * ARCHITECTURAL DECISION: Convert once at API layer, not 1,800+ times in frontend
 * - AggregatedData has 12 months × 10 units × 15+ fields = 1,800+ values
 * - Converting once here is FAR more efficient than converting in frontend
 * - Frontend receives clean pesos, no confusion about "is 8000 = $8000 or $80?"
 * - Matches pattern that will be applied to HOA Dues refactoring
 */
function convertAggregatedDataToPesos(data) {
  if (!data || !data.months) return data;
  
  // Currency fields that need conversion from centavos to pesos
  const currencyFields = [
    'previousBalance', 'penaltyAmount', 'billAmount', 'totalAmount',
    'paidAmount', 'unpaidAmount', 'displayDue', 'displayPenalties', 'displayOverdue',
    'totalPenalties', 'totalDue', 'displayTotalPenalties', 'displayTotalDue'
  ];
  
  // Convert months array
  const convertedMonths = data.months.map(month => {
    if (!month || !month.units) return month;
    
    // Convert each unit's currency fields
    const convertedUnits = {};
    for (const [unitId, unitData] of Object.entries(month.units)) {
      convertedUnits[unitId] = { ...unitData };
      
      // Convert each currency field from centavos to pesos
      for (const field of currencyFields) {
        if (typeof unitData[field] === 'number') {
          convertedUnits[unitId][field] = centavosToPesos(unitData[field]);
        }
      }
      
      // Convert payments array amounts
      if (unitData.payments && Array.isArray(unitData.payments)) {
        convertedUnits[unitId].payments = unitData.payments.map(payment => ({
          ...payment,
          amount: typeof payment.amount === 'number' ? centavosToPesos(payment.amount) : payment.amount,
          baseChargePaid: typeof payment.baseChargePaid === 'number' ? centavosToPesos(payment.baseChargePaid) : payment.baseChargePaid,
          penaltyPaid: typeof payment.penaltyPaid === 'number' ? centavosToPesos(payment.penaltyPaid) : payment.penaltyPaid
        }));
      }
    }
    
    return {
      ...month,
      units: convertedUnits
    };
  });
  
  // Convert wash rates
  const carWashRate = typeof data.carWashRate === 'number' ? centavosToPesos(data.carWashRate) : data.carWashRate;
  const boatWashRate = typeof data.boatWashRate === 'number' ? centavosToPesos(data.boatWashRate) : data.boatWashRate;
  
  // Convert summary fields from centavos to pesos
  let convertedSummary = data.summary;
  if (data.summary && typeof data.summary === 'object') {
    convertedSummary = {
      ...data.summary,
      totalBilled: typeof data.summary.totalBilled === 'number' ? centavosToPesos(data.summary.totalBilled) : data.summary.totalBilled,
      totalPaid: typeof data.summary.totalPaid === 'number' ? centavosToPesos(data.summary.totalPaid) : data.summary.totalPaid,
      totalUnpaid: typeof data.summary.totalUnpaid === 'number' ? centavosToPesos(data.summary.totalUnpaid) : data.summary.totalUnpaid,
      totalNewCharges: typeof data.summary.totalNewCharges === 'number' ? centavosToPesos(data.summary.totalNewCharges) : data.summary.totalNewCharges
    };
    
    // Convert overdueDetails amounts if present
    if (data.summary.overdueDetails && Array.isArray(data.summary.overdueDetails)) {
      convertedSummary.overdueDetails = data.summary.overdueDetails.map(detail => ({
        ...detail,
        amountDue: typeof detail.amountDue === 'number' ? centavosToPesos(detail.amountDue) : detail.amountDue
      }));
    }
  }
  
  return {
    ...data,
    months: convertedMonths,
    carWashRate,
    boatWashRate,
    summary: convertedSummary
  };
}

// ============= DATA AGGREGATION ============= 
// (Removed aggregatedData endpoints - using direct bill reads instead)


// ============= READINGS =============
// GET /water/clients/:clientId/readings/:year/:month
router.get('/clients/:clientId/readings/:year/:month', enforceClientAccess, async (req, res) => {
  try {
    const { clientId, year, month } = req.params;
    const data = await waterReadingsService.getMonthReadings(
      clientId, 
      parseInt(year), 
      parseInt(month)
    );
    
    res.json({ 
      success: true, 
      data: data || { readings: {} }
    });
  } catch (error) {
    console.error('Error fetching water readings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /water/clients/:clientId/readings/:year/:month
router.post('/clients/:clientId/readings/:year/:month', enforceClientAccess, async (req, res) => {
  try {
    const { clientId, year, month } = req.params;
    
    console.log(`💾 Saving water readings: clientId=${clientId}, year=${year}, month=${month}`);
    console.log('📦 Request payload:', JSON.stringify(req.body, null, 2));
    
    const data = await waterReadingsService.saveReadings(
      clientId,
      parseInt(year),
      parseInt(month),
      req.body
    );
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error saving water readings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= BILLS =============
// POST /water/clients/:clientId/bills/generate
router.post('/clients/:clientId/bills/generate', enforceClientAccess, generateBills);

// POST /water/clients/:clientId/bills/recalculate-penalties
router.post('/clients/:clientId/bills/recalculate-penalties', enforceClientAccess, recalculatePenalties);

// GET /water/clients/:clientId/bills/penalty-summary
router.get('/clients/:clientId/bills/penalty-summary', enforceClientAccess, getPenaltySummary);

// ============= PAYMENTS =============
// GET /water/clients/:clientId/bills/unpaid/:unitId - MUST BE BEFORE :year/:month route
router.get('/clients/:clientId/bills/unpaid/:unitId', enforceClientAccess, getUnpaidBillsSummary);

// POST /water/clients/:clientId/payments/preview - Preview payment distribution
router.post('/clients/:clientId/payments/preview', enforceClientAccess, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { unitId, amount, payOnDate, selectedMonth } = req.body;
    
    // Validate input
    if (!unitId || amount === undefined || amount < 0) {
      return res.status(400).json({
        success: false,
        error: 'Unit ID and non-negative amount are required'
      });
    }
    
    // Import services and utilities
    const { waterPaymentsService } = await import('../services/waterPaymentsService.js');
    const { CreditAPI } = await import('../api/creditAPI.js');
    const { getFiscalYear } = await import('../utils/fiscalYearUtils.js');
    const { getNow } = await import('../services/DateService.js');
    
    // Get current credit balance using CreditAPI (same as recordPayment does)
    const fiscalYear = getFiscalYear(getNow(), 7); // AVII uses July start
    const creditData = await CreditAPI.getCreditBalance(clientId, unitId);
    const currentCreditBalance = creditData.creditBalance || 0;
    
    console.log(`💰 Preview: Credit balance for unit ${unitId}: $${currentCreditBalance}`);
    console.log(`🔍 [ROUTE] Received parameters: unitId=${unitId}, amount=${amount}, payOnDate=${payOnDate}, selectedMonth=${selectedMonth}`);
    
    // Calculate distribution with optional payment date for backdated payments
    const distribution = await waterPaymentsService.calculatePaymentDistribution(
      clientId,
      unitId,
      parseFloat(amount),
      currentCreditBalance,
      payOnDate, // Pass payment date for penalty recalculation
      selectedMonth // Pass selected month to filter bills
    );
    
    // Return distribution (all amounts already in pesos from service)
    res.json({
      success: true,
      data: distribution
    });
    
  } catch (error) {
    console.error('Error previewing payment distribution:', error);
    next(error);
  }
});

// POST /water/clients/:clientId/payments/record
router.post('/clients/:clientId/payments/record', enforceClientAccess, recordWaterPayment);

// GET /water/clients/:clientId/payments/history/:unitId
router.get('/clients/:clientId/payments/history/:unitId', enforceClientAccess, getWaterPaymentHistory);

// GET /water/clients/:clientId/bills/:year/:month - MUST BE AFTER unpaid route
router.get('/clients/:clientId/bills/:year/:month', enforceClientAccess, async (req, res) => {
  try {
    const { clientId, year, month } = req.params;
    const { unpaidOnly } = req.query;
    
    const bills = await waterBillsService.getBills(
      clientId,
      parseInt(year),
      parseInt(month),
      unpaidOnly === 'true'
    );
    
    res.json({
      success: true,
      data: bills
    });
  } catch (error) {
    console.error('Error fetching water bills:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= CONFIGURATION =============
// GET /water/clients/:clientId/config
router.get('/clients/:clientId/config', enforceClientAccess, getBillingConfig);

// ============= CACHE MANAGEMENT ============= 
// (Removed - no caching layer)

export default router;