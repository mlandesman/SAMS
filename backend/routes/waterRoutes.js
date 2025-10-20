// routes/waterRoutes.js
// Clean domain-focused water routes that internally handle Firebase structure
import express from 'express';
import { authenticateUserWithProfile, enforceClientAccess } from '../middleware/clientAuth.js';
import { waterDataService } from '../services/waterDataService.js';
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
// GET /water/clients/:clientId/aggregatedData - TASK 2: Fast read from pre-calculated document
router.get('/clients/:clientId/aggregatedData', enforceClientAccess, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { year } = req.query;
    const fiscalYear = year ? parseInt(year) : null;
    
    console.log(`📊 [FAST_READ] Reading aggregatedData for ${clientId} FY${fiscalYear || 'current'}`);
    
    const { getDb } = await import('../firebase.js');
    const db = await getDb();
    
    const aggregatedDataRef = db
      .collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('bills').doc('aggregatedData');
    
    const doc = await aggregatedDataRef.get();
    
    if (!doc.exists) {
      // Fallback: Trigger calculation if aggregatedData doesn't exist
      console.log('⚠️ [FAST_READ] aggregatedData not found, triggering calculation...');
      const data = await waterDataService.getYearData(clientId, fiscalYear);
      
      // Convert from centavos to pesos for frontend compatibility
      const convertedData = convertAggregatedDataToPesos(data);
      
      return res.json({
        success: true,
        data: convertedData,
        source: 'calculated',
        metadata: {
          calculationTimestamp: Date.now(),
          note: 'Document created on this request'
        }
      });
    }
    
    const aggregatedData = doc.data();
    console.log(`✅ [FAST_READ] Read aggregatedData from Firestore (fast path)`);
    console.log(`   Fiscal Year: ${aggregatedData._metadata?.fiscalYear}`);
    console.log(`   Timestamp: ${aggregatedData._metadata?.calculationTimestamp}`);
    console.log(`   Months: ${aggregatedData.months?.length}`);
    
    // Convert from centavos to pesos for frontend compatibility
    const dataForFrontend = {
      year: aggregatedData.year,
      fiscalYear: aggregatedData.fiscalYear,
      months: aggregatedData.months,
      summary: aggregatedData.summary,
      carWashRate: aggregatedData.carWashRate,
      boatWashRate: aggregatedData.boatWashRate
    };
    const convertedData = convertAggregatedDataToPesos(dataForFrontend);
    
    res.json({
      success: true,
      data: convertedData,
      source: 'firestore',
      metadata: aggregatedData._metadata
    });
  } catch (error) {
    console.error('Error reading aggregatedData:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= CACHE VALIDATION (LIGHTWEIGHT) =============
// GET /water/clients/:clientId/lastUpdated - Get just the timestamp for cache validation
router.get('/clients/:clientId/lastUpdated', enforceClientAccess, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { year } = req.query;
    const fiscalYear = year ? parseInt(year) : null;
    
    console.log(`⏰ [CACHE_CHECK] Checking lastUpdated for ${clientId} FY${fiscalYear || 'current'}`);
    
    const { getDb } = await import('../firebase.js');
    const db = await getDb();
    
    // Read ONLY the specific timestamp fields (truly lightweight)
    const timestampRef = db
      .collection('clients').doc(clientId)
      .collection('projects').doc('waterBills');
    
    const doc = await timestampRef.get();
    
    if (!doc.exists) {
      console.log(`⚠️ [CACHE_CHECK] No timestamp found for ${clientId}`);
      return res.json({ 
        success: true,
        lastUpdated: null,
        fiscalYear: null,
        exists: false
      });
    }
    
    // Read only the specific aggregatedData timestamp fields
    const timestampData = doc.data();
    const lastUpdated = timestampData.aggregatedDataLastUpdated;
    const docFiscalYear = timestampData.aggregatedDataFiscalYear;
    const targetYear = fiscalYear || docFiscalYear;
    
    // Check if we have data for the requested year
    if (docFiscalYear !== targetYear) {
      console.log(`⚠️ [CACHE_CHECK] Timestamp for ${clientId} is FY${docFiscalYear}, but requested FY${targetYear}`);
      return res.json({ 
        success: true,
        lastUpdated: null,
        fiscalYear: docFiscalYear,
        exists: false
      });
    }
    
    console.log(`✅ [CACHE_CHECK] Lightweight timestamp check: ${lastUpdated}`);
    
    res.json({ 
      success: true,
      lastUpdated: lastUpdated,
      fiscalYear: docFiscalYear,
      exists: true
    });
    
  } catch (error) {
    console.error('❌ [CACHE_CHECK] Error checking lastUpdated:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to check last updated timestamp',
      details: error.message 
    });
  }
});

