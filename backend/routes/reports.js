/**
 * Reports API Routes for SAMS
 * Provides unit-specific financial reports for unit owners
 */

import express from 'express';
import { authenticateUserWithProfile } from '../middleware/clientAuth.js';
import { getDb } from '../firebase.js';
import { hasUnitAccess } from '../middleware/unitAuthorization.js';
import { DateService, getNow } from '../services/DateService.js';
import statementController from '../controllers/statementController.js';
import { queryDuesPaymentsData } from '../services/statementDataService.js';
import axios from 'axios';

// Create date service for formatting API responses
const dateService = new DateService({ timezone: 'America/Cancun' });

// Helper to format date fields consistently for API responses
function formatDateField(dateValue) {
  if (!dateValue) return null;
  return dateService.formatForFrontend(dateValue);
}

const router = express.Router();

/**
 * Get unit-specific financial report
 * GET /api/clients/:clientId/reports/unit/:unitId
 */
router.get('/unit/:unitId', authenticateUserWithProfile, async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    const { unitId } = req.params;
    const user = req.user;

    if (!clientId || !unitId) {
      return res.status(400).json({ 
        error: 'Client ID and Unit ID are required' 
      });
    }

    // Verify user has access to this client
    const propertyAccess = user.getPropertyAccess(clientId);
    if (!propertyAccess) {
      return res.status(403).json({ 
        error: 'Access denied to this client' 
      });
    }

    // Check comprehensive unit access (supports Admin, Unit Owners, and Unit Managers)
    if (!hasUnitAccess(propertyAccess, unitId, user.samsProfile?.globalRole)) {
      return res.status(403).json({ 
        error: 'Access denied to this unit',
        unitId: unitId,
        userRole: propertyAccess.role,
        globalRole: user.samsProfile?.globalRole
      });
    }

    const db = await getDb();

    // Get unit information with owners and managers
    const unitDoc = await db.collection('clients').doc(clientId)
      .collection('units').doc(unitId).get();

    if (!unitDoc.exists) {
      return res.status(404).json({ 
        error: 'Unit not found' 
      });
    }

    const unitData = unitDoc.data();

    // Get owners and managers directly from the unit document
    const owners = (unitData.owners || []).map(ownerName => ({ name: ownerName }));
    const managers = (unitData.managers || []).map(managerName => ({ name: managerName }));

    // Get HOA dues information using the same approach as desktop UI
    const currentDate = getNow();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    let amountDue = 0;
    let paidThrough = null;
    let ytdPaid = 0;
    let creditBalance = 0;

    // Get unit dues data for current year using direct Firestore access
    // This matches the pattern used in HOADuesContext.jsx
    const duesDocRef = db.collection('clients').doc(clientId)
      .collection('units').doc(unitId)
      .collection('dues').doc(currentYear.toString());
    
    const duesSnapshot = await duesDocRef.get();
    
    if (duesSnapshot.exists) {
      const duesData = duesSnapshot.data();
      const payments = duesData.payments || [];
      const scheduledAmount = duesData.scheduledAmount || 0;
      creditBalance = duesData.creditBalance || 0;

      // Calculate YTD paid amount
      ytdPaid = payments.reduce((sum, payment) => {
        return sum + (payment.paid || 0);
      }, 0);

      // Calculate amount due based on current requirements:
      // - All past due amounts (up to current month)
      // - Any amounts due within the next 30 days
      
      // Calculate date 30 days from now
      const futureDate = getNow();
      futureDate.setDate(futureDate.getDate() + 30);
      const futureMonth = futureDate.getMonth() + 1;
      const futureYear = futureDate.getFullYear();
      
      // Calculate through which month we should include (current month + potentially next month)
      let monthsToInclude = currentMonth;
      
      // If the 30-day window extends into next month, include it
      if (futureYear === currentYear && futureMonth > currentMonth) {
        monthsToInclude = futureMonth;
      } else if (futureYear > currentYear) {
        // If 30 days extends into next year, include December of current year
        monthsToInclude = 12;
      }
      
      console.log(`📅 [UNIT REPORT] Calculating dues: currentMonth=${currentMonth}, futureMonth=${futureMonth}, monthsToInclude=${monthsToInclude}`);
      
      // Calculate total scheduled through the appropriate month
      let totalScheduledThroughTarget = scheduledAmount * monthsToInclude;
      amountDue = Math.max(0, totalScheduledThroughTarget - ytdPaid);
      
      console.log(`💰 [UNIT REPORT] Amount due calculation: scheduled=${totalScheduledThroughTarget}, paid=${ytdPaid}, due=${amountDue}`);

      // Determine "Paid Through" month if amount due is 0
      if (amountDue <= 0) {
        // Find the latest month that's fully paid
        let latestPaidMonth = 0;
        for (let month = 1; month <= 12; month++) {
          const payment = payments.find(p => p.month === month);
          const paidAmount = payment?.paid || 0;
          if (paidAmount >= scheduledAmount) {
            latestPaidMonth = month;
          }
        }
        
        if (latestPaidMonth > 0) {
          const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
          ];
          paidThrough = `${monthNames[latestPaidMonth - 1]} ${currentYear}`;
        }
        
        console.log(`✅ [UNIT REPORT] No amount due - Paid through: ${paidThrough}`);
      } else {
        console.log(`🚨 [UNIT REPORT] Amount due detected: ${amountDue}`);
      }
    }

    // Get transaction history for this unit
    // Note: Removed orderBy to avoid index requirement, will sort in memory
    
    // First try to get transactions with unitId field
    let transactionsSnapshot = await db.collection('clients').doc(clientId)
      .collection('transactions')
      .where('unitId', '==', unitId)
      .get();

    // Debug: Log initial query results
    console.log(`[UNIT REPORT] Initial query for unitId='${unitId}' found ${transactionsSnapshot.size} transactions`);
    
    // If no results, also check for transactions with unit field (legacy format)
    if (transactionsSnapshot.size === 0) {
      console.log(`[UNIT REPORT] No transactions found with unitId field, checking unit field for unit ${unitId}`);
      transactionsSnapshot = await db.collection('clients').doc(clientId)
        .collection('transactions')
        .where('unit', '==', unitId)
        .get();
      console.log(`[UNIT REPORT] Query for unit='${unitId}' found ${transactionsSnapshot.size} transactions`);
    }
    
    // If we still have no results but found some with the first query, combine both
    // This handles the case where some transactions use unitId and others use unit
    else {
      const legacySnapshot = await db.collection('clients').doc(clientId)
        .collection('transactions')
        .where('unit', '==', unitId)
        .get();
      
      if (legacySnapshot.size > 0) {
        // Combine both result sets
        const allDocs = [...transactionsSnapshot.docs, ...legacySnapshot.docs];
        // Remove duplicates based on document ID
        const uniqueDocs = Array.from(new Map(allDocs.map(doc => [doc.id, doc])).values());
        
        // Create a combined snapshot-like object
        transactionsSnapshot = {
          docs: uniqueDocs,
          size: uniqueDocs.length
        };
      }
    }

    const allTransactions = transactionsSnapshot.docs.map(doc => {
      const data = doc.data();
      const txDate = data.date?.toDate?.() || new Date(data.date);
      
      // Debug: Log the raw date and converted date for HOA transactions
      if (data.category === 'HOA Dues' && unitId === '1C') {
        console.log(`[UNIT REPORT] HOA Transaction ${doc.id}:`, {
          rawDate: data.date,
          convertedDate: formatDateField(txDate),
          year: txDate.getFullYear(),
          unitField: data.unit,
          unitIdField: data.unitId
        });
      }
      
      return {
        id: doc.id,
        date: txDate,
        amount: data.amount || 0,
        type: data.type || '',
        category: data.category || '',
        vendor: data.vendor || '',
        description: data.description || data.notes || '',
        account: data.account || '',
        paymentMethod: data.paymentMethod || ''
      };
    }).sort((a, b) => {
      // Sort by date desc (most recent first)
      return new Date(b.date) - new Date(a.date);
    });

    // Calculate YTD from actual transactions for current year
    const currentYearTransactions = allTransactions.filter(tx => {
      const txYear = new Date(tx.date).getFullYear();
      return txYear === currentYear && tx.amount > 0; // Only positive amounts (payments)
    });
    
    const ytdFromTransactions = currentYearTransactions.reduce((sum, tx) => {
      return sum + tx.amount;
    }, 0);

    // Use transaction-based YTD if we have transaction data, otherwise fall back to dues data
    if (currentYearTransactions.length > 0) {
      ytdPaid = ytdFromTransactions;
    }

    // Limit recent transactions for display
    const transactions = allTransactions.slice(0, 50);

    // Get payment calendar data for current year
    let paymentCalendar = {};
    if (duesSnapshot.exists) {
      const duesData = duesSnapshot.data();
      const payments = duesData.payments || [];
      
      // Convert payments array to month-indexed object
      payments.forEach(payment => {
        if (payment.month >= 1 && payment.month <= 12) {
          paymentCalendar[payment.month] = {
            paid: payment.paid || 0,
            date: payment.date || null,
            transactionId: payment.transactionId || null
          };
        }
      });
    }

    // Build response
    const response = {
      unit: {
        unitNumber: unitData.unitNumber || unitId,
        unitId: unitId,
        owners: owners,
        managers: managers
      },
      currentStatus: {
        amountDue: Math.round(amountDue * 100) / 100, // Round to 2 decimal places
        paidThrough: paidThrough,
        creditBalance: Math.round(creditBalance * 100) / 100,
        ytdPaid: {
          hoaDues: Math.round(ytdPaid * 100) / 100,
          projects: 0 // Placeholder for future Projects module
        }
      },
      paymentCalendar: paymentCalendar, // Add payment calendar data
      transactions: transactions.map(tx => ({
        id: tx.id,
        date: formatDateField(tx.date), // Formatted date object
        amount: tx.amount,
        description: tx.description,
        category: tx.category,
        account: tx.account,
        paymentMethod: tx.paymentMethod
      }))
    };

    res.json(response);

  } catch (error) {
    console.error('Error fetching unit report:', error);
    res.status(500).json({ 
      error: 'Failed to fetch unit report',
      details: error.message 
    });
  }
});

