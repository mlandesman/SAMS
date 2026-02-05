import express from 'express';
import { logDebug, logInfo, logWarn, logError } from '../../../shared/logger.js';
const router = express.Router();
import { 
  authenticateUserWithProfile, 
  enforceClientAccess, 
  requirePermission,
  logSecurityEvent 
} from '../middleware/clientAuth.js';
import { getDb } from '../firebase.js';
import { getFiscalYearBounds, validateFiscalYearConfig } from '../utils/fiscalYearUtils.js';
import { DateService, getNow } from '../services/DateService.js';
import admin from 'firebase-admin';

// Create date service for formatting API responses
const dateService = new DateService({ timezone: 'America/Cancun' });

// Helper to format date fields consistently for API responses
function formatDateField(dateValue) {
  if (!dateValue) return null;
  return dateService.formatForFrontend(dateValue);
}

// Apply security middleware to all balance routes
router.use(authenticateUserWithProfile);
router.use(enforceClientAccess);


/**
 * Get current account balances for a client
 * GET /api/clients/:clientId/balances/current
 * 
 * Replaces getClientAccountBalances() from frontend
 */
router.get('/current',
  requirePermission('accounts.view'),
  logSecurityEvent('BALANCE_VIEW_CURRENT'),
  async (req, res) => {
  try {
    const clientId = req.authorizedClientId;
    
    logDebug('🔍 Balance route - GET /current:', { 
      user: req.user.email,
      clientId,
      userRole: req.clientRole
    });
    
    const db = await getDb();
    
    // Get client document
    const clientRef = db.doc(`clients/${clientId}`);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      return res.status(404).json({ 
        success: false,
        error: `Client ${clientId} not found` 
      });
    }
    
    const clientData = clientDoc.data();
    const accounts = clientData.accounts || [];
    
    // Calculate totals (skip inactive accounts)
    let cashBalance = 0;
    let bankBalance = 0;
    
    accounts.forEach(account => {
      if (account.active !== false) {
        if (account.type === 'cash') {
          cashBalance += account.balance || 0;
        } else if (account.type === 'bank') {
          bankBalance += account.balance || 0;
        }
      }
    });
    
    res.json({
      success: true,
      data: {
        cashBalance,
        bankBalance,
        accounts,
        lastUpdated: formatDateField(admin.firestore.Timestamp.now())
      }
    });
    
  } catch (error) {
    logError('❌ Error getting current balances:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Server error' 
    });
  }
});

/**
 * Get year-end balances for a client
 * GET /api/clients/:clientId/balances/year-end/:year
 * 
 * Replaces getYearEndBalances() from frontend
 */
router.get('/year-end/:year',
  requirePermission('accounts.view'),
  logSecurityEvent('BALANCE_VIEW_YEAR_END'),
  async (req, res) => {
  try {
    const clientId = req.authorizedClientId;
    const { year } = req.params;
    
    logDebug('🔍 Balance route - GET /year-end/:year:', { 
      user: req.user.email,
      clientId,
      userRole: req.clientRole,
      year
    });
    
    // Validate year format
    if (!/^\d{4}$/.test(year)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid year format. Use YYYY' 
      });
    }
    
    const db = await getDb();
    
    // Get client configuration for fiscal year
    const clientDoc = await db.doc(`clients/${clientId}`).get();
    const clientData = clientDoc.data();
    const fiscalYearStartMonth = validateFiscalYearConfig(clientData);
    
    // Determine snapshot date based on fiscal year
    // For fiscal years, the year parameter represents the ending year
    // e.g., FY 2025 (July 2024 - June 2025) would use year = 2025
    let snapshotDate;
    if (fiscalYearStartMonth === 1) {
      // Calendar year ends December 31
      snapshotDate = `${year}-12-31`;
    } else {
      // Fiscal year ends the day before start month
      const { endDate } = getFiscalYearBounds(parseInt(year), fiscalYearStartMonth);
      // Format as YYYY-MM-DD
      const endYear = endDate.getFullYear();
      const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
      const endDay = String(endDate.getDate()).padStart(2, '0');
      snapshotDate = `${endYear}-${endMonth}-${endDay}`;
    }
    
    logDebug(`📅 Year-end snapshot date for ${year}:`, snapshotDate, 
      `(Fiscal year start month: ${fiscalYearStartMonth})`);
    
    // Get year-end snapshot document
    const snapshotRef = db.doc(`clients/${clientId}/yearEndBalances/${year}`);
    const snapshotDoc = await snapshotRef.get();
    
    if (!snapshotDoc.exists) {
      return res.status(404).json({ 
        success: false,
        error: `Year-end snapshot for ${year} not found` 
      });
    }
    
    const snapshotData = snapshotDoc.data();
    const accounts = snapshotData.accounts || [];
    
    // Calculate totals from snapshot (no active check - these are historical)
    let cashBalance = 0;
    let bankBalance = 0;
    
    accounts.forEach(account => {
      if (account.type === 'cash') {
        cashBalance += account.balance || 0;
      } else if (account.type === 'bank') {
        bankBalance += account.balance || 0;
      }
    });
    
    res.json({
      success: true,
      data: {
        cashBalance,
        bankBalance,
        accounts,
        snapshotDate,
        createdAt: formatDateField(snapshotData.createdAt || snapshotData.created)
      }
    });
    
  } catch (error) {
    logError('❌ Error getting year-end balances:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Server error' 
    });
  }
});

