// Credit Balance Service
// Provides clean API for credit balance operations across modules
// CURRENT: Points to HOA Dues storage location
// FUTURE: Will point to new storage location when migrated

import { getDb } from '../firebase.js';
import { getNow } from './DateService.js';
import { getFiscalYear } from '../utils/fiscalYearUtils.js';
import admin from 'firebase-admin';

class CreditService {
  
  /**
   * Get current fiscal year for credit balance operations
   * @private
   */
  _getCurrentFiscalYear() {
    // AVII uses July start (month 7)
    // TODO: This should come from client configuration
    return getFiscalYear(getNow(), 7);
  }

  /**
   * Get current credit balance for a unit
   * CURRENT: Reads from HOA Dues location
   * FUTURE: Will read from new storage location
   * 
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier
   * @returns {Promise<Object>} Credit balance data
   */
  async getCreditBalance(clientId, unitId) {
    try {
      const db = await getDb();
      const fiscalYear = this._getCurrentFiscalYear();
      
      // CURRENT IMPLEMENTATION: Read from HOA Dues
      const duesRef = db.collection('clients').doc(clientId)
        .collection('units').doc(unitId)
        .collection('dues').doc(fiscalYear.toString());
      
      const doc = await duesRef.get();
      
      if (!doc.exists) {
        return {
          clientId,
          unitId,
          creditBalance: 0,
          creditBalanceDisplay: '$0.00',
          lastUpdated: null
        };
      }
      
      const data = doc.data();
      const creditBalanceInCents = data.creditBalance || 0;
      const creditBalanceInDollars = creditBalanceInCents / 100;
      
      return {
        clientId,
        unitId,
        creditBalance: creditBalanceInDollars, // Return in dollars for API consumers
        creditBalanceDisplay: this._formatCurrency(creditBalanceInCents),
        lastUpdated: data.updated ? data.updated.toDate().toISOString() : null
      };
    } catch (error) {
      console.error(`Error getting credit balance for ${clientId}/${unitId}:`, error);
      throw error;
    }
  }

  /**
   * Update credit balance (add or subtract)
   * CURRENT: Updates HOA Dues location
   * FUTURE: Will update new storage location
   * 
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier
   * @param {number} amount - Amount to add (positive) or subtract (negative) in cents
   * @param {string} transactionId - Transaction identifier for audit trail
   * @param {string} note - Description of the change
   * @param {string} source - Source module (e.g., 'waterBills', 'hoaDues', 'admin')
   * @returns {Promise<Object>} Update result
   */
  async updateCreditBalance(clientId, unitId, amount, transactionId, note, source) {
    try {
      const db = await getDb();
      const fiscalYear = this._getCurrentFiscalYear();
      
      // CURRENT IMPLEMENTATION: Update HOA Dues
      const duesRef = db.collection('clients').doc(clientId)
        .collection('units').doc(unitId)
        .collection('dues').doc(fiscalYear.toString());
      
      const doc = await duesRef.get();
      let currentBalance = 0;
      let creditHistory = [];
      
      if (doc.exists) {
        const data = doc.data();
        currentBalance = data.creditBalance || 0;
        creditHistory = data.creditBalanceHistory || [];
      }
      
      const newBalance = currentBalance + amount;
      
      // Validation: Credit balance cannot be negative (optional - check config)
      if (newBalance < 0) {
        throw new Error(`Insufficient credit balance. Current: ${this._formatCurrency(currentBalance)}, Requested: ${this._formatCurrency(amount)}`);
      }
      
      // Add history entry
      const historyEntry = {
        id: this._generateId(),
        timestamp: admin.firestore.Timestamp.now(),
        amount,
        balance: newBalance,
        transactionId,
        note,
        source
      };
      
      creditHistory.push(historyEntry);
      
      // Update Firestore
      await duesRef.set({
        creditBalance: newBalance,
        creditBalanceHistory: creditHistory,
        updated: admin.firestore.Timestamp.now()
      }, { merge: true });
      
      console.log(`✅ [CREDIT] Updated credit balance for ${clientId}/${unitId}: ${currentBalance} → ${newBalance}`);
      
      return {
        success: true,
        clientId,
        unitId,
        previousBalance: currentBalance,
        newBalance,
        amountChange: amount,
        transactionId
      };
    } catch (error) {
      console.error(`Error updating credit balance for ${clientId}/${unitId}:`, error);
      throw error;
    }
  }

