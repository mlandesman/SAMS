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
import { getStatementData, getConsolidatedUnitData } from '../services/statementDataService.js';
import { generateStatementData } from '../services/statementHtmlService.js';
import { generatePdf } from '../services/pdfService.js';
import { getBudgetActualData } from '../services/budgetActualDataService.js';
import { generateBudgetActualHtml } from '../services/budgetActualHtmlService.js';
import { generateBudgetActualText } from '../services/budgetActualTextService.js';
import { generateBudgetReportHtml } from '../services/budgetReportHtmlService.js';
import { 
  generateWaterConsumptionReportHtml,
  generateBothLanguageReports 
} from '../services/waterBillReportHtmlService.js';
import { normalizeOwners, normalizeManagers } from '../utils/unitContactUtils.js';
import { getCreditBalance } from '../../shared/utils/creditBalanceUtils.js';
import crypto from 'crypto';
import axios from 'axios';
import creditAutoPayReportRoutes from './creditAutoPayReportRoutes.js';

// Create date service for formatting API responses
const dateService = new DateService({ timezone: 'America/Cancun' });

// Helper to format date fields consistently for API responses
function formatDateField(dateValue) {
  if (!dateValue) return null;
  return dateService.formatForFrontend(dateValue);
}

const router = express.Router();

// Mount credit auto-pay report routes
// GET /reports/credit-auto-pay/send
router.use('/credit-auto-pay', creditAutoPayReportRoutes);

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

    // Get owners and managers directly from the unit document (normalized to new structure)
    const owners = normalizeOwners(unitData.owners);
    const managers = normalizeManagers(unitData.managers);

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
      
      // Fetch credit balance from centralized location (always fresh)
      try {
        const creditBalancesRef = db.collection('clients').doc(clientId)
          .collection('units').doc('creditBalances');
        const creditBalancesDoc = await creditBalancesRef.get();
        
        if (creditBalancesDoc.exists) {
          const allCreditData = creditBalancesDoc.data();
          const unitCreditData = allCreditData[unitId] || {};
          // Use getter to calculate balance from history (always fresh)
          creditBalance = getCreditBalance(unitCreditData);
        }
      } catch (error) {
        console.warn(`⚠️ Could not fetch credit balance, defaulting to 0:`, error);
        creditBalance = 0;
      }

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
    // unitId is normalized at import time, so we use simple exact matching
    // Also query legacy 'unit' field for backwards compatibility with older data
    const allDocIds = new Set();
    const allDocs = [];
    
    // Query 1: unitId field (primary - normalized at import)
    const unitIdSnapshot = await db.collection('clients').doc(clientId)
      .collection('transactions')
      .where('unitId', '==', unitId)
      .get();
    
    unitIdSnapshot.docs.forEach(doc => {
      if (!allDocIds.has(doc.id)) {
        allDocIds.add(doc.id);
        allDocs.push(doc);
      }
    });
    console.log(`[UNIT REPORT] Query for unitId='${unitId}' found ${unitIdSnapshot.size} transactions`);
    
    // Query 2: unit field (legacy format for backwards compatibility)
    const unitSnapshot = await db.collection('clients').doc(clientId)
      .collection('transactions')
      .where('unit', '==', unitId)
      .get();
    
    unitSnapshot.docs.forEach(doc => {
      if (!allDocIds.has(doc.id)) {
        allDocIds.add(doc.id);
        allDocs.push(doc);
      }
    });
    console.log(`[UNIT REPORT] Query for unit='${unitId}' found ${unitSnapshot.size} transactions`);
    
    // Create combined snapshot-like object
    const transactionsSnapshot = {
      docs: allDocs,
      size: allDocs.length
    };
    
    console.log(`[UNIT REPORT] Total unique transactions found: ${transactionsSnapshot.size}`);

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
    const language = req.query.language || 'english';
    const generateBothLanguages = req.query.generateBothLanguages === 'true';
    
    if (!unitId) {
      return res.status(400).json({ 
        success: false, 
        error: 'unitId query parameter is required' 
      });
    }
    
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

    // Generate statement data (with optional dual-language support)
    let statement;
    if (generateBothLanguages) {
      // Generate both languages (optimization: data fetch happens once, HTML built twice)
      statement = await generateStatementData(api, clientId, unitId, {
        fiscalYear,
        language,
        generateBothLanguages: true
      });
    } else {
      // Single language (original behavior)
      statement = await generateStatementData(api, clientId, unitId, {
        fiscalYear,
        language
      });
    }
    
    res.json({ success: true, data: statement });
  } catch (error) {
    console.error('Error fetching statement data:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.stack 
    });
  }
});

