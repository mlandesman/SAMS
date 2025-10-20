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

// GET /water/clients/:clientId/bills/:year - Get all 12 months for a year
router.get('/clients/:clientId/bills/:year', enforceClientAccess, async (req, res) => {
  try {
    const { clientId, year } = req.params;
    
    console.log(`📖 Fetching all bills for ${clientId} year ${year}`);
    
    // Fetch all 12 months in parallel
    const months = Array.from({ length: 12 }, (_, i) => i);
    const billPromises = months.map(month =>
      waterBillsService.getBills(clientId, parseInt(year), month, false)
    );
    
    const billsArray = await Promise.all(billPromises);
    
    // Convert array to object keyed by month ID
    const bills = {};
    billsArray.forEach((monthBills, idx) => {
      if (monthBills && monthBills.bills) {
        const monthId = `${year}-${String(idx).padStart(2, '0')}`;
        bills[monthId] = monthBills;
      }
    });
    
    console.log(`✅ Fetched ${Object.keys(bills).length} months of bills`);
    
    res.json({
      success: true,
      data: bills
    });
  } catch (error) {
    console.error('Error fetching year bills:', error);
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