  /**
   * Get credit history
   * CURRENT: Reads from HOA Dues location
   * FUTURE: Will read from new storage location
   * 
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier
   * @param {number} limit - Maximum number of history entries to return (default 50)
   * @returns {Promise<Object>} Credit history data
   */
  async getCreditHistory(clientId, unitId, limit = 50) {
    try {
      const db = await getDb();
      const fiscalYear = this._getCurrentFiscalYear();
      
      // CURRENT IMPLEMENTATION: Read from HOA Dues
      const duesRef = db.collection('clients').doc(clientId)
        .collection('units').doc(unitId)
        .collection('dues').doc(fiscalYear.toString());
      
      const doc = await duesRef.get();
      
      if (!doc.exists) {
        return {
          clientId,
          unitId,
          currentBalance: 0,
          history: []
        };
      }
      
      const data = doc.data();
      const creditBalanceInCents = data.creditBalance || 0;
      const creditBalanceInDollars = creditBalanceInCents / 100;
      const creditHistory = data.creditBalanceHistory || [];
      
      // Sort by timestamp (most recent first)
      const sortedHistory = creditHistory
        .sort((a, b) => {
          const aTime = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
          const bTime = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
          return bTime - aTime;
        })
        .slice(0, limit);
      
      return {
        clientId,
        unitId,
        currentBalance: creditBalanceInDollars, // Return in dollars
        history: sortedHistory.map(entry => ({
          id: entry.id,
          date: entry.timestamp?.toDate ? entry.timestamp.toDate().toISOString() : null,
          amount: entry.amount / 100, // Convert to dollars
          balance: entry.balance / 100, // Convert to dollars
          transactionId: entry.transactionId,
          note: entry.note,
          source: entry.source
        }))
      };
    } catch (error) {
      console.error(`Error getting credit history for ${clientId}/${unitId}:`, error);
      throw error;
    }
  }

  /**
   * Add credit history entry (for historical records or corrections)
   * CURRENT: Updates HOA Dues location
   * FUTURE: Will update new storage location
   * 
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier
   * @param {number} amount - Amount to add (positive) or subtract (negative) in cents
   * @param {string} date - ISO date string for the entry
   * @param {string} transactionId - Transaction identifier
   * @param {string} note - Description of the entry
   * @param {string} source - Source module
   * @returns {Promise<Object>} Operation result
   */
  async addCreditHistoryEntry(clientId, unitId, amount, date, transactionId, note, source) {
    try {
      const db = await getDb();
      const fiscalYear = this._getCurrentFiscalYear();
      
      // CURRENT IMPLEMENTATION: Update HOA Dues
      const duesRef = db.collection('clients').doc(clientId)
        .collection('units').doc(unitId)
        .collection('dues').doc(fiscalYear.toString());
      
      const doc = await duesRef.get();
      let currentBalance = 0;
      let creditHistory = [];
      
      if (doc.exists) {
        const data = doc.data();
        currentBalance = data.creditBalance || 0;
        creditHistory = data.creditBalanceHistory || [];
      }
      
      const newBalance = currentBalance + amount;
      
      // Add history entry
      const historyEntry = {
        id: this._generateId(),
        timestamp: admin.firestore.Timestamp.fromDate(new Date(date)),
        amount,
        balance: newBalance,
        transactionId,
        note,
        source
      };
      
      creditHistory.push(historyEntry);
      
      // Update Firestore
      await duesRef.set({
        creditBalance: newBalance,
        creditBalanceHistory: creditHistory,
        updated: admin.firestore.Timestamp.now()
      }, { merge: true });
      
      console.log(`✅ [CREDIT] Added history entry for ${clientId}/${unitId}: ${currentBalance} → ${newBalance}`);
      
      return {
        success: true,
        entryAdded: true,
        newBalance
      };
    } catch (error) {
      console.error(`Error adding credit history entry for ${clientId}/${unitId}:`, error);
      throw error;
    }
  }

  /**
   * Helper: Format currency from cents to display string
   * @private
   */
  _formatCurrency(cents) {
    const dollars = cents / 100;
    return `$${dollars.toFixed(2)}`;
  }

  /**
   * Helper: Generate unique ID for history entries
   * @private
   */
  _generateId() {
    return `credit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Create and export singleton instance
const creditService = new CreditService();
export default creditService;

