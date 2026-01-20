// Credit Balance Controller
// Handles HTTP requests for credit balance operations
// Routes requests to CreditService for business logic

import creditService from '../services/creditService.js';

export class CreditController {
  constructor() {
    this.creditService = creditService;
  }

  /**
   * GET /credit/:clientId/:unitId
   * Get current credit balance for a unit
   */
  getCreditBalance = async (req, res) => {
    try {
      const { clientId, unitId } = req.params;
      
      // Input validation
      if (!clientId || !unitId) {
        return res.status(400).json({ 
          error: 'clientId and unitId are required' 
        });
      }

      const creditData = await this.creditService.getCreditBalance(clientId, unitId);
      
      res.status(200).json(creditData);
    } catch (error) {
      console.error('Error getting credit balance:', error);
      res.status(500).json({ 
        error: 'Failed to get credit balance',
        message: error.message 
      });
    }
  };

  /**
   * POST /credit/:clientId/:unitId
   * Update credit balance (add or subtract)
   */
  updateCreditBalance = async (req, res) => {
    try {
      const { clientId, unitId } = req.params;
      const { amount, transactionId, note, source } = req.body;
      
      // Input validation
      if (!clientId || !unitId) {
        return res.status(400).json({ 
          error: 'clientId and unitId are required' 
        });
      }

      if (amount === undefined || amount === null) {
        return res.status(400).json({ 
          error: 'amount is required' 
        });
      }

      if (!transactionId) {
        return res.status(400).json({ 
          error: 'transactionId is required' 
        });
      }

      if (!note) {
        return res.status(400).json({ 
          error: 'note is required' 
        });
      }

      if (!source) {
        return res.status(400).json({ 
          error: 'source is required' 
        });
      }

      // Validate amount is a number
      const amountNum = Number(amount);
      if (isNaN(amountNum)) {
        return res.status(400).json({ 
          error: 'amount must be a valid number' 
        });
      }

      const result = await this.creditService.updateCreditBalance(
        clientId, 
        unitId, 
        amountNum, 
        transactionId, 
        note, 
        source
      );
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Error updating credit balance:', error);
      
      // Check for insufficient balance error
      if (error.message.includes('Insufficient credit balance')) {
        return res.status(400).json({ 
          error: 'Insufficient credit balance',
          message: error.message 
        });
      }
      
      res.status(500).json({ 
        error: 'Failed to update credit balance',
        message: error.message 
      });
    }
  };

  /**
   * GET /credit/:clientId/:unitId/history
   * Get credit balance history
   */
  getCreditHistory = async (req, res) => {
    try {
      const { clientId, unitId } = req.params;
      const limit = parseInt(req.query.limit) || 50;
      
      // Input validation
      if (!clientId || !unitId) {
        return res.status(400).json({ 
          error: 'clientId and unitId are required' 
        });
      }

      // Validate limit
      if (limit < 1 || limit > 500) {
        return res.status(400).json({ 
          error: 'limit must be between 1 and 500' 
        });
      }
      
      const history = await this.creditService.getCreditHistory(clientId, unitId, limit);
      
      res.status(200).json(history);
    } catch (error) {
      console.error('Error getting credit history:', error);
      res.status(500).json({ 
        error: 'Failed to get credit history',
        message: error.message 
      });
    }
  };

