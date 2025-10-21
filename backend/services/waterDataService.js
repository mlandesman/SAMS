// services/waterDataService.js
import { getFiscalYear, getFiscalMonthName } from '../utils/fiscalYearUtils.js';
import { listUnits } from '../controllers/unitsController.js';
import waterReadingsService from './waterReadingsService.js';
import waterBillsService from './waterBillsService.js';
import penaltyRecalculationService from './penaltyRecalculationService.js';
// import { calculateCurrentPenalties } from '../utils/penaltyCalculator.js'; // DEPRECATED - now using stored penalty data
import { getNow, DateService } from '../services/DateService.js';
import { pesosToCentavos, centavosToPesos } from '../utils/currencyUtils.js';

class WaterDataService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 3600000; // 1 hour cache
    // AVII fiscal year configuration
    this.fiscalYearStartMonth = 7; // July
    // Initialize DateService for timestamp formatting
    this.dateService = new DateService({ timezone: 'America/Cancun' });
  }

  /**
   * Build year data with calculations (does NOT write to aggregatedData)
   * This is the same calculation logic but returns directly instead of caching
   * @param {string} clientId - Client ID
   * @param {number} year - Fiscal year
   * @returns {object} Calculated year data with all fields UI expects
   */
  async buildYearDataForDisplay(clientId, year) {
    console.log(`📊 Building calculated year data for ${clientId} FY${year} (no caching)`);
    
    const months = [];
    
    // Get client config
    const { units, billingConfig: config } = await this.getClientConfig(clientId);
    const ratePerM3 = config?.ratePerM3 || 5000; // In centavos
    
    // PERFORMANCE: Batch fetch all readings and bills for the year at once
    // This replaces multiple individual Firestore reads with 2 batch operations
    console.log(`📚 [BATCH] Pre-fetching all readings and bills for year ${year}`);
    const [allReadings, allBills] = await Promise.all([
      this.fetchAllReadingsForYear(clientId, year),
      this.fetchAllBillsForYear(clientId, year)
    ]);
    
    // Build data for each month - stop when no more data exists
    for (let month = 0; month < 12; month++) {
      // Check if bills OR readings exist for this month
      const hasBills = allBills[month] !== null && allBills[month] !== undefined;
      const hasReadings = allReadings[month] && Object.keys(allReadings[month].readings).length > 0;
      
      // Stop if no bills AND no readings for months after the first month
      // (Month 0 might not have bills yet in a new fiscal year)
      if (!hasBills && !hasReadings && month > 0) {
        console.log(`📊 Stopping at month ${month} - no bills or readings found`);
        break;
      }
      
      // CRITICAL: Calculate dynamic carryover from all prior months (0 to month-1)
      // This ensures displayOverdue always reflects current payment status
      const unpaidCarryover = month === 0 
        ? {} // First month has no prior months
        : await this._calculateUnpaidCarryover(clientId, year, month, config?.ratePerM3 || 5000);
      
      console.log(`📊 Month ${month} carryover:`, Object.keys(unpaidCarryover).length > 0 
        ? `${Object.keys(unpaidCarryover).length} units with overdue` 
        : 'no overdue amounts');
      
      // Pass pre-fetched data to month builder (avoids individual fetches)
      const monthData = await this.buildSingleMonthDataWithCache(
        clientId, year, month, allReadings, allBills, config, unpaidCarryover
      );
      months.push(monthData);
    }
    
    console.log(`📊 Built ${months.length} months of data`);
    
    // Calculate year summary
    const summary = this.calculateYearSummary(months);
    
    return {
      year,
      fiscalYear: true,
      months,
      summary,
      carWashRate: config?.rateCarWash || 10000,
      boatWashRate: config?.rateBoatWash || 20000
    };
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
    const [currentReadingsData, priorReadingsData, bills] = await Promise.all([
      this.fetchReadings(clientId, year, month),
      this.fetchReadings(clientId, priorYear, priorMonth),
      this.fetchBills(clientId, year, month)
    ]);
    
    // Extract readings and timestamps
    const currentReadings = currentReadingsData.readings;
    const priorReadings = priorReadingsData.readings;
    const currentTimestamp = currentReadingsData.timestamp;
    const priorTimestamp = priorReadingsData.timestamp;
    
    // Rate already in centavos from config
    const ratePerM3 = config?.ratePerM3 || 5000; // In centavos
    
    // Build the month data using existing logic (no carryover for single month builds)
    return this._buildMonthDataFromSourcesWithCarryover(
      year, month, currentReadings, priorReadings, bills, units, config, ratePerM3, {}, currentTimestamp, priorTimestamp
    );
  }

  /**
   * Build data for a SINGLE UNIT in a specific month (surgical update)
   * This is the core surgical update logic - calculates only the changed unit
   * @param {object} existingUnitData - Optional: Existing unit data from aggregatedData to avoid recalculation
   */
  async buildSingleUnitData(clientId, year, month, unitId, existingUnitData = null) {
    console.log(`🔧 [SURGICAL] Building data for unit ${unitId} in month ${month}`);
    
    try {
      // Get cached client config to avoid repeated fetches
      const { units, billingConfig: config } = await this.getClientConfig(clientId);
      
      // OPTIMIZATION: If we have existing unit data and only need to update payment status,
      // fetch only the bill document (not readings/carryover)
      if (existingUnitData) {
        console.log(`⚡ [SURGICAL] Using existing unit data, fetching only updated bill`);
        const bills = await this.fetchBills(clientId, year, month);
        const bill = bills?.bills?.units?.[unitId];
        
        if (!bill) {
          console.warn(`⚠️  No bill found for unit ${unitId} in month ${month}`);
          return existingUnitData; // Return unchanged if no bill
        }
        
        // Update payment-related fields AND penalty data from fresh bill
        // Penalty recalc runs before surgical update, so bill has fresh penalty data
        const calculatedStatus = this.calculateStatus(bill);
        
        // Calculate unpaid amount accounting for credit usage
        // basePaid includes both cash (paidAmount) and credit
        const basePaidTotal = (bill.basePaid || 0);
        const penaltyPaidTotal = (bill.penaltyPaid || 0);
        const totalPaid = basePaidTotal + penaltyPaidTotal;
        const unpaid = Math.max(0, (bill.totalAmount || 0) - totalPaid);
        
        return {
          ...existingUnitData,
          // CRITICAL: Include fresh penalty data from recalculated bill
          penaltyAmount: bill.penaltyAmount || 0,
          totalAmount: bill.totalAmount,
          previousBalance: bill.previousBalance || 0,
          // Payment data (paidAmount is cash only, unpaidAmount accounts for credit)
          paidAmount: bill.paidAmount || 0,
          unpaidAmount: unpaid,
          status: calculatedStatus,
          transactionId: (() => {
            const payments = bill.payments;
            return payments && payments.length > 0 ? payments[payments.length - 1].transactionId : null;
          })(),
          payments: bill.payments || []
        };
      }
      
      // FULL CALCULATION (when no existing data available)
      // Calculate prior month coordinates
      let priorMonth, priorYear;
      if (month === 0) {
        priorMonth = 11;
        priorYear = year - 1;
      } else {
        priorMonth = month - 1;
        priorYear = year;
      }
      
      // Fetch the same data sources that buildSingleMonthData uses
      const [currentReadingsData, priorReadingsData, bills] = await Promise.all([
        this.fetchReadings(clientId, year, month),
        this.fetchReadings(clientId, priorYear, priorMonth),
        this.fetchBills(clientId, year, month)
      ]);
      
      const currentReadings = currentReadingsData.readings;
      const priorReadings = priorReadingsData.readings;
      const ratePerM3 = config?.ratePerM3 || 5000; // Already in centavos from config
      
      // Calculate unpaid carryover for THIS UNIT ONLY (surgical optimization)
      const unpaidCarryover = await this._calculateUnpaidCarryover(clientId, year, month, config.ratePerM3, unitId);
      
      // Find the specific unit in the config
      const unit = units.find(u => u.unitId === unitId);
      if (!unit) {
        throw new Error(`Unit ${unitId} not found in client config`);
      }
      
      // Calculate ONLY this unit's data using the same logic as the full month builder
      const unitData = this._calculateUnitData(
        unit, 
        currentReadings, 
        priorReadings, 
        bills, 
        unpaidCarryover, 
        ratePerM3, 
        config,
        month
      );
      
      console.log(`✅ [SURGICAL] Unit ${unitId} data calculated successfully`);
      return unitData;
      
    } catch (error) {
      console.error(`❌ [SURGICAL] Error calculating unit ${unitId} data:`, error);
      throw error;
    }
  }

  /**
   * Calculate data for a single unit (extracted from loop logic)
   * This is the core unit calculation that both full month and surgical updates use
   */
  _calculateUnitData(unit, currentReadings, priorReadings, bills, unpaidCarryover, ratePerM3, config, month) {
    const unitId = unit.unitId;
    
    // 1. Extract reading from nested structure if present
    let currentReading = currentReadings[unitId] || 0;
    let washes = undefined;
    
    if (typeof currentReading === 'object' && currentReading.reading !== undefined) {
      if (currentReading.washes && Array.isArray(currentReading.washes)) {
        washes = currentReading.washes;
      }
      currentReading = currentReading.reading;
    }
    
    const priorReading = priorReadings[unitId] || 0;
    const consumption = currentReading - priorReading;
    const bill = bills?.bills?.units?.[unitId];
    
    // 2. Store reading and washes array (only if washes exist)
    const currentReadingObj = {
      reading: currentReading
    };
    
    if (washes !== undefined) {
      const washesWithCost = washes.map(wash => ({
        ...wash,
        cost: wash.type === 'car' 
          ? (config?.rateCarWash || 100) 
          : (config?.rateBoatWash || 200)
      }));
      currentReadingObj.washes = washesWithCost;
    }
    
    // 3. Extract owner last name
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
    
    // 4. Calculate bill amounts (ALL IN CENTAVOS - integers)
    const currentCharge = bill?.currentCharge; // Already in centavos from waterBillsService
    const calculatedAmount = consumption > 0 ? Math.round(consumption * ratePerM3) : 0; // ratePerM3 is in centavos
    const billAmount = currentCharge ?? calculatedAmount;
    
    const carryover = unpaidCarryover[unitId] || {};
    
    let totalDueAmount;
    let penaltyAmount;
    let unpaidAmount;
    
    if (bill) {
      // Use stored bill data which has correct accounting (all in centavos)
      totalDueAmount = bill.totalAmount || 0;
      penaltyAmount = bill.penaltyAmount || 0;
      
      // Calculate unpaid amount accounting for credit usage (all in centavos)
      // basePaid includes both cash (paidAmount) and credit
      const basePaidTotal = (bill.basePaid || 0);
      const penaltyPaidTotal = (bill.penaltyPaid || 0);
      const totalPaid = basePaidTotal + penaltyPaidTotal;
      unpaidAmount = Math.max(0, totalDueAmount - totalPaid);
    } else {
      // No bill exists - use carryover data for display (all in centavos)
      totalDueAmount = billAmount + (carryover.previousBalance || 0) + (carryover.penaltyAmount || 0);
      penaltyAmount = carryover.penaltyAmount || 0;
      unpaidAmount = totalDueAmount;
    }
    
    // 5. Build and return unit data object (same structure as full month builder)
    // CRITICAL: Use status from Firestore if it exists (set by payment service)
    // Only calculate status if bill doesn't have one (legacy data)
    const billStatus = bill?.status || this.calculateStatus(bill) || (carryover.previousBalance > 0 ? 'unpaid' : 'nobill');
    
    return {
      ownerLastName,
      priorReading,
      currentReading: currentReadingObj,
      consumption,
      // ALL AMOUNTS BELOW ARE IN CENTAVOS (integers) - frontend must convert to pesos for display
      previousBalance: bill?.previousBalance || carryover.previousBalance || 0,  // In centavos
      penaltyAmount: penaltyAmount,                                              // In centavos
      billAmount: billAmount,                                                    // In centavos
      totalAmount: totalDueAmount,                                               // In centavos
      paidAmount: bill?.paidAmount || 0,                                         // In centavos
      unpaidAmount: unpaidAmount,                                                // In centavos
      status: billStatus,
      daysPastDue: this.calculateDaysPastDue(bill, bills?.dueDate) || carryover.daysOverdue || 0,
      transactionId: (() => {
        const payments = bill?.payments;
        return payments && payments.length > 0 ? payments[payments.length - 1].transactionId : null;
      })(),
      payments: bill?.payments || [],
      billNotes: bill?.billNotes || null,
      
      // Display fields for frontend (all in centavos - frontend converts to pesos for display)
      displayDue: billStatus === 'paid' ? 0 : unpaidAmount,                     // In centavos
      displayPenalties: (() => {
        // CRITICAL: Calculate penalties dynamically as of TODAY, not stored value
        // This ensures UI always shows current penalties based on current date
        if (billStatus === 'paid') return 0;
        
        // If no bill exists yet (nobill status), penalties are only on carried-over amounts
        // These are already included in displayOverdue, so show 0 here to avoid double-counting
        if (!bill) return 0;
        
        // Get dueDate from document level (bills.dueDate), not unit level (bill.dueDate doesn't exist)
        const dueDate = bills?.dueDate;
        if (!dueDate) return penaltyAmount; // Fallback to stored if no due date
        
        const dueDateObj = new Date(dueDate);
        const today = new Date();
        const gracePeriodDays = config?.penaltyDays || 10;
        const daysPastDue = Math.max(0, Math.floor((today - dueDateObj) / (1000 * 60 * 60 * 24)));
        
        if (daysPastDue <= gracePeriodDays) return 0; // Within grace period
        
        // Calculate months past due
        let monthsPastDue = (today.getFullYear() - dueDateObj.getFullYear()) * 12;
        monthsPastDue += today.getMonth() - dueDateObj.getMonth();
        if (today.getDate() >= dueDateObj.getDate()) monthsPastDue += 1;
        monthsPastDue = Math.max(1, monthsPastDue);
        
        // Calculate penalty on UNPAID base amount (current bill only)
        const unpaidBaseAmount = billAmount - (bill.basePaid || 0);
        const penaltyRate = config?.penaltyRate || 0.05;
        return Math.round(unpaidBaseAmount * penaltyRate * monthsPastDue);
      })(),                                                                      // In centavos
      displayOverdue: billStatus === 'paid' ? 0 : (carryover.previousBalance || 0),  // In centavos
      
      // NEW: Summary fields for UI (cumulative totals)
      totalPenalties: billStatus === 'paid' ? 0 : (month === 0 ? penaltyAmount : (carryover.totalPenalties || 0)),  // Current month penalty OR cumulative penalties from previous months
      totalDue: billStatus === 'paid' ? 0 : unpaidAmount,  // Use unpaidAmount which accounts for partial payments
      displayTotalPenalties: billStatus === 'paid' ? 0 : (month === 0 ? penaltyAmount : (carryover.totalPenalties || 0)),  // For UI display
      displayTotalDue: billStatus === 'paid' ? 0 : unpaidAmount  // Use unpaidAmount which accounts for partial payments
    };
    
    // TASK 2: Data consistency validation (after building the unit data)
    // Use basePaid + penaltyPaid for validation (not paidAmount which may include overflow from prior payment)
    const actualAmountPaidToThisBill = (bill?.basePaid || 0) + (bill?.penaltyPaid || 0);
    
    if (billStatus === 'paid' && unpaidAmount > 0) {
      console.warn(`⚠️  [DATA_INCONSISTENCY] Unit ${unitId} Month ${month}: Status is 'paid' but unpaidAmount is $${unpaidAmount}`);
      console.warn(`   totalAmount: $${totalDueAmount}, actualPaid: $${actualAmountPaidToThisBill}`);
    }
    if (billStatus === 'unpaid' && unpaidAmount === 0 && totalDueAmount > 0) {
      console.warn(`⚠️  [DATA_INCONSISTENCY] Unit ${unitId} Month ${month}: Status is 'unpaid' but unpaidAmount is $0`);
      console.warn(`   totalAmount: $${totalDueAmount}, actualPaid: $${actualAmountPaidToThisBill}`);
    }
    if (billStatus === 'paid' && actualAmountPaidToThisBill < totalDueAmount) {
      console.warn(`⚠️  [DATA_INCONSISTENCY] Unit ${unitId} Month ${month}: Status is 'paid' but actualPaid ($${actualAmountPaidToThisBill}) < totalAmount ($${totalDueAmount})`);
    }
    
    return unitData;
  }



  /**
   * Build data for a single month using pre-fetched data (for batch operations)
   * This version uses cached data passed from buildYearDataForDisplay
   */
  async buildSingleMonthDataWithCache(clientId, year, month, allReadings, allBills, config, unpaidCarryover = {}) {
    // Get readings for current and prior month from cache
    const priorMonth = month === 0 ? 'prior-11' : (month - 1);
    const currentReadingsData = allReadings[month] || { readings: {}, timestamp: null };
    const priorReadingsData = allReadings[priorMonth] || { readings: {}, timestamp: null };
    const bills = allBills[month] || null;
    
    // Get units
    const units = await this.fetchUnits(clientId);
    
    // Extract readings and timestamps from the data objects
    const currentReadings = currentReadingsData.readings;
    const priorReadings = priorReadingsData.readings;
    const currentTimestamp = currentReadingsData.timestamp;
    const priorTimestamp = priorReadingsData.timestamp;
    
    // Get rate from config
    const ratePerM3 = config?.ratePerM3 || 5000; // In centavos
    
    // Build month data using the fetched data with calculated carryover
    return this._buildMonthDataFromSourcesWithCarryover(
      year, month, 
      currentReadings, priorReadings, bills,
      units, config, ratePerM3, unpaidCarryover, 
      currentTimestamp, priorTimestamp
    );
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
    
    // Rate already in centavos from config
    const ratePerM3 = config?.ratePerM3 || 5000; // In centavos
    
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
      
      // Extract reading from nested structure if present
      let currentReading = currentReadings[unitId] || 0;
      let washes = undefined; // Only include if washes array exists
      
      if (typeof currentReading === 'object' && currentReading.reading !== undefined) {
        // Extract washes array if it exists (ignore legacy count fields)
        if (currentReading.washes && Array.isArray(currentReading.washes)) {
          washes = currentReading.washes;
        }
        currentReading = currentReading.reading;
      }
      
      const priorReading = priorReadings[unitId] || 0;
      const consumption = currentReading - priorReading;
      const bill = bills?.bills?.units?.[unitId];
      
      // Store reading and washes array (only if washes exist)
      const currentReadingObj = {
        reading: currentReading
      };
      
      // Only include washes if the array exists in Firebase
      if (washes !== undefined) {
        // Add cost field to each wash entry based on configuration
        const washesWithCost = washes.map(wash => ({
          ...wash,
          cost: wash.type === 'car' 
            ? (config?.rateCarWash || 100) 
            : (config?.rateBoatWash || 200)
        }));
        currentReadingObj.washes = washesWithCost;
      }
      
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
      
      // Calculate billAmount (ALL IN CENTAVOS - integers)
      const currentCharge = bill?.currentCharge; // Already in centavos from waterBillsService
      const calculatedAmount = consumption > 0 ? Math.round(consumption * ratePerM3) : 0; // ratePerM3 is in centavos
      const billAmount = currentCharge ?? calculatedAmount;
      
      // Removed Unit 203 debug logging to prevent confusion
      
      // Use carryover data if no bills exist for this month
      const carryover = unpaidCarryover[unitId] || {};
      
      // Calculate Total Due = Monthly Amount + Previous Balance + Penalties (all in centavos)
      // Don't use dynamic penalty calculation - use stored bill data for correct accounting
      let totalDueAmount;
      let penaltyAmount;
      let unpaidAmount;
      
      if (bill) {
        // Use stored bill data which has correct accounting (all in centavos)
        totalDueAmount = bill.totalAmount || 0;
        penaltyAmount = bill.penaltyAmount || 0;
        // CRITICAL: Use basePaid + penaltyPaid, NOT paidAmount (which may include overflow)
        const totalPaid = (bill.basePaid || 0) + (bill.penaltyPaid || 0);
        unpaidAmount = Math.max(0, totalDueAmount - totalPaid);
        
        console.log(`💰 Unit ${unitId} bill data (centavos):`);
        console.log(`  Monthly Amount: ${billAmount} (${centavosToPesos(billAmount)} pesos)`);
        console.log(`  Previous Balance: ${bill.previousBalance || 0} (${centavosToPesos(bill.previousBalance || 0)} pesos)`);
        console.log(`  Penalty Amount: ${penaltyAmount} (${centavosToPesos(penaltyAmount)} pesos)`);
        console.log(`  Total Due: ${totalDueAmount} (${centavosToPesos(totalDueAmount)} pesos)`);
        console.log(`  Total Paid: ${totalPaid} (${centavosToPesos(totalPaid)} pesos) [basePaid: ${bill.basePaid || 0}, penaltyPaid: ${bill.penaltyPaid || 0}]`);
        console.log(`  Status: ${this.calculateStatus(bill)}`);
        console.log(`  Unpaid Amount: ${unpaidAmount} (${centavosToPesos(unpaidAmount)} pesos)`);
      } else {
        // No bill exists - use carryover data for display (all in centavos)
        totalDueAmount = billAmount + (carryover.previousBalance || 0) + (carryover.penaltyAmount || 0);
        penaltyAmount = carryover.penaltyAmount || 0;
        unpaidAmount = totalDueAmount;
      }
      
      // CRITICAL: Use status from Firestore if it exists (set by payment service)
      // Only calculate status if bill doesn't have one (legacy data)
      const billStatus = bill?.status || this.calculateStatus(bill) || (carryover.previousBalance > 0 ? 'unpaid' : 'nobill');
      
      // TASK 2: Data consistency validation
      // Use basePaid + penaltyPaid for validation (not paidAmount which may include overflow from prior payment)
      const actualAmountPaidToThisBill = (bill?.basePaid || 0) + (bill?.penaltyPaid || 0);
      
      // Check for inconsistencies between status and amounts
      if (billStatus === 'paid' && unpaidAmount > 0) {
        console.warn(`⚠️  [DATA_INCONSISTENCY] Unit ${unitId} Month ${month}: Status is 'paid' but unpaidAmount is $${unpaidAmount}`);
        console.warn(`   totalAmount: $${totalDueAmount}, actualPaid: $${actualAmountPaidToThisBill}`);
      }
      if (billStatus === 'unpaid' && unpaidAmount === 0 && totalDueAmount > 0) {
        console.warn(`⚠️  [DATA_INCONSISTENCY] Unit ${unitId} Month ${month}: Status is 'unpaid' but unpaidAmount is $0`);
        console.warn(`   totalAmount: $${totalDueAmount}, actualPaid: $${actualAmountPaidToThisBill}`);
      }
      if (billStatus === 'paid' && actualAmountPaidToThisBill < totalDueAmount) {
        console.warn(`⚠️  [DATA_INCONSISTENCY] Unit ${unitId} Month ${month}: Status is 'paid' but actualPaid ($${actualAmountPaidToThisBill}) < totalAmount ($${totalDueAmount})`);
      }
      
      unitData[unitId] = {
        ownerLastName,
        priorReading,
        currentReading: currentReadingObj,
        consumption,
        // ALL AMOUNTS BELOW ARE IN CENTAVOS (integers) - frontend must convert to pesos for display
        previousBalance: bill?.previousBalance || carryover.previousBalance || 0,  // In centavos
        penaltyAmount: penaltyAmount,                // In centavos
        billAmount: billAmount,                      // In centavos
        totalAmount: totalDueAmount,                 // In centavos
        paidAmount: bill?.paidAmount || 0,           // In centavos
        unpaidAmount: unpaidAmount,                  // In centavos
        status: billStatus,
        daysPastDue: this.calculateDaysPastDue(bill, bills?.dueDate) || carryover.daysOverdue || 0,
        
        // Display fields for frontend (all in centavos - frontend converts to pesos for display)
        displayDue: billStatus === 'paid' ? 0 : unpaidAmount,                     // In centavos
        displayPenalties: billStatus === 'paid' ? 0 : penaltyAmount,              // In centavos
        displayOverdue: billStatus === 'paid' ? 0 : (carryover.previousBalance || 0)  // In centavos
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
    
    // Add Common Area data - always include if we have prior readings or current readings
    if (currentReadings.commonArea !== undefined || priorReadings.commonArea !== undefined) {
      let currentCommonReading = currentReadings.commonArea;
      // If it's an object, extract the reading value (like we do for units)
      if (typeof currentCommonReading === 'object' && currentCommonReading.reading !== undefined) {
        currentCommonReading = currentCommonReading.reading;
      }
      
      let priorCommonReading = priorReadings.commonArea || 0;
      // If it's an object, extract the reading value
      if (typeof priorCommonReading === 'object' && priorCommonReading.reading !== undefined) {
        priorCommonReading = priorCommonReading.reading;
      }
      
      monthData.commonArea = {
        priorReading: priorCommonReading,
        currentReading: currentCommonReading || null,
        consumption: currentCommonReading !== undefined ? currentCommonReading - priorCommonReading : null
      };
    }
    
    // Add Building Meter data - always include if we have prior readings or current readings
    if (currentReadings.buildingMeter !== undefined || priorReadings.buildingMeter !== undefined) {
      let currentBuildingReading = currentReadings.buildingMeter;
      // If it's an object, extract the reading value (like we do for units)
      if (typeof currentBuildingReading === 'object' && currentBuildingReading.reading !== undefined) {
        currentBuildingReading = currentBuildingReading.reading;
      }
      
      let priorBuildingReading = priorReadings.buildingMeter || 0;
      // If it's an object, extract the reading value
      if (typeof priorBuildingReading === 'object' && priorBuildingReading.reading !== undefined) {
        priorBuildingReading = priorBuildingReading.reading;
      }
      
      monthData.buildingMeter = {
        priorReading: priorBuildingReading,
        currentReading: currentBuildingReading || null,
        consumption: currentBuildingReading !== undefined ? currentBuildingReading - priorBuildingReading : null
      };
    }
    
    // Add reading timestamps using DateService
    if (currentTimestamp) {
      monthData.readingDate = this.dateService.formatForFrontend(currentTimestamp).iso;
    }
    if (priorTimestamp) {
      monthData.priorReadingDate = this.dateService.formatForFrontend(priorTimestamp).iso;
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
   * Check if bills exist for a month (used to avoid calculating future months)
   */
  async _checkBillsExist(clientId, year, month) {
    try {
      const bills = await this.fetchBills(clientId, year, month);
      return bills && bills.bills && Object.keys(bills.bills.units || {}).length > 0;
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
    const [currentReadingsData, priorReadingsData, bills] = await Promise.all([
      this.fetchReadings(clientId, year, month),
      this.fetchReadings(clientId, priorYear, priorMonth),
      this.fetchBills(clientId, year, month)
    ]);
    
    // Extract readings and timestamps
    const currentReadings = currentReadingsData.readings;
    const priorReadings = priorReadingsData.readings;
    const currentTimestamp = currentReadingsData.timestamp;
    const priorTimestamp = priorReadingsData.timestamp;
    
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
                  unpaidCarryover[unitId] = { penaltyAmount: 0, previousBalance: 0, totalPenalties: 0 };
                }
                const unpaidPenalty = (unitBill.penaltyAmount || 0) - (unitBill.penaltyPaid || 0);
                const unpaidBalance = (unitBill.totalAmount || 0) - (unitBill.paidAmount || 0) - unpaidPenalty;
                
                unpaidCarryover[unitId].penaltyAmount += unpaidPenalty;
                unpaidCarryover[unitId].previousBalance += unpaidBalance;
                unpaidCarryover[unitId].totalPenalties += unpaidPenalty;  // Same as penaltyAmount for cumulative total
                
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
      year, month, currentReadings, priorReadings, bills, units, config, ratePerM3, unpaidCarryover, currentTimestamp, priorTimestamp
    );
  }

  /**
   * Core month data builder that takes all data sources as parameters
   * This allows reuse with different data fetching strategies
   */
  _buildMonthDataFromSourcesWithCarryover(year, month, currentReadings, priorReadings, bills, units, config, ratePerM3, unpaidCarryover = {}, currentTimestamp = null, priorTimestamp = null) {
    // Building month data with carryover calculations
    
    // Build unit data (reuse existing logic from buildMonthData)
    const unitData = {};
    
    for (const unit of units) {
      const unitId = unit.unitId;
      
      // Extract reading from nested structure if present
      let currentReading = currentReadings[unitId] || 0;
      let washes = undefined; // Only include if washes array exists
      
      if (typeof currentReading === 'object' && currentReading.reading !== undefined) {
        // Extract washes array if it exists (ignore legacy count fields)
        if (currentReading.washes && Array.isArray(currentReading.washes)) {
          washes = currentReading.washes;
        }
        currentReading = currentReading.reading;
      }
      
      const priorReading = priorReadings[unitId] || 0;
      const consumption = currentReading - priorReading;
      const bill = bills?.bills?.units?.[unitId];
      
      // Store reading and washes array (only if washes exist)
      const currentReadingObj = {
        reading: currentReading
      };
      
      // Only include washes if the array exists in Firebase
      if (washes !== undefined) {
        // Add cost field to each wash entry based on configuration
        const washesWithCost = washes.map(wash => ({
          ...wash,
          cost: wash.type === 'car' 
            ? (config?.rateCarWash || 100) 
            : (config?.rateBoatWash || 200)
        }));
        currentReadingObj.washes = washesWithCost;
      }
      
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
      
      // Calculate billAmount (ALL IN CENTAVOS - integers)
      const currentCharge = bill?.currentCharge; // Already in centavos from waterBillsService
      const calculatedAmount = consumption > 0 ? Math.round(consumption * ratePerM3) : 0; // ratePerM3 is in centavos
      const billAmount = currentCharge ?? calculatedAmount;
      
      // Use carryover data if no bills exist for this month
      const carryover = unpaidCarryover[unitId] || {};
      
      // Calculate Total Due = Monthly Amount + Previous Balance + Penalties (all in centavos)
      let totalDueAmount;
      let penaltyAmount;
      let unpaidAmount;
      
      if (bill) {
        // Use stored bill data which has correct accounting (all in centavos)
        totalDueAmount = bill.totalAmount || 0;
        penaltyAmount = bill.penaltyAmount || 0;
        
        // Calculate unpaid amount accounting for credit usage (all in centavos)
        // basePaid includes both cash (paidAmount) and credit
        const basePaidTotal = (bill.basePaid || 0);
        const penaltyPaidTotal = (bill.penaltyPaid || 0);
        const totalPaid = basePaidTotal + penaltyPaidTotal;
        unpaidAmount = Math.max(0, totalDueAmount - totalPaid);
      } else {
        // No bill exists - use carryover data for display (all in centavos)
        totalDueAmount = billAmount + (carryover.previousBalance || 0) + (carryover.penaltyAmount || 0);
        penaltyAmount = carryover.penaltyAmount || 0;
        unpaidAmount = totalDueAmount;
      }
      
      unitData[unitId] = {
        ownerLastName,
        priorReading,
        currentReading: currentReadingObj,
        consumption,
        // ALL AMOUNTS BELOW ARE IN CENTAVOS (integers) - frontend must convert to pesos for display
        previousBalance: bill?.previousBalance || carryover.previousBalance || 0,  // In centavos
        penaltyAmount: penaltyAmount,                                              // In centavos
        billAmount: billAmount,                                                    // In centavos
        totalAmount: totalDueAmount,                                               // In centavos
        paidAmount: bill?.paidAmount || 0,                                         // In centavos
        unpaidAmount: unpaidAmount,                                                // In centavos
        // CRITICAL: Use status from Firestore if it exists (set by payment service)
        status: bill?.status || this.calculateStatus(bill) || (carryover.previousBalance > 0 ? 'unpaid' : 'nobill'),
        daysPastDue: this.calculateDaysPastDue(bill, bills?.dueDate) || carryover.daysOverdue || 0,
        // CRITICAL: Include transaction ID for bidirectional linking
        transactionId: (() => {
          const payments = bill?.payments;
          const transactionId = payments && payments.length > 0 ? payments[payments.length - 1].transactionId : null;
          
          return transactionId;
        })(),
        // CRITICAL: Include payments array for UI transaction navigation
        payments: bill?.payments || [],
        // Include bill notes for hover tooltips (shows car wash details)
        billNotes: bill?.billNotes || null,
        
        // Display fields for frontend (all in centavos - frontend converts to pesos for display)
        displayDue: (() => {
          const billStatus = this.calculateStatus(bill) || (carryover.previousBalance > 0 ? 'unpaid' : 'nobill');
          return billStatus === 'paid' ? 0 : unpaidAmount;                        // In centavos
        })(),
        displayPenalties: (() => {
          const billStatus = this.calculateStatus(bill) || (carryover.previousBalance > 0 ? 'unpaid' : 'nobill');
          return billStatus === 'paid' ? 0 : penaltyAmount;                       // In centavos
        })(),
        displayOverdue: (() => {
          const billStatus = this.calculateStatus(bill) || (carryover.previousBalance > 0 ? 'unpaid' : 'nobill');
          return billStatus === 'paid' ? 0 : (carryover.previousBalance || 0);    // In centavos
        })(),
        
        // NEW: Summary fields for UI (cumulative totals)
        totalPenalties: (() => {
          const billStatus = this.calculateStatus(bill) || (carryover.previousBalance > 0 ? 'unpaid' : 'nobill');
          return billStatus === 'paid' ? 0 : (carryover.totalPenalties || 0);       // Cumulative penalties from all months
        })(),
        totalDue: (() => {
          const billStatus = this.calculateStatus(bill) || (carryover.previousBalance > 0 ? 'unpaid' : 'nobill');
          return billStatus === 'paid' ? 0 : unpaidAmount;  // Use unpaidAmount which accounts for partial payments
        })(),
        displayTotalPenalties: (() => {
          const billStatus = this.calculateStatus(bill) || (carryover.previousBalance > 0 ? 'unpaid' : 'nobill');
          return billStatus === 'paid' ? 0 : (carryover.totalPenalties || 0);       // For UI display
        })(),
        displayTotalDue: (() => {
          const billStatus = this.calculateStatus(bill) || (carryover.previousBalance > 0 ? 'unpaid' : 'nobill');
          return billStatus === 'paid' ? 0 : unpaidAmount;  // Use unpaidAmount which accounts for partial payments
        })()
      };
      
      // TASK 2: Data consistency validation (after building the unit data)
      const billStatus = this.calculateStatus(bill) || (carryover.previousBalance > 0 ? 'unpaid' : 'nobill');
      // Use basePaid + penaltyPaid for validation (not paidAmount which may include overflow from prior payment)
      const actualAmountPaidToThisBill = (bill?.basePaid || 0) + (bill?.penaltyPaid || 0);
      
      if (billStatus === 'paid' && unpaidAmount > 0) {
        console.warn(`⚠️  [DATA_INCONSISTENCY] Unit ${unitId} Month ${month}: Status is 'paid' but unpaidAmount is $${unpaidAmount}`);
        console.warn(`   totalAmount: $${totalDueAmount}, actualPaid: $${actualAmountPaidToThisBill}`);
      }
      if (billStatus === 'unpaid' && unpaidAmount === 0 && totalDueAmount > 0) {
        console.warn(`⚠️  [DATA_INCONSISTENCY] Unit ${unitId} Month ${month}: Status is 'unpaid' but unpaidAmount is $0`);
        console.warn(`   totalAmount: $${totalDueAmount}, actualPaid: $${actualAmountPaidToThisBill}`);
      }
      if (billStatus === 'paid' && actualAmountPaidToThisBill < totalDueAmount) {
        console.warn(`⚠️  [DATA_INCONSISTENCY] Unit ${unitId} Month ${month}: Status is 'paid' but actualPaid ($${actualAmountPaidToThisBill}) < totalAmount ($${totalDueAmount})`);
      }
    }
    
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
    
    // Add Common Area data - always include if we have prior readings or current readings
    if (currentReadings.commonArea !== undefined || priorReadings.commonArea !== undefined) {
      let currentCommonReading = currentReadings.commonArea;
      // If it's an object, extract the reading value (like we do for units)
      if (typeof currentCommonReading === 'object' && currentCommonReading.reading !== undefined) {
        currentCommonReading = currentCommonReading.reading;
      }
      
      let priorCommonReading = priorReadings.commonArea || 0;
      // If it's an object, extract the reading value
      if (typeof priorCommonReading === 'object' && priorCommonReading.reading !== undefined) {
        priorCommonReading = priorCommonReading.reading;
      }
      
      monthData.commonArea = {
        priorReading: priorCommonReading,
        currentReading: currentCommonReading || null,
        consumption: currentCommonReading !== undefined ? currentCommonReading - priorCommonReading : null
      };
    }
    
    // Add Building Meter data - always include if we have prior readings or current readings
    if (currentReadings.buildingMeter !== undefined || priorReadings.buildingMeter !== undefined) {
      let currentBuildingReading = currentReadings.buildingMeter;
      // If it's an object, extract the reading value (like we do for units)
      if (typeof currentBuildingReading === 'object' && currentBuildingReading.reading !== undefined) {
        currentBuildingReading = currentBuildingReading.reading;
      }
      
      let priorBuildingReading = priorReadings.buildingMeter || 0;
      // If it's an object, extract the reading value
      if (typeof priorBuildingReading === 'object' && priorBuildingReading.reading !== undefined) {
        priorBuildingReading = priorBuildingReading.reading;
      }
      
      monthData.buildingMeter = {
        priorReading: priorBuildingReading,
        currentReading: currentBuildingReading || null,
        consumption: currentBuildingReading !== undefined ? currentBuildingReading - priorBuildingReading : null
      };
    }
    
    // Add reading timestamps using DateService
    if (currentTimestamp) {
      monthData.readingDate = this.dateService.formatForFrontend(currentTimestamp).iso;
    }
    if (priorTimestamp) {
      monthData.priorReadingDate = this.dateService.formatForFrontend(priorTimestamp).iso;
    }
    
    return monthData;
  }

  /**
   * BATCH FETCH: Fetch all readings for entire year at once
   * Reduces multiple Firestore reads to a single batch operation
   */
  async fetchAllReadingsForYear(clientId, year) {
    try {
      // Initialize database connection
      await waterReadingsService._initializeDb();
      const db = waterReadingsService.db;
      
      // Build document references for all 12 months + prior year's last month
      const docRefs = [];
      const monthKeys = [];
      
      // Get June of prior year (needed for July calculation)
      const priorYearDocId = `${year - 1}-11`;
      docRefs.push(
        db.collection('clients').doc(clientId)
          .collection('projects').doc('waterBills')
          .collection('readings').doc(priorYearDocId)
      );
      monthKeys.push('prior-11');
      
      // Get all 12 months of current year
      for (let month = 0; month < 12; month++) {
        const docId = `${year}-${String(month).padStart(2, '0')}`;
        docRefs.push(
          db.collection('clients').doc(clientId)
            .collection('projects').doc('waterBills')
            .collection('readings').doc(docId)
        );
        monthKeys.push(month);
      }
      
      // Batch fetch all documents
      console.log(`📚 [BATCH] Fetching ${docRefs.length} reading documents in one call`);
      const snapshots = await db.getAll(...docRefs);
      
      // Build results map
      const results = {};
      snapshots.forEach((snapshot, index) => {
        const key = monthKeys[index];
        if (snapshot.exists) {
          const data = snapshot.data();
          results[key] = {
            readings: {
              ...data.readings || {},
              commonArea: data.commonArea,
              buildingMeter: data.buildingMeter
            },
            timestamp: data.timestamp || null
          };
        } else {
          results[key] = { readings: {}, timestamp: null };
        }
      });
      
      console.log(`✅ [BATCH] Loaded ${Object.keys(results).filter(k => Object.keys(results[k].readings).length > 0).length} months with readings`);
      return results;
    } catch (error) {
      console.error('Error batch fetching readings:', error);
      return {};
    }
  }

  /**
   * BATCH FETCH: Fetch all bills for entire year at once
   * Reduces multiple Firestore reads to a single batch operation
   */
  async fetchAllBillsForYear(clientId, year) {
    try {
      // Initialize database connection
      await waterBillsService._initializeDb();
      const db = waterBillsService.db;
      
      // Build document references for all 12 months
      const docRefs = [];
      const monthKeys = [];
      
      for (let month = 0; month < 12; month++) {
        const docId = `${year}-${String(month).padStart(2, '0')}`;
        docRefs.push(
          db.collection('clients').doc(clientId)
            .collection('projects').doc('waterBills')
            .collection('bills').doc(docId)
        );
        monthKeys.push(month);
      }
      
      // Batch fetch all documents
      console.log(`📚 [BATCH] Fetching ${docRefs.length} bill documents in one call`);
      const snapshots = await db.getAll(...docRefs);
      
      // Build results map
      const results = {};
      snapshots.forEach((snapshot, index) => {
        const key = monthKeys[index];
        results[key] = snapshot.exists ? snapshot.data() : null;
      });
      
      console.log(`✅ [BATCH] Loaded ${Object.keys(results).filter(k => results[k] !== null).length} months with bills`);
      return results;
    } catch (error) {
      console.error('Error batch fetching bills:', error);
      return {};
    }
  }

  /**
   * Fetch readings for a month using existing service
   * NOTE: Prefer fetchAllReadingsForYear() for better performance
   */
  async fetchReadings(clientId, year, month) {
    try {
      const data = await waterReadingsService.getMonthReadings(clientId, year, month);
      if (!data) return { readings: {}, timestamp: null };
      
      // Return readings and timestamp separately
      return {
        readings: {
          ...data.readings || {},  // Spread unit readings at top level
          commonArea: data.commonArea,
          buildingMeter: data.buildingMeter
        },
        timestamp: data.timestamp || null
      };
    } catch (error) {
      console.log(`No readings for ${year}-${month}`);
      return { readings: {}, timestamp: null };
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
   * CRITICAL: Must account for credit usage (basePaid) not just cash (paidAmount)
   */
  calculateStatus(bill) {
    if (!bill) return 'nobill';
    
    // Check if bill is fully paid (including credit usage)
    // basePaid includes both cash (paidAmount) and credit usage
    const baseFullyPaid = (bill.basePaid || 0) >= (bill.currentCharge || 0);
    const penaltiesFullyPaid = (bill.penaltyPaid || 0) >= (bill.penaltyAmount || 0);
    
    // Bill is paid if both base charges and penalties are fully paid
    if (baseFullyPaid && penaltiesFullyPaid) return 'paid';
    
    const dueDate = bill.dueDate ? new Date(bill.dueDate) : null;
    if (dueDate && dueDate < getNow()) return 'overdue';
    
    return 'unpaid';
  }

  /**
   * Calculate days past due
   */
  calculateDaysPastDue(bill, billDueDate) {
    if (!bill || !billDueDate) return 0;
    if (bill.paidAmount >= bill.totalAmount) return 0;
    
    const dueDate = new Date(billDueDate);
    const today = getNow();
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
    
    // Find the most recent month with bills generated (for Dashboard past due calculation)
    let mostRecentBilledMonth = null;
    for (let i = months.length - 1; i >= 0; i--) {
      if (months[i].billsGenerated) {
        mostRecentBilledMonth = months[i];
        break;
      }
    }
    
    for (const month of months) {
      // Sum unit consumption and billing
      for (const [unitId, data] of Object.entries(month.units)) {
        totalConsumption += data.consumption;
        totalBilled += data.billAmount;
        totalPaid += data.paidAmount;
        // Note: Do NOT accumulate unpaidAmount here - it's cumulative per month
        // We'll calculate the correct totalUnpaid from the most recent month later
        
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
    
    // Build overdueDetails from MOST RECENT month only (displayTotalDue is cumulative)
    const overdueDetails = [];
    if (mostRecentBilledMonth && mostRecentBilledMonth.units) {
      for (const [unitId, data] of Object.entries(mostRecentBilledMonth.units)) {
        // Use displayTotalDue which includes cumulative amounts across all months
        const cumulativeDue = data.displayTotalDue || 0;
        if (cumulativeDue > 0) {
          overdueDetails.push({
            unitId: unitId,
            owner: data.ownerLastName || 'Unknown',
            amountDue: cumulativeDue // This is the cumulative amount due across all months
          });
        }
      }
      
      // Update totalUnpaid to match cumulative amounts from most recent month
      totalUnpaid = overdueDetails.reduce((sum, detail) => sum + detail.amountDue, 0);
    }
    
    return {
      totalConsumption,
      commonAreaConsumption,
      buildingMeterConsumption,
      totalBilled,
      totalPaid,
      totalUnpaid,
      unitsWithOverdue: overdueUnits.size,
      collectionRate: totalBilled > 0 ? parseFloat((totalPaid / totalBilled * 100).toFixed(1)) : 0,
      overdueDetails // Pre-calculated for Dashboard tooltip from most recent month
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
   * @param {string} specificUnitId - Optional: Calculate carryover for only this unit (surgical update optimization)
   */
  async _calculateUnpaidCarryover(clientId, currentYear, currentMonth, ratePerM3, specificUnitId = null) {
    if (specificUnitId) {
      console.log(`🔍 [CARRYOVER] SURGICAL: Calculating for unit ${specificUnitId} only`);
    } else {
      console.log(`🔍 [CARRYOVER] Starting calculation for ${clientId} ${currentYear} month ${currentMonth}`);
    }
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
        
        // SURGICAL OPTIMIZATION: If specificUnitId provided, only process that unit
        const unitsToProcess = specificUnitId 
          ? (billData.bills.units?.[specificUnitId] ? [[specificUnitId, billData.bills.units[specificUnitId]]] : [])
          : Object.entries(billData.bills.units || {});
        
        for (const [unitId, bill] of unitsToProcess) {
          // CRITICAL: Use basePaid + penaltyPaid, NOT paidAmount (which may include overflow)
          const totalPaid = (bill.basePaid || 0) + (bill.penaltyPaid || 0);
          const unpaidAmount = Math.max(0, bill.totalAmount - totalPaid);
          
          if (unpaidAmount > 0) {
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