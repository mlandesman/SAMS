import admin from 'firebase-admin';
import { getNow } from '../../shared/services/DateService.js';
import { pesosToCentavos, centavosToPesos } from '../../shared/utils/currencyUtils.js';

// Phase 3C: Import shared penalty calculation service
import {
  validatePenaltyConfig,
  calculatePenaltyForBill as calculatePenaltyForBillShared,
  recalculatePenalties as recalculatePenaltiesShared,
  loadBillingConfig
} from '../../shared/services/PenaltyRecalculationService.js';
import { logDebug, logInfo, logWarn, logError } from '../../shared/logger.js';

class PenaltyRecalculationService {
  constructor() {
    this.db = null;
  }

  async _initializeDb() {
    if (!this.db) {
      this.db = admin.firestore();
    }
  }

  /**
   * Load and validate water billing configuration
   * 
   * PHASE 3C: Now uses shared PenaltyRecalculationService
   * 
   * @param {string} clientId - The client ID
   * @returns {Object} Validated configuration
   * @throws {Error} If config is missing or invalid
   */
  async loadValidatedConfig(clientId) {
    // Use shared service to load config
    const config = await loadBillingConfig(clientId, 'water');
    
    // Validate using shared function
    return validatePenaltyConfig(config);
  }

  /**
   * Recalculate penalties for all unpaid bills for a specific client
   * @param {string} clientId - The client ID to recalculate penalties for
   * @param {Date} currentDate - Current date for penalty calculation
   * @param {Array<string>} unitIds - Optional: Array of unit IDs to recalculate (for surgical updates)
   * @returns {Promise<Object>} Summary with success/error structure for UI handling
   */
  async recalculatePenaltiesForClient(clientId, currentDate = getNow(), unitIds = null) {
    await this._initializeDb();
    
    try {
      const startTime = Date.now();
      const scopeDescription = unitIds ? `units: [${unitIds.join(', ')}]` : 'all units';
      logDebug(`🔄 [PENALTY_RECALC] Starting penalty recalculation for client ${clientId} (${scopeDescription})`);
      
      // Load and validate configuration first
      let config;
      try {
        config = await this.loadValidatedConfig(clientId);
      } catch (configError) {
        return {
          success: false,
          error: {
            type: 'CONFIG_ERROR',
            message: configError.message,
            details: {
              clientId,
              action: 'penalty_calculation',
              originalError: configError.message
            }
          }
        };
      }

      const results = {
        clientId,
        processedBills: 0,
        updatedBills: 0,
        skippedPaidBills: 0,
        skippedOutOfScopeBills: 0,
        totalPenaltiesUpdated: 0,
        errors: []
      };

      // Get all water bills using the actual collection structure
      const billsCollectionRef = this.db
        .collection('clients').doc(clientId)
        .collection('projects').doc('waterBills')
        .collection('bills');

      const billsSnapshot = await billsCollectionRef.get();

      if (billsSnapshot.empty) {
        logWarn(`⚠️  [PENALTY_RECALC] No water bills found for client: ${clientId}`);
        const elapsedTime = Date.now() - startTime;
        return {
          success: true,
          data: { ...results, processingTimeMs: elapsedTime }
        };
      }

      logDebug(`📊 [PENALTY_RECALC] Found ${billsSnapshot.size} bill documents to process for ${clientId}`);

      // Process each month's bills
      for (const billDoc of billsSnapshot.docs) {
        const billData = billDoc.data();
        let hasUpdates = false;

        if (!billData.bills || !billData.bills.units) {
          logDebug(`⚠️  [PENALTY_RECALC] Skipping ${billDoc.id} - no bills.units structure`);
          continue;
        }

        const unitCount = Object.keys(billData.bills.units).length;
        logDebug(`🏠 [PENALTY_RECALC] Processing ${billDoc.id} with ${unitCount} units, due date: ${billData.dueDate}`);

        // Process each unit's bills in this month
        for (const [unitId, unitData] of Object.entries(billData.bills.units)) {
          // OPTIMIZATION 1: Skip out-of-scope units (surgical update optimization)
          if (unitIds && !unitIds.includes(unitId)) {
            results.skippedOutOfScopeBills++;
            continue;
          }
          
          // OPTIMIZATION 2: Skip paid bills early (they can't accumulate penalties)
          if (unitData.status === 'paid') {
            results.skippedPaidBills++;
            continue;
          }

          results.processedBills++;

          // Calculate penalty using validated config
          const penaltyResult = this.calculatePenaltyForBill(unitData, currentDate, billData.dueDate, config);
          
          if (penaltyResult.updated) {
            // Update the bill with new penalty calculation
            unitData.penaltyAmount = penaltyResult.penaltyAmount;
            // Use currentCharge with fallback pattern as coordinated
            unitData.totalAmount = (unitData.currentCharge || 0) + penaltyResult.penaltyAmount;
            unitData.lastPenaltyUpdate = penaltyResult.details.lastUpdate;

            results.updatedBills++;
            results.totalPenaltiesUpdated += penaltyResult.penaltyAmount;
            hasUpdates = true;

            logDebug(`Updated penalty for ${clientId} Unit ${unitId} ${billDoc.id}: $${penaltyResult.penaltyAmount}`);
          }
        }

        // Save updates to this month's bill if any were made
        if (hasUpdates) {
          await billDoc.ref.set(billData, { merge: true });
        }
      }

      // Performance metrics and summary
      const elapsedTime = Date.now() - startTime;
      const performanceMetrics = {
        processingTimeMs: elapsedTime,
        billsProcessed: results.processedBills,
        billsUpdated: results.updatedBills,
        billsSkippedPaid: results.skippedPaidBills,
        billsSkippedOutOfScope: results.skippedOutOfScopeBills,
        efficiencyGain: unitIds ? `${results.skippedOutOfScopeBills + results.skippedPaidBills} bills skipped (surgical mode)` : `${results.skippedPaidBills} paid bills skipped`
      };
      
      logDebug(`✅ [PENALTY_RECALC] Penalty recalculation completed for client ${clientId}`);
      logDebug(`📊 [PENALTY_RECALC] Performance Metrics:`, performanceMetrics);
      logDebug(`   - Processing time: ${elapsedTime}ms`);
      logDebug(`   - Bills processed: ${results.processedBills}`);
      logDebug(`   - Bills updated: ${results.updatedBills}`);
      logDebug(`   - Paid bills skipped: ${results.skippedPaidBills}`);
      if (unitIds) {
        logDebug(`   - Out-of-scope bills skipped: ${results.skippedOutOfScopeBills}`);
        logDebug(`   - Unit scope: [${unitIds.join(', ')}]`);
      }
      
      return {
        success: true,
        data: { ...results, ...performanceMetrics }
      };

    } catch (error) {
      logError(`Error recalculating penalties for client ${clientId}:`, error);
      return {
        success: false,
        error: {
          type: 'CALCULATION_ERROR',
          message: 'Failed to recalculate penalties',
          details: {
            clientId,
            originalError: error.message
          }
        }
      };
    }
  }