/**
 * Get raw consolidated unit data (debug endpoint)
 * GET /api/clients/:clientId/reports/statement/raw
 * Query params:
 *   - unitId: Unit ID (e.g., '101', '102')
 *   - fiscalYear (optional): Fiscal year (defaults to current)
 *   - excludeFutureBills (optional): Whether to exclude future bills (default: false)
 * 
 * Returns comprehensive raw data object (for debugging/internal use)
 */
router.get('/statement/raw', authenticateUserWithProfile, async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    const unitId = req.query.unitId;
    const fiscalYear = req.query.fiscalYear ? parseInt(req.query.fiscalYear) : null;
    const excludeFutureBills = req.query.excludeFutureBills === 'true';
    
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
    
    // Call the raw data service
    const result = await getConsolidatedUnitData(api, clientId, unitId, fiscalYear, excludeFutureBills);
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching raw statement data:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.stack 
    });
  }
});

/**
 * Get Statement of Account as HTML
 * GET /api/clients/:clientId/reports/statement/html
 * Query params:
 *   - unitId: Unit ID (e.g., '101', '102')
 *   - fiscalYear (optional): Fiscal year (defaults to current)
 *   - language (optional): 'english' or 'spanish' (defaults to 'english')
 * 
 * Returns professional HTML statement matching prior administrator design
 */
router.get('/statement/html', authenticateUserWithProfile, async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    const unitId = req.query.unitId;
    const fiscalYear = req.query.fiscalYear ? parseInt(req.query.fiscalYear) : null;
    const language = req.query.language || 'english';
    
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
    
    // Generate Statement data
    const { html: htmlOutput } = await generateStatementData(api, clientId, unitId, {
      fiscalYear,
      language
    });
    
    // Return as HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlOutput);
  } catch (error) {
    console.error('Error generating statement HTML:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.stack 
    });
  }
});

/**
 * Get Statement of Account as PDF
 * GET /api/clients/:clientId/reports/statement/pdf
 * Query params:
 *   - unitId: Unit ID (e.g., '101', '102')
 *   - fiscalYear (optional): Fiscal year (defaults to current)
 *   - language (optional): 'english' or 'spanish' (defaults to 'english')
 * 
 * Returns PDF statement for download or email attachment
 */
