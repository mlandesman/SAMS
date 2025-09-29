// src/services/waterMeterService.js
import { MeterReadingService } from './meterReadingService.js';
import { getDb } from '../firebase.js';
import admin from 'firebase-admin';
import { randomUUID } from 'crypto';
import { getFiscalYear } from '../utils/fiscalYearUtils.js';
import { getNow } from './DateService.js';

/**
 * Water Meter Service
 * Extends MeterReadingService with water-specific billing functionality
 * Handles water meter readings and bill generation for AVII water billing
 */
class WaterMeterService extends MeterReadingService {
  constructor() {
    // Initialize parent with water meter type
    super('waterMeter');
    
    // Billing configuration will be loaded from Firestore
    this.billingConfig = null;
    // Client configuration for fiscal year
    this.clientConfig = null;
  }

  /**
   * Load water billing configuration from Firestore
   * @param {string} clientId - Client identifier
   * @returns {Object} Water billing configuration
   */
  async loadConfig(clientId) {
    await this._initializeDb();
    const configDoc = await this.dbInstance.doc(`clients/${clientId}/config/waterBills`).get();
    if (!configDoc.exists) {
      throw new Error(`Water billing config not found for client ${clientId}`);
    }
    this.billingConfig = configDoc.data();
    console.log(`Loaded water config for ${clientId}: Rate=${this.billingConfig.ratePerM3} cents/m³`);
    
    // Also load client configuration for fiscal year
    const clientDoc = await this.dbInstance.doc(`clients/${clientId}`).get();
    if (clientDoc.exists) {
      this.clientConfig = { id: clientId, ...clientDoc.data() };
      console.log(`[WATER] Client ${clientId} fiscal year starts in month ${this.clientConfig?.configuration?.fiscalYearStartMonth || 1}`);
    }
    
    return this.billingConfig;
  }

  /**
   * Calculate water charges based on consumption
   * @param {number} consumption - Water consumption in cubic meters
   * @param {Object} config - Billing configuration
   * @param {number} [daysLate=0] - Days late for penalty calculation
   * @returns {Object} Calculated charges
   */
  calculateWaterCharges(consumption, config, daysLate = 0) {
    // Simple calculation - NO minimum charge
    const subtotal = Math.round(consumption * config.ratePerM3);
    
    // Calculate penalty if applicable (using decimal format)
    let penalty = 0;
    if (daysLate > config.penaltyDays) {
      penalty = Math.round(subtotal * config.penaltyRate); // 0.05 = 5%
    }
    
    return {
      consumption,
      rate: config.ratePerM3,
      subtotal,
      penalty,
      total: subtotal + penalty
    };
  }

  /**
   * Calculate water consumption from meter readings
   * @param {number} currentReading - Current meter reading
   * @param {number} previousReading - Previous meter reading
   * @returns {Object} Consumption details
   */
  calculateConsumption(currentReading, previousReading) {
    // Handle meter rollover (e.g., 9999 to 0001)
    // Handle negative consumption (error case)
    // Return consumption and any warnings
    
    if (currentReading < 0 || previousReading < 0) {
      throw new Error('Readings cannot be negative');
    }
    
    let consumption = currentReading - previousReading;
    
    // Handle meter rollover (assuming 10000 max)
    if (consumption < 0) {
      // Possible rollover
      const meterMax = 10000;
      consumption = (meterMax - previousReading) + currentReading;
      
      // If still negative or unreasonably high, it's an error
      if (consumption < 0 || consumption > 1000) {
        throw new Error(`Invalid consumption: ${consumption}. Check readings.`);
      }
      
      return {
        consumption,
        warning: 'Meter rollover detected',
        previousReading,
        currentReading
      };
    }
    
    // Check for suspicious consumption (>200 m³ is unusual)
    const warnings = [];
    if (consumption > 200) {
      warnings.push('Unusually high consumption');
    }
    
    return {
      consumption,
      warnings,
      previousReading,
      currentReading
    };
  }

