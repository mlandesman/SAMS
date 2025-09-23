// src/routes/hoaDues.js
import express from 'express';
import { 
  recordDuesPayment, 
  getUnitDuesData, 
  getAllDuesDataForYear, 
  updateCreditBalance,
  getCreditBalanceForModule,
  updateCreditBalanceFromModule
} from '../controllers/hoaDuesController.js';
import { checkFirestoreConnection, getDb } from '../firebase.js';
import { hasUnitAccess } from '../middleware/unitAuthorization.js';

const router = express.Router();

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
          timestamp: new Date(),
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

// Removed redundant /:year route to avoid conflicts with /:clientId/year/:year
// All year-based queries should use the specific /:clientId/year/:year pattern

/**
 * Get all dues data for a specific year (domain-specific endpoint)
 * GET /hoadues/:clientId/year/:year
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
    res.json(duesData);
  } catch (error) {
    console.error('Error fetching dues data:', error);
    res.status(500).json({ error: 'Failed to fetch dues data' });
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
      const testDate = new Date(paymentData.date);
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
    const { creditBalance, notes } = req.body;
    
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
    
    const result = await updateCreditBalance(
      clientId, 
      unitId, 
      parseInt(year), 
      parseFloat(creditBalance),
      notes
    );
    
    res.json({ success: result });
  } catch (error) {
    console.error('Error updating credit balance:', error);
    res.status(500).json({ error: 'Failed to update credit balance' });
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