router.get('/statement/pdf', authenticateUserWithProfile, async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    const unitId = req.query.unitId;
    const fiscalYear = req.query.fiscalYear ? parseInt(req.query.fiscalYear) : null;
    const language = req.query.language || 'english';
    
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
    
    // Generate Statement data
    const { html: htmlOutput, meta: htmlMeta } = await generateStatementData(api, clientId, unitId, {
      fiscalYear,
      language
    });
    
    // Convert to PDF
    const pdfBuffer = await generatePdf(htmlOutput, {
      footerMeta: {
        statementId: htmlMeta?.statementId,
        generatedAt: htmlMeta?.generatedAt,
        language: htmlMeta?.language
      }
    });
    
    // Return as PDF with download header
    const fileName = `statement_${clientId}_${unitId}_${fiscalYear || 'current'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating statement PDF:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.stack 
    });
  }
});

/**
 * Export Statement of Account using pre-generated HTML
 * POST /reports/:clientId/statement/export?format=pdf
 *
 * Body:
 * {
 *   unitId: string,
 *   fiscalYear?: number,
 *   language?: 'english' | 'spanish',
 *   html: string,
 *   meta?: {
 *     statementId?: string,
 *     generatedAt?: string,
 *     language?: string
 *   }
 * }
 *
 * NOTE: This endpoint assumes the caller has already fetched and formatted
 * the statement data. It simply converts provided HTML to the requested
 * export format (currently PDF).
 */
router.post('/statement/export', authenticateUserWithProfile, async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    const {
      unitId,
      fiscalYear = null,
      language = 'english',
      html,
      meta = {},
      format: bodyFormat
    } = req.body || {};

    const format = (req.query.format || bodyFormat || 'pdf').toLowerCase();



/**
 * Verify download token for PDF access
 */
function verifyDownloadToken(token, clientId, unitId, fiscalYear, language) {
  // crypto is imported at top of file
  const secret = process.env.DOWNLOAD_TOKEN_SECRET || 'sams-statement-download-secret-change-in-production';
  
  try {
    // Split token into payload and signature
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) {
      return false;
    }
    
    // Decode payload
    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadStr);
    
    // Verify expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return false;
    }
    
    // Verify payload matches request
    if (payload.clientId !== clientId || 
        payload.unitId !== unitId || 
        payload.fiscalYear !== fiscalYear || 
        payload.language !== language) {
      return false;
    }
    
    // Verify signature
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payloadStr);
    const expectedSignature = hmac.digest('base64url');
    
    return signature === expectedSignature;
  } catch (error) {
    console.error('Token verification error:', error);
    return false;
  }
}

/**
 * GET /api/clients/:clientId/reports/statement/pdf-download
 * Token-based PDF download (no authentication required)
 * Query params:
 *   - unitId: Unit ID
 *   - fiscalYear: Fiscal year
 *   - language: 'en' or 'es'
 *   - token: Download token
 */
router.get('/statement/pdf-download', async (req, res) => {
  try {
    const clientId = req.params.clientId;
    const { unitId, fiscalYear, language, token } = req.query;
    
    if (!clientId || !unitId || !fiscalYear || !language || !token) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters' 
      });
    }
    
    // Verify token
    if (!verifyDownloadToken(token, clientId, unitId, parseInt(fiscalYear), language)) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired download token' 
      });
    }
    
    // Generate PDF using existing logic
    const api = axios.create({
      baseURL: process.env.API_BASE_URL || 'http://localhost:5001',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });
    
    const statement = await generateStatementData(api, clientId, unitId, {
      fiscalYear: parseInt(fiscalYear),
      language
    });
    
    // Generate PDF
    const pdfBuffer = await generatePdf(statement.html);
    
    const fileName = `statement_${clientId}_${unitId}_${fiscalYear}_${language}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF download:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate PDF',
      details: error.message 
    });
  }
});

    // CSV export: build from statement data (lineItems) for clean imports
    if (format === 'csv') {
      if (!unitId) {
        return res.status(400).json({
          success: false,
          error: 'unitId field is required in request body for CSV export'
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

      const statementData = await getStatementData(
        api,
        clientId,
        unitId,
        fiscalYear,
        false
      );

      const lineItems = statementData.lineItems || [];
      const openingBalance =
        typeof statementData.summary?.openingBalance === 'number'
          ? statementData.summary.openingBalance
          : 0;

      const header = ['Date', 'Description', 'Charge', 'Payment', 'Balance', 'Type'];
      const rows = [];

      // Opening balance row
      rows.push([
        '',
        'Opening Balance',
        '',
        '',
        openingBalance.toFixed(2),
        'opening'
      ]);

      // Transaction rows (exclude future items)
      for (const item of lineItems) {
        if (item.isFuture) continue;

        rows.push([
          item.date || '',
          item.description || '',
          typeof item.charge === 'number' ? item.charge.toFixed(2) : '',
          typeof item.payment === 'number' ? item.payment.toFixed(2) : '',
          typeof item.balance === 'number' ? item.balance.toFixed(2) : '',
          item.type || ''
        ]);
      }

      const escapeCell = (value) => {
        const str = value == null ? '' : String(value);
        const escaped = str.replace(/"/g, '""');
        return `"${escaped}"`;
      };

      const csvLines = [header, ...rows].map((row) =>
        row.map(escapeCell).join(',')
      );
      const csvContent = csvLines.join('\r\n');

      const safeClientId = clientId || 'client';
      const safeUnitId = unitId || 'unit';
      const fileName = `statement_${safeClientId}_${safeUnitId}_${
        fiscalYear || 'current'
      }.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(csvContent);
      return;
    }

    if (!html) {
      return res.status(400).json({
        success: false,
        error: 'html field is required in request body'
      });
    }

    // For now we only support PDF export for non-CSV formats
    if (format !== 'pdf') {
      return res.status(400).json({
        success: false,
        error: 'Unsupported export format. Supported formats: "pdf", "csv".'
      });
    }

    // Convert provided HTML to PDF without additional data fetching
    const pdfBuffer = await generatePdf(html, {
      footerMeta: {
        statementId: meta.statementId || '',
        generatedAt: meta.generatedAt || '',
        language: meta.language || language
      }
    });

    const safeClientId = clientId || 'client';
    const safeUnitId = unitId || 'unit';
    const fileName = `statement_${safeClientId}_${safeUnitId}_${fiscalYear || 'current'}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error exporting statement from HTML:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
});

/**
 * Get Budget vs Actual report data
 * GET /api/clients/:clientId/reports/budget-actual/data
 * Query params:
 *   - fiscalYear (optional): Fiscal year (defaults to current)
 *   - language (optional): 'english' or 'spanish' (defaults to 'english')
 * 
 * Returns comprehensive data object with budget vs actual data
 */
router.get('/budget-actual/data', authenticateUserWithProfile, async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    const fiscalYear = req.query.fiscalYear ? parseInt(req.query.fiscalYear) : null;
    const user = req.user;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }

    // Verify user has access to this client
    const propertyAccess = user.getPropertyAccess(clientId);
    if (!propertyAccess) {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied to this client' 
      });
    }

    // Get budget vs actual data
    const data = await getBudgetActualData(clientId, fiscalYear, user);
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching budget vs actual data:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.stack 
    });
  }
});