/**
 * Recalculate client account balances (POST version)
 * POST /api/clients/:clientId/balances/recalculate
 * 
 * New POST endpoint with same logic as GET version
 */
router.post('/recalculate',
  requirePermission('accounts.edit'),
  logSecurityEvent('BALANCE_RECALCULATE'),
  async (req, res) => {
  try {
    const clientId = req.authorizedClientId;
    let { startYear, forceRebuild = false } = req.body;
    const isDryRun = false; // POST version is never dry run
    
    const db = await getDb();
    
    // Get client document
    const clientRef = db.doc(`clients/${clientId}`);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      throw new Error(`Client ${clientId} not found`);
    }
    
    // Get client fiscal year configuration
    const clientData = clientDoc.data();
    const fiscalYearStartMonth = validateFiscalYearConfig(clientData);
    
    // Auto-determine startYear if not provided
    if (!startYear) {
      const dateService = new DateService({ timezone: 'America/Cancun' });
      const today = getNow();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;
      
      // Determine which fiscal year we're in and what snapshot to use
      if (fiscalYearStartMonth === 1) {
        // Calendar year client - use previous calendar year
        startYear = (currentYear - 1).toString();
      } else {
        // Fiscal year client
        if (currentMonth >= fiscalYearStartMonth) {
          // We're in the early part of fiscal year, use current calendar year
          // E.g., August 2025 with July FY start = use FY 2025 snapshot (ends June 2025)
          startYear = currentYear.toString();
        } else {
          // We're in the latter part of fiscal year, use previous calendar year
          // E.g., May 2025 with July FY start = use FY 2024 snapshot (ends June 2024)
          startYear = (currentYear - 1).toString();
        }
      }
      logDebug(`📅 Auto-determined snapshot year: ${startYear} for ${clientId} (FY starts month ${fiscalYearStartMonth})`);
    }
    
    logDebug('🔍 Balance route - POST /recalculate:', { 
      user: req.user.email,
      clientId,
      userRole: req.clientRole,
      startYear,
      forceRebuild,
      fiscalYearStartMonth
    });
    
    logDebug(`🔄 Backend: Recalculating balances for client ${clientId} from ${startYear} snapshot...`);
    
    // Get current account structure
    let accounts = clientData.accounts || [];
    
    if (accounts.length === 0) {
      throw new Error(`No accounts found for client ${clientId}`);
    }
    
    logDebug(`Found ${accounts.length} accounts for client ${clientId}`);
    
    // Get year-end snapshot
    const snapshotRef = db.doc(`clients/${clientId}/yearEndBalances/${startYear}`);
    const snapshot = await snapshotRef.get();
    
    if (!snapshot.exists) {
      throw new Error(`Year-end snapshot for ${startYear} not found`);
    }
    
    logDebug(`Found year-end snapshot for ${startYear}`);
    
    // Get snapshot accounts
    const snapshotAccounts = snapshot.data().accounts || [];
    
    if (snapshotAccounts.length === 0) {
      throw new Error(`No accounts in year-end snapshot for ${startYear}`);
    }
    
    logDebug(`Found ${snapshotAccounts.length} accounts in snapshot`);
    
    // Calculate fiscal year end date for snapshot reference
    const { endDate: yearEndDate } = getFiscalYearBounds(parseInt(startYear), fiscalYearStartMonth);
    const snapshotDateStr = yearEndDate.toISOString().split('T')[0];
    
    logDebug(`📅 Balance Recalculation - Fiscal Year Config: Start month ${fiscalYearStartMonth}`);
    logDebug(`📅 Year ${startYear} ends on: ${snapshotDateStr}`);
    
    // Map snapshot balances to current account structure
    accounts = accounts.map(account => {
      // Try to find snapshot account by ID first
      let snapshotAccount = account.id ? 
        snapshotAccounts.find(snap => snap.id === account.id) : null;
      
      // If not found by ID, try by name (for backward compatibility)
      if (!snapshotAccount) {
        snapshotAccount = snapshotAccounts.find(snap => snap.name === account.name);
      }
      
      return {
        ...account,
        balance: snapshotAccount ? snapshotAccount.balance : 0,
        lastRebuildSnapshot: snapshotDateStr
      };
    });
    
    // Get transactions after the snapshot date
    const { endDate } = getFiscalYearBounds(parseInt(startYear), fiscalYearStartMonth);
    // Add one millisecond to get start of next period
    const startDate = new Date(endDate.getTime() + 1);
    logDebug(`📅 Processing transactions after: ${startDate.toISOString()}`);
    logDebug(`Fetching transactions after ${startDate.toISOString()}`);
    
    const transactionsRef = db.collection(`clients/${clientId}/transactions`);
    const transactionQuery = transactionsRef
      .where('date', '>', startDate)
      .orderBy('date', 'asc');
    
    const transactionSnapshot = await transactionQuery.get();
    
    logDebug(`Found ${transactionSnapshot.size} transactions after the snapshot date`);
    
    // Apply each transaction to the account balances
    let processedCount = 0;
    let firstInvalidTransactionId = null;
    let hasInvalidTransaction = false;
    
    transactionSnapshot.forEach(transactionDoc => {
      const transaction = transactionDoc.data();
      processedCount++;
      
      // Find account using ACCOUNTTYPE-ONLY logic for balance aggregation
      let targetAccountType = null;
      
      // Use explicit transaction.accountType (required field)
      if (transaction.accountType) {
        const legacyType = transaction.accountType.toLowerCase();
        if (legacyType === 'cash') {
          targetAccountType = 'cash';
        } else if (legacyType === 'bank') {
          targetAccountType = 'bank';
        }
      }
      
      // If no valid accountType, this is an error
      if (!targetAccountType) {
        if (!firstInvalidTransactionId) {
          firstInvalidTransactionId = transactionDoc.id;
          hasInvalidTransaction = true;
        }
        logError(`❌ Transaction ${transactionDoc.id} missing valid accountType`);
        return; // Skip this transaction
      }
      
      // Find ANY account with the target accountType (balance aggregation logic)
      const accountIndex = accounts.findIndex(acc => acc.type === targetAccountType);
      
      if (accountIndex !== -1) {
        // Simple arithmetic balance calculation with proper accounting signs
        const amount = Number(transaction.amount || 0);
        accounts[accountIndex].balance += amount; // Clean and simple!
        
        // Update the timestamp to the latest transaction date
        const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
        const accountUpdated = accounts[accountIndex].updated?.toDate ? 
          accounts[accountIndex].updated.toDate() : new Date(accounts[accountIndex].updated || 0);
        
        if (!accounts[accountIndex].updated || transactionDate > accountUpdated) {
          accounts[accountIndex].updated = transaction.date;
        }
      } else {
        logWarn(`⚠️ No matching account found for transaction ${transactionDoc.id}`);
        logWarn(`Account: ${transaction.account || transaction.accountType || 'Unknown'}`);
      }
    });
    
    // If we found invalid transactions, return error with zero balances
    if (hasInvalidTransaction) {
      return res.status(400).json({
        success: false,
        error: `Cannot recalculate balances: Transaction ${firstInvalidTransactionId} is missing a valid accountType field. All balances set to zero until this is resolved.`,
        data: {
          accounts: accounts.map(acc => ({ ...acc, balance: 0 })),
          cashBalance: 0,
          bankBalance: 0,
          totalBalance: 0,
          processedTransactions: processedCount,
          rebuildDate: formatDateField(admin.firestore.Timestamp.now()),
          sourceSnapshot: snapshotDateStr,
          firstInvalidTransactionId,
          dryRun: false
        }
      });
    }
    
    // Update the client with recalculated balances
    await clientRef.update({ 
      accounts,
      lastBalanceRebuild: admin.firestore.Timestamp.now(),
      lastBalanceRebuildSource: `${startYear} year-end snapshot`
    });
    
    logDebug(`✅ Backend: Successfully rebuilt account balances from ${startYear} snapshot`);
    logDebug(`Processed ${processedCount} transactions`);
    
    // Display the updated balances
    logDebug('Updated account balances:');
    accounts.forEach(account => {
      logDebug(`${account.name} (${account.id}): ${account.balance}`);
    });
    
    // Calculate totals for return
    let cashBalance = 0;
    let bankBalance = 0;
    
    accounts.forEach(account => {
      if (account.active !== false) {
        if (account.type === 'cash') {
          cashBalance += account.balance || 0;
        } else if (account.type === 'bank') {
          bankBalance += account.balance || 0;
        }
      }
    });
    
    const result = {
      accounts,
      cashBalance,
      bankBalance,
      totalBalance: cashBalance + bankBalance,
      processedTransactions: processedCount,
      rebuildDate: formatDateField(admin.firestore.Timestamp.now()),
      sourceSnapshot: snapshotDateStr,
      dryRun: false
    };
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logError(`❌ Backend: Error rebuilding balances:`, error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Server error' 
    });
  }
});

