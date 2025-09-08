// services/waterDataService.js
import { getFiscalYear, getFiscalMonthName } from '../utils/fiscalYearUtils.js';
import { listUnits } from '../controllers/unitsController.js';
import waterReadingsService from './waterReadingsService.js';
import waterBillsService from './waterBillsService.js';
import penaltyRecalculationService from './penaltyRecalculationService.js';
// import { calculateCurrentPenalties } from '../utils/penaltyCalculator.js'; // DEPRECATED - now using stored penalty data

class WaterDataService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 3600000; // 1 hour cache
    // AVII fiscal year configuration
    this.fiscalYearStartMonth = 7; // July
  }

  /**
   * Get complete year data with caching
   */
  async getYearData(clientId, year = null) {
    // Default to current FY if not specified
    if (!year) {
      year = getFiscalYear(new Date(), this.fiscalYearStartMonth);
    }
    
    const cacheKey = `${clientId}-${year}`;
    
    // Check cache - TEMPORARILY DISABLED FOR PENALTY DEBUGGING
    // const cached = this.cache.get(cacheKey);
    // if (cached && cached.timestamp > Date.now() - this.cacheTimeout) {
    //   console.log(`📦 Returning cached data for ${clientId} FY${year}`);
    //   return cached.data;
    // }
    
    // Build fresh data
    console.log(`🔄 Building fresh data for ${clientId} FY${year}`);
    const yearData = await this.buildYearData(clientId, year);
    
    // Cache it
    this.cache.set(cacheKey, {
      data: yearData,
      timestamp: Date.now()
    });
    
    return yearData;
  }

  /**
   * Update a specific month in the cached year data without full invalidation
   * This is used after payments to keep cache warm while updating payment data
   */
  async updateMonthInCache(clientId, year, month, newBillData = null) {
    const cacheKey = `${clientId}-${year}`;
    const cached = this.cache.get(cacheKey);
    
    if (!cached || !cached.data) {
      console.log(`🚫 No cached data found for ${clientId} FY${year} - skipping cache update`);
      return;
    }
    
    console.log(`🔄 Updating cached month ${month} data for ${clientId} FY${year}`);
    
    // Rebuild just this month's data
    const updatedMonthData = await this.buildSingleMonthData(clientId, year, month);
    
    // Update the specific month in cached data
    cached.data.months[month] = updatedMonthData;
    
    // Recalculate year summary with new month data
    cached.data.summary = this.calculateYearSummary(cached.data.months);
    
    // Update timestamp to keep cache fresh
    cached.timestamp = Date.now();
    
    console.log(`✅ Updated cached data for ${clientId} FY${year} month ${month}`);
  }

  /**
   * Clear cache for a specific client and year (use sparingly)
   */
  clearCache(clientId, year = null) {
    if (year) {
      const cacheKey = `${clientId}-${year}`;
      this.cache.delete(cacheKey);
      console.log(`🗑️ Cleared cache for ${clientId} FY${year}`);
    } else {
      // Clear all cache entries for this client
      for (const [key] of this.cache) {
        if (key.startsWith(`${clientId}-`)) {
          this.cache.delete(key);
        }
      }
      console.log(`🗑️ Cleared all cache for client ${clientId}`);
    }
    
    // Also clear config cache
    const configCacheKey = `config-${clientId}`;
    this.cache.delete(configCacheKey);
  }

  /**
   * Get cached client configuration data (units + billing config)
   * This prevents repeated fetches of the same data
   */
  async getClientConfig(clientId) {
    const configCacheKey = `config-${clientId}`;
    const cached = this.cache.get(configCacheKey);
    
    if (cached && cached.timestamp > Date.now() - this.cacheTimeout) {
      return cached.data;
    }
    
    // Fetch both units and billing config in parallel
    const [units, billingConfig] = await Promise.all([
      this.fetchUnits(clientId),
      this.fetchWaterBillingConfig(clientId)
    ]);
    
    const configData = { units, billingConfig };
    
    // Cache for reuse
    this.cache.set(configCacheKey, {
      data: configData,
      timestamp: Date.now()
    });
    
    return configData;
  }

  /**
   * Build data for a single month only (optimized for bill generation)
   */
  async buildSingleMonthData(clientId, year, month) {
    // Get cached client config to avoid repeated fetches
    const { units, billingConfig: config } = await this.getClientConfig(clientId);
    
    // Calculate prior month coordinates
    let priorMonth, priorYear;
    if (month === 0) {
      priorMonth = 11;
      priorYear = year - 1;
    } else {
      priorMonth = month - 1;
      priorYear = year;
    }
    
    // Fetch only the readings and bills for this specific month
    const [currentReadings, priorReadings, bills] = await Promise.all([
      this.fetchReadings(clientId, year, month),
      this.fetchReadings(clientId, priorYear, priorMonth),
      this.fetchBills(clientId, year, month)
    ]);
    
    // Convert rate from cents to dollars
    const ratePerM3 = (config?.ratePerM3 || 5000) / 100;
    
    // Build the month data using existing logic (no carryover for single month builds)
    return this._buildMonthDataFromSourcesWithCarryover(
      year, month, currentReadings, priorReadings, bills, units, config, ratePerM3, {}
    );
  }

  /**
   * Build complete year data from Firebase (optimized)
   */
  async buildYearData(clientId, year) {
    const months = [];
    
    // CRITICAL: Run penalty recalculation before building year data
    // This ensures penalties are up-to-date when data is displayed
    console.log(`🔄 Running penalty recalculation for client ${clientId} before data aggregation...`);
    try {
      await penaltyRecalculationService.recalculatePenaltiesForClient(clientId);
      console.log(`✅ Penalty recalculation completed for ${clientId}`);
    } catch (error) {
      console.error(`❌ Penalty recalculation failed for ${clientId}:`, error);
      // Continue with data building even if penalty recalculation fails
    }
    
    // Get client config once and cache it
    console.log(`📋 [CONFIG] Fetching client config for ${clientId}`);
    const { units, billingConfig: config } = await this.getClientConfig(clientId);
    console.log(`📋 [CONFIG] Got ${units?.length} units, config:`, !!config);
    const ratePerM3 = (config?.ratePerM3 || 5000) / 100;
    console.log(`📋 [CONFIG] Rate per m3: $${ratePerM3}`);
    
    console.log(`📅 [YEAR_BUILD] Initializing months array`);
    
    // Process each month but only fetch months that might exist
    console.log(`📅 [YEAR_BUILD] Starting month processing for ${clientId} FY${year}`);
    try {
      for (let month = 0; month < 12; month++) {
      console.log(`📅 [YEAR_BUILD] Processing month ${month}...`);
      // Check if this month should exist (smart loop checker)
      const monthExists = await this._checkMonthExists(clientId, year, month);
      console.log(`📅 [YEAR_BUILD] Month ${month} exists: ${monthExists}`);
      if (!monthExists && month > 0) {
        // No readings for future months - stop here
        console.log(`📅 [YEAR_BUILD] Stopping at month ${month} - no more data`);
        break;
      }
      
      console.log(`📅 [YEAR_BUILD] Building data for month ${month}...`);
      const monthData = await this._buildMonthDataOptimized(
        clientId, year, month, units, config, ratePerM3
      );
      months.push(monthData);
      console.log(`📅 [YEAR_BUILD] Completed month ${month}`);
      }
    } catch (error) {
      console.error(`❌ [YEAR_BUILD] Error in month processing:`, error);
      throw error;
    }
    
    // Calculate year summary
    const summary = this.calculateYearSummary(months);
    
    const finalResult = {
      year,
      fiscalYear: true,
      months,
      summary
    };
    
    // DEBUG: Log what's actually being returned to frontend
    console.log(`🚀 [FINAL_RETURN] Returning year data for ${clientId} FY${year}:`);
    console.log(`  Total months: ${months.length}`);
    months.forEach((month, index) => {
      if (month.units) {
        const unitsWithPenalties = Object.entries(month.units).filter(([unitId, data]) => data.penaltyAmount > 0);
        console.log(`  Month ${index} (${month.monthName}): ${Object.keys(month.units).length} units, ${unitsWithPenalties.length} with penalties`);
        if (unitsWithPenalties.length > 0) {
          unitsWithPenalties.forEach(([unitId, data]) => {
            console.log(`    Unit ${unitId}: penalty=$${data.penaltyAmount}`);
          });
        }
      }
    });
    
    return finalResult;
  }

  /**
   * Build data for a single month
   * Month 0 = July, Month 1 = August, etc.
   */
  async buildMonthData(clientId, year, month) {
    // For month 0 (July), we need June readings from the previous fiscal year
    // For other months, we need the previous month from the same fiscal year
    let priorMonth, priorYear;
    
    if (month === 0) {
      // July (month 0) needs June (month 11) from previous fiscal year
      priorMonth = 11;
      priorYear = year - 1;
    } else {
      // All other months use previous month from same fiscal year
      priorMonth = month - 1;
      priorYear = year;
    }
    
    // Fetch all data sources in parallel including water billing config
    const [currentReadings, priorReadings, bills, units, config] = await Promise.all([
      this.fetchReadings(clientId, year, month),
      this.fetchReadings(clientId, priorYear, priorMonth),
      this.fetchBills(clientId, year, month),
      this.fetchUnits(clientId),
      this.fetchWaterBillingConfig(clientId)
    ]);
    
    // Convert rate from cents to dollars
    const ratePerM3 = (config?.ratePerM3 || 5000) / 100;
    
    // Calculate unpaid amounts from previous months for ALL months (not just unbilled)
    // This gives us Penalties column (all unpaid penalties) and Overdue column (all unpaid balances)
    let unpaidCarryover = {};
    if (month > 0) {
      console.log(`🔍 Calculating carryover for month ${month} (${month > 0 ? 'eligible' : 'not eligible'})`);
      // Always calculate carryover for penalty and overdue amounts from previous months
      unpaidCarryover = await this._calculateUnpaidCarryover(clientId, year, month, ratePerM3);
      console.log(`📊 Carryover results:`, unpaidCarryover);
    }
    
    // Build unit data
    const unitData = {};
    
    for (const unit of units) {
      const unitId = unit.unitId;
      const currentReading = currentReadings[unitId] || 0;
      const priorReading = priorReadings[unitId] || 0;
      const consumption = currentReading - priorReading;
      const bill = bills?.bills?.units?.[unitId];
      
      // Extract owner last name from owners array (following HOA pattern)
      let ownerLastName = 'Unknown';
      if (Array.isArray(unit.owners) && unit.owners.length > 0) {
        const ownerName = unit.owners[0];
        const nameParts = ownerName.trim().split(/\s+/);
        if (nameParts.length > 1) {
          ownerLastName = nameParts[nameParts.length - 1];
        } else if (nameParts.length === 1) {
          ownerLastName = nameParts[0];
        }
      }
      
      // Calculate billAmount with debugging
      const currentCharge = bill?.currentCharge;
      const calculatedAmount = consumption > 0 ? consumption * ratePerM3 : 0;
      const billAmount = currentCharge ?? calculatedAmount;
      
      // Removed Unit 203 debug logging to prevent confusion
      
      // Use carryover data if no bills exist for this month
      const carryover = unpaidCarryover[unitId] || {};
      
      // Calculate Total Due = Monthly Amount + Previous Balance + Penalties
      // Don't use dynamic penalty calculation - use stored bill data for correct accounting
      let totalDueAmount;
      let penaltyAmount;
      let unpaidAmount;
      
      if (bill) {
        // Use stored bill data which has correct accounting
        totalDueAmount = bill.totalAmount || 0;
        penaltyAmount = bill.penaltyAmount || 0;
        unpaidAmount = totalDueAmount - (bill.paidAmount || 0);
        
        console.log(`💰 Unit ${unitId} bill data:`);
        console.log(`  Monthly Amount: $${billAmount}`);
        console.log(`  Previous Balance: $${bill.previousBalance || 0}`);
        console.log(`  Penalty Amount: $${penaltyAmount}`);
        console.log(`  Total Due: $${totalDueAmount}`);
        console.log(`  Paid Amount: $${bill.paidAmount || 0}`);
      } else {
        // No bill exists - use carryover data for display
        totalDueAmount = billAmount + (carryover.previousBalance || 0) + (carryover.penaltyAmount || 0);
        penaltyAmount = carryover.penaltyAmount || 0;
        unpaidAmount = totalDueAmount;
      }
      
      unitData[unitId] = {
        ownerLastName,
        priorReading,
        currentReading,
        consumption,
        previousBalance: bill?.previousBalance || carryover.previousBalance || 0,  // Unpaid from previous months
        penaltyAmount: penaltyAmount,                // Penalty amount from bill data
        billAmount: billAmount,                      // This month's charge only (Monthly Amount column)
        totalAmount: totalDueAmount,                 // Total balance to clear account (Total Due column)
        paidAmount: bill?.paidAmount || 0,           // Payment made THIS MONTH ONLY (Paid Amount column)
        unpaidAmount: unpaidAmount,                  // Current unpaid amount
        status: this.calculateStatus(bill) || (carryover.previousBalance > 0 ? 'unpaid' : 'nobill'),
        daysPastDue: this.calculateDaysPastDue(bill, bills?.dueDate) || carryover.daysOverdue || 0
      };
    }
    
    // Build response object
    const monthData = {
      month,
      monthName: this.getMonthName(month), // fiscal month names
      calendarYear: this.getCalendarYear(year, month),
      units: unitData,
      billsGenerated: bills !== null  // True if YYYY-MM document exists
    };
    
    // Add Common Area data if present (readings only, no billing)
    if (currentReadings.commonArea !== undefined) {
      monthData.commonArea = {
        priorReading: priorReadings.commonArea || 0,
        currentReading: currentReadings.commonArea || 0,
        consumption: (currentReadings.commonArea || 0) - (priorReadings.commonArea || 0)
      };
    }
    
    // Add Building Meter data if present (readings only, no billing)
    if (currentReadings.buildingMeter !== undefined) {
      monthData.buildingMeter = {
        priorReading: priorReadings.buildingMeter || 0,
        currentReading: currentReadings.buildingMeter || 0,
        consumption: (currentReadings.buildingMeter || 0) - (priorReadings.buildingMeter || 0)
      };
    }
    
    return monthData;
  }

  /**
   * Check if a month has any readings (smart loop checker)
   */
  async _checkMonthExists(clientId, year, month) {
    try {
      const readings = await this.fetchReadings(clientId, year, month);
      return readings && Object.keys(readings).length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Optimized month builder that reuses cached config data
   */
  async _buildMonthDataOptimized(clientId, year, month, units, config, ratePerM3) {
    console.log(`🔧 [OPTIMIZED] Building month ${month} data for ${clientId}`);
    console.log(`🔧 [OPTIMIZED] About to start carryover logic for month ${month}`);
    // Calculate prior month coordinates
    let priorMonth, priorYear;
    if (month === 0) {
      priorMonth = 11;
      priorYear = year - 1;
    } else {
      priorMonth = month - 1;
      priorYear = year;
    }
    
    // Fetch only the variable data for this month
    const [currentReadings, priorReadings, bills] = await Promise.all([
      this.fetchReadings(clientId, year, month),
      this.fetchReadings(clientId, priorYear, priorMonth),
      this.fetchBills(clientId, year, month)
    ]);
    
    // Calculate unpaid carryover from previous months for months > 0
    console.log(`🔍 [CARRYOVER] Checking if month ${month} > 0 for carryover calculation`);
    let unpaidCarryover = {};
    if (month > 0) {
      console.log(`🔍 [CARRYOVER] Calculating carryover for ${clientId} month ${month}`);
      try {
        // Fetch all previous month bills to calculate carryover
        for (let prevMonth = 0; prevMonth < month; prevMonth++) {
          const prevBills = await this.fetchBills(clientId, year, prevMonth);
          if (prevBills?.bills?.units) {
            console.log(`🔍 [CARRYOVER] Checking month ${prevMonth} bills for unpaid amounts`);
            for (const [unitId, unitBill] of Object.entries(prevBills.bills.units)) {
              if (unitBill.status !== 'paid') {
                if (!unpaidCarryover[unitId]) {
                  unpaidCarryover[unitId] = { penaltyAmount: 0, previousBalance: 0 };
                }
                const unpaidPenalty = (unitBill.penaltyAmount || 0) - (unitBill.penaltyPaid || 0);
                const unpaidBalance = (unitBill.totalAmount || 0) - (unitBill.paidAmount || 0) - unpaidPenalty;
                
                unpaidCarryover[unitId].penaltyAmount += unpaidPenalty;
                unpaidCarryover[unitId].previousBalance += unpaidBalance;
                
                if (unitId === '106' || unitId === '203') {
                  console.log(`🔍 [CARRYOVER] Unit ${unitId} from month ${prevMonth}: +$${unpaidPenalty} penalty, +$${unpaidBalance} balance`);
                }
              }
            }
          }
        }
        
        // Log final carryover amounts
        Object.entries(unpaidCarryover).forEach(([unitId, carryover]) => {
          if (carryover.penaltyAmount > 0 || carryover.previousBalance > 0) {
            console.log(`🔍 [CARRYOVER] Unit ${unitId} total carryover: $${carryover.penaltyAmount} penalty, $${carryover.previousBalance} balance`);
          }
        });
      } catch (error) {
        console.error(`❌ [CARRYOVER] Error calculating carryover for month ${month}:`, error);
      }
    }
    
    // Build month data using existing logic with carryover data
    return this._buildMonthDataFromSourcesWithCarryover(
      year, month, currentReadings, priorReadings, bills, units, config, ratePerM3, unpaidCarryover
    );
  }

  /**
   * Core month data builder that takes all data sources as parameters
   * This allows reuse with different data fetching strategies
   */
  _buildMonthDataFromSourcesWithCarryover(year, month, currentReadings, priorReadings, bills, units, config, ratePerM3, unpaidCarryover = {}) {
    console.log(`🔧 [BUILD_WITH_CARRYOVER] Building month ${month} with carryover data`);
    
    // Build unit data (reuse existing logic from buildMonthData)
    const unitData = {};
    
    for (const unit of units) {
      const unitId = unit.unitId;
      const currentReading = currentReadings[unitId] || 0;
      const priorReading = priorReadings[unitId] || 0;
      const consumption = currentReading - priorReading;
      const bill = bills?.bills?.units?.[unitId];
      
      // Extract owner last name from owners array (following HOA pattern)
      let ownerLastName = 'Unknown';
      if (unit.owners && unit.owners.length > 0) {
        const ownerInfo = unit.owners[0];
        const nameParts = ownerInfo.split(' ');
        if (nameParts.length >= 2) {
          ownerLastName = nameParts[nameParts.length - 1];
        } else if (nameParts.length === 1) {
          ownerLastName = nameParts[0];
        }
      }
      
      // Calculate billAmount with debugging
      const currentCharge = bill?.currentCharge;
      const calculatedAmount = consumption > 0 ? consumption * ratePerM3 : 0;
      const billAmount = currentCharge ?? calculatedAmount;
      
      // Use carryover data if no bills exist for this month
      const carryover = unpaidCarryover[unitId] || {};
      
      // Calculate Total Due = Monthly Amount + Previous Balance + Penalties
      let totalDueAmount;
      let penaltyAmount;
      let unpaidAmount;
      
      if (bill) {
        // Use stored bill data which has correct accounting
        totalDueAmount = bill.totalAmount || 0;
        penaltyAmount = bill.penaltyAmount || 0;
        unpaidAmount = totalDueAmount - (bill.paidAmount || 0);
      } else {
        // No bill exists - use carryover data for display
        totalDueAmount = billAmount + (carryover.previousBalance || 0) + (carryover.penaltyAmount || 0);
        penaltyAmount = carryover.penaltyAmount || 0;
        unpaidAmount = totalDueAmount;
      }
      
      unitData[unitId] = {
        ownerLastName,
        priorReading,
        currentReading,
        consumption,
        previousBalance: bill?.previousBalance || carryover.previousBalance || 0,
        penaltyAmount: penaltyAmount,
        billAmount: billAmount,
        totalAmount: totalDueAmount,
        paidAmount: bill?.paidAmount || 0,
        unpaidAmount: unpaidAmount,
        status: this.calculateStatus(bill) || (carryover.previousBalance > 0 ? 'unpaid' : 'nobill'),
        daysPastDue: this.calculateDaysPastDue(bill, bills?.dueDate) || carryover.daysOverdue || 0
      };
      
      // DEBUG: Log penalty assignment for specific units we're tracking
      if (unitId === '106' || unitId === '203') {
        console.log(`🐛 [AGGREGATOR] Unit ${unitId} penalty assignment: penalty=${penaltyAmount}, fromBill=${!!bill}, billPenalty=${bill?.penaltyAmount}, carryoverPenalty=${carryover.penaltyAmount}`);
      }
    }
    
    // DEBUG: Log penalty amounts being returned for month
    console.log(`🐛 [AGGREGATOR] Month ${month} penalty summary:`);
    Object.entries(unitData).forEach(([unitId, data]) => {
      if (data.penaltyAmount > 0 || unitId === '106' || unitId === '203') {
        console.log(`  Unit ${unitId}: penalty=${data.penaltyAmount}, fromBill=${!!bills?.bills?.units?.[unitId]}`);
      }
    });
    
    // Build response object
    const monthData = {
      month,
      year,
      fiscalYear: year,
      monthName: getFiscalMonthName(month + 1, this.fiscalYearStartMonth),
      calendarYear: this.getCalendarYear(year, month),
      billsGenerated: !!bills?.bills,
      units: unitData,
      dueDate: bills?.dueDate || null
    };
    
    // Add Common Area data if present (readings only, no billing)
    if (currentReadings.commonArea !== undefined) {
      monthData.commonArea = {
        priorReading: priorReadings.commonArea || 0,
        currentReading: currentReadings.commonArea || 0,
        consumption: (currentReadings.commonArea || 0) - (priorReadings.commonArea || 0)
      };
    }
    
    // Add Building Meter data if present (readings only, no billing)
    if (currentReadings.buildingMeter !== undefined) {
      monthData.buildingMeter = {
        priorReading: priorReadings.buildingMeter || 0,
        currentReading: currentReadings.buildingMeter || 0,
        consumption: (currentReadings.buildingMeter || 0) - (priorReadings.buildingMeter || 0)
      };
    }
    
    return monthData;
  }

  /**
   * Fetch readings for a month using existing service
   */
  async fetchReadings(clientId, year, month) {
    try {
      const data = await waterReadingsService.getMonthReadings(clientId, year, month);
      return data?.readings || {};
    } catch (error) {
      console.log(`No readings for ${year}-${month}`);
      return {};
    }
  }

  /**
   * Fetch bills for a month using existing service
   */
  async fetchBills(clientId, year, month) {
    try {
      const data = await waterBillsService.getBills(clientId, year, month);
      return data;
    } catch (error) {
      console.log(`No bills for ${year}-${month}`);
      return null;
    }
  }

  /**
   * Fetch all units for client using existing controller
   */
  async fetchUnits(clientId) {
    try {
      const units = await listUnits(clientId);
      console.log(`📦 Fetched ${units.length} units for ${clientId}`);
      return units;
    } catch (error) {
      console.error(`Error fetching units for ${clientId}:`, error.message);
      return [];
    }
  }

  /**
   * Fetch water billing configuration
   */
  async fetchWaterBillingConfig(clientId) {
    try {
      const { getDb } = await import('../firebase.js');
      const db = await getDb();
      
      const configDoc = await db
        .collection('clients').doc(clientId)
        .collection('config').doc('waterBills')
        .get();
      
      if (configDoc.exists) {
        const config = configDoc.data();
        console.log(`💧 Water billing config: ratePerM3 = ${config.ratePerM3} cents ($${(config.ratePerM3 || 5000) / 100})`);
        return config;
      }
      
      console.log('⚠️ No water billing config found, using defaults');
      return { ratePerM3: 5000 }; // Default to 5000 cents ($50)
      
    } catch (error) {
      console.error('Error fetching water billing config:', error);
      return { ratePerM3: 5000 }; // Default fallback
    }
  }

  /**
   * Calculate status for a unit
   */
  calculateStatus(bill) {
    if (!bill) return 'nobill';
    if (bill.paidAmount >= bill.totalAmount) return 'paid';
    
    const dueDate = bill.dueDate ? new Date(bill.dueDate) : null;
    if (dueDate && dueDate < new Date()) return 'overdue';
    
    return 'unpaid';
  }

  /**
   * Calculate days past due
   */
  calculateDaysPastDue(bill, billDueDate) {
    if (!bill || !billDueDate) return 0;
    if (bill.paidAmount >= bill.totalAmount) return 0;
    
    const dueDate = new Date(billDueDate);
    const today = new Date();
    if (today <= dueDate) return 0;
    
    const daysPast = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
    return daysPast;
  }

  /**
   * Calculate year summary
   */
  calculateYearSummary(months) {
    let totalConsumption = 0;
    let totalBilled = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;
    let commonAreaConsumption = 0;
    let buildingMeterConsumption = 0;
    const overdueUnits = new Set();
    
    for (const month of months) {
      // Sum unit consumption and billing
      for (const [unitId, data] of Object.entries(month.units)) {
        totalConsumption += data.consumption;
        totalBilled += data.billAmount;
        totalPaid += data.paidAmount;
        totalUnpaid += data.unpaidAmount;
        
        if (data.status === 'overdue') {
          overdueUnits.add(unitId);
        }
      }
      
      // Add Common Area consumption if present
      if (month.commonArea) {
        commonAreaConsumption += month.commonArea.consumption;
      }
      
      // Add Building Meter consumption if present
      if (month.buildingMeter) {
        buildingMeterConsumption += month.buildingMeter.consumption;
      }
    }
    
    return {
      totalConsumption,
      commonAreaConsumption,
      buildingMeterConsumption,
      totalBilled,
      totalPaid,
      totalUnpaid,
      unitsWithOverdue: overdueUnits.size,
      collectionRate: totalBilled > 0 ? parseFloat((totalPaid / totalBilled * 100).toFixed(1)) : 0
    };
  }

  /**
   * Get month name for fiscal month
   * Month 0 = July, Month 1 = August, etc.
   */
  getMonthName(fiscalMonth) {
    // Use the existing fiscalYearUtils function
    // For fiscal month to calendar month conversion:
    // Fiscal month 0 (July) = calendar month 7
    // Fiscal month 1 (August) = calendar month 8, etc.
    return getFiscalMonthName(fiscalMonth + 1, this.fiscalYearStartMonth);
  }

  /**
   * Get calendar year for fiscal month
   * FY 2026: July 2025 (month 0) through June 2026 (month 11)
   */
  getCalendarYear(fiscalYear, fiscalMonth) {
    // Months 0-5 (Jul-Dec) are in calendar year fiscalYear - 1
    // Months 6-11 (Jan-Jun) are in calendar year fiscalYear
    return fiscalMonth <= 5 ? fiscalYear - 1 : fiscalYear;
  }

  /**
   * Invalidate cache for client/year (legacy method - use clearCache instead)
   */
  invalidate(clientId, year = null) {
    console.log(`⚠️ Using legacy invalidate method - consider using clearCache instead`);
    this.clearCache(clientId, year);
  }

  /**
   * Calculate unpaid carryover amounts from previous months (for UI display when bills not generated)
   */
  async _calculateUnpaidCarryover(clientId, currentYear, currentMonth, ratePerM3) {
    console.log(`🔍 [CARRYOVER] Starting calculation for ${clientId} ${currentYear} month ${currentMonth}`);
    const { getDb } = await import('../firebase.js');
    const db = await getDb();
    
    const unpaidByUnit = {};
    
    // Check all previous months in the fiscal year
    console.log(`🔍 [CARRYOVER] Checking months 0 to ${currentMonth - 1}`);
    for (let month = 0; month < currentMonth; month++) {
      const monthStr = String(month).padStart(2, '0');
      const billDoc = await db
        .collection('clients').doc(clientId)
        .collection('projects').doc('waterBills')
        .collection('bills').doc(`${currentYear}-${monthStr}`)
        .get();
      
      if (billDoc.exists) {
        const billData = billDoc.data();
        const monthsOverdue = currentMonth - month;
        
        for (const [unitId, bill] of Object.entries(billData.bills.units || {})) {
          if (bill.totalAmount > bill.paidAmount) {
            const unpaidAmount = bill.totalAmount - bill.paidAmount;
            // Use stored penalty amount minus penalty payments (not recalculated)
            const unpaidPenalty = (bill.penaltyAmount || 0) - (bill.penaltyPaid || 0);
            
            if (!unpaidByUnit[unitId]) {
              unpaidByUnit[unitId] = {
                previousBalance: 0,
                penaltyAmount: 0,
                daysOverdue: 0
              };
            }
            
            // Accumulate unpaid balances and penalties from previous months
            unpaidByUnit[unitId].previousBalance += unpaidAmount;
            unpaidByUnit[unitId].penaltyAmount += unpaidPenalty;
            unpaidByUnit[unitId].daysOverdue = Math.max(unpaidByUnit[unitId].daysOverdue, monthsOverdue * 30);
          }
        }
      }
    }
    
    return unpaidByUnit;
  }

  /**
   * Clear entire cache
   */
  clearCache() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🗑️ Cleared entire cache (${size} entries)`);
  }
}

// Export singleton instance
export const waterDataService = new WaterDataService();