// backend/routes/paymentMethods.js
import express from 'express';
const router = express.Router();
import { authenticateUserWithProfile } from '../middleware/clientAuth.js';
import { 
  listPaymentMethods, 
  createPaymentMethod, 
  updatePaymentMethod, 
  deletePaymentMethod 
} from '../controllers/paymentMethodsController.js';

// Apply authentication to ALL routes in this file
router.use(authenticateUserWithProfile);

// List all payment methods for a client
router.get('/', async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    console.log('💳 Payment methods route - fetching for client:', clientId);
    
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'Client ID is required'
      });
    }

    const paymentMethods = await listPaymentMethods(clientId);
    res.json({
      success: true,
      data: paymentMethods,
      count: paymentMethods.length
    });
  } catch (error) {
    console.error('❌ Error in payment methods list route:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create a new payment method
router.post('/', async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    console.log('💳 Payment methods route - creating for client:', clientId);
    
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'Client ID is required'
      });
    }

    if (!req.body.name) {
      return res.status(400).json({
        success: false,
        error: 'Payment method name is required'
      });
    }

    // Use the entire request body, with defaults for missing fields
    const paymentMethodData = {
      type: 'bank',
      currency: 'US Dollars',
      details: '',
      status: 'active',
      ...req.body // This will override defaults with actual values from the form
    };

    const methodId = await createPaymentMethod(clientId, paymentMethodData);

    if (methodId) {
      res.json({
        success: true,
        data: { id: methodId },
        message: 'Payment method created successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to create payment method'
      });
    }
  } catch (error) {
    console.error('❌ Error in payment methods create route:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update an existing payment method
router.put('/:methodId', async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    const { methodId } = req.params;
    console.log('💳 Payment methods route - updating method:', methodId, 'for client:', clientId);
    
    if (!clientId || !methodId) {
      return res.status(400).json({
        success: false,
        error: 'Client ID and method ID are required'
      });
    }

    const success = await updatePaymentMethod(clientId, methodId, req.body);

    if (success) {
      // Fetch the updated payment method to return complete data
      const updatedMethods = await listPaymentMethods(clientId);
      const method = updatedMethods.find(m => m.id === methodId);
      
      res.json({
        success: true,
        data: method || { id: methodId, ...req.body },
        message: 'Payment method updated successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to update payment method'
      });
    }
  } catch (error) {
    console.error('❌ Error in payment methods update route:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete a payment method
router.delete('/:methodId', async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    const { methodId } = req.params;
    console.log('💳 Payment methods route - deleting method:', methodId, 'for client:', clientId);
    
    if (!clientId || !methodId) {
      return res.status(400).json({
        success: false,
        error: 'Client ID and method ID are required'
      });
    }

    const success = await deletePaymentMethod(clientId, methodId);

    if (success) {
      res.json({
        success: true,
        message: 'Payment method deleted successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to delete payment method'
      });
    }
  } catch (error) {
    console.error('❌ Error in payment methods delete route:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
