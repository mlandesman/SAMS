// src/routes/hoaDues.js
import express from 'express';
import { 
  recordDuesPayment, 
  getUnitDuesData, 
  getAllDuesDataForYear, 
  updateCreditBalance,
  getCreditBalanceForModule,
  updateCreditBalanceFromModule,
  previewHOAPayment
} from '../controllers/hoaDuesController.js';
import { checkFirestoreConnection, getDb } from '../firebase.js';
import { hasUnitAccess } from '../middleware/unitAuthorization.js';
import { getNow, parseDate } from '../../shared/services/DateService.js';
import { centavosToPesos, pesosToCentavos } from '../../shared/utils/currencyUtils.js';
import { getFiscalYear } from '../utils/fiscalYearUtils.js';

const router = express.Router();

// ============================================================================
// TASK 4.2: CONVERSION HELPER FUNCTIONS (Pesos ↔ Centavos)
// ============================================================================
// Pattern copied from Water Bills (waterRoutes.js) for consistency

/**
 * Convert HOA Dues year data from centavos (backend storage) to pesos (frontend display)
 * Handles full year structure with all units and their payment arrays
 * 
 * @param {object} yearData - Year data object with unit dues
 * @returns {object} Converted data with all amounts in pesos
 */
function convertHOAYearDataToPesos(yearData) {
  if (!yearData || typeof yearData !== 'object') return yearData;
  
  const currencyFields = [
    'creditBalance', 'scheduledAmount', 'totalDue', 'totalPaid', 
    'amount', 'penalty', 'penaltyPaid', 'totalPenalty',
    'balanceBefore', 'balanceAfter'
  ];
  
  // Convert each unit's dues data
  const convertedUnits = {};
  for (const [unitId, unitData] of Object.entries(yearData)) {
    if (!unitData || typeof unitData !== 'object') {
      convertedUnits[unitId] = unitData;
      continue;
    }
    
    convertedUnits[unitId] = { ...unitData };
    
    // Convert top-level currency fields
    for (const field of currencyFields) {
      if (typeof unitData[field] === 'number') {
        convertedUnits[unitId][field] = centavosToPesos(unitData[field]);
      }
    }
    
    // Convert payments array (monthly dues)
    if (unitData.payments && Array.isArray(unitData.payments)) {
      convertedUnits[unitId].payments = unitData.payments.map(payment => {
        if (!payment || typeof payment !== 'object') return payment;
        
        const convertedPayment = { ...payment };
        for (const field of currencyFields) {
          if (typeof payment[field] === 'number') {
            convertedPayment[field] = centavosToPesos(payment[field]);
          }
        }
        return convertedPayment;
      });
    }
    
    // Convert credit balance history
    if (unitData.creditBalanceHistory && Array.isArray(unitData.creditBalanceHistory)) {
      convertedUnits[unitId].creditBalanceHistory = unitData.creditBalanceHistory.map(entry => {
        if (!entry || typeof entry !== 'object') return entry;
        
        const convertedEntry = { ...entry };
        for (const field of currencyFields) {
          if (typeof entry[field] === 'number') {
            convertedEntry[field] = centavosToPesos(entry[field]);
          }
        }
        return convertedEntry;
      });
    }
  }
  
  return convertedUnits;
}

/**
 * Convert payment request from pesos (frontend) to centavos (backend processing)
 * 
 * @param {object} paymentData - Payment data from frontend
 * @returns {object} Payment data with amounts in centavos
 */
