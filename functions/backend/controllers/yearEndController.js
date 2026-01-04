/**
 * yearEndController.js
 * Year-End Processing Controller
 * Handles preview, execution, and reporting for fiscal year-end processing
 */

import { getDb } from '../firebase.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { getNow } from '../services/DateService.js';
import { getFiscalYear, getFiscalYearBounds } from '../utils/fiscalYearUtils.js';
import { centavosToPesos, pesosToCentavos } from '../../shared/utils/currencyUtils.js';
import { createYearEndBalance } from './yearEndBalancesController.js';
import * as yearEndReportService from '../services/yearEndReportService.js';

/**
 * Preview year-end data
 * GET /api/clients/:clientId/year-end/preview/:closingYear
 */
export async function previewYearEnd(req, res) {
  try {
    const clientId = req.authorizedClientId;
    const closingYear = parseInt(req.params.closingYear);
    
    if (isNaN(closingYear)) {
      return res.status(400).json({ error: 'Invalid closing year' });
    }
    
    const db = await getDb();
    
    // Get client configuration
    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const clientData = clientDoc.data();
    const fiscalYearStartMonth = clientData.configuration?.fiscalYearStartMonth || 1;
    
    // Calculate opening year and snapshot date
    const openingYear = closingYear + 1;
    const { endDate } = getFiscalYearBounds(closingYear, fiscalYearStartMonth);
    const snapshotDate = endDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Get accounts
    // Note: Account balances are already stored in centavos in Firestore
    const accounts = clientData.accounts || [];
    const accountBalances = accounts
      .filter(acc => acc.active !== false)
      .map(acc => ({
        id: acc.id,
        name: acc.name,
        type: acc.type || 'bank',
        currentBalance: acc.balance || 0, // Already in centavos, no conversion needed
        yeSnapshotExists: false // Will check below
      }));
    
    // Check if year-end balance snapshot exists
    const yearEndBalanceRef = db.doc(`clients/${clientId}/yearEndBalances/${closingYear}`);
    const yearEndBalanceDoc = await yearEndBalanceRef.get();
    const snapshotExists = yearEndBalanceDoc.exists;
    
    // Update yeSnapshotExists flag
    accountBalances.forEach(acc => {
      acc.yeSnapshotExists = snapshotExists;
    });
    
    // Get all units
    const unitsRef = db.collection(`clients/${clientId}/units`);
    const unitsSnapshot = await unitsRef.get();
    
    const units = [];
    let totalBalanceDue = 0;
    let totalCreditBalance = 0;
    let unitsWithBalanceDue = 0;
    let unitsWithCredit = 0;
    let unitsWithRateChange = 0;
    
    // Process each unit
    for (const unitDoc of unitsSnapshot.docs) {
      const unitId = unitDoc.id;
      
      // Skip creditBalances* documents (includes yearly archives like creditBalances_2025)
      if (unitId.startsWith('creditBalances')) continue;
      
      // Get unit data for owner names
      const unitData = unitDoc.data();
      
      // Extract owner names
      let ownerNames = [];
      if (Array.isArray(unitData.owners) && unitData.owners.length > 0) {
        ownerNames = unitData.owners.map(owner => {
          if (typeof owner === 'string') {
            return owner;
          } else if (owner && typeof owner === 'object') {
            return owner.name || '';
          }
          return '';
        }).filter(name => name);
      } else if (unitData.owner) {
        ownerNames = [typeof unitData.owner === 'string' ? unitData.owner : (unitData.owner.name || '')];
      }
      
      // Get current year dues (amounts are in centavos in Firestore)
      const currentYearDuesRef = db.doc(`clients/${clientId}/units/${unitId}/dues/${closingYear}`);
      const currentYearDuesDoc = await currentYearDuesRef.get();
      
      const currentYearScheduledAmount = currentYearDuesDoc.exists 
        ? (currentYearDuesDoc.data().scheduledAmount || 0) // Already in centavos
        : 0;
      
      // Default next year amount to current year amount
      const nextYearScheduledAmount = currentYearScheduledAmount; // Already in centavos
      
      // Check if new year doc already exists
      const newYearDuesRef = db.doc(`clients/${clientId}/units/${unitId}/dues/${openingYear}`);
      const newYearDuesDoc = await newYearDuesRef.get();
      const hasNewYearDoc = newYearDuesDoc.exists;
      
      // Calculate balance due and credit balance
      // Use the same logic as statement generation
      const balanceData = await calculateUnitBalances(db, clientId, unitId, closingYear, fiscalYearStartMonth);
      
      const balanceDue = balanceData.balanceDue; // In pesos
      const creditBalance = balanceData.creditBalance; // In pesos (already converted)
      
      // Track summary stats
      if (balanceDue > 0) {
        unitsWithBalanceDue++;
        totalBalanceDue += balanceDue;
      }
      if (creditBalance > 0) {
        unitsWithCredit++;
        totalCreditBalance += creditBalance; // Already in pesos
      }
      if (nextYearScheduledAmount !== currentYearScheduledAmount) {
        unitsWithRateChange++;
      }
      
      units.push({
        unitId,
        ownerNames: ownerNames.join(', '), // Join multiple owners with comma
        currentYearScheduledAmount, // In centavos
        nextYearScheduledAmount, // In centavos
        balanceDue: pesosToCentavos(balanceDue), // Convert pesos to centavos
        creditBalance, // Already in pesos from calculateUnitBalances
        hasNewYearDoc,
        priorYearClosed: null // Will be set during execute
      });
    }
    
    // Sort units by unitId
    units.sort((a, b) => a.unitId.localeCompare(b.unitId));
    
    const response = {
      client: {
        id: clientId,
        name: clientData.name || clientId,
        fiscalYearStartMonth
      },
      closingYear,
      openingYear,
      snapshotDate,
      accounts: accountBalances,
      units,
      summary: {
        totalUnits: units.length,
        unitsWithBalanceDue,
        totalBalanceDue: pesosToCentavos(totalBalanceDue), // Convert pesos to centavos
        unitsWithCredit,
        totalCreditBalance, // Already in pesos
        unitsWithRateChange
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error('❌ Error in previewYearEnd:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Execute year-end processing
 * POST /api/clients/:clientId/year-end/execute
 */
export async function executeYearEnd(req, res) {
  try {
    const clientId = req.authorizedClientId;
    const { closingYear, units, snapshotAccounts } = req.body;
    
    if (!closingYear || !Array.isArray(units)) {
      return res.status(400).json({ error: 'Missing required fields: closingYear, units' });
    }
    
    const db = await getDb();
    
    // Get client configuration
    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const clientData = clientDoc.data();
    const fiscalYearStartMonth = clientData.configuration?.fiscalYearStartMonth || 1;
    const openingYear = closingYear + 1;
    const user = req.user;
    
    const errors = [];
    let unitsProcessed = 0;
    let yearEndBalanceCreated = false;
    
    // Process all units (no exclude option)
    for (const unitData of units) {
      
      try {
        const unitId = unitData.unitId;
        const nextYearScheduledAmount = unitData.nextYearScheduledAmount || 0; // Already in centavos from frontend
        
        // Create or update new year dues document
        const newYearDuesRef = db.doc(`clients/${clientId}/units/${unitId}/dues/${openingYear}`);
        const newYearDuesDoc = await newYearDuesRef.get();
        
        const now = getNow();
        const duesData = {
          year: openingYear,
          unitId,
          scheduledAmount: nextYearScheduledAmount, // Already in centavos
          totalPaid: 0,
          payments: [],
          priorYearClosed: true,
          priorYearClosedAt: now.toISOString(),
          priorYearClosedBy: user.email || user.uid,
          created: now.toISOString(),
          createdBy: user.email || user.uid
        };
        
        if (newYearDuesDoc.exists) {
          // Update existing document
          await newYearDuesRef.update({
            scheduledAmount: duesData.scheduledAmount,
            priorYearClosed: duesData.priorYearClosed,
            priorYearClosedAt: duesData.priorYearClosedAt,
            priorYearClosedBy: duesData.priorYearClosedBy
          });
        } else {
          // Create new document
          await newYearDuesRef.set(duesData);
        }
        
        unitsProcessed++;
      } catch (error) {
        console.error(`❌ Error processing unit ${unitData.unitId}:`, error);
        errors.push({
          unitId: unitData.unitId,
          error: error.message
        });
      }
    }
    
    // Create year-end balance snapshot if requested
    if (snapshotAccounts) {
      try {
        // Check if snapshot already exists
        const yearEndBalanceRef = db.doc(`clients/${clientId}/yearEndBalances/${closingYear}`);
        const existingSnapshot = await yearEndBalanceRef.get();
        
        if (existingSnapshot.exists) {
          errors.push({
            type: 'yearEndBalance',
            error: `Year-end balance snapshot for ${closingYear} already exists`
          });
        } else {
          // Get current account balances
          const accounts = clientData.accounts || [];
          const snapshotAccounts = accounts
            .filter(acc => acc.active !== false)
            .map(acc => ({
              id: acc.id,
              name: acc.name,
              balance: pesosToCentavos(acc.balance || 0)
            }));
          
          // Create snapshot
          const { endDate } = getFiscalYearBounds(closingYear, fiscalYearStartMonth);
          const snapshotDate = endDate.toISOString().split('T')[0];
          
          await createYearEndBalance(clientId, {
            fiscalYear: closingYear,
            date: snapshotDate,
            accounts: snapshotAccounts
          }, user);
          
          yearEndBalanceCreated = true;
        }
      } catch (error) {
        console.error('❌ Error creating year-end balance snapshot:', error);
        errors.push({
          type: 'yearEndBalance',
          error: error.message
        });
      }
    }
    
    // Write audit log
    await writeAuditLog({
      module: 'yearEnd',
      action: 'execute',
      parentPath: `clients/${clientId}`,
      docId: closingYear.toString(),
      friendlyName: `Year-End ${closingYear}`,
      notes: `Executed year-end processing for ${closingYear}. Units processed: ${unitsProcessed}, Errors: ${errors.length}`,
      userId: user.uid,
      clientId
    });
    
    res.json({
      success: true,
      closingYear,
      openingYear,
      unitsProcessed,
      yearEndBalanceCreated,
      errors: errors.length > 0 ? errors : []
    });
  } catch (error) {
    console.error('❌ Error in executeYearEnd:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Generate Board Report PDF
 * GET /api/clients/:clientId/year-end/report/:closingYear?language=english|spanish
 */
export async function generateBoardReport(req, res) {
  try {
    const clientId = req.authorizedClientId;
    const closingYear = parseInt(req.params.closingYear);
    const language = req.query.language || 'english';
    
    if (isNaN(closingYear)) {
      return res.status(400).json({ error: 'Invalid closing year' });
    }
    
    // Get preview data (reuse preview logic)
    const db = await getDb();
    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const clientData = clientDoc.data();
    const fiscalYearStartMonth = clientData.configuration?.fiscalYearStartMonth || 1;
    const { endDate } = getFiscalYearBounds(closingYear, fiscalYearStartMonth);
    const snapshotDate = endDate.toISOString().split('T')[0];
    
    // Get preview data
    const previewData = await getPreviewDataForReport(db, clientId, closingYear, fiscalYearStartMonth, snapshotDate);
    
    // Generate PDF
    const pdfBuffer = await yearEndReportService.generateBoardReportPDF(previewData, language, req.user);
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="year-end-report-${clientId}-${closingYear}.pdf"`);
    
    res.send(pdfBuffer);
  } catch (error) {
    console.error('❌ Error generating board report:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Calculate unit balances (balance due and credit balance)
 * Uses same logic as statement generation
 */
async function calculateUnitBalances(db, clientId, unitId, fiscalYear, fiscalYearStartMonth) {
  try {
    // Get dues document
    const duesRef = db.doc(`clients/${clientId}/units/${unitId}/dues/${fiscalYear}`);
    const duesDoc = await duesRef.get();
    
    if (!duesDoc.exists) {
      return { balanceDue: 0, creditBalance: 0 };
    }
    
    const duesData = duesDoc.data();
    const scheduledAmount = centavosToPesos(duesData.scheduledAmount || 0);
    const totalPaid = centavosToPesos(duesData.totalPaid || 0);
    
    // Calculate total due (12 months * scheduled amount)
    const totalDue = scheduledAmount * 12;
    const balanceDue = Math.max(0, totalDue - totalPaid);
    
    // Get credit balance
    const creditBalancesRef = db.collection('clients').doc(clientId)
      .collection('units').doc('creditBalances');
    const creditBalancesDoc = await creditBalancesRef.get();
    
    let creditBalance = 0;
    if (creditBalancesDoc.exists) {
      const creditData = creditBalancesDoc.data();
      const unitCreditData = creditData[unitId];
      
      if (unitCreditData && unitCreditData.history && Array.isArray(unitCreditData.history)) {
        // Calculate credit balance from history
        creditBalance = unitCreditData.history.reduce((sum, entry) => {
          const amount = typeof entry.amount === 'number' ? entry.amount : 0;
          return sum + amount;
        }, 0);
        creditBalance = centavosToPesos(Math.max(0, creditBalance)); // Convert to pesos, ensure non-negative
      }
    }
    
    return { balanceDue, creditBalance };
  } catch (error) {
    console.error(`❌ Error calculating balances for ${unitId}:`, error);
    return { balanceDue: 0, creditBalance: 0 };
  }
}

/**
 * Get preview data for report generation
 */
async function getPreviewDataForReport(db, clientId, closingYear, fiscalYearStartMonth, snapshotDate) {
  const clientRef = db.collection('clients').doc(clientId);
  const clientDoc = await clientRef.get();
  const clientData = clientDoc.data();
  
  const openingYear = closingYear + 1;
  const accounts = clientData.accounts || [];
  
  // Get year-end balance snapshot if exists
  const yearEndBalanceRef = db.doc(`clients/${clientId}/yearEndBalances/${closingYear}`);
  const yearEndBalanceDoc = await yearEndBalanceRef.get();
  
  let accountBalances = [];
  if (yearEndBalanceDoc.exists) {
    // Use snapshot balances
    const snapshotData = yearEndBalanceDoc.data();
    accountBalances = snapshotData.accounts || [];
  } else {
    // Use current balances (already in centavos)
    accountBalances = accounts
      .filter(acc => acc.active !== false)
      .map(acc => ({
        id: acc.id,
        name: acc.name,
        balance: acc.balance || 0 // Already in centavos, no conversion needed
      }));
  }
  
  // Get units
  const unitsRef = db.collection(`clients/${clientId}/units`);
  const unitsSnapshot = await unitsRef.get();
  
  const units = [];
  for (const unitDoc of unitsSnapshot.docs) {
    const unitId = unitDoc.id;
    if (unitId.startsWith('creditBalances')) continue;
    
    // Get unit data for owner names
    const unitData = unitDoc.data();
    
    // Extract owner names
    let ownerNames = [];
    if (Array.isArray(unitData.owners) && unitData.owners.length > 0) {
      ownerNames = unitData.owners.map(owner => {
        if (typeof owner === 'string') {
          return owner;
        } else if (owner && typeof owner === 'object') {
          return owner.name || '';
        }
        return '';
      }).filter(name => name);
    } else if (unitData.owner) {
      ownerNames = [typeof unitData.owner === 'string' ? unitData.owner : (unitData.owner.name || '')];
    }
    
    const currentYearDuesRef = db.doc(`clients/${clientId}/units/${unitId}/dues/${closingYear}`);
    const currentYearDuesDoc = await currentYearDuesRef.get();
    
    const currentYearScheduledAmount = currentYearDuesDoc.exists 
      ? (currentYearDuesDoc.data().scheduledAmount || 0) // In centavos
      : 0;
    
    const newYearDuesRef = db.doc(`clients/${clientId}/units/${unitId}/dues/${openingYear}`);
    const newYearDuesDoc = await newYearDuesRef.get();
    
    const nextYearScheduledAmount = newYearDuesDoc.exists
      ? (newYearDuesDoc.data().scheduledAmount || 0) // In centavos
      : currentYearScheduledAmount;
    
    const balanceData = await calculateUnitBalances(db, clientId, unitId, closingYear, fiscalYearStartMonth);
    
    units.push({
      unitId,
      ownerNames: ownerNames.join(', '), // Join multiple owners with comma
      currentYearScheduledAmount, // In centavos
      nextYearScheduledAmount, // In centavos
      balanceDue: pesosToCentavos(balanceData.balanceDue), // Convert pesos to centavos
      creditBalance: balanceData.creditBalance // Already in pesos
    });
  }
  
  units.sort((a, b) => a.unitId.localeCompare(b.unitId));
  
  return {
    client: {
      id: clientId,
      name: clientData.name || clientId,
      fiscalYearStartMonth
    },
    closingYear,
    openingYear,
    snapshotDate,
    accounts: accountBalances,
    units
  };
}