  /**
   * Calculate compound penalty for late payment
   * @param {number} outstandingAmount - Amount in cents
   * @param {number} penaltyRate - Rate as decimal (0.05 = 5%)
   * @param {number} monthsLate - Number of months late
   * @returns {Object} Penalty calculation details
   */
  applyCompoundPenalty(outstandingAmount, penaltyRate, monthsLate) {
    // Compound monthly: A = P(1 + r)^n
    // Where P = principal, r = rate, n = periods
    
    if (monthsLate <= 0) {
      return {
        penalty: 0,
        totalWithPenalty: outstandingAmount,
        monthsLate: 0,
        effectiveRate: 0
      };
    }
    
    const compoundAmount = Math.round(
      outstandingAmount * Math.pow(1 + penaltyRate, monthsLate)
    );
    const penalty = compoundAmount - outstandingAmount;
    
    return {
      penalty,
      totalWithPenalty: compoundAmount,
      monthsLate,
      effectiveRate: (compoundAmount / outstandingAmount - 1) * 100 // Percentage
    };
  }

  /**
   * Apply credit balance to bill
   * @param {number} totalDue - Amount due in cents
   * @param {number} creditBalance - Available credit in cents
   * @returns {Object} Payment application details
   */
  handleCreditBalance(totalDue, creditBalance) {
    if (creditBalance <= 0) {
      return {
        amountDue: totalDue,
        creditUsed: 0,
        creditRemaining: 0,
        originalAmount: totalDue
      };
    }
    
    const creditUsed = Math.min(creditBalance, totalDue);
    const amountDue = totalDue - creditUsed;
    const creditRemaining = creditBalance - creditUsed;
    
    return {
      amountDue,
      creditUsed,
      creditRemaining,
      originalAmount: totalDue
    };
  }

  /**
   * Calculate days late from due date
   * @param {Date|string} dueDate - Bill due date
   * @param {Date|string} [currentDate] - Current date (defaults to now)
   * @returns {number} Days late (0 if not late)
   */
  calculateDaysLate(dueDate, currentDate = getNow()) {
    const due = this._parseDate(dueDate);
    const current = this._parseDate(currentDate);
    
    // Convert Firestore timestamps to milliseconds
    const dueMs = due.toMillis ? due.toMillis() : due.getTime();
    const currentMs = current.toMillis ? current.toMillis() : current.getTime();
    
    const diffMs = currentMs - dueMs;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  }

  /**
   * Get water meter bills collection path
   * Follows unit-centric pattern: /clients/{clientId}/units/{unitId}/waterMeter/{year}/bills
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier (unitId field, not id)
   * @param {number} year - Year for bills
   * @returns {string} Firestore collection path for bills
   */
  getBillsCollectionPath(clientId, unitId, year) {
    return `${this.getCollectionPath(clientId, unitId, year)}/bills`;
  }

  /**
   * Get bills subcollection reference
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier (unitId field, not id)
   * @param {number} year - Year for bills
   * @returns {FirestoreCollectionReference} Bills subcollection reference
   */
  async getBillsCollection(clientId, unitId, year) {
    await this._initializeDb();
    const billsPath = this.getBillsCollectionPath(clientId, unitId, year);
    return this.dbInstance.collection(billsPath);
  }