  /**
   * POST /credit/:clientId/:unitId/history
   * Add credit history entry (for historical records or corrections)
   */
  addCreditHistoryEntry = async (req, res) => {
    try {
      const { clientId, unitId } = req.params;
      const { amount, date, transactionId, note, source } = req.body;
      
      // Input validation
      if (!clientId || !unitId) {
        return res.status(400).json({ 
          error: 'clientId and unitId are required' 
        });
      }

      if (amount === undefined || amount === null) {
        return res.status(400).json({ 
          error: 'amount is required' 
        });
      }

      if (!date) {
        return res.status(400).json({ 
          error: 'date is required' 
        });
      }

      // transactionId is optional for admin entries (can be null)

      if (!note) {
        return res.status(400).json({ 
          error: 'note is required' 
        });
      }

      if (!source) {
        return res.status(400).json({ 
          error: 'source is required' 
        });
      }

      // Validate amount is a number
      const amountNum = Number(amount);
      if (isNaN(amountNum)) {
        return res.status(400).json({ 
          error: 'amount must be a valid number' 
        });
      }

      // Validate date format (ISO string expected)
      // Using basic Date parsing for validation - actual timezone handling in service layer
      try {
        const testDate = Date.parse(date);
        if (isNaN(testDate)) {
          return res.status(400).json({ 
            error: 'date must be a valid ISO date string' 
          });
        }
      } catch (dateError) {
        return res.status(400).json({ 
          error: 'date must be a valid ISO date string',
          details: dateError.message
        });
      }

      const result = await this.creditService.addCreditHistoryEntry(
        clientId, 
        unitId, 
        amountNum, 
        date, 
        transactionId || null, // Allow null for admin entries
        note, 
        source
      );
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Error adding credit history entry:', error);
      res.status(500).json({ 
        error: 'Failed to add credit history entry',
        message: error.message 
      });
    }
  };

  /**
   * DELETE /credit/:clientId/:unitId/history/:transactionId
   * Delete credit history entries by transaction ID (for transaction deletion/reversal)
   */
  deleteCreditHistoryEntry = async (req, res) => {
    try {
      const { clientId, unitId, transactionId } = req.params;
      
      // Input validation
      if (!clientId || !unitId || !transactionId) {
        return res.status(400).json({ 
          error: 'clientId, unitId, and transactionId are required' 
        });
      }

      const result = await this.creditService.deleteCreditHistoryEntry(
        clientId, 
        unitId, 
        transactionId
      );
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Error deleting credit history entry:', error);
      res.status(500).json({ 
        error: 'Failed to delete credit history entry',
        message: error.message 
      });
    }
  };

  /**
   * DELETE /credit/:clientId/:unitId/history/entry/:entryId
   * Delete credit history entry by entry ID (for admin deletion)
   */
  deleteCreditHistoryEntryById = async (req, res) => {
    try {
      const { clientId, unitId, entryId } = req.params;
      
      // Input validation
      if (!clientId || !unitId || !entryId) {
        return res.status(400).json({ 
          error: 'clientId, unitId, and entryId are required' 
        });
      }

      const result = await this.creditService.deleteCreditHistoryEntryById(
        clientId, 
        unitId, 
        entryId
      );
      
      if (!result.success) {
        return res.status(404).json(result);
      }
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Error deleting credit history entry by ID:', error);
      res.status(500).json({ 
        error: 'Failed to delete credit history entry',
        message: error.message 
      });
    }
  };

  /**
   * PUT /credit/:clientId/:unitId/history/entry/:entryId
   * Update credit history entry (edit date, amount, notes, source)
   */
  updateCreditHistoryEntry = async (req, res) => {
    try {
      const { clientId, unitId, entryId } = req.params;
      const { date, amount, notes, source } = req.body;
      
      // Input validation
      if (!clientId || !unitId || !entryId) {
        return res.status(400).json({ 
          error: 'clientId, unitId, and entryId are required' 
        });
      }

      // Build updates object (only include provided fields)
      const updates = {};
      if (date !== undefined) updates.date = date;
      if (amount !== undefined) {
        const amountNum = Number(amount);
        if (isNaN(amountNum)) {
          return res.status(400).json({ 
            error: 'amount must be a valid number' 
          });
        }
        updates.amount = amountNum;
      }
      if (notes !== undefined) updates.notes = notes;
      if (source !== undefined) updates.source = source;

      // Validate date if provided
      if (updates.date !== undefined) {
        const testDate = Date.parse(updates.date);
        if (isNaN(testDate)) {
          return res.status(400).json({ 
            error: 'date must be a valid ISO date string' 
          });
        }
      }

      const result = await this.creditService.updateCreditHistoryEntry(
        clientId, 
        unitId, 
        entryId,
        updates
      );
      
      if (!result.success) {
        return res.status(404).json(result);
      }
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Error updating credit history entry:', error);
      res.status(500).json({ 
        error: 'Failed to update credit history entry',
        message: error.message 
      });
    }
  };
}

