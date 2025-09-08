// controllers/waterBillsController.js
import waterBillsService from '../services/waterBillsService.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import penaltyRecalculationService from '../services/penaltyRecalculationService.js';

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
    
    // Audit log
    await writeAuditLog({
      module: 'waterBills',
      action: 'generateBills',
      parentPath: `clients/${clientId}/projects/waterBills/bills`,
      docId: `${year}-${String(month).padStart(2, '0')}`,
      friendlyName: `Water bills for ${result.billingPeriod}`,
      notes: `Generated bills for ${result.summary.totalUnits} units, total: ${result.summary.currencySymbol}${result.summary.totalBilled}`,
      clientId
    });
    
    // Return only unpaid bills as per requirement
    res.json({
      success: true,
      message: `Generated bills for ${result.summary.totalUnits} units`,
      data: result
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
    
    res.json({
      success: true,
      data: bills
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
    
    console.log(`Manual penalty recalculation requested for client: ${clientId}`);
    
    const result = await penaltyRecalculationService.recalculatePenaltiesForClient(clientId);
    
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
          'config.lastPenaltyRecalc': new Date().toISOString()
        });
    } catch (configUpdateError) {
      console.warn('Failed to update lastPenaltyRecalc timestamp:', configUpdateError);
      // Don't fail the whole operation for this
    }
    
    res.json({
      success: true,
      message: `Penalty recalculation completed for ${data.processedBills} bills`,
      data: {
        processedBills: data.processedBills,
        updatedBills: data.updatedBills,
        totalPenaltiesUpdated: data.totalPenaltiesUpdated,
        clientId: data.clientId
      }
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