function convertPaymentRequestToCentavos(paymentData) {
  if (!paymentData || typeof paymentData !== 'object') return paymentData;
  
  const converted = { ...paymentData };
  
  // Convert payment amount fields
  const amountFields = ['amount', 'creditUsed', 'creditBalanceAdded', 'newCreditBalance', 'creditRepairAmount'];
  for (const field of amountFields) {
    if (typeof paymentData[field] === 'number') {
      converted[field] = pesosToCentavos(paymentData[field]);
    }
  }
  
  // Convert distribution array amounts
  if (paymentData.distribution && Array.isArray(paymentData.distribution)) {
    converted.distribution = paymentData.distribution.map(item => {
      if (!item || typeof item !== 'object') return item;
      
      const convertedItem = { ...item };
      if (typeof item.amountToAdd === 'number') {
        convertedItem.amountToAdd = pesosToCentavos(item.amountToAdd);
      }
      if (typeof item.newAmount === 'number') {
        convertedItem.newAmount = pesosToCentavos(item.newAmount);
      }
      return convertedItem;
    });
  }
  
  return converted;
}

/**
 * Convert payment response from centavos (backend) to pesos (frontend)
 * 
 * @param {object} response - Payment response from controller
 * @returns {object} Response with amounts in pesos
 */
function convertPaymentResponseToPesos(response) {
  if (!response || typeof response !== 'object') return response;
  
  const converted = { ...response };
  
  // Convert preview/response fields
  const amountFields = [
    'paymentAmount', 'currentCreditBalance', 'newCreditBalance',
    'creditUsed', 'overpayment', 'totalBaseCharges', 
    'totalPenalties', 'totalApplied'
  ];
  
  for (const field of amountFields) {
    if (typeof response[field] === 'number') {
      converted[field] = centavosToPesos(response[field]);
    }
  }
  
  // Convert monthsAffected array
  if (response.monthsAffected && Array.isArray(response.monthsAffected)) {
    converted.monthsAffected = response.monthsAffected.map(month => ({
      ...month,
      basePaid: typeof month.basePaid === 'number' ? centavosToPesos(month.basePaid) : month.basePaid,
      penaltyPaid: typeof month.penaltyPaid === 'number' ? centavosToPesos(month.penaltyPaid) : month.penaltyPaid,
      totalPaid: typeof month.totalPaid === 'number' ? centavosToPesos(month.totalPaid) : month.totalPaid
    }));
  }
  
  // Convert duesData if present (from recordPayment)
  if (response.duesData && typeof response.duesData === 'object') {
    converted.duesData = convertHOAYearDataToPesos({ unit: response.duesData }).unit;
  }
  
  return converted;
}

/**
 * Debug endpoint to check Firestore connection and test writing to a specific path
 * GET /hoadues/:clientId/debug/connection
 */