  /**
   * PENALTY CALCULATION RULES (Per Condominium Contract):
   * 
   * Water Bills: "The water consumption must be paid within the first 10 days 
   * of the corresponding month, after the ten days there will be a 5% interest 
   * per month as approved by the Condominium Owner's Meeting"
   * 
   * PHASE 3C: Now uses shared PenaltyRecalculationService
   * This is a wrapper that delegates to the shared service
   * 
   * @param {Object} billData - The bill data object
   * @param {Date} currentDate - Current date for calculation
   * @param {string} billDueDate - The due date from the bill document
   * @param {Object} config - Water billing configuration with penaltyRate and penaltyDays
   * @returns {Object} Penalty calculation result
   */
  calculatePenaltyForBill(billData, currentDate, billDueDate, config) {
    // Prepare bill object for shared service
    const bill = {
      billId: billData.billId || 'unknown',
      currentCharge: billData.currentCharge || 0,
      paidAmount: billData.paidAmount || 0,
      penaltyAmount: billData.penaltyAmount || 0,
      dueDate: billDueDate,
      lastPenaltyUpdate: billData.lastPenaltyUpdate
    };
    
    // If no due date, return early with no penalty update
    if (!billDueDate) {
      logDebug(`⚠️  [PENALTY_RECALC] Bill has no due date - skipping penalty calculation`);
      return {
        penaltyAmount: billData.penaltyAmount || 0,
        updated: false,
        details: {
          unpaidBalance: Math.max(0, (billData.totalAmount || billData.currentCharge || 0) - (billData.paidAmount || 0) - (billData.penaltyAmount || 0)),
          chargeAmount: billData.currentCharge || 0,
          penaltyRate: config.penaltyRate,
          graceDays: config.penaltyDays,
          lastUpdate: billData.lastPenaltyUpdate
        }
      };
    }
    
    // Use shared penalty calculation service
    return calculatePenaltyForBillShared({
      bill,
      asOfDate: currentDate,
      config
    });
  }