/**
 * Get Budget vs Actual report as HTML
 * GET /api/clients/:clientId/reports/budget-actual/html
 * Query params:
 *   - fiscalYear (optional): Fiscal year (defaults to current)
 *   - language (optional): 'english' or 'spanish' (defaults to 'english')
 * 
 * Returns professional HTML report matching Statement of Account design
 */
router.get('/budget-actual/html', authenticateUserWithProfile, async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    const fiscalYear = req.query.fiscalYear ? parseInt(req.query.fiscalYear) : null;
    const language = req.query.language || 'english';
    const user = req.user;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }

    // Verify user has access to this client
    const propertyAccess = user.getPropertyAccess(clientId);
    if (!propertyAccess) {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied to this client' 
      });
    }

    // Get budget vs actual data
    const data = await getBudgetActualData(clientId, fiscalYear, user);
    
    // Generate HTML
    const { html: htmlOutput } = generateBudgetActualHtml(data, { language });
    
    // Return as HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlOutput);
  } catch (error) {
    console.error('Error generating budget vs actual HTML:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.stack 
    });
  }
});

/**
 * Export Budget vs Actual report
 * POST /api/clients/:clientId/reports/budget-actual/export
 * Query param: format=pdf|csv
 * Body: { fiscalYear, language, html?, meta? }
 * 
 * Returns PDF or CSV export of the report
 */
