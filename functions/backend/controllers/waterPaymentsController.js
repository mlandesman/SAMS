import { waterPaymentsService } from '../services/waterPaymentsService.js';

/**
 * Record a water bill payment
 * POST /api/water/:clientId/payments/record
 */
export const recordWaterPayment = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { unitId, ...paymentData } = req.body;
    
    console.log(`📝 Recording water payment for client ${clientId}, unit ${unitId}`);
    
    const result = await waterPaymentsService.recordPayment(
      clientId,
      unitId, 
      paymentData
    );
    
    console.log(`✅ Payment recorded successfully:`, {
      transactionId: result?.transactionId,
      paymentType: result?.paymentType,
      billsPaid: result?.billsPaid?.length || 0
    });
    
    res.json({
      success: true,
      data: result,
      transactionId: result?.transactionId || null,
      vendorId: 'deposit' // Explicitly return vendorId for frontend validation
    });
    
  } catch (error) {
    console.error('Error recording water payment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get payment history for a unit
 * GET /api/water/:clientId/payments/history/:unitId
 */
export const getWaterPaymentHistory = async (req, res) => {
  try {
    const { clientId, unitId } = req.params;
    const { year } = req.query;
    
    const history = await waterPaymentsService.getPaymentHistory(
      clientId,
      unitId,
      year ? parseInt(year) : null
    );
    
    res.json({
      success: true,
      data: history
    });
    
  } catch (error) {
    console.error('Error getting payment history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get unpaid bills summary for payment modal
 * GET /api/water/:clientId/bills/unpaid/:unitId
 */
export const getUnpaidBillsSummary = async (req, res) => {
  try {
    const { clientId, unitId } = req.params;
    
    const summary = await waterPaymentsService.getUnpaidBillsSummary(clientId, unitId);
    
    res.json({
      success: true,
      data: summary
    });
    
  } catch (error) {
    console.error('Error getting unpaid bills summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};