  /**
   * Generate a water bill based on consumption
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier (unitId field, not id)
   * @param {number} year - Year for the bill
   * @param {Object} billData - Bill generation data
   * @param {number} [billData.consumption] - Water consumption in cubic meters (if not provided, calculated from readings)
   * @param {number} [billData.currentReading] - Current meter reading
   * @param {number} [billData.previousReading] - Previous meter reading
   * @param {string|Date|FirestoreTimestamp} billData.billingDate - Billing date
   * @param {string|Date|FirestoreTimestamp} billData.dueDate - Payment due date
   * @param {number} [billData.previousBalance] - Previous outstanding balance in cents
   * @param {number} [billData.creditBalance] - Available credit balance in cents
   * @param {string} [billData.notes] - Optional billing notes
   * @param {Object} [billData.customRates] - Override default billing rates
   * @returns {Object} Generated bill document
   */
  async generateBill(clientId, unitId, year, billData) {
    try {
      await this._initializeDb();

      // Validate required dates
      if (!billData.billingDate) {
        throw new Error('Billing date is required');
      }

      if (!billData.dueDate) {
        throw new Error('Due date is required');
      }

      // Convert dates to Firestore timestamps
      const billingDate = this._parseDate(billData.billingDate);
      const dueDate = this._parseDate(billData.dueDate);

      // Ensure config is loaded
      if (!this.billingConfig) {
        await this.loadConfig(clientId);
      }

      // Use custom rates if provided, otherwise use loaded config
      const rates = billData.customRates ? { ...this.billingConfig, ...billData.customRates } : this.billingConfig;

      // Calculate consumption from readings if not provided
      let consumption = billData.consumption;
      let consumptionWarnings = [];
      if (typeof consumption === 'undefined' && billData.currentReading !== undefined && billData.previousReading !== undefined) {
        const consumptionResult = this.calculateConsumption(billData.currentReading, billData.previousReading);
        consumption = consumptionResult.consumption;
        consumptionWarnings = consumptionResult.warnings || [];
        if (consumptionResult.warning) {
          consumptionWarnings.push(consumptionResult.warning);
        }
      }

      // Validate consumption
      if (typeof consumption !== 'number' || consumption < 0) {
        throw new Error('Consumption must be a non-negative number');
      }

      // Calculate base charges using the new calculation method
      const charges = this.calculateWaterCharges(consumption, rates, 0);
      
      // Handle previous balance with compound penalty if applicable
      let penaltyAmount = 0;
      let penaltyDetails = null;
      if (billData.previousBalance && billData.previousBalance > 0) {
        // Calculate days late for previous balance
        const daysLate = this.calculateDaysLate(billData.previousDueDate || billingDate, billingDate);
        const monthsLate = Math.floor(daysLate / 30);
        
        if (monthsLate > 0) {
          penaltyDetails = this.applyCompoundPenalty(billData.previousBalance, rates.penaltyRate, monthsLate);
          penaltyAmount = penaltyDetails.penalty;
        }
      }
      
      // Calculate total before credit
      const subtotal = charges.subtotal;
      const totalBeforeCredit = subtotal + (billData.previousBalance || 0) + penaltyAmount;
      
      // Apply credit balance if available
      let creditApplied = 0;
      let creditRemaining = 0;
      let finalAmount = totalBeforeCredit;
      
      if (billData.creditBalance && billData.creditBalance > 0) {
        const creditResult = this.handleCreditBalance(totalBeforeCredit, billData.creditBalance);
        creditApplied = creditResult.creditUsed;
        creditRemaining = creditResult.creditRemaining;
        finalAmount = creditResult.amountDue;
      }

      // Generate bill document (no need to store unitId - it's in the path)
      const billDoc = {
        // Billing identifiers
        clientId,
        year,
        meterType: this.meterType,

        // Billing period and dates
        billingDate,
        dueDate,
        billingPeriod: rates.billingPeriod || 'monthly',

        // Consumption data
        consumption,
        currentReading: billData.currentReading || null,
        previousReading: billData.previousReading || null,
        consumptionWarnings,

        // Billing amounts (stored as integers in cents)
        consumptionCharge: subtotal,
        previousBalance: billData.previousBalance || 0,
        penaltyAmount,
        penaltyDetails,
        subtotal: totalBeforeCredit,
        creditApplied,
        creditRemaining,
        totalAmount: finalAmount,
        currency: rates.currency || 'MXN',

        // Rate information for transparency
        ratePerM3: rates.ratePerM3,
        penaltyRate: rates.penaltyRate,
        minimumCharge: 0, // No minimum charge for AVII

        // Payment tracking
        paid: false,
        paidAmount: 0,
        paidDate: null,
        paymentReference: null,

        // Additional information
        notes: billData.notes || '',
        status: 'pending',

        // Metadata with proper date formatting
        created: admin.firestore.Timestamp.now(),
        updated: admin.firestore.Timestamp.now(),
        createdAt: this.dateService.formatForFrontend(getNow())
      };

      // Generate unique bill ID with readable format (no prefix needed - we're already in bills collection)
      const billMonth = this.dateService.formatForFrontend(billingDate).month;
      const billId = `${year}-${billMonth.toLowerCase()}-${randomUUID().substring(0, 8)}`;
      
      // Save bill document
      const billsCollection = await this.getBillsCollection(clientId, unitId, year);
      await billsCollection.doc(billId).set(billDoc);

      console.log(`Generated water bill for unit ${unitId}, year ${year}:`, {
        billId,
        consumption,
        totalAmount: finalAmount / 100 // Log in dollars for readability
      });

      // Return bill with formatted data for frontend
      return {
        id: billId,
        unitId,  // Include unitId for frontend convenience
        ...billDoc,
        // Format amounts for display (convert from cents to dollars)
        displayAmounts: {
          consumptionCharge: this._formatAmount(subtotal),
          previousBalance: this._formatAmount(billDoc.previousBalance),
          penaltyAmount: this._formatAmount(penaltyAmount),
          creditApplied: this._formatAmount(creditApplied),
          totalAmount: this._formatAmount(finalAmount),
          paidAmount: this._formatAmount(billDoc.paidAmount)
        },
        // Format dates for frontend
        billingDateFormatted: this.dateService.formatForFrontend(billingDate),
        dueDateFormatted: this.dateService.formatForFrontend(dueDate),
        createdFormatted: this.dateService.formatForFrontend(billDoc.created),
        // Include path for reference
        firestorePath: `${this.getBillsCollectionPath(clientId, unitId, year)}/${billId}`
      };

    } catch (error) {
      console.error('Error generating water bill:', error);
      throw error;
    }
  }

