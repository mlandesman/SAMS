// backend/routes/accounts.js
import express from 'express';
const router = express.Router();
import { authenticateUserWithProfile } from '../middleware/clientAuth.js';
import { 
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  updateAccountBalance,
  setAccountBalance,
  createYearEndSnapshot,
  getYearEndSnapshot,
  listYearEndSnapshots,
  rebuildBalances,
  getAccountsForReconciliation,
  createReconciliationAdjustments
} from '../controllers/accountsController.js';

// Apply authentication to ALL routes in this file
router.use(authenticateUserWithProfile);

/**
 * Get all accounts for a client
 * GET /api/clients/:clientId/accounts
 */
router.get('/', async (req, res) => {
  try {
    const clientId = req.params.clientId || req.originalParams?.clientId;
    
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID not provided' });
    }
    
    const accounts = await getAccounts(clientId);
    res.json(accounts);
  } catch (error) {
    console.error('Error in accounts route:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

/**
 * Create a new account
 * POST /api/clients/:clientId/accounts
 */
router.post('/', async (req, res) => {
  try {
    const clientId = req.params.clientId || req.originalParams?.clientId;
    
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID not provided' });
    }
    
    const account = await createAccount(clientId, req.body);
    res.status(201).json(account);
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(error.message.includes('already exists') ? 409 : 500)
      .json({ error: error.message || 'Server error' });
  }
});

/**
 * Update an account
 * PUT /api/clients/:clientId/accounts/:accountName
 */
router.put('/:accountName', async (req, res) => {
  try {
    const clientId = req.params.clientId || req.originalParams?.clientId;
    const { accountName } = req.params;
    
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID not provided' });
    }
    
    const account = await updateAccount(clientId, accountName, req.body);
    res.json(account);
  } catch (error) {
    console.error('Error updating account:', error);
    res.status(error.message.includes('not found') ? 404 : 500)
      .json({ error: error.message || 'Server error' });
  }
});

/**
 * Delete an account
 * DELETE /api/clients/:clientId/accounts/:accountName
 */
router.delete('/:accountName', async (req, res) => {
  try {
    const clientId = req.params.clientId || req.originalParams?.clientId;
    const { accountName } = req.params;
    const { transferToAccount } = req.body; // Optional account to transfer balance to
    
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID not provided' });
    }
    
    await deleteAccount(clientId, accountName, transferToAccount);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    
    if (error.message.includes('non-zero balance')) {
      return res.status(400).json({ 
        error: error.message,
        requiresTransfer: true
      });
    }
    
    res.status(error.message.includes('not found') ? 404 : 500)
      .json({ error: error.message || 'Server error' });
  }
});

/**
 * Update account balance (add/subtract amount)
 * PATCH /api/clients/:clientId/accounts/:accountName/balance
 */
router.patch('/:accountName/balance', async (req, res) => {
  try {
    const clientId = req.params.clientId || req.originalParams?.clientId;
    const { accountName } = req.params;
    const { amount } = req.body;
    
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID not provided' });
    }
    
    if (typeof amount !== 'number') {
      return res.status(400).json({ error: 'Amount must be a number' });
    }
    
    const newBalance = await updateAccountBalance(clientId, accountName, amount);
    res.json({ account: accountName, balance: newBalance });
  } catch (error) {
    console.error('Error updating account balance:', error);
    res.status(error.message.includes('not found') ? 404 : 500)
      .json({ error: error.message || 'Server error' });
  }
});

/**
 * Set account balance directly
 * PUT /api/clients/:clientId/accounts/:accountName/balance
 */
router.put('/:accountName/balance', async (req, res) => {
  try {
    const clientId = req.params.clientId || req.originalParams?.clientId;
    const { accountName } = req.params;
    const { balance } = req.body;
    
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID not provided' });
    }
    
    if (typeof balance !== 'number') {
      return res.status(400).json({ error: 'Balance must be a number' });
    }
    
    const newBalance = await setAccountBalance(clientId, accountName, balance);
    res.json({ account: accountName, balance: newBalance });
  } catch (error) {
    console.error('Error setting account balance:', error);
    res.status(error.message.includes('not found') ? 404 : 500)
      .json({ error: error.message || 'Server error' });
  }
});

