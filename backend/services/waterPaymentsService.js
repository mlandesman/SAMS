import { getDb } from '../firebase.js';
import { waterDataService } from './waterDataService.js';
import { createTransaction } from '../controllers/transactionsController.js';
import { databaseFieldMappings } from '../utils/databaseFieldMappings.js';
// import { calculateCurrentPenalties } from '../utils/penaltyCalculator.js'; // DEPRECATED - now using stored penalty data
import axios from 'axios';

const { dollarsToCents, centsToDollars } = databaseFieldMappings;

// Create axios instance for internal API calls to HOA module
const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' 
    ? 'https://sams-backend.vercel.app/api'
    : 'http://localhost:5001/api'
});

class WaterPaymentsService {
  constructor() {
    this.db = null;
  }

  async _initializeDb() {
    if (!this.db) {
      this.db = await getDb();
    }
  }
  
  /**
   * Round currency amounts to prevent floating point precision errors
   */
  _roundCurrency(amount) {
    return Math.round(amount * 100) / 100;
  }
  
  /**
   * Record a payment against water bills using credit balance integration
   * Follows identical logic to HOA Dues payment system
   */
  async recordPayment(clientId, unitId, paymentData) {
    await this._initializeDb();
    
    const { 
      amount, 
      paymentDate = new Date().toISOString().split('T')[0], 
      paymentMethod = 'cash',
      reference = '',
      notes = '',
      accountId,
      accountType
    } = paymentData;
    
    // Validate required fields
    if (!unitId || !amount || amount <= 0) {
      throw new Error('Unit ID and positive payment amount are required');
    }
    
    if (!accountId || !accountType) {
      throw new Error('Account ID and account type are required for transaction creation');
    }
    
    console.log(`💧 Recording water payment: Unit ${unitId}, Amount $${amount}`);
    
    // STEP 1: Get current credit balance from HOA Dues module
    const currentYear = new Date().getFullYear();
    const creditResponse = await this._getCreditBalance(clientId, unitId, currentYear);
    const currentCreditBalance = creditResponse.creditBalance || 0;
    
    console.log(`💰 Current credit balance: $${currentCreditBalance}`);
    
    // STEP 2: Calculate total available funds (IDENTICAL TO HOA LOGIC)
    const totalAvailableFunds = this._roundCurrency(amount + currentCreditBalance);
    console.log(`💵 Total available funds: $${amount} + $${currentCreditBalance} = $${totalAvailableFunds}`);
    
    // STEP 3: Get unpaid water bills (oldest first)
    const unpaidBills = await this._getUnpaidBillsForUnit(clientId, unitId);
    console.log(`📋 Found ${unpaidBills.length} unpaid bills`);
    
    if (unpaidBills.length === 0) {
      // No bills to pay - entire amount goes to credit (like HOA overpayment)
      const newCreditBalance = currentCreditBalance + amount;
      
      await this._updateCreditBalance(clientId, unitId, currentYear, {
        newBalance: newCreditBalance,
        changeAmount: amount,
        changeType: 'water_overpayment',
        description: `Water bill overpayment - no bills due`,
        transactionId: null // Will be updated after transaction creation
      });
      
      // Create transaction for the overpayment
      const transactionData = {
        amount: amount,
        type: 'income',
        categoryId: 'water_payments',
        categoryName: 'Water Payments',
        description: `Water bill credit - Unit ${unitId}`,
        unitId: unitId,
        accountId: accountId,
        accountType: accountType,
        paymentMethod: paymentMethod,
        reference: reference,
        notes: this._generateTransactionNotes([], 0, 0, unitId, notes, amount),
        date: paymentDate
      };
      
      const transactionResult = await createTransaction(clientId, transactionData);
      
      return {
        success: true,
        paymentType: 'credit_only',
        totalFundsAvailable: totalAvailableFunds,
        billsPaid: [],
        newCreditBalance: newCreditBalance,
        creditUsed: 0,
        overpayment: amount,
        transactionId: transactionResult
      };
    }
    
    // STEP 4: Apply funds to bills (priority: oldest first, base charges before penalties)
    let remainingFunds = totalAvailableFunds;
    const billPayments = [];
    let totalBaseChargesPaid = 0;
    let totalPenaltiesPaid = 0;
    
    for (const bill of unpaidBills) {
      if (remainingFunds <= 0) break;
      
      const unpaidAmount = bill.totalAmount - (bill.paidAmount || 0);
      const baseUnpaid = bill.currentCharge - (bill.basePaid || 0);
      const penaltyUnpaid = bill.penaltyAmount - (bill.penaltyPaid || 0);
      
      console.log(`📄 Bill ${bill.period}: Total due $${unpaidAmount} (Base: $${baseUnpaid}, Penalties: $${penaltyUnpaid})`);
      
      if (remainingFunds >= unpaidAmount) {
        // Pay bill in full
        billPayments.push({
          billId: bill.id,
          billPeriod: bill.period,
          amountPaid: this._roundCurrency(unpaidAmount),
          baseChargePaid: this._roundCurrency(baseUnpaid),
          penaltyPaid: this._roundCurrency(penaltyUnpaid),
          newStatus: 'paid'
        });
        
        totalBaseChargesPaid = this._roundCurrency(totalBaseChargesPaid + baseUnpaid);
        totalPenaltiesPaid = this._roundCurrency(totalPenaltiesPaid + penaltyUnpaid);
        remainingFunds = this._roundCurrency(remainingFunds - unpaidAmount);
        
        console.log(`✅ Bill ${bill.period} paid in full: $${unpaidAmount}`);
        
      } else if (remainingFunds > 0) {
        // Partial payment - prioritize base charges over penalties
        let amountToApply = remainingFunds;
        let basePortionPaid = 0;
        let penaltyPortionPaid = 0;
        
        if (baseUnpaid > 0) {
          basePortionPaid = Math.min(amountToApply, baseUnpaid);
          amountToApply -= basePortionPaid;
        }
        
        if (amountToApply > 0 && penaltyUnpaid > 0) {
          penaltyPortionPaid = Math.min(amountToApply, penaltyUnpaid);
        }
        
        billPayments.push({
          billId: bill.id,
          billPeriod: bill.period,
          amountPaid: this._roundCurrency(remainingFunds),
          baseChargePaid: this._roundCurrency(basePortionPaid),
          penaltyPaid: this._roundCurrency(penaltyPortionPaid),
          newStatus: 'partial'
        });
        
        totalBaseChargesPaid = this._roundCurrency(totalBaseChargesPaid + basePortionPaid);
        totalPenaltiesPaid = this._roundCurrency(totalPenaltiesPaid + penaltyPortionPaid);
        
        console.log(`🔸 Bill ${bill.period} partial payment: $${remainingFunds} (Base: $${basePortionPaid}, Penalties: $${penaltyPortionPaid})`);
        
        remainingFunds = 0;
      }
    }
    
    // STEP 5: Calculate credit usage vs overpayment (IDENTICAL TO HOA LOGIC)
    const newCreditBalance = this._roundCurrency(remainingFunds);
    const totalUsedForBills = this._roundCurrency(totalAvailableFunds - remainingFunds);
    
    let creditUsed = 0;
    let overpayment = 0;
    
    if (newCreditBalance >= currentCreditBalance) {
      // Overpayment scenario: Payment had extra beyond bills
      overpayment = this._roundCurrency(newCreditBalance - currentCreditBalance);
    } else {
      // Credit was used to help pay bills
      creditUsed = this._roundCurrency(currentCreditBalance - newCreditBalance);
    }
    
    console.log(`💰 Credit calculation: Used $${creditUsed}, Overpaid $${overpayment}, New balance $${newCreditBalance}`);
    
    // STEP 6: Update credit balance via HOA module
    await this._updateCreditBalance(clientId, unitId, currentYear, {
      newBalance: newCreditBalance,
      changeAmount: overpayment > 0 ? overpayment : -creditUsed,
      changeType: overpayment > 0 ? 'water_overpayment' : 'water_credit_used',
      description: this._generateCreditDescription(billPayments, totalBaseChargesPaid, totalPenaltiesPaid),
      transactionId: null // Will be updated after transaction creation
    });
    
    // STEP 7: Create accounting transaction (like HOA)
    // Note: Create transaction first to get the transaction ID for bill updates
    const transactionData = {
      amount: amount,
      type: 'income',
      categoryId: 'water-consumption',
      categoryName: 'Water Consumption',
      vendorId: 'deposit',
      description: this._generateTransactionDescription(billPayments, totalBaseChargesPaid, totalPenaltiesPaid, unitId),
      unitId: unitId,
      accountId: accountId,
      accountType: accountType,
      paymentMethod: paymentMethod,
      reference: reference,
      notes: this._generateTransactionNotes(billPayments, totalBaseChargesPaid, totalPenaltiesPaid, unitId, notes, amount),
      date: paymentDate
    };
    
    const transactionResult = await createTransaction(clientId, transactionData);
    console.log(`💳 Transaction created:`, { transactionId: transactionResult, vendorId: transactionData.vendorId });
    
    // STEP 8: Update water bills with payment info (now with transaction ID)
    await this._updateBillsWithPayments(clientId, unitId, billPayments, paymentMethod, paymentDate, reference, transactionResult, amount);
    
    // STEP 9: Smart cache update - only update affected months instead of full invalidation
    await this._updateAffectedMonthsInCache(clientId, billPayments);
    
    return {
      success: true,
      paymentType: 'bills_and_credit',
      totalFundsAvailable: totalAvailableFunds,
      billsPaid: billPayments,
      newCreditBalance: newCreditBalance,
      creditUsed: creditUsed,
      overpayment: overpayment,
      totalBaseChargesPaid: totalBaseChargesPaid,
      totalPenaltiesPaid: totalPenaltiesPaid,
      transactionId: transactionResult
    };
  }
  
