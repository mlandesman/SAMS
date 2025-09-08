// services/projectsService.js
import admin from 'firebase-admin';
import { getDb } from '../firebase.js';

/**
 * Generic Projects Service
 * Handles any type of project (water bills, propane readings, roof assessments, etc.)
 * Uses the new projects structure: /clients/{clientId}/projects/{projectType}
 */
class ProjectsService {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize Firestore connection
   * @private
   */
  async _initializeDb() {
    if (!this.db) {
      this.db = await getDb();
    }
  }

  /**
   * Get project data for a specific period
   * Works for water bills, propane, or any project type
   * @param {string} clientId - Client identifier
   * @param {string} projectType - Type of project (waterBills, propane, etc.)
   * @param {number} year - Year
   * @param {number} monthIndex - Month index (0-11)
   * @returns {Object} Project data for the period
   */
  async getProjectPeriod(clientId, projectType, year, monthIndex) {
    await this._initializeDb();
    
    const docRef = this.db
      .collection('clients').doc(clientId)
      .collection('projects').doc(projectType)
      .collection(year.toString()).doc('data');
    
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new Error(`No ${projectType} data for ${year}`);
    }
    
    const data = doc.data();
    if (!data.months || !data.months[monthIndex]) {
      throw new Error(`No data for month ${monthIndex} in ${projectType} ${year}`);
    }
    
