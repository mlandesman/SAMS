import express from 'express';
import { sendWaterBillEmail, testWaterBillEmail } from '../controllers/emailService.js';
import { getDb } from '../firebase.js';

const router = express.Router();

// Send water bill email
router.post('/send/waterBill', async (req, res) => {
  try {
    const { clientId, unitNumber, billingPeriod, userLanguage, recipientEmails } = req.body;

    if (!clientId || !unitNumber || !billingPeriod || !recipientEmails) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: clientId, unitNumber, billingPeriod, recipientEmails'
      });
    }

    const result = await sendWaterBillEmail(
      clientId,
      unitNumber,
      billingPeriod,
      userLanguage || 'en',
      recipientEmails
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test endpoint for development
router.post('/send/waterBill/test', async (req, res) => {
  try {
    const { unitNumber, userLanguage, testEmail } = req.body;

    const result = await testWaterBillEmail(
      unitNumber || '101',
      userLanguage || 'en',
      testEmail || 'michael@landesman.com'
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get emailTemplates config for demo page
router.get('/config/templates/:clientId', async (req, res) => {
  try {
    const clientId = req.params.clientId;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }

    console.log(`📧 Fetching emailTemplates for client: ${clientId}`);
    
    const db = await getDb();
    
    // Fetch emailTemplates document from Firebase
    const emailTemplatesDoc = await db.collection('clients').doc(clientId)
      .collection('config').doc('emailTemplates').get();
    
    if (!emailTemplatesDoc.exists) {
      return res.status(404).json({
        success: false,
        error: `Email templates not found for client ${clientId}`
      });
    }
    
    const emailTemplates = emailTemplatesDoc.data();
    
    console.log(`✅ EmailTemplates fetched for ${clientId}:`, {
      hasWaterBill: !!emailTemplates.waterBill,
      hasReceipt: !!emailTemplates.receipt,
      waterBillKeys: emailTemplates.waterBill ? Object.keys(emailTemplates.waterBill) : []
    });
    
    res.json({
      success: true,
      data: emailTemplates
    });
    
  } catch (error) {
    console.error('❌ Error fetching emailTemplates:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch email templates',
      details: error.message 
    });
  }
});

export default router;