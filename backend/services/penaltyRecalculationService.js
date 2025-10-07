import admin from 'firebase-admin';

class PenaltyRecalculationService {
  constructor() {
    this.db = admin.firestore();
  }

  /**
   * Load and validate water billing configuration
   * @param {string} clientId - The client ID
   * @returns {Object} Validated configuration
   * @throws {Error} If config is missing or invalid
   */
  async loadValidatedConfig(clientId) {
    const configDoc = await this.db
      .collection('clients').doc(clientId)
      .collection('config').doc('waterBills')
      .get();
    
    if (!configDoc.exists) {
      throw new Error(`Water billing configuration not found for client ${clientId}. Cannot proceed with penalty calculation.`);
    }
    
    const config = configDoc.data();
    
    // Validate required fields
    const errors = [];
    
    if (typeof config.penaltyRate !== 'number' || config.penaltyRate <= 0) {
      errors.push('penaltyRate must be a positive number');
    }
    
    if (typeof config.penaltyDays !== 'number' || config.penaltyDays <= 0) {
      errors.push('penaltyDays must be a positive number');
    }
    
    if (errors.length > 0) {
      throw new Error(`Invalid water billing configuration for client ${clientId}: ${errors.join(', ')}`);
    }
    
    return config;
  }

  /**
   * Recalculate penalties for all unpaid bills for a specific client
   * @param {string} clientId - The client ID to recalculate penalties for
   * @param {Date} currentDate - Current date for penalty calculation
   * @returns {Promise<Object>} Summary with success/error structure for UI handling
   */
  async recalculatePenaltiesForClient(clientId, currentDate = getNow()) {
    try {
      console.log(`Starting penalty recalculation for client: ${clientId}`);
      
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
        console.warn(`No water bills found for client: ${clientId}`);
        return {
          success: true,
          data: results
        };
      }

      console.log(`📊 Found ${billsSnapshot.size} bill documents to process for ${clientId}`);

      // Process each month's bills
      for (const billDoc of billsSnapshot.docs) {
        const billData = billDoc.data();
        let hasUpdates = false;

        if (!billData.bills || !billData.bills.units) {
          console.log(`⚠️ Skipping ${billDoc.id} - no bills.units structure`);
          continue;
        }

        const unitCount = Object.keys(billData.bills.units).length;
        console.log(`🏠 Processing ${billDoc.id} with ${unitCount} units, due date: ${billData.dueDate}`);

        // Process each unit's bills in this month
        for (const [unitId, unitData] of Object.entries(billData.bills.units)) {
          if (unitData.status === 'paid') continue;

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

            console.log(`Updated penalty for ${clientId} Unit ${unitId} ${billDoc.id}: $${penaltyResult.penaltyAmount}`);
          }
        }

        // Save updates to this month's bill if any were made
        if (hasUpdates) {
          await billDoc.ref.set(billData, { merge: true });
        }
      }