  /**
   * Mark a water bill as paid
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier (unitId field, not id)
   * @param {number} year - Year for the bill
   * @param {string} billId - Bill identifier
   * @param {Object} paymentData - Payment information
   * @param {number} paymentData.amount - Payment amount in cents
   * @param {string|Date|FirestoreTimestamp} paymentData.paidDate - Payment date
   * @param {string} [paymentData.reference] - Payment reference
   * @param {string} [paymentData.notes] - Payment notes
   * @returns {Object} Updated bill document
   */
  async recordPayment(clientId, unitId, year, billId, paymentData) {
    try {
      await this._initializeDb();

      // Validate payment data
      if (!paymentData.amount || paymentData.amount <= 0) {
        throw new Error('Payment amount must be greater than 0');
      }

      if (!paymentData.paidDate) {
        throw new Error('Payment date is required');
      }

      // Get bill document
      const billsCollection = await this.getBillsCollection(clientId, unitId, year);
      const billRef = billsCollection.doc(billId);
      const billDoc = await billRef.get();

      if (!billDoc.exists) {
        throw new Error(`Water bill ${billId} not found`);
      }

      const billData = billDoc.data();

      // Convert payment date
      const paidDate = this._parseDate(paymentData.paidDate);

      // Determine payment status
      const isPaid = paymentData.amount >= billData.totalAmount;
      const status = isPaid ? 'paid' : 'partial';

      // Update bill document
      const updateData = {
        paid: isPaid,
        paidAmount: paymentData.amount,
        paidDate,
        paymentReference: paymentData.reference || null,
        paymentNotes: paymentData.notes || '',
        status,
        updated: admin.firestore.Timestamp.now()
      };

      await billRef.update(updateData);

      console.log(`Recorded payment for water bill ${billId}:`, {
        unitId,
        amount: paymentData.amount / 100, // Log in dollars
        status
      });

      // Return updated bill data
      const updatedBillDoc = await billRef.get();
      const updatedData = updatedBillDoc.data();

      return {
        id: billId,
        unitId,  // Include unitId for frontend convenience
        ...updatedData,
        displayAmounts: {
          consumptionCharge: this._formatAmount(updatedData.consumptionCharge),
          previousBalance: this._formatAmount(updatedData.previousBalance),
          penaltyAmount: this._formatAmount(updatedData.penaltyAmount),
          creditApplied: this._formatAmount(updatedData.creditApplied),
          totalAmount: this._formatAmount(updatedData.totalAmount),
          paidAmount: this._formatAmount(updatedData.paidAmount)
        },
        billingDateFormatted: this.dateService.formatForFrontend(updatedData.billingDate),
        dueDateFormatted: this.dateService.formatForFrontend(updatedData.dueDate),
        paidDateFormatted: updatedData.paidDate ? this.dateService.formatForFrontend(updatedData.paidDate) : null,
        updatedFormatted: this.dateService.formatForFrontend(updatedData.updated)
      };

    } catch (error) {
      console.error('Error recording water bill payment:', error);
      throw error;
    }
  }