router.get('/:clientId/debug/connection', async (req, res) => {
  try {
    // Access clientId from path parameters (domain-specific mounting)
    const { clientId } = req.params;
    
    // First check general Firestore connection
    const connectionStatus = await checkFirestoreConnection();
    
    // Now attempt to write to the specific client path
    let clientWriteResult = { success: false };
    let duesReadResult = { success: false };
    
    if (connectionStatus.connected && clientId) {
      try {
        // Get database instance
        const db = await getDb();
        
        // Try to write to the client path (using valid collection name)
        const testRef = db.collection('clients').doc(clientId).collection('connection_tests').doc('test');
        await testRef.set({ 
          timestamp: getNow(),
          message: 'Connection test'
        });
        
        // Verify the write
        const docCheck = await testRef.get();
        clientWriteResult = {
          success: true,
          exists: docCheck.exists,
          path: `clients/${clientId}/connection_tests/test`
        };
        
        // Try to read an existing dues document if available
        const unitsSnapshot = await db.collection('clients').doc(clientId).collection('units').limit(1).get();
        if (!unitsSnapshot.empty) {
          const unitDoc = unitsSnapshot.docs[0];
          const unitId = unitDoc.id;
          
          // Try to access the dues collection
          const duesQuery = await db.collection('clients').doc(clientId)
                                   .collection('units').doc(unitId)
                                   .collection('dues').limit(1).get();
          
          duesReadResult = {
            success: true,
            unitId: unitId,
            hasDuesDocuments: !duesQuery.empty,
            documentsCount: duesQuery.size,
            firstDocPath: duesQuery.empty ? null : duesQuery.docs[0].ref.path
          };
        }
      } catch (clientPathError) {
        clientWriteResult = {
          success: false,
          error: clientPathError.message
        };
      }
    }
    
    res.json({
      connectionStatus,
      clientWriteResult,
      duesReadResult,
      clientId
    });
  } catch (error) {
    console.error('Error checking connection:', error);
    res.status(500).json({ 
      error: 'Failed to check connection', 
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

// ============================================================================
// TASK 4.2: API ENDPOINTS WITH CONVERSION LAYER
// ============================================================================

/**
 * A. Get all dues data for a specific year (domain-specific endpoint)
 * GET /hoadues/:clientId/year/:year
 * 
 * Returns: All units' HOA dues data for specified year in PESOS (frontend-ready)
 * Backend Storage: CENTAVOS (integer) - converted by getAllDuesDataForYear
 */
router.get('/:clientId/year/:year', async (req, res) => {
  try {
    // Access clientId from path parameters (domain-specific mounting)
    const { clientId, year } = req.params;
    
    if (!clientId) {
      return res.status(400).json({ error: 'Missing clientId parameter' });
    }
    
    console.log(`Fetching all dues data for client ${clientId} year ${year}`);
    const duesData = await getAllDuesDataForYear(clientId, parseInt(year));
    // Note: getAllDuesDataForYear already converts to pesos (see controller line 1248-1276)
    res.json(duesData);
  } catch (error) {
    console.error('Error fetching dues data:', error);
    res.status(500).json({ error: 'Failed to fetch dues data' });
  }
});

/**
 * B. Preview HOA payment distribution (Task 4.2)
 * POST /hoadues/:clientId/payment/preview
 * 
 * Input: { unitId, paymentAmount (pesos), year, payOnDate (optional) }
 * Returns: Payment distribution preview in PESOS (frontend-ready)
 * 
 * Uses previewHOAPayment() from Task 4.1
 */
router.post('/:clientId/payment/preview', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { unitId, paymentAmount, year, payOnDate } = req.body;
    
    // Validate required fields
    if (!clientId) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing clientId parameter' 
      });
    }
    if (!unitId) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing unitId in request body' 
      });
    }
    if (!year) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing year in request body' 
      });
    }
    if (paymentAmount === undefined || paymentAmount < 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing or invalid paymentAmount in request body' 
      });
    }
    
    // Check unit access authorization
    const user = req.user;
    if (!user) {
      console.error('No user object found in request. Authentication middleware may not be working.');
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required' 
      });
    }
    
    if (typeof user.getPropertyAccess !== 'function') {
      console.error('User object missing getPropertyAccess method:', user);
      return res.status(500).json({ 
        success: false,
        error: 'User authentication error' 
      });
    }
    
    const propertyAccess = user.getPropertyAccess(clientId);
    if (!propertyAccess) {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied to this property' 
      });
    }
    
    if (!hasUnitAccess(propertyAccess, unitId, user.samsProfile?.globalRole)) {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied to this unit',
        unitId: unitId
      });
    }
    
    console.log(`🔮 [HOA PREVIEW API] ${clientId}/${unitId}/${year}, Amount: $${paymentAmount}`);
    
    // Call Task 4.1's previewHOAPayment function (expects pesos, returns pesos)
    const preview = await previewHOAPayment(
      clientId, 
      unitId, 
      parseInt(year), 
      parseFloat(paymentAmount),
      payOnDate ? parseDate(payOnDate) : null
    );
    
    // previewHOAPayment already returns amounts in pesos (see controller line 1559-1695)
    // No conversion needed - pass through directly
    
    res.json({
      success: true,
      data: preview
    });
    
  } catch (error) {
    console.error('Error previewing HOA payment:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to preview payment',
      message: error.message
    });
  }
});

