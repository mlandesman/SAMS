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
 * Convert year data from centavos to pesos for frontend display
 * This handles the full year structure with months array and summary
 */
function convertYearDataToPesos(data) {
  if (!data || !data.months) return data;
  
  const currencyFields = [
    'waterCharge', 'carWashCharge', 'boatWashCharge',
    'currentCharge', 'penaltyAmount', 'totalAmount',
    'paidAmount', 'penaltyPaid', 'basePaid', 'previousBalance',
    'billAmount', 'unpaidAmount', 'displayDue', 'displayPenalties', 
    'displayOverdue', 'displayTotalDue', 'displayTotalPenalties'
  ];
  
  // Convert each month
  const convertedMonths = data.months.map(month => {
    if (!month || !month.units) return month;
    
    const convertedUnits = {};
    for (const [unitId, unitData] of Object.entries(month.units)) {
      convertedUnits[unitId] = { ...unitData };
      
      // Convert currency fields
      for (const field of currencyFields) {
        if (typeof unitData[field] === 'number') {
          convertedUnits[unitId][field] = centavosToPesos(unitData[field]);
        }
      }
      
      // Convert payments array
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
  
  // Convert summary
  const convertedSummary = data.summary ? {
    ...data.summary,
    totalConsumption: data.summary.totalConsumption,
    totalBilled: typeof data.summary.totalBilled === 'number' ? centavosToPesos(data.summary.totalBilled) : data.summary.totalBilled,
    totalPaid: typeof data.summary.totalPaid === 'number' ? centavosToPesos(data.summary.totalPaid) : data.summary.totalPaid,
    totalUnpaid: typeof data.summary.totalUnpaid === 'number' ? centavosToPesos(data.summary.totalUnpaid) : data.summary.totalUnpaid,
    overdueDetails: data.summary.overdueDetails?.map(detail => ({
      ...detail,
      amountDue: typeof detail.amountDue === 'number' ? centavosToPesos(detail.amountDue) : detail.amountDue
    }))
  } : undefined;
  
  // Convert wash rates
  const carWashRate = typeof data.carWashRate === 'number' ? centavosToPesos(data.carWashRate) : data.carWashRate;
  const boatWashRate = typeof data.boatWashRate === 'number' ? centavosToPesos(data.boatWashRate) : data.boatWashRate;
  
  return {
    ...data,
    months: convertedMonths,
    summary: convertedSummary,
    carWashRate,
    boatWashRate
  };
}

// ============= DATA AGGREGATION ============= 
// AggregatedData endpoints removed - using direct bill document reads instead


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

// GET /water/clients/:clientId/bills/:year - Get all 12 months with calculations
router.get('/clients/:clientId/bills/:year', enforceClientAccess, async (req, res) => {
  try {
    const { clientId, year } = req.params;
    
    console.log(`📖 Building calculated year data for ${clientId} year ${year}`);
    
    // Import waterDataService to use calculation methods
    const { waterDataService } = await import('../services/waterDataService.js');
    
    // Build year data with all calculations (same as aggregatedData had)
    // This calls buildSingleMonthData() for each month and calculateYearSummary()
    const calculatedData = await waterDataService.buildYearDataForDisplay(clientId, parseInt(year));
    
    // Convert from centavos to pesos for frontend
    const convertedData = convertYearDataToPesos(calculatedData);
    
    console.log(`✅ Built and converted year data: ${calculatedData.months.length} months`);
    
    res.json({
      success: true,
      data: convertedData
    });
  } catch (error) {
    console.error('Error building year data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= CONFIGURATION =============
// GET /water/clients/:clientId/config
router.get('/clients/:clientId/config', enforceClientAccess, getBillingConfig);

export default router;