router.post('/budget-actual/export', authenticateUserWithProfile, async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    const {
      fiscalYear = null,
      language = 'english',
      html,
      meta = {},
      format: bodyFormat
    } = req.body || {};

    const format = (req.query.format || bodyFormat || 'pdf').toLowerCase();
    const user = req.user;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'Client ID is required'
      });
    }

    // Verify user has access to this client
    const propertyAccess = user.getPropertyAccess(clientId);
    if (!propertyAccess) {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied to this client' 
      });
    }

    // CSV export: build from data
    if (format === 'csv') {
      const data = await getBudgetActualData(clientId, fiscalYear, user);
      
      const header = ['Category Name', 'Type', 'Annual Budget', 'YTD Budget', 'YTD Actual', 'Variance ($)', 'Variance (%)'];
      const rows = [];

      // Income categories
      data.income.categories.forEach(cat => {
        rows.push([
          cat.name,
          'Income',
          (cat.annualBudget / 100).toFixed(2),
          (cat.ytdBudget / 100).toFixed(2),
          (cat.ytdActual / 100).toFixed(2),
          (cat.variance / 100).toFixed(2),
          cat.variancePercent.toFixed(2)
        ]);
      });

      // Expense categories
      data.expenses.categories.forEach(cat => {
        rows.push([
          cat.name,
          'Expense',
          (cat.annualBudget / 100).toFixed(2),
          (cat.ytdBudget / 100).toFixed(2),
          (cat.ytdActual / 100).toFixed(2),
          (cat.variance / 100).toFixed(2),
          cat.variancePercent.toFixed(2)
        ]);
      });

      // Special Assessments (as separate section)
      if (data.specialAssessments.collections && data.specialAssessments.collections.amount > 0) {
        rows.push([
          data.specialAssessments.collections.categoryName,
          'Special Assessments - Collections',
          '0.00',
          '0.00',
          (data.specialAssessments.collections.amount / 100).toFixed(2),
          '0.00',
          '0.00'
        ]);
      }

      data.specialAssessments.expenditures.forEach(exp => {
        rows.push([
          exp.name,
          'Special Assessments - Expenditure',
          '0.00',
          '0.00',
          (exp.amount / 100).toFixed(2),
          '0.00',
          '0.00'
        ]);
      });

      // Unit Credit Accounts (as separate section)
      if (data.unitCreditAccounts) {
        rows.push([
          'Credit Added',
          'Unit Credit Accounts - Added',
          '0.00',
          '0.00',
          (data.unitCreditAccounts.added / 100).toFixed(2),
          '0.00',
          '0.00'
        ]);
        rows.push([
          'Credit Used',
          'Unit Credit Accounts - Used',
          '0.00',
          '0.00',
          (data.unitCreditAccounts.used / 100).toFixed(2),
          '0.00',
          '0.00'
        ]);
        rows.push([
          'Credit Balance',
          'Unit Credit Accounts - Balance',
          '0.00',
          '0.00',
          (data.unitCreditAccounts.balance / 100).toFixed(2),
          '0.00',
          '0.00'
        ]);
      }

      const escapeCell = (value) => {
        const str = value == null ? '' : String(value);
        const escaped = str.replace(/"/g, '""');
        return `"${escaped}"`;
      };

      const csvLines = [header, ...rows].map((row) =>
        row.map(escapeCell).join(',')
      );
      const csvContent = csvLines.join('\r\n');

      const safeClientId = clientId || 'client';
      const fileName = `budget-actual_${safeClientId}_${fiscalYear || 'current'}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(csvContent);
      return;
    }

    // PDF export: use provided HTML or generate it
    if (format !== 'pdf') {
      return res.status(400).json({
        success: false,
        error: 'Unsupported export format. Supported formats: "pdf", "csv".'
      });
    }

    let htmlToConvert = html;
    let metaToUse = meta;

    if (!htmlToConvert) {
      // Generate HTML if not provided
      const data = await getBudgetActualData(clientId, fiscalYear, user);
      const result = generateBudgetActualHtml(data, { language });
      htmlToConvert = result.html;
      metaToUse = result.meta;
    }

    // Convert HTML to PDF
    const pdfBuffer = await generatePdf(htmlToConvert, {
      footerMeta: {
        reportId: metaToUse.reportId || '',
        generatedAt: metaToUse.generatedAt || '',
        language: metaToUse.language || language
      }
    });

    const safeClientId = clientId || 'client';
    const fileName = `budget-actual_${safeClientId}_${fiscalYear || 'current'}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error exporting budget vs actual report:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
});

/**
 * Get available budget years for a client
 * GET /api/clients/:clientId/reports/budget/years
 * 
 * Returns array of years that have budget entries, sorted descending
 */
