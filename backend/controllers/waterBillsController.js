// controllers/waterBillsController.js
import waterBillsService from '../services/waterBillsService.js';
import { waterDataService } from '../services/waterDataService.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import penaltyRecalculationService from '../services/penaltyRecalculationService.js';
import { getNow } from '../../shared/services/DateService.js';
import { centavosToPesos } from '../../shared/utils/currencyUtils.js';

/**
 * Convert bills from centavos (backend storage) to pesos (frontend display)
 */
function convertBillsToPesos(billsData) {
  if (!billsData || !billsData.bills || !billsData.bills.units) return billsData;
  
  const currencyFields = [
    'waterCharge', 'carWashCharge', 'boatWashCharge',
    'currentCharge', 'penaltyAmount', 'totalAmount',
    'paidAmount', 'penaltyPaid', 'basePaid', 'previousBalance'
  ];
  
  const convertedUnits = {};
  for (const [unitId, unitBill] of Object.entries(billsData.bills.units)) {
    convertedUnits[unitId] = { ...unitBill };
    
    // Convert each currency field
    for (const field of currencyFields) {
      if (typeof unitBill[field] === 'number') {
        convertedUnits[unitId][field] = centavosToPesos(unitBill[field]);
      }
    }
    
    // Convert payments array if present
    if (unitBill.payments && Array.isArray(unitBill.payments)) {
      convertedUnits[unitId].payments = unitBill.payments.map(payment => ({
        ...payment,
        amount: typeof payment.amount === 'number' ? centavosToPesos(payment.amount) : payment.amount,
        baseChargePaid: typeof payment.baseChargePaid === 'number' ? centavosToPesos(payment.baseChargePaid) : payment.baseChargePaid,
        penaltyPaid: typeof payment.penaltyPaid === 'number' ? centavosToPesos(payment.penaltyPaid) : payment.penaltyPaid
      }));
    }
  }
  
  // Convert summary amounts if present
  const convertedSummary = billsData.summary ? {
    ...billsData.summary,
    totalNewCharges: centavosToPesos(billsData.summary.totalNewCharges || 0),
    totalBilled: centavosToPesos(billsData.summary.totalBilled || 0),
    totalUnpaid: centavosToPesos(billsData.summary.totalUnpaid || 0),
    totalPaid: centavosToPesos(billsData.summary.totalPaid || 0)
  } : billsData.summary;
  
  return {
    ...billsData,
    bills: {
      units: convertedUnits
    },
    summary: convertedSummary
  };
}

/**
 * Get billing configuration for a client
 * GET /api/clients/:clientId/water/config
 */
export const getBillingConfig = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const config = await waterBillsService.getBillingConfig(clientId);
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Generate bills for a specific month
 * POST /api/clients/:clientId/water/bills/generate
 */
export const generateBills = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { year, month, dueDate } = req.body;
    
    if (!year || month === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: year, month'
      });
    }
    
    const result = await waterBillsService.generateBills(
      clientId,
      parseInt(year),
      parseInt(month),
      dueDate ? { dueDate } : undefined
    );
    
    // Bills generated successfully - frontend will fetch fresh data
    console.log(`✅ [GENERATE_BILLS] Bills generated successfully`);
    
    // Convert bills from centavos to pesos for frontend compatibility
    const convertedResult = convertBillsToPesos(result);
    
    // Audit log (convert amounts for audit display)
    await writeAuditLog({
      module: 'waterBills',
      action: 'generateBills',
      parentPath: `clients/${clientId}/projects/waterBills/bills`,
      docId: `${year}-${String(month).padStart(2, '0')}`,
      friendlyName: `Water bills for ${convertedResult.billingPeriod}`,
      notes: `Generated bills for ${convertedResult.summary.totalUnits} units, total: ${convertedResult.summary.currencySymbol}${convertedResult.summary.totalBilled}`,
      clientId
    });
    
    // Return converted bills (in pesos) as per requirement
    res.json({
      success: true,
      message: `Generated bills for ${convertedResult.summary.totalUnits} units`,
      data: convertedResult
    });
  } catch (error) {
    console.error('Error generating bills:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get bills for a specific month
 * GET /api/clients/:clientId/water/bills/:year/:month
 */
export const getBills = async (req, res) => {
  try {
    const { clientId, year, month } = req.params;
    const { unpaidOnly } = req.query;
    
    const bills = await waterBillsService.getBills(
      clientId,
      parseInt(year),
      parseInt(month),
      unpaidOnly === 'true'
    );
    
    if (!bills) {
      return res.status(404).json({
        success: false,
        error: `No bills found for ${month}/${year}`
      });
    }
    
    // Convert bills from centavos to pesos for frontend compatibility
    const convertedBills = convertBillsToPesos(bills);
    
    res.json({
      success: true,
      data: convertedBills
    });
  } catch (error) {
    console.error('Error getting bills:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get water billing configuration
 * GET /api/clients/:clientId/water/config
 */
export const getConfig = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const config = await waterBillsService.getBillingConfig(clientId);
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Manually recalculate penalties for all unpaid bills
 * POST /api/clients/:clientId/water/bills/recalculate-penalties
 */
export const recalculatePenalties = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { unitIds } = req.body; // Optional: unit IDs for surgical updates
    
    const scopeDescription = unitIds ? ` (scoped to ${unitIds.length} unit(s))` : '';
    console.log(`Manual penalty recalculation requested for client: ${clientId}${scopeDescription}`);
    
    // Pass unitIds to service (undefined if not provided - backward compatible)
    const result = await penaltyRecalculationService.recalculatePenaltiesForClient(clientId, undefined, unitIds);
    
    // Handle the new success/error structure from penalty service
    if (!result.success) {
      // Handle configuration errors or calculation errors
      const statusCode = result.error.type === 'CONFIG_ERROR' ? 400 : 500;
      return res.status(statusCode).json(result);
    }
    
    // Success case - log audit and return response
    const { data } = result;
    
    // Audit log
    await writeAuditLog({
      module: 'waterBills',
      action: 'recalculatePenalties',
      parentPath: `clients/${clientId}/projects/waterBills`,
      docId: 'penalty-recalculation',
      friendlyName: 'Manual penalty recalculation',
      notes: `Processed ${data.processedBills} bills, updated ${data.updatedBills} bills with penalties totaling $${data.totalPenaltiesUpdated}`,
      clientId
    });
    
    // Store lastPenaltyRecalc timestamp for Dashboard trigger logic
    try {
      const admin = await import('firebase-admin');
      const db = admin.default.firestore();
      await db.collection('clients').doc(clientId)
        .collection('projects').doc('waterBills')
        .update({
          'config.lastPenaltyRecalc': getNow().toISOString()
        });
    } catch (configUpdateError) {
      console.warn('Failed to update lastPenaltyRecalc timestamp:', configUpdateError);
      // Don't fail the whole operation for this
    }
    
    res.json({
      success: true,
      message: `Penalty recalculation completed for ${data.processedBills} bills`,
      data: data // Return ALL metrics including performance data
    });
  } catch (error) {
    console.error('Error recalculating penalties:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get penalty summary for a client
 * GET /api/clients/:clientId/water/bills/penalty-summary
 */
export const getPenaltySummary = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const summary = await penaltyRecalculationService.getPenaltySummary(clientId);
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting penalty summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};