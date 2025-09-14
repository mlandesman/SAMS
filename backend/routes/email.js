/**
 * Email API Routes
 * Handles email configuration and sending for digital receipts
 */

import express from 'express';
import { authenticateUserWithProfile } from '../middleware/clientAuth.js';
import { getEmailConfig, setEmailConfig, initializeMTCEmailConfig } from '../controllers/emailConfigController.js';
import { sendReceiptEmail, testEmailConfig } from '../controllers/emailService.js';

const router = express.Router({ mergeParams: true });

// Apply authentication to ALL routes in this file
router.use(authenticateUserWithProfile);

// GET /api/clients/:clientId/email/config/:templateType - Get email configuration  
router.get('/config/:templateType?', async (req, res) => {
  try {
    const clientId = req.params.clientId;
    const templateType = req.params.templateType || 'receipt';
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }

    console.log(`📋 Fetching email config for client: ${clientId}, template: ${templateType}`);
    const result = await getEmailConfig(clientId, templateType);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('❌ Error fetching email config:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch email configuration' 
    });
  }
});

// POST /api/clients/:clientId/email/config/:configType - Set email configuration
router.post('/config/:configType?', async (req, res) => {
  try {
    const clientId = req.params.clientId;
    const configType = req.params.configType || 'receiptEmail';
    const configData = req.body;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }

    console.log(`📝 Setting email config for client: ${clientId}, type: ${configType}`);
    const result = await setEmailConfig(clientId, configType, configData);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error setting email config:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to set email configuration' 
    });
  }
});

// POST /api/clients/:clientId/email/send-receipt - Send receipt email
router.post('/send-receipt', async (req, res) => {
  try {
    const clientId = req.params.clientId;
    const { receiptData, receiptImageBase64, clientData } = req.body;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }

    if (!receiptData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Receipt data is required' 
      });
    }

    console.log(`📧 Sending receipt email for client: ${clientId}, unit: ${receiptData.unitNumber}`);
    
    // Convert base64 image to buffer if provided
    let receiptImageBlob = null;
    if (receiptImageBase64) {
      // Remove data URL prefix if present
      const base64Data = receiptImageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      receiptImageBlob = Buffer.from(base64Data, 'base64');
    }
    
    const result = await sendReceiptEmail(clientId, receiptData, receiptImageBlob, clientData);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('❌ Error sending receipt email:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send receipt email' 
    });
  }
});

// POST /api/clients/:clientId/email/test - Test email configuration
router.post('/test', async (req, res) => {
  try {
    const clientId = req.params.clientId;
    const { testEmail } = req.body;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }

    if (!testEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'Test email address is required' 
      });
    }

    console.log(`🧪 Testing email config for client: ${clientId}, sending to: ${testEmail}`);
    const result = await testEmailConfig(clientId, testEmail);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error testing email config:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to test email configuration' 
    });
  }
});

// POST /api/clients/:clientId/email/initialize - Initialize default email config for MTC
router.post('/initialize', async (req, res) => {
  try {
    const clientId = req.params.clientId;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }

    console.log(`🔧 Initializing default email config for client: ${clientId}`);
    const result = await initializeMTCEmailConfig(clientId);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error initializing email config:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to initialize email configuration' 
    });
  }
});

export default router;
