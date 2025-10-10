// routes/waterRoutes.js
// Clean domain-focused water routes that internally handle Firebase structure
import express from 'express';
import { authenticateUserWithProfile, enforceClientAccess } from '../middleware/clientAuth.js';
import { waterDataService } from '../services/waterDataService.js';
import waterBillsService from '../services/waterBillsService.js';
import waterReadingsService from '../services/waterReadingsService.js';
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
// GET /water/clients/:clientId/data/:year?
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

export default router;