/**
 * Create year-end snapshot
 * POST /api/clients/:clientId/balances/year-end-close/:year
 * 
 * New functionality to create year-end snapshots
 */
router.post('/year-end-close/:year',
  requirePermission('accounts.edit'),
  logSecurityEvent('BALANCE_YEAR_END_CLOSE'),
  async (req, res) => {
  try {
    const clientId = req.authorizedClientId;
    const { year } = req.params;
    const { accounts } = req.body;
    
    logDebug('🔍 Balance route - POST /year-end-close/:year:', { 
      user: req.user.email,
      clientId,
      userRole: req.clientRole,
      year,
      accountCount: accounts?.length || 0
    });
    
    // Validate year format
    if (!/^\d{4}$/.test(year)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid year format. Use YYYY' 
      });
    }
    
    // Validate accounts array
    if (!Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Accounts array is required and must not be empty' 
      });
    }
    
    const db = await getDb();
    
    // Get client configuration for fiscal year
    const clientRef = db.doc(`clients/${clientId}`);
    const clientDoc = await clientRef.get();
    const clientData = clientDoc.data();
    const fiscalYearStartMonth = validateFiscalYearConfig(clientData);
    
    // Calculate proper snapshot date
    const { endDate } = getFiscalYearBounds(parseInt(year), fiscalYearStartMonth);
    const snapshotDateStr = endDate.toISOString().split('T')[0];
    
    logDebug(`📅 Year-End Close - Fiscal Year Config: Start month ${fiscalYearStartMonth}`);
    logDebug(`📅 Year ${year} ends on: ${snapshotDateStr}`);
    
    // Check if snapshot already exists
    const snapshotRef = db.doc(`clients/${clientId}/yearEndBalances/${year}`);
    const existingSnapshot = await snapshotRef.get();
    
    if (existingSnapshot.exists) {
      return res.status(409).json({ 
        success: false,
        error: `Year-end snapshot for ${year} already exists` 
      });
    }
    
    // Create the snapshot
    const snapshotData = {
      accounts,
      createdAt: admin.firestore.Timestamp.now(),
      createdBy: req.user.email,
      clientId
    };
    
    await snapshotRef.set(snapshotData);
    
    logDebug(`✅ Created year-end snapshot for ${clientId} year ${year} (${snapshotDateStr}`);
    
    res.json({
      success: true,
      data: {
        message: `Year-end snapshot for ${year} created successfully`,
        accountCount: accounts.length
      }
    });
    
  } catch (error) {
    logError('❌ Error creating year-end snapshot:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Server error' 
    });
  }
});

export default router;