  /**
   * Get credit balance using existing HOA dues controller function (CLEAN SEPARATION)
   */
  async _getCreditBalance(clientId, unitId, year) {
    try {
      // Import and use the existing HOA controller function directly
      const { getUnitDuesData } = await import('../controllers/hoaDuesController.js');
      
      const duesData = await getUnitDuesData(clientId, unitId, year);
      
      if (!duesData) {
        console.log(`No dues data found for unit ${unitId} year ${year} - returning zero credit balance`);
        return { creditBalance: 0, creditBalanceHistory: [] };
      }
      
      console.log(`📊 Credit balance accessed by water_bills: Unit ${unitId}, Year ${year}, Balance: $${duesData.creditBalance || 0}`);
      
      return {
        creditBalance: duesData.creditBalance || 0, // Already in dollars from HOA controller
        creditBalanceHistory: duesData.creditBalanceHistory || []
      };
      
    } catch (error) {
      console.error('Error getting credit balance via HOA controller:', error);
      // Return zero balance if HOA module unavailable (graceful degradation)
      return { creditBalance: 0, creditBalanceHistory: [] };
    }
  }
  
  /**
   * Update credit balance using existing HOA dues controller function (CLEAN SEPARATION)
   */
  async _updateCreditBalance(clientId, unitId, year, updateData) {
    try {
      // Import and use the existing HOA controller function directly
      const { updateCreditBalance } = await import('../controllers/hoaDuesController.js');
      
      const { newBalance, changeAmount, changeType, description, transactionId } = updateData;
      
      console.log(`💰 Updating credit balance via HOA controller: Unit ${unitId}, New balance: $${newBalance}`);
      
      // Use the existing HOA updateCreditBalance function
      const result = await updateCreditBalance(clientId, unitId, year, newBalance);
      
      console.log(`✅ Credit balance updated by water_bills via HOA controller: $${newBalance}`);
      
      return {
        success: true,
        newBalance: newBalance,
        changeAmount: changeAmount
      };
      
    } catch (error) {
      console.error('Error updating credit balance via HOA controller:', error);
      throw new Error('Failed to update credit balance via HOA controller');
    }
  }
  