// GET /water/clients/:clientId/data/:year? - LEGACY: On-demand aggregation (kept for compatibility)
router.get('/clients/:clientId/data/:year?', enforceClientAccess, async (req, res) => {
  try {
    const { clientId, year } = req.params;
    const fiscalYear = year ? parseInt(year) : null;
    
    console.log(`📊 Fetching water data for ${clientId} FY${fiscalYear || 'current'}`);
    const data = await waterDataService.getYearData(clientId, fiscalYear);
    
    // DEBUG: Log Unit 203 data being sent to frontend
    if (data && data.months) {
      Object.keys(data.months).forEach(monthKey => {
        const monthData = data.months[monthKey];
        if (monthData.units && monthData.units['203']) {
          const unit203 = monthData.units['203'];
          console.log(`🐛 [WATER_API] Unit 203 data for ${monthKey}:`, {
            status: unit203.status,
            transactionId: unit203.transactionId,
            hasPayments: unit203.payments?.length > 0,
            payments: unit203.payments
          });
        }
      });
    }
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching water data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

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
// POST /water/clients/:clientId/cache/clear
router.post('/clients/:clientId/cache/clear', enforceClientAccess, async (req, res) => {
  try {
    const { clientId } = req.params;
    waterDataService.invalidate(clientId);
    
    res.json({
      success: true,
      message: `Cache cleared for client ${clientId}`
    });
  } catch (error) {
    console.error('Error clearing water cache:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /water/clients/:clientId/cache/clear-all
router.post('/clients/:clientId/cache/clear-all', enforceClientAccess, async (req, res) => {
  try {
    waterDataService.clearCache();
    
    res.json({
      success: true,
      message: 'All water cache cleared'
    });
  } catch (error) {
    console.error('Error clearing all water cache:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /water/clients/:clientId/aggregatedData/clear - Clear aggregatedData document and timestamp to force rebuild
router.post('/clients/:clientId/aggregatedData/clear', enforceClientAccess, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { year, rebuild } = req.query;
    const fiscalYear = year ? parseInt(year) : null;
    
    console.log(`🗑️ [CLEAR_AGGREGATED] Clearing aggregatedData for ${clientId} FY${fiscalYear || 'current'}`);
    
    const { getDb } = await import('../firebase.js');
    const db = await getDb();
    
    // Delete the aggregatedData document
    const aggregatedDataRef = db
      .collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('bills').doc('aggregatedData');
    
    await aggregatedDataRef.delete();
    console.log(`✅ [CLEAR_AGGREGATED] Deleted aggregatedData document`);
    
    // Clear the timestamp to invalidate cache
    const timestampRef = db
      .collection('clients').doc(clientId)
      .collection('projects').doc('waterBills');
    
    await timestampRef.update({
      aggregatedDataLastUpdated: null,
      aggregatedDataFiscalYear: null
    });
    console.log(`✅ [CLEAR_TIMESTAMP] Cleared aggregatedDataLastUpdated timestamp`);
    
    // If rebuild flag is set, trigger immediate rebuild
    let rebuiltData = null;
    if (rebuild === 'true') {
      console.log(`🔄 [REBUILD] Triggering immediate rebuild for ${clientId} FY${fiscalYear}`);
      rebuiltData = await waterDataService.getYearData(clientId, fiscalYear);
      console.log(`✅ [REBUILD] Data rebuilt successfully with ${rebuiltData.months.length} months`);
    }
    
    res.json({
      success: true,
      message: `AggregatedData and timestamp cleared for ${clientId}${fiscalYear ? ` FY${fiscalYear}` : ''}${rebuild === 'true' ? ' and rebuilt' : ''}`,
      fiscalYear: fiscalYear,
      rebuilt: rebuild === 'true',
      timestamp: rebuiltData?._metadata?.calculationTimestamp || null
    });
  } catch (error) {
    console.error('Error clearing aggregatedData:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;