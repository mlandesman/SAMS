// backend/routes/budgets.js
import express from 'express';
const router = express.Router();
import { authenticateUserWithProfile, enforceClientAccess } from '../middleware/clientAuth.js';
import { 
  listBudgetsByYear, 
  upsertBudget, 
  deleteBudget,
  getPriorYearData
} from '../controllers/budgetController.js';

// Apply authentication to ALL routes in this file
router.use(authenticateUserWithProfile);

// Get all budgets for a fiscal year
// GET /budgets/clients/:clientId/:year
router.get('/clients/:clientId/:year', enforceClientAccess, async (req, res) => {
  try {
    const clientId = req.authorizedClientId;
    const year = parseInt(req.params.year);
    
    console.log('📋 Budgets route - fetching for client:', clientId, 'year:', year);
    
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid year parameter'
      });
    }
    
    const budgets = await listBudgetsByYear(clientId, year, req.user);
    res.json({
      success: true,
      data: budgets,
      count: budgets.length
    });
  } catch (error) {
    console.error('❌ Error in budgets list route:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Upsert budget for a category/year
// PUT /budgets/clients/:clientId/categories/:categoryId/budget/:year
router.put('/clients/:clientId/categories/:categoryId/budget/:year', enforceClientAccess, async (req, res) => {
  try {
    const clientId = req.authorizedClientId;
    const categoryId = req.params.categoryId;
    const year = parseInt(req.params.year);
    const { amount, notes } = req.body;
    
    console.log('✏️ Budgets route - upserting budget for category:', categoryId, 'year:', year, 'amount:', amount, 'notes:', notes ? 'provided' : 'none');
    
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid year parameter'
      });
    }
    
    if (typeof amount !== 'number' || amount < 0 || !Number.isInteger(amount)) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a non-negative integer (centavos)'
      });
    }
    
    // Validate notes if provided (should be string or undefined/null)
    if (notes !== undefined && notes !== null && typeof notes !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Notes must be a string'
      });
    }
    
    const success = await upsertBudget(clientId, categoryId, year, amount, notes, req.user);
    
    if (success) {
      // Fetch the updated budget to return complete data
      const budgets = await listBudgetsByYear(clientId, year, req.user);
      const budget = budgets.find(b => b.categoryId === categoryId);
      
      res.json({
        success: true,
        data: budget || { categoryId, year, amount },
        message: 'Budget saved successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to save budget'
      });
    }
  } catch (error) {
    console.error('❌ Error in budget upsert route:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete budget entry
// DELETE /budgets/clients/:clientId/categories/:categoryId/budget/:year
router.delete('/clients/:clientId/categories/:categoryId/budget/:year', enforceClientAccess, async (req, res) => {
  try {
    const clientId = req.authorizedClientId;
    const categoryId = req.params.categoryId;
    const year = parseInt(req.params.year);
    
    console.log('🗑️ Budgets route - deleting budget for category:', categoryId, 'year:', year);
    
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid year parameter'
      });
    }
    
    const success = await deleteBudget(clientId, categoryId, year, req.user);
    
    if (success) {
      res.json({
        success: true,
        message: 'Budget deleted successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to delete budget'
      });
    }
  } catch (error) {
    console.error('❌ Error in budget deletion route:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get prior year budget and actual data for a category
// GET /budgets/clients/:clientId/categories/:categoryId/prior-year-data?year=2026
router.get('/clients/:clientId/categories/:categoryId/prior-year-data', enforceClientAccess, async (req, res) => {
  try {
    const clientId = req.authorizedClientId;
    const categoryId = req.params.categoryId;
    const year = parseInt(req.query.year);
    
    console.log('📋 Budgets route - fetching prior year data for category:', categoryId, 'current year:', year);
    
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid year parameter'
      });
    }
    
    const data = await getPriorYearData(clientId, categoryId, year, req.user);
    
    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('❌ Error in prior year data route:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;