  /**
   * Get unpaid bills for a unit with DYNAMIC penalty calculation
   * Bills store base amounts + due dates, penalties calculated in real-time
   */
  async _getUnpaidBillsForUnit(clientId, unitId) {
    const bills = [];
    
    // Query all bill documents to find unpaid bills for this unit
    const billsSnapshot = await this.db.collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('bills')
      .orderBy('__name__') // Order by document name (YYYY-MM format - oldest first)
      .get();
    
    // Collect bill metadata (no longer need penalty calculation data)
    const billsMetadata = [];
    
    billsSnapshot.forEach(doc => {
      const billData = doc.data();
      const unitBill = billData.bills?.units?.[unitId];
      
      if (unitBill && unitBill.status !== 'paid') {
        const paidAmount = unitBill.paidAmount || 0;
        const basePaid = unitBill.basePaid || 0;
        
        // Extract base amount from bill structure
        const storedBaseAmount = unitBill.currentCharge || 0;
        const unpaidBaseAmount = storedBaseAmount - basePaid;
        
        if (unpaidBaseAmount > 0) {
          // Use existing waterDataService fiscal-to-calendar conversion
          // Format: YYYY-MM where YYYY is fiscal year and MM is fiscal month (00-11)
          const [fiscalYearStr, fiscalMonthStr] = doc.id.split('-');
          const fiscalYear = parseInt(fiscalYearStr);
          const fiscalMonth = parseInt(fiscalMonthStr);
          
          // Use waterDataService methods for proper fiscal year conversion
          const calendarYear = waterDataService.getCalendarYear(fiscalYear, fiscalMonth);
          
          // Convert fiscal month to calendar month using existing logic
          // Fiscal month 0 (July) = calendar month 7, etc.
          const calendarMonth = fiscalMonth + 7; // July = 7, adjust if > 12
          const actualCalendarMonth = calendarMonth > 12 ? calendarMonth - 12 : calendarMonth;
          
          const dueDate = `${calendarYear}-${String(actualCalendarMonth).padStart(2, '0')}-01`;
          
          console.log(`📅 Bill ${doc.id}: Fiscal FY${fiscalYear}-${fiscalMonthStr} → Calendar ${dueDate} (${waterDataService.getMonthName(fiscalMonth)})`);
          
          // Store metadata for bill construction
          billsMetadata.push({
            id: doc.id,
            period: doc.id,
            originalData: unitBill,
            paidAmount,
            basePaid,
            penaltyPaid: unitBill.penaltyPaid || 0,
            status: unitBill.status
          });
        }
      }
    });
    
    // Use STORED penalty data (from penalty recalculation service)
    // No dynamic calculation needed - penalties are pre-calculated and stored
    for (const metadata of billsMetadata) {
      const unitBill = metadata.originalData;
      
      // Use stored penalty amounts from the bill document
      const storedPenaltyAmount = unitBill.penaltyAmount || 0;
      const storedTotalAmount = unitBill.totalAmount || unitBill.currentCharge || 0;
      const currentCharge = unitBill.currentCharge || 0;
      
      const totalCurrentlyDue = storedTotalAmount - metadata.paidAmount;
      
      if (totalCurrentlyDue > 0) {
        bills.push({
          id: metadata.id,
          period: metadata.period,
          penaltyAmount: storedPenaltyAmount,
          totalAmount: storedTotalAmount,
          paidAmount: metadata.paidAmount,
          basePaid: metadata.basePaid,
          penaltyPaid: metadata.penaltyPaid,
          unpaidAmount: totalCurrentlyDue,
          status: metadata.status,
          monthsOverdue: 0, // Will be calculated during penalty recalc
          daysOverdue: 0,   // Will be calculated during penalty recalc
          dueDate: unitBill.dueDate,
          lastPenaltyUpdate: unitBill.lastPenaltyUpdate || null,
          // Debug info
          _dynamicCalculation: false,
          _usingStoredPenalties: true,
          _originalTotalAmount: unitBill.totalAmount
        });
      }
    }
    
    return bills; // Already sorted oldest first by document name
  }
  