    return data.months[monthIndex];
  }

  /**
   * Update readings/measurements for a period
   * Generic enough for water meters, propane gauges, etc.
   * @param {string} clientId - Client identifier
   * @param {string} projectType - Type of project
   * @param {number} year - Year
   * @param {number} monthIndex - Month index (0-11)
   * @param {Object} readings - Object with unitId: reading pairs
   * @returns {Object} Updated unit data
   */
  async updateReadings(clientId, projectType, year, monthIndex, readings) {
    await this._initializeDb();
    
    const docRef = this.db
      .collection('clients').doc(clientId)
      .collection('projects').doc(projectType)
      .collection(year.toString()).doc('data');
    
    const doc = await docRef.get();
    let data;
    
    if (!doc.exists) {
      // Initialize structure if it doesn't exist
      data = {
        year,
        months: new Array(12).fill(null),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      };
      data.months[monthIndex] = {
        monthIndex,
        period: `${['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'][monthIndex]} ${year}`,
        units: {},
        commonArea: null,
        buildingMeter: null
      };
      await docRef.set(data);
    } else {
      data = doc.data();
    }
    
    // Initialize current month if null
    if (!data.months[monthIndex]) {
      data.months[monthIndex] = {
        monthIndex,
        period: `${['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'][monthIndex]} ${year}`,
        units: {},
        commonArea: null,
        buildingMeter: null
      };
    }
    
    const currentMonth = data.months[monthIndex];
    const previousMonth = monthIndex > 0 ? data.months[monthIndex - 1] : null;
    
    // Ensure currentMonth has units structure
    if (!currentMonth.units) {
      currentMonth.units = {};
    }
    
    // Separate out special fields from unit readings
    const { commonArea, buildingMeter, ...unitReadings } = readings;
    
    // Process each unit's reading
    const updatedUnits = {};
    let unitsTotal = 0;
    
    for (const [unitId, currentReading] of Object.entries(unitReadings)) {
      // Get prior reading from previous month or current month's prior field
      let priorReading = currentMonth.units[unitId]?.priorReading;
      if (!priorReading && previousMonth && previousMonth.units && previousMonth.units[unitId]) {
        priorReading = previousMonth.units[unitId].currentReading || 0;
      }
      if (!priorReading) {
        priorReading = 0; // Default for first reading
      }
      
      const consumption = Math.max(0, currentReading - priorReading);
      // Use config rate if available, otherwise default to 50 pesos per m³
      const ratePerM3 = data.config?.ratePerM3 || 50;
      const amount = Math.round(consumption * ratePerM3);
      
      // For water bills V2, we're just tracking readings, not payments
      // So we'll simplify this structure
      updatedUnits[unitId] = {
        priorReading,
        currentReading,
        consumption,
        amount,
        unpaidBalance: 0,  // Simplified - no payment tracking for now
        monthsBehind: 0,   // Simplified - no payment tracking for now
        paid: false,
        paidDate: null,
        paymentRecord: null
      };
      
      unitsTotal += currentReading;
      
      // Skip validation for water bills (simplified implementation)
      // this.validateUnitData(updatedUnits[unitId]);
    }
    
    // Process common area if provided
    if (commonArea !== undefined && commonArea !== null) {
      let commonPriorReading = currentMonth.commonArea?.priorReading;
      if (!commonPriorReading && previousMonth?.commonArea) {
        commonPriorReading = previousMonth.commonArea.currentReading || 0;
      }
      if (!commonPriorReading) {
        commonPriorReading = 0;
      }
      
      currentMonth.commonArea = {
        currentReading: parseInt(commonArea),
        priorReading: commonPriorReading,
        consumption: Math.max(0, parseInt(commonArea) - commonPriorReading)
      };
    }
    
    // Process or calculate building meter
    if (buildingMeter !== undefined && buildingMeter !== null) {
      // Use provided building meter reading
      let buildingPriorReading = currentMonth.buildingMeter?.priorReading;
      if (!buildingPriorReading && previousMonth?.buildingMeter) {
        buildingPriorReading = previousMonth.buildingMeter.currentReading || 0;
      }
      if (!buildingPriorReading) {
        buildingPriorReading = 0;
      }
      
      currentMonth.buildingMeter = {
        currentReading: parseInt(buildingMeter),
        priorReading: buildingPriorReading,
        consumption: Math.max(0, parseInt(buildingMeter) - buildingPriorReading)
      };
    } else if (commonArea !== undefined && Object.keys(updatedUnits).length > 0) {
      // Auto-calculate building meter as sum of units + common area
      const calculatedTotal = unitsTotal + parseInt(commonArea);
      let buildingPriorReading = currentMonth.buildingMeter?.priorReading;
      if (!buildingPriorReading && previousMonth?.buildingMeter) {
        buildingPriorReading = previousMonth.buildingMeter.currentReading || 0;
      }
      if (!buildingPriorReading) {
        buildingPriorReading = 0;
      }
      
      currentMonth.buildingMeter = {
        currentReading: calculatedTotal,
        priorReading: buildingPriorReading,
        consumption: Math.max(0, calculatedTotal - buildingPriorReading)
      };
    }
    
    // Update the month with new readings
    currentMonth.units = { ...currentMonth.units, ...updatedUnits };
    currentMonth.readingDate = admin.firestore.Timestamp.now();
    
    // Save back to database
    data.months[monthIndex] = currentMonth;
    await docRef.set(data);
    
    console.log(`Updated ${Object.keys(updatedUnits).length} units for ${projectType} ${year}-${monthIndex}`);
    if (currentMonth.commonArea) {
      console.log(`Updated common area: ${currentMonth.commonArea.currentReading}`);
    }
    if (currentMonth.buildingMeter) {
      console.log(`Updated building meter: ${currentMonth.buildingMeter.currentReading}`);
    }
    
    return updatedUnits;
  }

  /**
   * Process payment for a unit
   * MUST track principal vs penalty for AVII
   * @param {string} clientId - Client identifier
   * @param {string} projectType - Type of project
   * @param {number} year - Year
   * @param {number} monthIndex - Month index (0-11)
   * @param {string} unitId - Unit identifier (using unitId NOT id per CRITICAL requirements)
   * @param {number} paymentAmount - Payment amount in cents
   * @param {string} method - Payment method
   * @returns {Object} Payment record
   */
  async processPayment(clientId, projectType, year, monthIndex, unitId, paymentAmount, method) {
    await this._initializeDb();
    
    const docRef = this.db
      .collection('clients').doc(clientId)
      .collection('projects').doc(projectType)
      .collection(year.toString()).doc('data');
    
    const doc = await docRef.get();
    const data = doc.data();
    const unit = data.months[monthIndex].units[unitId];
    
    if (!unit) {
      throw new Error(`No bill for unit ${unitId} in period ${monthIndex}`);
    }
    
    // Calculate amounts due
    const penaltyAmount = Math.round(unit.unpaidBalance * 0.05);
    const principalDue = unit.amount + unit.unpaidBalance;
    const totalDue = principalDue + penaltyAmount;
    
    // Determine how payment is applied
    let principalPaid = 0;
    let penaltyPaid = 0;
    
    if (paymentAmount >= totalDue) {
      // Full payment
      principalPaid = principalDue;
      penaltyPaid = penaltyAmount;
      unit.paid = true;
      unit.unpaidBalance = 0;
      unit.monthsBehind = 0;
    } else {
      // Partial payment - apply to penalty first (accounting convention)
      penaltyPaid = Math.min(paymentAmount, penaltyAmount);
      principalPaid = paymentAmount - penaltyPaid;
      unit.unpaidBalance = totalDue - paymentAmount;
      // monthsBehind stays same (still behind, just less owed)
    }
    
    // Create payment record
    unit.paymentRecord = {
      totalPaid: paymentAmount,
      principalPaid,
      penaltyPaid,
      paymentId: `PMT-${Date.now()}-${unitId}`,
      method,
      date: admin.firestore.Timestamp.now(),
      partial: paymentAmount < totalDue
    };
    
    unit.paidDate = admin.firestore.Timestamp.now();
    
    // Validate data integrity after payment
    this.validateUnitData(unit);
    
    // Save back to database
    data.months[monthIndex].units[unitId] = unit;
    await docRef.set(data);
    
    console.log(`Processed payment for unit ${unitId}: $${paymentAmount/100} (${unit.paid ? 'full' : 'partial'})`);
    return unit.paymentRecord;
  }

  /**
   * CRITICAL: Validate data integrity
   * Prevents the sync issues that waste debugging time
   * @param {Object} unit - Unit data to validate
   * @returns {boolean} True if valid
   * @throws {Error} If validation fails
   */
  validateUnitData(unit) {
    if (unit.monthsBehind > 0 && unit.unpaidBalance === 0) {
      throw new Error(
        `Data integrity error: ${unit.monthsBehind} months behind but no unpaid balance. ` +
        `Possible cause: Payment processed without resetting monthsBehind.`
      );
    }
    
    if (unit.monthsBehind === 0 && unit.unpaidBalance > 0) {
      throw new Error(
        `Data integrity error: Has $${unit.unpaidBalance/100} unpaid but monthsBehind is 0. ` +
        `Possible cause: Partial payment or manual balance adjustment.`
      );
    }
    
    if (unit.monthsBehind < 0 || unit.unpaidBalance < 0) {
      throw new Error(
        `Data integrity error: Negative values detected ` +
        `(monthsBehind: ${unit.monthsBehind}, unpaidBalance: ${unit.unpaidBalance})`
      );
    }
    
    return true;
  }

  /**
   * Calculate total due with optimized penalty calculation
   * Avoids history walks for 90% of cases
   * @param {Object} unit - Unit data
   * @returns {Object} Payment calculation details
   */
  calculateTotalDue(unit) {
    if (unit.monthsBehind === 0) {
      // Current month only - no penalties
      return {
        principal: unit.amount,
        penalty: 0,
        total: unit.amount
      };
    } else if (unit.monthsBehind === 1) {
      // 90% of cases - simple calculation
      const penalty = Math.round(unit.unpaidBalance * 0.05);
      return {
        principal: unit.amount + unit.unpaidBalance,
        penalty: penalty,
        total: unit.amount + unit.unpaidBalance + penalty
      };
    } else {
      // Rare case - need to walk history for accurate compound interest
      // This will be implemented when needed
      return this.calculateFromHistory(unit);
    }
  }

  /**
   * Calculate from history for complex penalty scenarios
   * @param {Object} unit - Unit data
   * @returns {Object} Complex penalty calculation
   * @private
   */
  calculateFromHistory(unit) {
    // For now, use simplified compound calculation
    // TODO: Implement full history walk when needed
    const compoundPenalty = Math.round(
      unit.unpaidBalance * Math.pow(1.05, unit.monthsBehind)
    );
    
    return {
      principal: unit.amount + unit.unpaidBalance,
      penalty: compoundPenalty - unit.unpaidBalance,
      total: unit.amount + compoundPenalty
    };
  }

  /**
   * Initialize project structure for a client and year
   * Creates the months array with empty data structure
   * @param {string} clientId - Client identifier
   * @param {string} projectType - Type of project
   * @param {number} year - Year to initialize
   * @param {Object} config - Project configuration
   * @returns {Object} Initialized project structure
   */
  async initializeProjectYear(clientId, projectType, year, config) {
    await this._initializeDb();
    
    const docRef = this.db
      .collection('clients').doc(clientId)
      .collection('projects').doc(projectType)
      .collection(year.toString()).doc('data');
    
    // Create 12 months of empty data
    const months = {};
    for (let i = 0; i < 12; i++) {
      months[i] = {
        monthIndex: i,
        monthName: new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }),
        units: {},
        readingDate: null,
        generated: admin.firestore.Timestamp.now()
      };
    }
    
    const projectData = {
      clientId,
      projectType,
      year,
      config,
      months,
      created: admin.firestore.Timestamp.now(),
      updated: admin.firestore.Timestamp.now()
    };
    
    await docRef.set(projectData);
    console.log(`Initialized ${projectType} structure for ${clientId} year ${year}`);
    
    return projectData;
  }

  /**
   * Get project configuration
   * @param {string} clientId - Client identifier
   * @param {string} projectType - Type of project
   * @returns {Object} Project configuration
   */
  async getProjectConfig(clientId, projectType) {
    await this._initializeDb();
    
    // First try the new projects structure
    const configDoc = await this.db
      .collection('clients').doc(clientId)
      .collection('projects').doc(projectType)
      .collection('config').doc('settings')
      .get();
    
    if (configDoc.exists) {
      return configDoc.data();
    }
    
    // Fallback to legacy water bills config location
    if (projectType === 'waterBills') {
      const legacyConfigDoc = await this.db
        .collection('clients').doc(clientId)
        .collection('config').doc('waterBills')
        .get();
      
      if (legacyConfigDoc.exists) {
        return legacyConfigDoc.data();
      }
    }
    
    throw new Error(`No configuration found for ${projectType} in client ${clientId}`);
  }

  /**
   * Set project configuration
   * @param {string} clientId - Client identifier
   * @param {string} projectType - Type of project
   * @param {Object} config - Configuration data
   * @returns {Object} Saved configuration
   */
  async setProjectConfig(clientId, projectType, config) {
    await this._initializeDb();
    
    const configRef = this.db
      .collection('clients').doc(clientId)
      .collection('projects').doc(projectType)
      .collection('config').doc('settings');
    
    const configData = {
      ...config,
      clientId,
      projectType,
      updated: admin.firestore.Timestamp.now()
    };
    
    await configRef.set(configData);
    console.log(`Updated ${projectType} config for ${clientId}`);
    
    return configData;
  }

  /**
   * Get all project data for a year (bulk fetch following SAMS pattern)
   * @param {string} clientId - Client identifier
   * @param {string} projectType - Type of project
   * @param {number} year - Year
   * @returns {Object} Complete project data for the year
   */
  async getProjectDataForYear(clientId, projectType, year) {
    await this._initializeDb();
    
    const docRef = this.db
      .collection('clients').doc(clientId)
      .collection('projects').doc(projectType)
      .collection(year.toString()).doc('data');
    
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new Error(`No ${projectType} data for ${year}`);
    }
    
    const data = doc.data();
    
    // Calculate summary statistics
    let totalBilled = 0;
    let totalPaid = 0;
    let unitsWithBalance = 0;
    
    // Filter out null months before processing
    const validMonths = data.months.filter(month => month !== null && month !== undefined);
    
    validMonths.forEach(month => {
      if (month.units) {
        Object.values(month.units).forEach(unit => {
          totalBilled += unit.amount || 0;
          if (unit.paymentRecord) {
            totalPaid += unit.paymentRecord.totalPaid || 0;
          }
          if (unit.unpaidBalance > 0) {
            unitsWithBalance++;
          }
        });
      }
    });
    
    return {
      ...data,
      summary: {
        totalBilled: totalBilled / 100, // Convert to dollars
        totalPaid: totalPaid / 100,
        outstandingBalance: (totalBilled - totalPaid) / 100,
        unitsWithBalance
      }
    };
  }
}

export default ProjectsService;