/**
 * C. Record HOA payment (Task 4.2)
 * POST /hoadues/:clientId/payment/record
 * 
 * Input: { unitId, year, paymentData (pesos), distribution }
 * Returns: Payment result in PESOS (frontend-ready)
 * 
 * Note: This wraps the existing payment endpoint at /:clientId/payment/:unitId/:year
 * for consistent API pattern matching Task 4.2 specification
 */
router.post('/:clientId/payment/record', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { unitId, year, paymentData, distribution } = req.body;
    
    // Validate required fields
    if (!clientId) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing clientId parameter' 
      });
    }
    if (!unitId) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing unitId in request body' 
      });
    }
    if (!year) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing year in request body' 
      });
    }
    if (!paymentData) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing paymentData in request body' 
      });
    }
    if (!paymentData.amount && paymentData.amount !== 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing amount in paymentData' 
      });
    }
    if (!paymentData.date) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing date in paymentData' 
      });
    }
    
    // Check unit access authorization
    const user = req.user;
    if (!user) {
      console.error('No user object found in request. Authentication middleware may not be working.');
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required' 
      });
    }
    
    if (typeof user.getPropertyAccess !== 'function') {
      console.error('User object missing getPropertyAccess method:', user);
      return res.status(500).json({ 
        success: false,
        error: 'User authentication error' 
      });
    }
    
    const propertyAccess = user.getPropertyAccess(clientId);
    if (!propertyAccess) {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied to this property' 
      });
    }
    
    if (!hasUnitAccess(propertyAccess, unitId, user.samsProfile?.globalRole)) {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied to this unit',
        unitId: unitId
      });
    }
    
    console.log(`💰 [HOA RECORD API] ${clientId}/${unitId}/${year}, Amount: $${paymentData.amount}`);
    
    // Call existing recordDuesPayment (expects and stores centavos internally)
    // Frontend sends pesos, backend converts and stores as centavos
    const result = await recordDuesPayment(
      clientId, 
      unitId, 
      parseInt(year), 
      paymentData,  // Controller handles conversion internally
      distribution  // Controller handles conversion internally
    );
    
    res.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('Error recording HOA payment:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to record payment',
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

/**
 * Get dues data for a specific unit and year
 * GET /hoadues/:clientId/unit/:unitId/:year
 */
router.get('/:clientId/unit/:unitId/:year', async (req, res) => {
  try {
    // Access clientId from path parameters (domain-specific mounting)
    const { clientId, unitId, year } = req.params;
    
    if (!clientId) {
      return res.status(400).json({ error: 'Missing clientId parameter' });
    }
    
    // Check unit access authorization
    const user = req.user;
    if (!user) {
      console.error('No user object found in request. Authentication middleware may not be working.');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (typeof user.getPropertyAccess !== 'function') {
      console.error('User object missing getPropertyAccess method:', user);
      return res.status(500).json({ error: 'User authentication error' });
    }
    
    const propertyAccess = user.getPropertyAccess(clientId);
    if (!propertyAccess) {
      return res.status(403).json({ error: 'Access denied to this property' });
    }
    
    if (!hasUnitAccess(propertyAccess, unitId, user.samsProfile?.globalRole)) {
      return res.status(403).json({ 
        error: 'Access denied to this unit',
        unitId: unitId
      });
    }
    
    const duesData = await getUnitDuesData(clientId, unitId, parseInt(year));
    
    if (duesData) {
      res.json(duesData);
    } else {
      res.status(404).json({ error: 'Dues data not found for this unit/year' });
    }
  } catch (error) {
    console.error('Error fetching unit dues data:', error);
    res.status(500).json({ error: 'Failed to fetch unit dues data' });
  }
});

/**
 * Record a dues payment
 * POST /hoadues/:clientId/payment/:unitId/:year
 */
router.post('/:clientId/payment/:unitId/:year', async (req, res) => {
  try {
    // Access clientId from path parameters (domain-specific mounting)
    const { clientId, unitId, year } = req.params;
    const { paymentData, distribution } = req.body;
    
    // Debug logging for production issue
    console.log('HOA Payment Route - clientId resolution:', {
      clientId,
      originalParams: req.originalParams,
      params: req.params,
      url: req.originalUrl
    });
    
    // Check unit access authorization
    const user = req.user;
    if (!user) {
      console.error('No user object found in request. Authentication middleware may not be working.');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (typeof user.getPropertyAccess !== 'function') {
      console.error('User object missing getPropertyAccess method:', user);
      return res.status(500).json({ error: 'User authentication error' });
    }
    
    const propertyAccess = user.getPropertyAccess(clientId);
    if (!propertyAccess) {
      console.error('Property access denied for payment:', {
        clientId,
        userEmail: user.email,
        globalRole: user.samsProfile?.globalRole,
        authorizedClients: user.samsProfile?.authorizedClients || []
      });
      return res.status(403).json({ error: 'Access denied to this property' });
    }
    
    if (!hasUnitAccess(propertyAccess, unitId, user.samsProfile?.globalRole)) {
      return res.status(403).json({ 
        error: 'Access denied to this unit',
        unitId: unitId
      });
    }
    
    // Debug logs to verify parameters
    console.log('Route params received:', req.params);
    console.log('Original params:', req.originalParams);
    console.log('Client ID used:', clientId);
    
    console.log('Backend received payment request:', {
      clientId,
      unitId,
      year,
      paymentData: {
        ...paymentData,
        date: paymentData.date, // Log the date as received
        dateType: typeof paymentData.date,
        amount: paymentData.amount,
        amountType: typeof paymentData.amount
      },
      distribution
    });
    
    // Validate required fields before calling the controller
    if (!clientId) {
      return res.status(400).json({ error: 'Missing clientId parameter' });
    }
    if (!unitId) {
      return res.status(400).json({ error: 'Missing unitId parameter' });
    }
    if (!year) {
      return res.status(400).json({ error: 'Missing year parameter' });
    }
    if (!paymentData) {
      return res.status(400).json({ error: 'Missing paymentData in request body' });
    }
    if (!paymentData.amount) {
      return res.status(400).json({ error: 'Missing amount in paymentData' });
    }
    if (!paymentData.date) {
      return res.status(400).json({ error: 'Missing date in paymentData' });
    }
    
    try {
      // Parse and validate date to ensure it's a valid value
      const testDate = parseDate(paymentData.date);
      if (isNaN(testDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format in paymentData' });
      }
    } catch (dateError) {
      return res.status(400).json({ error: `Invalid date: ${dateError.message}` });
    }
    
    // Log distribution data in route handler
    console.log('Distribution data received by route handler:', JSON.stringify(distribution));
    
    // Ensure distribution is an array
    if (!Array.isArray(distribution)) {
      console.error('❌ Distribution is not an array:', distribution);
      distribution = [];
    }
    
    // Handle empty distribution for credit-only payments
    if (distribution.length === 0) {
      console.log('Empty distribution array - this may be a credit-only payment');
      // We'll still continue with the API call - the controller will handle this case
    }
    
    // Validate the distribution array structure
    if (distribution.length > 0) {
      console.log('Sample distribution item:', JSON.stringify(distribution[0]));
      
      // Ensure each item in the distribution has the required fields
      const validDistribution = distribution.filter(item => {
        if (!item || typeof item !== 'object') {
          console.error('❌ Invalid distribution item (not an object):', item);
          return false;
        }
        
        if (!('month' in item)) {
          console.error('❌ Distribution item missing month field:', item);
          return false;
        }
        
        // At minimum, one of these fields must be present
        const hasAmountField = 'amountToAdd' in item || 'newAmount' in item || 'existingAmount' in item;
        if (!hasAmountField) {
          console.error('❌ Distribution item missing amount fields:', item);
          return false;
        }
        
        return true;
      });
      
      if (validDistribution.length !== distribution.length) {
        console.warn(`⚠️ Filtered out ${distribution.length - validDistribution.length} invalid distribution items`);
        distribution = validDistribution;
      }
    }
    
    console.log('Calling recordDuesPayment with params:', {
      clientId, 
      unitId, 
      year: parseInt(year), 
      paymentDataSummary: {
        amount: paymentData.amount,
        date: paymentData.date,
        method: paymentData.method
      }, 
      distributionCount: distribution.length
    });
    
    const result = await recordDuesPayment(
      clientId, 
      unitId, 
      parseInt(year), 
      paymentData, 
      distribution
    );
    
    console.log('recordDuesPayment result:', JSON.stringify(result));
    
    res.json(result);
  } catch (error) {
    console.error('Error recording dues payment:', error);
    // Send back more detailed error message
    res.status(500).json({ 
      error: 'Failed to record dues payment', 
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

/**
 * Update credit balance for a unit
 * PUT /hoadues/:clientId/credit/:unitId/:year
 */
router.put('/:clientId/credit/:unitId/:year', async (req, res) => {
  try {
    // Access clientId from path parameters (domain-specific mounting)
    const { clientId, unitId, year } = req.params;
    const { creditBalance, notes, entryDate } = req.body;
    
    if (!clientId) {
      return res.status(400).json({ error: 'Missing clientId parameter' });
    }
    
    // Check unit access authorization
    const user = req.user;
    if (!user) {
      console.error('No user object found in request. Authentication middleware may not be working.');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (typeof user.getPropertyAccess !== 'function') {
      console.error('User object missing getPropertyAccess method:', user);
      return res.status(500).json({ error: 'User authentication error' });
    }
    
    const propertyAccess = user.getPropertyAccess(clientId);
    if (!propertyAccess) {
      return res.status(403).json({ error: 'Access denied to this property' });
    }
    
    if (!hasUnitAccess(propertyAccess, unitId, user.samsProfile?.globalRole)) {
      return res.status(403).json({ 
        error: 'Access denied to this unit',
        unitId: unitId
      });
    }
    
    // Parse year, with fallback to fiscal year if invalid
    const yearNum = parseInt(year);
    let validYear;
    
    if (isNaN(yearNum)) {
      // Get client configuration to determine fiscal year
      const db = await getDb();
      const clientDoc = await db.collection('clients').doc(clientId).get();
      const clientConfig = clientDoc.exists ? clientDoc.data() : {};
      const fiscalYearStartMonth = clientConfig?.configuration?.fiscalYearStartMonth || 1;
      
      // Calculate current fiscal year
      validYear = getFiscalYear(getNow(), fiscalYearStartMonth);
      console.log(`[CREDIT] Year was NaN, using fiscal year ${validYear} (start month: ${fiscalYearStartMonth})`);
    } else {
      validYear = yearNum;
    }
    
    const result = await updateCreditBalance(
      clientId, 
      unitId, 
      validYear, 
      parseFloat(creditBalance),
      notes,
      entryDate // Pass entryDate if provided
    );
    
    res.json({ success: result });
  } catch (error) {
    console.error('Error updating credit balance:', error);
    res.status(500).json({ error: 'Failed to update credit balance', message: error.message });
  }
});

// Cross-module credit balance endpoints - ADD AFTER EXISTING ROUTES
/**
 * Get credit balance for any module (Water Bills, Special Billings, etc.)
 * GET /api/hoa/:clientId/units/:unitId/credit-balance/:year
 */
router.get('/:clientId/units/:unitId/credit-balance/:year', getCreditBalanceForModule);

/**
 * Update credit balance from any module (Water Bills, Special Billings, etc.)  
 * PUT /api/hoa/:clientId/units/:unitId/credit-balance/:year
 */
router.put('/:clientId/units/:unitId/credit-balance/:year', updateCreditBalanceFromModule);

export default router;