  /**
   * Update water bills with payment information
   */
  async _updateBillsWithPayments(clientId, unitId, billPayments, paymentMethod, paymentDate, reference, transactionResult, paymentAmount) {
    const batch = this.db.batch();
    
    // Determine which month to record the FULL payment amount in
    // Use current fiscal month based on payment date
    const currentDate = new Date(paymentDate);
    const currentFiscalYear = new Date().getFullYear() + 1; // AVII uses FY 2026 for 2025 calendar year
    const currentFiscalMonth = Math.max(0, currentDate.getMonth() - 6); // July = 0, Aug = 1, etc.
    const paymentMonthId = `${currentFiscalYear}-${String(currentFiscalMonth).padStart(2, '0')}`;
    
    console.log(`💳 Recording FULL payment amount $${transactionResult.amount} in month ${paymentMonthId} for display`);
    
    for (const payment of billPayments) {
      const billRef = this.db.collection('clients').doc(clientId)
        .collection('projects').doc('waterBills')
        .collection('bills').doc(payment.billId);
      
      // Get current bill data to calculate new totals
      const billDoc = await billRef.get();
      const currentBill = billDoc.data()?.bills?.units?.[unitId];
      
      if (!currentBill) {
        console.error(`Bill not found for unit ${unitId} in period ${payment.billId}`);
        continue;
      }
      
      // Calculate new payment totals for allocation tracking
      const newBasePaid = (currentBill.basePaid || 0) + payment.baseChargePaid;
      const newPenaltyPaid = (currentBill.penaltyPaid || 0) + payment.penaltyPaid;
      
      // For paidAmount display: Show FULL payment in the payment month, allocated amounts in other months
      const isPaymentMonth = payment.billId === paymentMonthId;
      const displayPaidAmount = isPaymentMonth ? paymentAmount : payment.amountPaid;
      const newPaidAmount = (currentBill.paidAmount || 0) + displayPaidAmount;
      
      console.log(`💰 Bill ${payment.billId}: isPaymentMonth=${isPaymentMonth}, displayAmount=$${displayPaidAmount}`);
      
      batch.update(billRef, {
        [`bills.units.${unitId}.paidAmount`]: newPaidAmount,
        [`bills.units.${unitId}.basePaid`]: newBasePaid,
        [`bills.units.${unitId}.penaltyPaid`]: newPenaltyPaid,
        [`bills.units.${unitId}.status`]: payment.newStatus,
        [`bills.units.${unitId}.lastPayment`]: {
          amount: displayPaidAmount, // Full amount in payment month, allocated in others
          baseChargePaid: payment.baseChargePaid,
          penaltyPaid: payment.penaltyPaid,
          paymentDate: paymentDate,
          paymentMethod: paymentMethod,
          reference: reference,
          transactionId: transactionResult || null,
          recordedAt: new Date().toISOString()
        }
      });
    }
    
    await batch.commit();
  }
  
