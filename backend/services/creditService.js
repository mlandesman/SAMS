// Credit Balance Service
// Provides clean API for credit balance operations across modules
// NEW STRUCTURE: /clients/{clientId}/units/creditBalances (migrated)

import { getDb } from '../firebase.js';
import { getNow } from './DateService.js';
import { getFiscalYear } from '../utils/fiscalYearUtils.js';
import { formatCurrency } from '../utils/currencyUtils.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { validateCentavos } from '../utils/centavosValidation.js';
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
   * NEW IMPLEMENTATION: Reads from simplified storage location
   * 
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier
   * @returns {Promise<Object>} Credit balance data
   */
  async getCreditBalance(clientId, unitId) {
    try {
      const db = await getDb();
      
      // NEW IMPLEMENTATION: Read from simplified structure
      const creditBalancesRef = db.collection('clients').doc(clientId)
        .collection('units').doc('creditBalances');
      
      const doc = await creditBalancesRef.get();
      
      if (!doc.exists || !doc.data()[unitId]) {
        return {
          clientId,
          unitId,
          creditBalance: 0,
          creditBalanceDisplay: '$0.00',
          lastUpdated: null
        };
      }
      
      const unitData = doc.data()[unitId];
      const creditBalanceInCents = unitData.creditBalance || 0;
      const creditBalanceInDollars = creditBalanceInCents / 100;
      
      return {
        clientId,
        unitId,
        creditBalance: creditBalanceInDollars, // Return in dollars for API consumers
        creditBalanceDisplay: formatCurrency(creditBalanceInCents, 'MXN', true),
        lastUpdated: unitData.lastChange?.timestamp || null
      };
    } catch (error) {
      console.error(`Error getting credit balance for ${clientId}/${unitId}:`, error);
      throw error;
    }
  }

  /**
   * Update credit balance (add or subtract)
   * NEW IMPLEMENTATION: Updates simplified storage location
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
      
      // NEW IMPLEMENTATION: Update simplified structure
      const creditBalancesRef = db.collection('clients').doc(clientId)
        .collection('units').doc('creditBalances');
      
      const doc = await creditBalancesRef.get();
      const allData = doc.exists ? doc.data() : {};
      const unitData = allData[unitId] || { creditBalance: 0, history: [] };
      
      // CRITICAL: Validate all centavos values are integers before calculation
      const currentBalance = validateCentavos(unitData.creditBalance || 0, 'currentBalance');
      const validAmount = validateCentavos(amount, 'amount');
      const newBalance = validateCentavos(currentBalance + validAmount, 'newBalance');
      
      // Validation: Credit balance cannot be negative (optional - check config)
      if (newBalance < 0) {
        throw new Error(`Insufficient credit balance. Current: ${formatCurrency(currentBalance, 'MXN', true)}, Requested: ${formatCurrency(validAmount, 'MXN', true)}`);
      }
      
      // Add history entry with proper date serialization (FIX: [object Object] bug)
      const now = getNow();
      const historyEntry = {
        id: this._generateId(),
        timestamp: now.toISOString(), // FIX: Use toISOString() instead of Timestamp object
        amount: validAmount, // Use validated amount
        balance: newBalance, // Already validated above
        transactionId,
        note,
        source
      };
      
      // Initialize or update history array
      const history = unitData.history || [];
      history.push(historyEntry);
      
      // Update unit data
      allData[unitId] = {
        creditBalance: newBalance,
        lastChange: {
          year: fiscalYear.toString(),
          historyIndex: history.length - 1,
          timestamp: now.toISOString()
        },
        history: history
      };
      
      // Write back to Firestore
      await creditBalancesRef.set(allData);
      
      console.log(`✅ [CREDIT] Updated credit balance for ${clientId}/${unitId}: ${currentBalance} → ${newBalance} centavos (${currentBalance / 100} → ${newBalance / 100} pesos)`);
      
      // Write audit log
      await writeAuditLog({
        module: 'credit',
        action: 'update_balance',
        parentPath: `clients/${clientId}/units`,
        docId: 'creditBalances',
        friendlyName: `Unit ${unitId} Credit Balance`,
        notes: `${note} | Amount: ${formatCurrency(amount, 'MXN', true)} | New Balance: ${formatCurrency(newBalance, 'MXN', true)} | Source: ${source} | Transaction: ${transactionId}`
      });
      
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
   * NEW IMPLEMENTATION: Reads from simplified storage location
   * 
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier
   * @param {number} limit - Maximum number of history entries to return (default 50)
   * @returns {Promise<Object>} Credit history data
   */
  async getCreditHistory(clientId, unitId, limit = 50) {
    try {
      const db = await getDb();
      
      // NEW IMPLEMENTATION: Read from simplified structure
      const creditBalancesRef = db.collection('clients').doc(clientId)
        .collection('units').doc('creditBalances');
      
      const doc = await creditBalancesRef.get();
      
      if (!doc.exists || !doc.data()[unitId]) {
        return {
          clientId,
          unitId,
          currentBalance: 0,
          history: []
        };
      }
      
      const unitData = doc.data()[unitId];
      const creditBalanceInCents = unitData.creditBalance || 0;
      const creditBalanceInDollars = creditBalanceInCents / 100;
      const creditHistory = unitData.history || [];
      
      // Sort by timestamp (most recent first) - timestamps are now ISO strings
      const sortedHistory = creditHistory
        .sort((a, b) => {
          const aTime = new Date(a.timestamp).getTime();
          const bTime = new Date(b.timestamp).getTime();
          return bTime - aTime;
        })
        .slice(0, limit);
      
      return {
        clientId,
        unitId,
        currentBalance: creditBalanceInDollars, // Return in dollars
        history: sortedHistory.map(entry => ({
          id: entry.id,
          date: entry.timestamp, // Already ISO string - no conversion needed
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
   * NEW IMPLEMENTATION: Updates simplified storage location
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
      
      // Validate date format
      const dateMillis = Date.parse(date);
      if (isNaN(dateMillis)) {
        throw new Error(`Invalid date format: ${date}`);
      }
      
      // NEW IMPLEMENTATION: Update simplified structure
      const creditBalancesRef = db.collection('clients').doc(clientId)
        .collection('units').doc('creditBalances');
      
      const doc = await creditBalancesRef.get();
      const allData = doc.exists ? doc.data() : {};
      const unitData = allData[unitId] || { creditBalance: 0, history: [] };
      
      const currentBalance = unitData.creditBalance || 0;
      const newBalance = currentBalance + amount;
      
      // Add history entry with proper date serialization
      const historyEntry = {
        id: this._generateId(),
        timestamp: new Date(dateMillis).toISOString(), // Use provided date
        amount,
        balance: newBalance,
        transactionId,
        note,
        source
      };
      
      // Initialize or update history array
      const history = unitData.history || [];
      history.push(historyEntry);
      
      // Update unit data
      allData[unitId] = {
        creditBalance: newBalance,
        lastChange: {
          year: fiscalYear.toString(),
          historyIndex: history.length - 1,
          timestamp: getNow().toISOString()
        },
        history: history
      };
      
      // Write back to Firestore
      await creditBalancesRef.set(allData);
      
      console.log(`✅ [CREDIT] Added history entry for ${clientId}/${unitId}: ${currentBalance} → ${newBalance} centavos (${currentBalance / 100} → ${newBalance / 100} pesos)`);
      
      // Write audit log
      await writeAuditLog({
        module: 'credit',
        action: 'add_history',
        parentPath: `clients/${clientId}/units`,
        docId: 'creditBalances',
        friendlyName: `Unit ${unitId} Credit Balance History`,
        notes: `${note} | Amount: ${formatCurrency(amount, 'MXN', true)} | Date: ${date} | Transaction: ${transactionId} | Source: ${source}`
      });
      
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
   * Delete credit history entry by transaction ID
   * FIX: Implements proper delete reversal logic (delete entry instead of adding reversal)
   * 
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier
   * @param {string} transactionId - Transaction identifier to delete
   * @returns {Promise<Object>} Operation result
   */
  async deleteCreditHistoryEntry(clientId, unitId, transactionId) {
    try {
      const db = await getDb();
      const fiscalYear = this._getCurrentFiscalYear();
      
      // Read current data
      const creditBalancesRef = db.collection('clients').doc(clientId)
        .collection('units').doc('creditBalances');
      
      const doc = await creditBalancesRef.get();
      if (!doc.exists || !doc.data()[unitId]) {
        console.log(`⚠️ [CREDIT] No credit data found for ${clientId}/${unitId}`);
        return {
          success: true,
          entriesDeleted: 0,
          newBalance: 0
        };
      }
      
      const allData = doc.data();
      const unitData = allData[unitId];
      const history = unitData.history || [];
      
      // Find and remove entries with matching transaction ID
      const entriesToDelete = history.filter(entry => entry.transactionId === transactionId);
      const entriesDeleted = entriesToDelete.length;
      
      if (entriesDeleted === 0) {
        console.log(`ℹ️ [CREDIT] No history entries found for transaction ${transactionId}`);
        return {
          success: true,
          entriesDeleted: 0,
          newBalance: unitData.creditBalance
        };
      }
      
      // Remove entries
      const newHistory = history.filter(entry => entry.transactionId !== transactionId);
      
      // Recalculate balance by replaying history
      let recalculatedBalance = 0;
      newHistory.forEach(entry => {
        // Ensure balance is a valid number
        if (typeof entry.balance === 'number' && !isNaN(entry.balance)) {
          recalculatedBalance = entry.balance;
        }
      });
      
      // If no history left, balance should be 0
      if (newHistory.length === 0) {
        recalculatedBalance = 0;
      }
      
      // CRITICAL FIX: Ensure recalculatedBalance is never undefined
      if (typeof recalculatedBalance !== 'number' || isNaN(recalculatedBalance)) {
        console.warn(`⚠️ [CREDIT] Invalid balance calculated: ${recalculatedBalance}, defaulting to 0`);
        recalculatedBalance = 0;
      }
      
      console.log(`🗑️ [CREDIT] Deleting ${entriesDeleted} history entries for transaction ${transactionId}`);
      console.log(`💰 [CREDIT] Balance: ${unitData.creditBalance} → ${recalculatedBalance} centavos`);
      
      // Update unit data with validation
      allData[unitId] = {
        creditBalance: recalculatedBalance, // Already validated above
        lastChange: {
          year: fiscalYear.toString(),
          historyIndex: Math.max(0, newHistory.length - 1), // Ensure non-negative
          timestamp: getNow().toISOString()
        },
        history: newHistory
      };
      
      // CRITICAL FIX: Validate all data before writing to Firestore
      if (typeof allData[unitId].creditBalance !== 'number' || isNaN(allData[unitId].creditBalance)) {
        throw new Error(`Invalid creditBalance: ${allData[unitId].creditBalance}`);
      }
      
      // Write back to Firestore
      await creditBalancesRef.set(allData);
      
      console.log(`✅ [CREDIT] Deleted credit history entries for ${clientId}/${unitId}, transaction ${transactionId}`);
      
      // Write audit log
      await writeAuditLog({
        module: 'credit',
        action: 'delete_history',
        parentPath: `clients/${clientId}/units`,
        docId: 'creditBalances',
        friendlyName: `Unit ${unitId} Credit Balance History`,
        notes: `Deleted ${entriesDeleted} history entries for transaction ${transactionId} | Balance: ${unitData.creditBalance} → ${recalculatedBalance} centavos`
      });
      
      return {
        success: true,
        entriesDeleted,
        newBalance: recalculatedBalance,
        previousBalance: unitData.creditBalance
      };
    } catch (error) {
      console.error(`Error deleting credit history entry for ${clientId}/${unitId}:`, error);
      throw error;
    }
  }

  /**
   * Helper: Generate unique ID for history entries
   * @private
   */
  _generateId() {
    const now = getNow();
    const timestamp = now.getTime();
    return `credit_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Create and export singleton instance
const creditService = new CreditService();
export default creditService;