  /**
   * Calculate the number of months between two dates
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {number} Number of months difference
   */
  getMonthsDifference(startDate, endDate) {
    const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                   (endDate.getMonth() - startDate.getMonth());
    return Math.max(0, months);
  }

  /**
   * Schedule monthly penalty recalculation for all clients
   * This should be called on the 11th of each month
   * @returns {Promise<Array>} Results for all clients
   */
  async scheduleMonthlyPenaltyRecalc() {
    await this._initializeDb();
    
    try {
      logDebug('Starting monthly penalty recalculation for all clients');
      const currentDate = getNow();
      
      // Get all clients that have waterBills projects
      const clientsSnapshot = await this.db.collection('clients').get();
      const results = [];

      for (const clientDoc of clientsSnapshot.docs) {
        const clientId = clientDoc.id;
        
        // Check if this client has water bills
        const waterBillsProject = await this.db
          .collection('clients').doc(clientId)
          .collection('projects').doc('waterBills')
          .get();

        if (waterBillsProject.exists) {
          try {
            const clientResult = await this.recalculatePenaltiesForClient(clientId, currentDate);
            results.push(clientResult);
          } catch (error) {
            logError(`Failed to recalculate penalties for client ${clientId}:`, error);
            results.push({
              clientId,
              error: error.message,
              processedBills: 0,
              updatedBills: 0
            });
          }
        }
      }

      const totalUpdated = results.reduce((sum, result) => sum + (result.updatedBills || 0), 0);
      logDebug(`Monthly penalty recalculation completed. Updated ${totalUpdated} bills across ${results.length} clients.`);

      return results;

    } catch (error) {
      logError('Error in monthly penalty recalculation:', error);
      throw error;
    }
  }

  /**
   * Manual penalty recalculation trigger for admin use
   * @param {string} clientId - Optional specific client ID
   * @returns {Promise<Object|Array>} Recalculation results
   */
  async manualPenaltyRecalc(clientId = null) {
    try {
      if (clientId) {
        logDebug(`Manual penalty recalculation requested for client: ${clientId}`);
        return await this.recalculatePenaltiesForClient(clientId);
      } else {
        logDebug('Manual penalty recalculation requested for all clients');
        return await this.scheduleMonthlyPenaltyRecalc();
      }
    } catch (error) {
      logError('Manual penalty recalculation failed:', error);
      throw error;
    }
  }

  /**
   * Recalculate penalties for specific units only (convenience method for surgical updates)
   * @param {string} clientId - The client ID
   * @param {Array<string>} unitIds - Array of unit IDs to recalculate
   * @param {Date} currentDate - Current date for penalty calculation
   * @returns {Promise<Object>} Summary with success/error structure
   */
  async recalculatePenaltiesForUnits(clientId, unitIds, currentDate = getNow()) {
    if (!Array.isArray(unitIds) || unitIds.length === 0) {
      throw new Error('unitIds must be a non-empty array');
    }
    
    logDebug(`🎯 [PENALTY_RECALC] Surgical update: recalculating penalties for ${unitIds.length} unit(s)`);
    return await this.recalculatePenaltiesForClient(clientId, currentDate, unitIds);
  }

  /**
   * Get penalty calculation summary for a client
   * @param {string} clientId - The client ID
   * @returns {Promise<Object>} Summary of penalties for the client
   */
  async getPenaltySummary(clientId) {
    await this._initializeDb();
    
    try {
      const billsCollectionRef = this.db
        .collection('clients').doc(clientId)
        .collection('projects').doc('waterBills')
        .collection('bills');

      const billsSnapshot = await billsCollectionRef.get();

      if (billsSnapshot.empty) {
        return { clientId, totalPenalties: 0, unpaidBills: 0 };
      }

      let totalPenalties = 0;
      let unpaidBills = 0;

      // Sum penalties across all unpaid bills
      for (const billDoc of billsSnapshot.docs) {
        const billData = billDoc.data();
        
        if (!billData.bills || !billData.bills.units) continue;

        for (const [unitId, unitData] of Object.entries(billData.bills.units)) {
          if (unitData.status !== 'paid') {
            totalPenalties += unitData.penaltyAmount || 0;
            unpaidBills++;
          }
        }
      }

      return {
        clientId,
        totalPenalties: Math.round(totalPenalties * 100) / 100,
        unpaidBills,
        lastCalculated: getNow().toISOString()
      };

    } catch (error) {
      logError(`Error getting penalty summary for client ${clientId}:`, error);
      throw error;
    }
  }
}

const penaltyRecalculationService = new PenaltyRecalculationService();
export default penaltyRecalculationService;