  /**
   * Generate transaction description for payment (simple description)
   */
  _generateTransactionDescription(billPayments, totalBaseCharges, totalPenalties, unitId) {
    if (billPayments.length === 0) {
      return `Water bill credit - Unit ${unitId}`;
    }
    
    return `Water bill payment - Unit ${unitId}`;
  }

  /**
   * Generate detailed transaction notes following HOA pattern
   * Format: "Water bill payment for Unit [X] - [Month Year] - [User Notes] - $[Amount] [breakdown]"
   */
  _generateTransactionNotes(billPayments, totalBaseCharges, totalPenalties, unitId, userNotes = '', totalAmount) {
    if (billPayments.length === 0) {
      const notesText = userNotes ? ` - ${userNotes}` : '';
      return `Water bill payment for Unit ${unitId} - No bills due${notesText} - $${totalAmount.toFixed(2)} credit`;
    }
    
    // Convert periods to readable dates
    const readablePeriods = billPayments.map(p => this._convertPeriodToReadableDate(p.billPeriod));
    const periodsText = readablePeriods.join(', ');
    
    // Build breakdown text
    let breakdown = '';
    if (totalBaseCharges > 0 && totalPenalties > 0) {
      breakdown = `$${totalBaseCharges.toFixed(2)} charges + $${totalPenalties.toFixed(2)} penalties`;
    } else if (totalBaseCharges > 0) {
      breakdown = `$${totalBaseCharges.toFixed(2)} charges`;
    } else if (totalPenalties > 0) {
      breakdown = `$${totalPenalties.toFixed(2)} penalties`;
    }
    
    // Format: "Water bill payment for Unit 203 - Jul 2025, Aug 2025 - Test payment - $4400 charges + $600 penalties"
    const userNotesText = userNotes ? ` - ${userNotes}` : '';
    return `Water bill payment for Unit ${unitId} - ${periodsText}${userNotesText} - ${breakdown}`;
  }
  
  /**
   * Convert period format (2026-00) to readable date (Jul 2025)
   */
  _convertPeriodToReadableDate(period) {
    const [fiscalYearStr, fiscalMonthStr] = period.split('-');
    const fiscalYear = parseInt(fiscalYearStr);
    const fiscalMonth = parseInt(fiscalMonthStr);
    
    // Use waterDataService methods for consistent conversion
    const monthName = waterDataService.getMonthName(fiscalMonth);
    const calendarYear = waterDataService.getCalendarYear(fiscalYear, fiscalMonth);
    
    return `${monthName} ${calendarYear}`;
  }
  