      console.log(`Penalty recalculation completed for client ${clientId}. Updated ${results.updatedBills} bills.`);
      return {
        success: true,
        data: results
      };

    } catch (error) {
      console.error(`Error recalculating penalties for client ${clientId}:`, error);
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
   * Implementation:
   * - Bills are due on the 1st of each month
   * - Grace period: configurable days (default 10)
   * - After grace period: Add penalty rate % to existing penalty amount
   * - Penalties are INCREMENTAL, not recalculated from scratch
   * 
   * @param {Object} billData - The bill data object
   * @param {Date} currentDate - Current date for calculation
   * @param {string} billDueDate - The due date from the bill document
   * @param {Object} config - Water billing configuration with penaltyRate and penaltyDays
   * @returns {Object} Penalty calculation result
   */
  calculatePenaltyForBill(billData, currentDate, billDueDate, config) {
    const result = {
      penaltyAmount: billData.penaltyAmount || 0,  // Start with existing penalty
      updated: false,
      details: {
        // Use unpaid balance (totalAmount - paidAmount - existing penalties) for penalty calculations
        unpaidBalance: Math.max(0, (billData.totalAmount || billData.currentCharge || 0) - (billData.paidAmount || 0) - (billData.penaltyAmount || 0)),
        chargeAmount: billData.currentCharge || 0,
        penaltyRate: config.penaltyRate,
        graceDays: config.penaltyDays,
        lastUpdate: billData.lastPenaltyUpdate
      }
    };

    // Parse the bill's due date and calculate grace period end from that date
    const billDueDateObj = new Date(billDueDate);
    const gracePeriodEnd = new Date(billDueDateObj);
    gracePeriodEnd.setDate(billDueDateObj.getDate() + result.details.graceDays);
    
    // Check if we're past the bill's grace period
    const pastGracePeriod = currentDate > gracePeriodEnd;
    console.log(`📅 Date Check - Current: ${currentDate.toISOString()}, Bill Due: ${billDueDateObj.toISOString()}, Grace End: ${gracePeriodEnd.toISOString()}, Past Grace: ${pastGracePeriod}`);
    
    // Calculate overdue amount (unpaid principal without penalties)
    const overdueAmount = Math.max(0, (billData.currentCharge || 0) - (billData.paidAmount || 0));
    
    console.log(`🔍 [PENALTY_DEBUG] Bill data: charge=${billData.currentCharge}, paid=${billData.paidAmount}, currentPenalty=${billData.penaltyAmount}`);
    console.log(`🔍 [PENALTY_DEBUG] Calculated overdue amount: $${overdueAmount}`);
    
    if (pastGracePeriod && overdueAmount > 0) {
      // Calculate how many complete penalty periods have passed since grace period ended
      const monthsSinceGracePeriod = this.getMonthsDifference(gracePeriodEnd, currentDate);
      console.log(`🔢 Months since grace period ended: ${monthsSinceGracePeriod}`);
      console.log(`💰 Overdue amount for penalty calculation: $${overdueAmount}`);
      
      // COMPOUNDING PENALTY LOGIC: Each month, penalty is calculated on (principal + previous penalties)
      // Start with overdue principal amount
      let runningTotal = overdueAmount;
      let totalPenalty = 0;
      
      console.log(`🧮 [COMPOUND_CALC] Starting compounding calculation:`);
      console.log(`🧮 [COMPOUND_CALC] Initial overdue principal: $${overdueAmount}`);
      
      for (let month = 1; month <= monthsSinceGracePeriod; month++) {
        const monthlyPenalty = runningTotal * result.details.penaltyRate;
        totalPenalty += monthlyPenalty;
        runningTotal += monthlyPenalty;
        
        console.log(`🧮 [COMPOUND_CALC] Month ${month}: $${runningTotal.toFixed(2)} × ${result.details.penaltyRate} = $${monthlyPenalty.toFixed(2)} penalty (total penalty: $${totalPenalty.toFixed(2)})`);
      }
      
      const expectedPenalty = Math.round(totalPenalty * 100) / 100;
      
      // Update if penalty amounts are different (switching to compounding logic)
      if (Math.abs(result.penaltyAmount - expectedPenalty) > 0.01) {
        console.log(`💰 Updating penalty: Current $${result.penaltyAmount} -> Expected $${expectedPenalty} (compounding logic)`);
        result.penaltyAmount = expectedPenalty;
        result.updated = true;
        result.details.lastUpdate = currentDate.toISOString();
      } else {
        console.log(`✅ Penalty already up-to-date: $${result.penaltyAmount} (expected $${expectedPenalty})`);
      }
    }
    
    return result;
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
    try {
      console.log('Starting monthly penalty recalculation for all clients');
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
            console.error(`Failed to recalculate penalties for client ${clientId}:`, error);
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
      console.log(`Monthly penalty recalculation completed. Updated ${totalUpdated} bills across ${results.length} clients.`);

      return results;

    } catch (error) {
      console.error('Error in monthly penalty recalculation:', error);
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
        console.log(`Manual penalty recalculation requested for client: ${clientId}`);
        return await this.recalculatePenaltiesForClient(clientId);
      } else {
        console.log('Manual penalty recalculation requested for all clients');
        return await this.scheduleMonthlyPenaltyRecalc();
      }
    } catch (error) {
      console.error('Manual penalty recalculation failed:', error);
      throw error;
    }
  }

  /**
   * Get penalty calculation summary for a client
   * @param {string} clientId - The client ID
   * @returns {Promise<Object>} Summary of penalties for the client
   */
  async getPenaltySummary(clientId) {
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
      console.error(`Error getting penalty summary for client ${clientId}:`, error);
      throw error;
    }
  }
}

const penaltyRecalculationService = new PenaltyRecalculationService();
export default penaltyRecalculationService;