/**
 * Year-end snapshot routes
 */

/**
 * List all year-end snapshots
 * GET /api/clients/:clientId/accounts/year-end-snapshots
 */
router.get('/year-end-snapshots', async (req, res) => {
  try {
    const clientId = req.params.clientId || req.originalParams?.clientId;
    
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID not provided' });
    }
    
    const snapshots = await listYearEndSnapshots(clientId);
    res.json(snapshots);
  } catch (error) {
    console.error('Error listing year-end snapshots:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

/**
 * Get a specific year-end snapshot
 * GET /api/clients/:clientId/accounts/year-end-snapshots/:year
 */
router.get('/year-end-snapshots/:year', async (req, res) => {
  try {
    const clientId = req.params.clientId || req.originalParams?.clientId;
    const { year } = req.params;
    
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID not provided' });
    }
    
    const snapshot = await getYearEndSnapshot(clientId, year);
    res.json(snapshot);
  } catch (error) {
    console.error('Error fetching year-end snapshot:', error);
    res.status(error.message.includes('not found') ? 404 : 500)
      .json({ error: error.message || 'Server error' });
  }
});

/**
 * Create a year-end snapshot
 * POST /api/clients/:clientId/accounts/year-end-snapshots/:year
 */
router.post('/year-end-snapshots/:year', async (req, res) => {
  try {
    const clientId = req.params.clientId || req.originalParams?.clientId;
    const { year } = req.params;
    
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID not provided' });
    }
    
    // Validate year format
    if (!/^\d{4}$/.test(year)) {
      return res.status(400).json({ error: 'Year must be in YYYY format' });
    }
    
    const snapshot = await createYearEndSnapshot(clientId, year);
    res.status(201).json(snapshot);
  } catch (error) {
    console.error('Error creating year-end snapshot:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

/**
 * Rebuild account balances
 * POST /api/clients/:clientId/accounts/rebuild
 * Body: { startYear?: "YYYY" }
 */
router.post('/rebuild', async (req, res) => {
  try {
    const clientId = req.params.clientId || req.originalParams?.clientId;
    const { startYear } = req.body;
    
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID not provided' });
    }
    
    // Validate start year if provided
    if (startYear && !/^\d{4}$/.test(startYear)) {
      return res.status(400).json({ error: 'Start year must be in YYYY format' });
    }
    
    const accounts = await rebuildBalances(clientId, startYear);
    res.json({ 
      success: true,
      accounts,
      message: `Balances rebuilt${startYear ? ` from ${startYear}` : ' from zero'}`
    });
  } catch (error) {
    console.error('Error rebuilding balances:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

/**
 * Get accounts for reconciliation
 * GET /api/clients/:clientId/accounts/reconciliation
 * Returns accounts with calculated balances for reconciliation UI
 */
router.get('/reconciliation', async (req, res) => {
  try {
    const clientId = req.params.clientId || req.originalParams?.clientId;
    
    if (!clientId) {
      return res.status(400).json({ success: false, error: 'Client ID not provided' });
    }
    
    const accounts = await getAccountsForReconciliation(clientId);
    res.json({ success: true, accounts });
  } catch (error) {
    console.error('Error fetching accounts for reconciliation:', error);
    res.status(500).json({ success: false, error: error.message || 'Server error' });
  }
});

/**
 * Create reconciliation adjustment transactions
 * POST /api/clients/:clientId/accounts/reconciliation
 * Body: { adjustments: [{ accountId, accountName, samsBalance, actualBalance, difference }] }
 */
router.post('/reconciliation', async (req, res) => {
  try {
    const clientId = req.params.clientId || req.originalParams?.clientId;
    const { adjustments } = req.body;
    
    if (!clientId) {
      return res.status(400).json({ success: false, error: 'Client ID not provided' });
    }
    
    if (!adjustments || !Array.isArray(adjustments)) {
      return res.status(400).json({ success: false, error: 'Adjustments array is required' });
    }
    
    const results = await createReconciliationAdjustments(clientId, adjustments, req.user);
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error creating reconciliation adjustments:', error);
    res.status(500).json({ success: false, error: error.message || 'Server error' });
  }
});

export default router;