/**
 * Generate Statement of Account for a unit (JSON format)
 * GET /api/clients/:clientId/reports/statement/:unitId
 * Query params:
 *   - fiscalYear (optional): Specific fiscal year (e.g., 2026)
 *   - asOfDate (optional): Date to calculate as of (ISO format)
 * 
 * NOTE: Temporarily disabled - will be implemented in Step 2
 */
// router.get('/statement/:unitId', authenticateUserWithProfile, statementController.generateStatement);

/**
 * Generate Statement of Account for a unit (Plain Text format)
 * GET /api/clients/:clientId/reports/statement/:unitId/text
 * Query params:
 *   - fiscalYear (optional): Specific fiscal year (e.g., 2026)
 *   - asOfDate (optional): Date to calculate as of (ISO format)
 * 
 * NOTE: Temporarily disabled - will be implemented in Step 2
 */
// router.get('/statement/:unitId/text', authenticateUserWithProfile, statementController.generateStatementText);

/**
 * Get complete Statement data (raw data structure)
 * GET /api/clients/:clientId/reports/statement/data
 * Query params:
 *   - unitId: Unit ID (e.g., '101', '102')
 *   - fiscalYear (optional): Fiscal year (defaults to current)
 * 
 * Returns comprehensive data object with all fetched and processed data
 */
router.get('/statement/data', authenticateUserWithProfile, async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    const unitId = req.query.unitId;
    const fiscalYear = req.query.fiscalYear ? parseInt(req.query.fiscalYear) : null;
    
    if (!unitId) {
      return res.status(400).json({ 
        success: false, 
        error: 'unitId query parameter is required' 
      });
    }
    
    // Create API client with auth token (for internal API calls)
    const authToken = req.headers.authorization?.replace('Bearer ', '');
    const baseURL = process.env.API_BASE_URL || 'http://localhost:5001';
    
    const api = axios.create({
      baseURL: baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    // Call the service - returns comprehensive data object
    const result = await queryDuesPaymentsData(api, clientId, unitId, fiscalYear);
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching statement data:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.stack 
    });
  }
});

export default router;