  /**
   * Get all bills for a unit and year
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier (unitId field, not id)
   * @param {number} year - Year for bills
   * @param {Object} [options] - Query options
   * @param {string} [options.status] - Filter by bill status
   * @param {boolean} [options.paidOnly] - Return only paid bills
   * @param {boolean} [options.unpaidOnly] - Return only unpaid bills
   * @returns {Array} Array of bill documents with formatted data
   */
  async getUnitBills(clientId, unitId, year, options = {}) {
    try {
      await this._initializeDb();

      const billsCollection = await this.getBillsCollection(clientId, unitId, year);
      
      // Simple query - just get all bills for this unit/year
      const snapshot = await billsCollection.get();
      
      // Format results for frontend
      let bills = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        bills.push({
          id: doc.id,
          unitId,  // Add unitId from parameter since it's not stored in document
          ...data,
          displayAmounts: {
            consumptionCharge: this._formatAmount(data.consumptionCharge),
            previousBalance: this._formatAmount(data.previousBalance),
            penaltyAmount: this._formatAmount(data.penaltyAmount),
            creditApplied: this._formatAmount(data.creditApplied),
            totalAmount: this._formatAmount(data.totalAmount),
            paidAmount: this._formatAmount(data.paidAmount)
          },
          billingDateFormatted: this.dateService.formatForFrontend(data.billingDate),
          dueDateFormatted: this.dateService.formatForFrontend(data.dueDate),
          paidDateFormatted: data.paidDate ? this.dateService.formatForFrontend(data.paidDate) : null,
          createdFormatted: this.dateService.formatForFrontend(data.created),
          updatedFormatted: this.dateService.formatForFrontend(data.updated)
        });
      });

      // Apply filters in memory (avoids need for Firestore composite indexes)
      if (options.status) {
        bills = bills.filter(bill => bill.status === options.status);
      }
      
      if (options.paidOnly) {
        bills = bills.filter(bill => bill.paid === true);
      } else if (options.unpaidOnly) {
        bills = bills.filter(bill => bill.paid !== true);
      }
      
      // Sort by billing date descending
      bills.sort((a, b) => {
        const dateA = a.billingDate?._seconds || 0;
        const dateB = b.billingDate?._seconds || 0;
        return dateB - dateA;
      });