  /**
   * Generate credit balance change description
   */
  _generateCreditDescription(billPayments, totalBaseCharges, totalPenalties) {
    if (billPayments.length === 0) {
      return 'Water bill overpayment - no bills due';
    }
    
    const billPeriods = billPayments.map(p => p.billPeriod).join(', ');
    return `Water bills paid: ${billPeriods} (Base: $${totalBaseCharges.toFixed(2)}, Penalties: $${totalPenalties.toFixed(2)})`;
  }
  
  /**
   * Get payment history for a unit from bill records
   */
  async getPaymentHistory(clientId, unitId, year = null) {
    await this._initializeDb();
    
    const payments = [];
    let query = this.db.collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('bills');
    
    if (year) {
      // Filter by year prefix in document name
      query = query.where('__name__', '>=', `${year}-01`)
                   .where('__name__', '<=', `${year}-12`);
    }
    
    const snapshot = await query.orderBy('__name__', 'desc').get();
    
    snapshot.forEach(doc => {
      const billData = doc.data();
      const unitBill = billData.bills?.units?.[unitId];
      
      if (unitBill?.lastPayment) {
        payments.push({
          id: doc.id,
          period: doc.id,
          ...unitBill.lastPayment
        });
      }
    });
    
    return payments;
  }
  
  /**
   * Get unpaid bills summary for payment modal (PUBLIC METHOD)
   */
  async getUnpaidBillsSummary(clientId, unitId) {
    await this._initializeDb();
    
    try {
      console.log(`🔍 Getting unpaid bills summary for client ${clientId}, unit ${unitId}`);
      
      const unpaidBills = await this._getUnpaidBillsForUnit(clientId, unitId);
      console.log(`📋 Found ${unpaidBills?.length || 0} unpaid bills`);
      
      // Also get current credit balance
      const currentYear = new Date().getFullYear();
      console.log(`💰 Getting credit balance for year ${currentYear}`);
      const creditData = await this._getCreditBalance(clientId, unitId, currentYear);
      console.log(`💰 Credit balance: $${creditData?.creditBalance || 0}`);
      
      const result = {
        unpaidBills: unpaidBills || [],
        currentCreditBalance: creditData?.creditBalance || 0,
        creditHistory: creditData?.creditBalanceHistory || []
      };
      
      console.log(`✅ Returning summary:`, {
        unpaidBillsCount: result.unpaidBills.length,
        creditBalance: result.currentCreditBalance,
        creditHistoryCount: result.creditHistory.length
      });
      
      return result;
      
    } catch (error) {
      console.error('Error in getUnpaidBillsSummary:', error);
      
      // Return safe defaults instead of throwing
      return {
        unpaidBills: [],
        currentCreditBalance: 0,
        creditHistory: [],
        error: error.message
      };
    }
  }

  /**
   * Smart cache update - only refresh affected months instead of full cache invalidation
   */
  async _updateAffectedMonthsInCache(clientId, billPayments) {
    if (!billPayments || billPayments.length === 0) {
      console.log(`⏭️ No bill payments to update cache for`);
      return;
    }

    // Extract unique year/month combinations from billPayments
    const affectedMonths = new Set();
    for (const payment of billPayments) {
      // payment.billId format is "YYYY-MM" 
      const [yearStr, monthStr] = payment.billId.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      affectedMonths.add(`${year}-${month}`);
    }

    console.log(`🔄 Smart cache update for ${affectedMonths.size} affected months:`, Array.from(affectedMonths));

    // Update each affected month in cache
    for (const monthKey of affectedMonths) {
      const [year, month] = monthKey.split('-').map(Number);
      try {
        await waterDataService.updateMonthInCache(clientId, year, month);
        console.log(`✅ Updated cache for ${clientId} FY${year} month ${month}`);
      } catch (error) {
        console.error(`❌ Failed to update cache for ${clientId} FY${year} month ${month}:`, error);
        // Fallback to full cache clear if individual month update fails
        console.log(`🔄 Falling back to full cache invalidation for ${clientId}`);
        waterDataService.clearCache(clientId);
        break;
      }
    }
  }
}

export const waterPaymentsService = new WaterPaymentsService();