router.get('/budget/years', authenticateUserWithProfile, async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    const user = req.user;
    
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'Client ID is required'
      });
    }
    
    // Validate propertyAccess
    if (!user.isSuperAdmin() && !user.hasPropertyAccess(clientId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this client'
      });
    }
    
    const { findAvailableBudgetYears } = await import('../services/budgetReportHtmlService.js');
    const years = await findAvailableBudgetYears(clientId);
    
    res.json({
      success: true,
      years
    });
  } catch (error) {
    console.error('Budget years error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get Budget Report HTML for a client
 * GET /api/clients/:clientId/reports/budget/:year
 * Query params:
 *   - language (optional): 'english' or 'spanish' (defaults to 'english')
 * 
 * Note: The :year parameter is optional - if not provided or invalid, uses highest available year
 * Returns professional HTML report with year-over-year comparison
 */
router.get('/budget/:year', authenticateUserWithProfile, async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    const fiscalYear = req.params.year ? parseInt(req.params.year) : null;
    const language = req.query.language || 'english';
    const user = req.user;
    
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'Client ID is required'
      });
    }
    
    // Validate propertyAccess
    if (!user.isSuperAdmin() && !user.hasPropertyAccess(clientId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this client'
      });
    }
    
    // fiscalYear parameter is now optional - service will use highest available year
    const { html, meta } = await generateBudgetReportHtml(clientId, fiscalYear, language, user);
    
    res.json({
      success: true,
      html,
      meta
    });
  } catch (error) {
    console.error('Budget report error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Export Budget Report PDF
 * POST /api/clients/:clientId/reports/budget/:year/pdf
 * Body: { html, language, fiscalYear? }
 * 
 * Note: fiscalYear in body is optional - if not provided, uses highest available year
 * Returns PDF export of the budget report
 */
router.post('/budget/:year/pdf', authenticateUserWithProfile, async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    const { html, language = 'english', fiscalYear: bodyFiscalYear } = req.body;
    const user = req.user;
    
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'Client ID is required'
      });
    }
    
    if (!html) {
      return res.status(400).json({
        success: false,
        error: 'html field is required in request body'
      });
    }
    
    // Validate propertyAccess
    if (!user.isSuperAdmin() && !user.hasPropertyAccess(clientId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this client'
      });
    }
    
    // Determine fiscal year - use body fiscalYear if provided, otherwise find highest available
    let fiscalYear = bodyFiscalYear ? parseInt(bodyFiscalYear) : null;
    if (!fiscalYear || isNaN(fiscalYear)) {
      const { findAvailableBudgetYears } = await import('../services/budgetReportHtmlService.js');
      const availableYears = await findAvailableBudgetYears(clientId);
      if (availableYears.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No budget entries found for this client'
        });
      }
      fiscalYear = availableYears[0]; // Use highest available year
    }
    
    // Generate PDF from HTML
    const pdfBuffer = await generatePdf(html, {
      format: 'Letter',
      footerMeta: {
        statementId: `BUDGET-${clientId}-${fiscalYear}`,
        generatedAt: new Date().toLocaleDateString(),
        language
      }
    });
    
    const safeClientId = clientId || 'client';
    const fileName = `Budget-${safeClientId}-FY${fiscalYear}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Budget PDF error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Export Transactions PDF from pre-generated HTML
 * POST /reports/:clientId/transactions/export?format=pdf
 *
 * Body:
 * {
 *   html: string,
 *   filterSummary?: {
 *     dateRange?: string | object,
 *     advancedFilters?: object
 *   }
 * }
 *
 * Returns PDF export of transactions report
 */
router.post('/transactions/export', authenticateUserWithProfile, async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    const { html, filterSummary = {} } = req.body || {};
    const format = (req.query.format || 'pdf').toLowerCase();
    const user = req.user;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'Client ID is required'
      });
    }

    // Validate propertyAccess
    if (!user.isSuperAdmin() && !user.hasPropertyAccess(clientId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this client'
      });
    }

    if (!html) {
      return res.status(400).json({
        success: false,
        error: 'html field is required in request body'
      });
    }

    if (format !== 'pdf') {
      return res.status(400).json({
        success: false,
        error: 'Unsupported export format. Supported formats: "pdf".'
      });
    }

    // Generate PDF from HTML (landscape orientation)
    const pdfBuffer = await generatePdf(html, {
      format: 'Letter',
      landscape: true,
      footerMeta: {
        statementId: `TRANSACTIONS-${clientId}-${Date.now()}`,
        generatedAt: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }),
        language: 'english'
      }
    });

    const safeClientId = clientId || 'client';
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `transactions-${safeClientId}-${dateStr}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error exporting transactions PDF:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
});