      console.log(`Retrieved ${bills.length} water bills for unit ${unitId}, year ${year}`);
      return bills;

    } catch (error) {
      console.error('Error getting water bills:', error);
      throw error;
    }
  }

  /**
   * Parse various date formats to Firestore timestamp
   * @private
   * @param {string|Date|FirestoreTimestamp} date - Date to parse
   * @returns {FirestoreTimestamp} Firestore timestamp
   */
  _parseDate(date) {
    if (date && typeof date.toDate === 'function') {
      // Already a Firestore timestamp
      return date;
    } else if (date instanceof Date) {
      return admin.firestore.Timestamp.fromDate(date);
    } else if (typeof date === 'string') {
      // Parse string date in Mexico timezone
      return this.dateService.parseFromFrontend(date, 'yyyy-MM-dd');
    } else {
      throw new Error('Invalid date format provided');
    }
  }

  /**
   * Format amount from cents to currency display
   * @private
   * @param {number} amountInCents - Amount in cents
   * @returns {string} Formatted currency amount
   */
  _formatAmount(amountInCents) {
    if (!amountInCents) return '0.00';
    
    const dollars = amountInCents / 100;
    return dollars.toFixed(2);
  }

  /**
   * Save a water meter reading
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier
   * @param {Object} readingData - Reading data
   * @returns {Object} Saved reading document
   */
  async saveReading(clientId, unitId, readingData) {
    // Ensure client config is loaded
    if (!this.clientConfig) {
      await this.loadConfig(clientId);
    }
    
    // Parse the reading date properly
    let readingDate;
    if (readingData.readingDate) {
      if (typeof readingData.readingDate === 'string') {
        readingDate = new Date(readingData.readingDate);
      } else {
        readingDate = readingData.readingDate;
      }
    } else {
      readingDate = getNow();
    }
    
    // Get fiscal year based on reading date and client's fiscal year configuration
    const fiscalYearStartMonth = this.clientConfig?.configuration?.fiscalYearStartMonth || 1;
    const year = getFiscalYear(readingDate, fiscalYearStartMonth);
    
    console.log(`[WATER] Saving reading for ${clientId}/${unitId} - Reading date: ${readingDate.toISOString()}, Fiscal Year: ${year}`);
    
    // Map the field names to match parent class expectations
    const mappedData = {
      reading: readingData.readingValue || readingData.value,
      date: readingDate,
      notes: readingData.notes || '',
      readBy: readingData.readBy || 'API'
    };
    
    // Use parent class recordReading method
    const result = await this.recordReading(clientId, unitId, year, mappedData);
    
    // Add some additional fields for compatibility
    return {
      ...result,
      unitId,  // Include unitId in response for frontend convenience
      value: mappedData.reading,
      readingDate: mappedData.date,
      readingType: readingData.readingType || 'monthly',
      fiscalYear: year
    };
  }

  /**
   * Get a specific reading for a period
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier
   * @param {number} year - Year
   * @param {number} month - Month (1-12)
   * @returns {Object|null} Reading for the period or null
   */
  async getReading(clientId, unitId, year, month) {
    await this._initializeDb();
    
    // Get all readings for the year
    const readings = await this.getUnitHistory(clientId, unitId, year);
    
    // Filter for the specific month
    const monthReading = readings.find(r => {
      const readingDate = r.date.toDate ? r.date.toDate() : new Date(r.date);
      return readingDate.getMonth() + 1 === month;
    });
    
    if (!monthReading) {
      return null;
    }
    
    return {
      ...monthReading,
      value: monthReading.reading,
      readingDate: monthReading.date
    };
  }

  /**
   * Get the previous reading before a specific month
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier
   * @param {number} year - Year
   * @param {number} month - Month (1-12)
   * @returns {Object|null} Previous reading or null
   */
  async getPreviousReading(clientId, unitId, year, month) {
    await this._initializeDb();
    
    // Get readings for current and previous year
    const currentYearReadings = await this.getUnitHistory(clientId, unitId, year);
    const previousYearReadings = year > 2024 ? 
      await this.getUnitHistory(clientId, unitId, year - 1) : [];
    
    // Combine and sort by date
    const allReadings = [...currentYearReadings, ...previousYearReadings]
      .sort((a, b) => {
        const dateA = a.date.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date.toDate ? b.date.toDate() : new Date(b.date);
        return dateB - dateA; // Descending order
      });
    
    // Find the first reading before the target month
    const targetDate = new Date(year, month - 1, 1); // First day of target month
    
    const previousReading = allReadings.find(r => {
      const readingDate = r.date.toDate ? r.date.toDate() : new Date(r.date);
      return readingDate < targetDate;
    });
    
    if (!previousReading) {
      return null;
    }
    
    return {
      ...previousReading,
      value: previousReading.reading,
      readingDate: previousReading.date
    };
  }


  /**
   * Get outstanding balance for a unit
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier
   * @returns {number} Outstanding balance in cents
   */
  async getOutstandingBalance(clientId, unitId) {
    // Ensure client config is loaded
    if (!this.clientConfig) {
      await this.loadConfig(clientId);
    }
    
    // Get current fiscal year
    const fiscalYearStartMonth = this.clientConfig?.configuration?.fiscalYearStartMonth || 1;
    const currentYear = getFiscalYear(getNow(), fiscalYearStartMonth);
    
    const bills = await this.getUnitBills(
      clientId,
      unitId,
      currentYear,
      { unpaidOnly: true }
    );
    
    let totalOutstanding = 0;
    bills.forEach(bill => {
      totalOutstanding += bill.totalAmount - bill.paidAmount;
    });
    
    return totalOutstanding;
  }

  /**
   * Calculate due date based on billing date
   * @param {Date|string} billingDate - Billing date
   * @param {number} [daysUntilDue=10] - Days until due
   * @returns {Date} Due date
   */
  calculateDueDate(billingDate, daysUntilDue = 10) {
    const date = new Date(billingDate);
    date.setDate(date.getDate() + daysUntilDue);
    return date;
  }

  /**
   * Get specific bill
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier
   * @param {string} billId - Bill identifier
   * @returns {Object|null} Bill document or null if not found
   */
  async getBill(clientId, unitId, billId) {
    await this._initializeDb();
    const year = parseInt(billId.split('-')[1]);
    const billDoc = await this.dbInstance
      .doc(`${this.getBillsCollectionPath(clientId, unitId, year)}/${billId}`)
      .get();
    
    if (!billDoc.exists) {
      return null;
    }
    
    const data = billDoc.data();
    return {
      id: billDoc.id,
      unitId,  // Include unitId for frontend convenience
      ...data,
      displayAmounts: {
        consumptionCharge: this._formatAmount(data.consumptionCharge),
        totalAmount: this._formatAmount(data.totalAmount),
        paidAmount: this._formatAmount(data.paidAmount)
      }
    };
  }

  /**
   * Get payment history
   * @param {string} clientId - Client identifier
   * @param {number} year - Year for payments
   * @param {string} [unitId] - Optional unit filter
   * @param {Array} [units] - Optional units array (passed from controller)
   * @returns {Array} Array of payments
   */
  async getPayments(clientId, year, unitId = null, units = null) {
    await this._initializeDb();
    const payments = [];
    
    if (unitId) {
      const bills = await this.getUnitBills(clientId, unitId, year, { paidOnly: true });
      bills.forEach(bill => {
        if (bill.paidAmount > 0) {
          payments.push({
            unitId,
            billId: bill.id,
            amount: bill.paidAmount,
            date: bill.paidDate,
            reference: bill.paymentReference
          });
        }
      });
    } else if (units) {
      // Use units passed from controller instead of querying directly
      for (const unit of units) {
        const unitPayments = await this.getPayments(clientId, year, unit.unitId);
        payments.push(...unitPayments);
      }
    } else {
      // If no units provided, return empty array (controller should provide units)
      console.warn('[WATER] getPayments called without units - controller should provide units array');
    }
    
    return payments;
  }

  /**
   * Get latest readings for all units
   * @param {string} clientId - Client identifier
   * @param {Array} units - Units array from controller
   * @returns {Array} Array of latest readings
   */
  async getLatestReadings(clientId, units) {
    await this._initializeDb();
    
    if (!units || !Array.isArray(units)) {
      console.warn('[WATER] getLatestReadings called without units array');
      return [];
    }
    
    const readings = [];
    
    for (const unit of units) {
      const latestReading = await this.getLatestReading(clientId, unit.unitId);
      if (latestReading) {
        readings.push({
          unitId: unit.unitId,
          unitName: unit.name || unit.unitName || unit.unitId,
          ...latestReading
        });
      }
    }
    
    return readings;
  }

  /**
   * Get latest reading for a specific unit
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier
   * @returns {Object|null} Latest reading or null
   */
  async getLatestReading(clientId, unitId) {
    // Ensure client config is loaded
    if (!this.clientConfig) {
      await this.loadConfig(clientId);
    }
    
    // Get current fiscal year
    const fiscalYearStartMonth = this.clientConfig?.configuration?.fiscalYearStartMonth || 1;
    const currentYear = getFiscalYear(getNow(), fiscalYearStartMonth);
    
    const readings = await this.getUnitReadings(clientId, unitId, currentYear);
    
    if (readings.length === 0 && currentYear > 2024) {
      const previousYearReadings = await this.getUnitReadings(clientId, unitId, currentYear - 1);
      return previousYearReadings.length > 0 ? previousYearReadings[0] : null;
    }
    
    return readings.length > 0 ? readings[0] : null;
  }

  /**
   * Get all readings for a unit and year
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier
   * @param {number} year - Year for readings
   * @returns {Array} Array of readings sorted by date desc
   */
  async getUnitReadings(clientId, unitId, year) {
    await this._initializeDb();
    const readingsPath = `${this.getCollectionPath(clientId, unitId, year)}/readings`;
    const snapshot = await this.dbInstance
      .collection(readingsPath)
      .orderBy('date', 'desc')  // Use 'date' field, not 'readingDate'
      .get();
    
    const readings = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      readings.push({
        id: doc.id,
        unitId,  // Add unitId since it's not stored in document
        ...data,
        readingDateFormatted: data.date ?  // Use 'date' field
          this.dateService.formatForFrontend(data.date) : null
      });
    });
    
    return readings;
  }

  /**
   * Get bill for a specific period
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier
   * @param {number} year - Year
   * @param {number} month - Month (1-12)
   * @returns {Object|null} Bill for the period or null
   */
  async getBillForPeriod(clientId, unitId, year, month) {
    await this._initializeDb();
    const monthName = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 
                       'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][month - 1];
    
    const billsCollection = await this.getBillsCollection(clientId, unitId, year);
    // Simple query - just get all monthly bills
    const snapshot = await billsCollection
      .where('billingPeriod', '==', 'monthly')
      .get();
    
    // Sort in memory
    const bills = [];
    snapshot.forEach(doc => {
      bills.push({ id: doc.id, ...doc.data() });
    });
    
    // Sort by billingDate descending
    bills.sort((a, b) => {
      const dateA = a.billingDate?._seconds || 0;
      const dateB = b.billingDate?._seconds || 0;
      return dateB - dateA;
    });
    
    // Find the bill for the specific month
    let foundBill = null;
    for (const bill of bills) {
      if (bill.id.includes(`-${year}-${monthName}-`)) {
        foundBill = bill;
        break;
      }
    }
    
    return foundBill;
  }
}

export { WaterMeterService };