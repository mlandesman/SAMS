// Credit Balance Service
// Provides clean API for credit balance operations across modules
// NEW STRUCTURE: /clients/{clientId}/units/creditBalances (migrated)

import { getDb } from '../firebase.js';
import { getNow } from './DateService.js';
import { getFiscalYear } from '../utils/fiscalYearUtils.js';
import { formatCurrency } from '../utils/currencyUtils.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { validateCentavos } from '../utils/centavosValidation.js';
import { getCreditBalance, createCreditHistoryEntry } from '../../shared/utils/creditBalanceUtils.js';
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
      
      if (!doc.exists) {
        return {
          clientId,
          unitId,
          creditBalance: 0,
          creditBalanceDisplay: '$0.00',
          lastUpdated: null
        };
      }
      
      const docData = doc.data();
      
      if (!docData[unitId]) {
        return {
          clientId,
          unitId,
          creditBalance: 0,
          creditBalanceDisplay: '$0.00',
          lastUpdated: null
        };
      }
      
      const unitData = docData[unitId];
      // Use getter to calculate balance from history (always fresh)
      const creditBalanceInCents = getCreditBalance(unitData);
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
   * @param {string} notes - Description of the change (use 'notes' plural for consistency)
   * @param {string} source - Source module (e.g., 'waterBills', 'hoaDues', 'admin')
   * @returns {Promise<Object>} Update result
   */
  async updateCreditBalance(clientId, unitId, amount, transactionId, notes, source) {
    try {
      const db = await getDb();
      const fiscalYear = this._getCurrentFiscalYear();
      
      // NEW IMPLEMENTATION: Update simplified structure
      const creditBalancesRef = db.collection('clients').doc(clientId)
        .collection('units').doc('creditBalances');
      
      const doc = await creditBalancesRef.get();
      const allData = doc.exists ? doc.data() : {};
      const unitData = allData[unitId] || { history: [] };
      
      // Calculate current balance using getter (always fresh)
      const currentBalance = getCreditBalance(unitData);
      
      // CRITICAL: Validate all centavos values are integers before calculation
      const validAmount = validateCentavos(amount, 'amount');
      const newBalance = validateCentavos(currentBalance + validAmount, 'newBalance');
      
      // Validation: Credit balance cannot be negative (optional - check config)
      if (newBalance < 0) {
        throw new Error(`Insufficient credit balance. Current: ${formatCurrency(currentBalance, 'MXN', true)}, Requested: ${formatCurrency(validAmount, 'MXN', true)}`);
      }
      
      // Create clean history entry (no stale balance fields)
      const historyEntry = createCreditHistoryEntry({
        amount: validAmount,
        transactionId,
        notes,
        type: validAmount > 0 ? 'credit_added' : 'credit_used',
        source
      });
      
      // Initialize or update history array
      const history = unitData.history || [];
      history.push(historyEntry);
      
      // Update unit data
      // DO NOT write creditBalance field - it becomes stale
      const now = getNow();
      allData[unitId] = {
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
        notes: `${notes} | Amount: ${formatCurrency(amount, 'MXN', true)} | New Balance: ${formatCurrency(newBalance, 'MXN', true)} | Source: ${source} | Transaction: ${transactionId}`
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
      // Use getter to calculate balance from history (always fresh)
      const creditBalanceInCents = getCreditBalance(unitData);
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
   * Sorts history array chronologically after adding entry
   * 
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier
   * @param {number} amount - Amount to add (positive) or subtract (negative) in cents
   * @param {string} date - ISO date string for the entry
   * @param {string} transactionId - Transaction identifier (can be null for admin entries)
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
      
      // Validate amount is integer (centavos)
      const validAmount = validateCentavos(amount, 'amount');
      
      // NEW IMPLEMENTATION: Update simplified structure
      const creditBalancesRef = db.collection('clients').doc(clientId)
        .collection('units').doc('creditBalances');
      
      const doc = await creditBalancesRef.get();
      const allData = doc.exists ? doc.data() : {};
      const unitData = allData[unitId] || { history: [] };
      
      // Calculate current balance using getter (always fresh)
      const currentBalance = getCreditBalance(unitData);
      
      // Create clean history entry (no stale balance fields)
      const historyEntry = createCreditHistoryEntry({
        amount: validAmount,
        transactionId: transactionId || null,
        notes: note,
        type: validAmount > 0 ? 'credit_added' : 'credit_used',
        timestamp: new Date(dateMillis).toISOString(), // Use provided date
        source: source || 'admin'
      });
      
      // Initialize or update history array
      const history = unitData.history || [];
      history.push(historyEntry);
      
      // CRITICAL: Sort history array chronologically by timestamp (oldest first)
      history.sort((a, b) => {
        const dateA = new Date(a.timestamp || 0).getTime();
        const dateB = new Date(b.timestamp || 0).getTime();
        return dateA - dateB; // Oldest first
      });
      
      // Update unit data
      // DO NOT write creditBalance field - it becomes stale
      allData[unitId] = {
        lastChange: {
          year: fiscalYear.toString(),
          historyIndex: history.length - 1,
          timestamp: getNow().toISOString()
        },
        history: history
      };
      
      // Write back to Firestore
      await creditBalancesRef.set(allData);
      
      // Recalculate balance after sorting
      const newBalance = getCreditBalance({ history });
      
      console.log(`✅ [CREDIT] Added history entry for ${clientId}/${unitId}: ${currentBalance} → ${newBalance} centavos (${currentBalance / 100} → ${newBalance / 100} pesos)`);
      
      // Write audit log
      await writeAuditLog({
        module: 'credit',
        action: 'add_history',
        parentPath: `clients/${clientId}/units`,
        docId: 'creditBalances',
        friendlyName: `Unit ${unitId} Credit Balance History`,
        notes: `${note} | Amount: ${formatCurrency(validAmount, 'MXN', true)} | Date: ${date} | Transaction: ${transactionId || 'N/A'} | Source: ${source}`
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
        const currentBalance = getCreditBalance(unitData);
        console.log(`ℹ️ [CREDIT] No history entries found for transaction ${transactionId}`);
        return {
          success: true,
          entriesDeleted: 0,
          newBalance: currentBalance
        };
      }
      
      // Simply remove the history entry for this transaction
      const newHistory = history.filter(entry => entry.transactionId !== transactionId);
      
      // Calculate new balance using getter (always correct)
      const newBalance = getCreditBalance({ history: newHistory });
      const currentBalance = getCreditBalance(unitData);
      
      console.log(`🗑️ [CREDIT] Deleting ${entriesDeleted} history entries for transaction ${transactionId}`);
      console.log(`💰 [CREDIT] Balance: ${currentBalance} → ${newBalance} centavos`);
      
      // Update unit data
      // DO NOT write creditBalance field - it becomes stale
      allData[unitId] = {
        lastChange: {
          year: fiscalYear.toString(),
          historyIndex: Math.max(0, newHistory.length - 1), // Ensure non-negative
          timestamp: getNow().toISOString()
        },
        history: newHistory
      };
      
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
        notes: `Deleted ${entriesDeleted} history entries for transaction ${transactionId} | Balance: ${currentBalance} → ${newBalance} centavos`
      });
      
      return {
        success: true,
        entriesDeleted,
        newBalance,
        previousBalance: currentBalance
      };
    } catch (error) {
      console.error(`Error deleting credit history entry for ${clientId}/${unitId}:`, error);
      throw error;
    }
  }

  /**
   * Delete credit history entry by entry ID
   * Used for admin deletion of individual history entries
   * 
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier
   * @param {string} entryId - Entry ID to delete
   * @returns {Promise<Object>} Operation result
   */
  async deleteCreditHistoryEntryById(clientId, unitId, entryId) {
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
          success: false,
          error: 'No credit data found',
          entriesDeleted: 0,
          newBalance: 0
        };
      }
      
      const allData = doc.data();
      const unitData = allData[unitId];
      const history = unitData.history || [];
      
      // Find entry by ID
      const entryToDelete = history.find(entry => entry.id === entryId);
      if (!entryToDelete) {
        const currentBalance = getCreditBalance(unitData);
        console.log(`ℹ️ [CREDIT] No history entry found with ID ${entryId}`);
        return {
          success: false,
          error: 'Entry not found',
          entriesDeleted: 0,
          newBalance: currentBalance
        };
      }
      
      // Remove the entry
      const newHistory = history.filter(entry => entry.id !== entryId);
      
      // Calculate new balance using getter (always correct)
      const newBalance = getCreditBalance({ history: newHistory });
      const currentBalance = getCreditBalance(unitData);
      
      console.log(`🗑️ [CREDIT] Deleting history entry ${entryId} for ${clientId}/${unitId}`);
      console.log(`💰 [CREDIT] Balance: ${currentBalance} → ${newBalance} centavos (${currentBalance / 100} → ${newBalance / 100} pesos)`);
      
      // Update unit data
      allData[unitId] = {
        lastChange: {
          year: fiscalYear.toString(),
          historyIndex: Math.max(0, newHistory.length - 1),
          timestamp: getNow().toISOString()
        },
        history: newHistory
      };
      
      // Write back to Firestore
      await creditBalancesRef.set(allData);
      
      console.log(`✅ [CREDIT] Deleted credit history entry ${entryId} for ${clientId}/${unitId}`);
      
      // Write audit log
      await writeAuditLog({
        module: 'credit',
        action: 'delete_history_entry',
        parentPath: `clients/${clientId}/units`,
        docId: 'creditBalances',
        friendlyName: `Unit ${unitId} Credit Balance History`,
        notes: `Deleted history entry ${entryId} | Amount: ${formatCurrency(entryToDelete.amount, 'MXN', true)} | Balance: ${currentBalance / 100} → ${newBalance / 100} pesos`
      });
      
      return {
        success: true,
        entriesDeleted: 1,
        newBalance,
        previousBalance: currentBalance
      };
    } catch (error) {
      console.error(`Error deleting credit history entry ${entryId} for ${clientId}/${unitId}:`, error);
      throw error;
    }
  }

  /**
   * Update credit history entry (edit date, amount, notes, source)
   * Resorts array chronologically after update
   * 
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier
   * @param {string} entryId - Entry ID to update
   * @param {Object} updates - Fields to update
   * @param {string} [updates.date] - New date (ISO string)
   * @param {number} [updates.amount] - New amount in centavos
   * @param {string} [updates.notes] - New notes
   * @param {string} [updates.source] - New source
   * @returns {Promise<Object>} Operation result
   */
  async updateCreditHistoryEntry(clientId, unitId, entryId, updates) {
    try {
      const db = await getDb();
      const fiscalYear = this._getCurrentFiscalYear();
      
      // Read current data
      const creditBalancesRef = db.collection('clients').doc(clientId)
        .collection('units').doc('creditBalances');
      
      const doc = await creditBalancesRef.get();
      if (!doc.exists || !doc.data()[unitId]) {
        return {
          success: false,
          error: 'No credit data found',
          newBalance: 0
        };
      }
      
      const allData = doc.data();
      const unitData = allData[unitId];
      const history = unitData.history || [];
      
      // Find entry by ID
      const entryIndex = history.findIndex(entry => entry.id === entryId);
      if (entryIndex === -1) {
        return {
          success: false,
          error: 'Entry not found',
          newBalance: getCreditBalance(unitData)
        };
      }
      
      const originalEntry = history[entryIndex];
      
      // Update entry fields
      const updatedEntry = { ...originalEntry };
      
      if (updates.date !== undefined) {
        const dateMillis = Date.parse(updates.date);
        if (isNaN(dateMillis)) {
          throw new Error(`Invalid date format: ${updates.date}`);
        }
        updatedEntry.timestamp = new Date(dateMillis).toISOString();
      }
      
      if (updates.amount !== undefined) {
        updatedEntry.amount = validateCentavos(updates.amount, 'amount');
        // Update type based on new amount
        updatedEntry.type = updatedEntry.amount > 0 ? 'credit_added' : 'credit_used';
      }
      
      if (updates.notes !== undefined) {
        updatedEntry.notes = updates.notes;
      }
      
      if (updates.source !== undefined) {
        updatedEntry.source = updates.source;
      }
      
      // Replace entry in history
      const newHistory = [...history];
      newHistory[entryIndex] = updatedEntry;
      
      // CRITICAL: Sort history array chronologically by timestamp (oldest first)
      newHistory.sort((a, b) => {
        const dateA = new Date(a.timestamp || 0).getTime();
        const dateB = new Date(b.timestamp || 0).getTime();
        return dateA - dateB; // Oldest first
      });
      
      // Calculate new balance using getter (always correct)
      const newBalance = getCreditBalance({ history: newHistory });
      const currentBalance = getCreditBalance(unitData);
      
      console.log(`✏️ [CREDIT] Updated history entry ${entryId} for ${clientId}/${unitId}`);
      console.log(`💰 [CREDIT] Balance: ${currentBalance} → ${newBalance} centavos (${currentBalance / 100} → ${newBalance / 100} pesos)`);
      
      // Update unit data
      allData[unitId] = {
        lastChange: {
          year: fiscalYear.toString(),
          historyIndex: Math.max(0, newHistory.length - 1),
          timestamp: getNow().toISOString()
        },
        history: newHistory
      };
      
      // Write back to Firestore
      await creditBalancesRef.set(allData);
      
      console.log(`✅ [CREDIT] Updated credit history entry ${entryId} for ${clientId}/${unitId}`);
      
      // Write audit log
      await writeAuditLog({
        module: 'credit',
        action: 'update_history_entry',
        parentPath: `clients/${clientId}/units`,
        docId: 'creditBalances',
        friendlyName: `Unit ${unitId} Credit Balance History`,
        notes: `Updated history entry ${entryId} | Changes: ${JSON.stringify(updates)} | Balance: ${currentBalance / 100} → ${newBalance / 100} pesos`
      });
      
      return {
        success: true,
        entryUpdated: true,
        newBalance,
        previousBalance: currentBalance
      };
    } catch (error) {
      console.error(`Error updating credit history entry ${entryId} for ${clientId}/${unitId}:`, error);
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

