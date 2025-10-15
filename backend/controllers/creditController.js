// Credit Balance Controller
// Handles HTTP requests for credit balance operations
// Routes requests to CreditService for business logic

import { CreditService } from '../services/creditService.js';

export class CreditController {
  constructor() {
    this.creditService = new CreditService();
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

      // Validate date format
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({ 
          error: 'date must be a valid ISO date string' 
        });
      }

      const result = await this.creditService.addCreditHistoryEntry(
        clientId, 
        unitId, 
        amountNum, 
        date, 
        transactionId, 
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
}