/**
 * Generate Water Consumption Report HTML
 * GET /api/clients/:clientId/reports/water/:unitId
 * 
 * Query Parameters:
 *   - format: 'html' | 'json' (default: 'html')
 *   - language: 'english' | 'spanish' (default: 'english')
 *   - generateBothLanguages: 'true' | 'false' (default: 'false')
 */
router.get('/water/:unitId', authenticateUserWithProfile, async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    const { unitId } = req.params;
    const user = req.user;
    
    // Validate inputs
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
    
    // Check unit access (admins and unit owners/managers)
    if (!hasUnitAccess(propertyAccess, unitId, user.samsProfile?.globalRole)) {
      return res.status(403).json({ 
        error: 'Access denied to this unit' 
      });
    }
    
    // Parse query parameters
    const language = req.query.language || 'english';
    const generateBothLanguages = req.query.generateBothLanguages === 'true';
    const format = req.query.format || 'html';
    
    // Validate language
    if (!['english', 'spanish'].includes(language)) {
      return res.status(400).json({
        error: 'Invalid language. Use "english" or "spanish".'
      });
    }
    
    // Generate report
    let result;
    if (generateBothLanguages) {
      result = await generateBothLanguageReports(clientId, unitId);
      
      return res.json({
        success: true,
        htmlEn: result.htmlEn,
        htmlEs: result.htmlEs,
        metaEn: result.metaEn,
        metaEs: result.metaEs,
        reportData: result.reportData
      });
    } else {
      result = await generateWaterConsumptionReportHtml(clientId, unitId, { language });
      
      if (result.error) {
        return res.status(500).json({
          error: 'Failed to generate report',
          message: result.error
        });
      }
      
      if (format === 'html') {
        // Return HTML content directly
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(result.html);
      }
      
      return res.json({
        success: true,
        html: result.html,
        meta: result.meta,
        reportData: result.reportData
      });
    }
    
  } catch (error) {
    console.error('Error generating water consumption report:', error);
    return res.status(500).json({ 
      error: 'Failed to generate report',
      message: error.message 
    });
  }
});

/**
 * Generate Water Consumption Report PDF
 * GET /api/clients/:clientId/reports/water/:unitId/pdf
 * 
 * Query Parameters:
 *   - language: 'english' | 'spanish' (default: 'english')
 */
router.get('/water/:unitId/pdf', authenticateUserWithProfile, async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    const { unitId } = req.params;
    const user = req.user;
    
    // Validate inputs
    if (!clientId || !unitId) {
      return res.status(400).json({ 
        error: 'Client ID and Unit ID are required' 
      });
    }
    
    // Verify user has access
    const propertyAccess = user.getPropertyAccess(clientId);
    if (!propertyAccess) {
      return res.status(403).json({ 
        error: 'Access denied to this client' 
      });
    }
    
    if (!hasUnitAccess(propertyAccess, unitId, user.samsProfile?.globalRole)) {
      return res.status(403).json({ 
        error: 'Access denied to this unit' 
      });
    }
    
    // Parse query parameters
    const language = req.query.language || 'english';
    
    // Validate language
    if (!['english', 'spanish'].includes(language)) {
      return res.status(400).json({
        error: 'Invalid language. Use "english" or "spanish".'
      });
    }
    
    // Generate HTML first
    const result = await generateWaterConsumptionReportHtml(clientId, unitId, { language });
    
    if (result.error) {
      return res.status(500).json({
        error: 'Failed to generate report HTML',
        message: result.error
      });
    }
    
    if (!result.html) {
      return res.status(500).json({
        error: 'Failed to generate report HTML'
      });
    }
    
    // Convert to PDF
    const pdfBuffer = await generatePdf(result.html, {
      format: 'Letter',
      footerMeta: {
        statementId: result.meta.reportId,
        generatedAt: result.meta.generatedAt,
        language: language
      }
    });
    
    // Set response headers for PDF download
    const filename = `water-consumption-${unitId}-${language}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    return res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error generating water consumption PDF:', error);
    return res.status(500).json({ 
      error: 'Failed to generate PDF',
      message: error.message 
    });
  }
});

export default router;