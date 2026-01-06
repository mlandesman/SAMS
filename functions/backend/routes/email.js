/**
 * Email API Routes
 * Handles email configuration and sending for digital receipts
 */

import express from 'express';
import { authenticateUserWithProfile } from '../middleware/clientAuth.js';
import { getEmailConfig, setEmailConfig, initializeMTCEmailConfig } from '../controllers/emailConfigController.js';
import { sendReceiptEmail, testEmailConfig, sendWaterBillEmail, testWaterBillEmail, sendStatementEmail, generateAndUploadPdfs } from '../controllers/emailService.js';

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

// POST /api/clients/:clientId/email/send-water-bill - Send water bill email
router.post('/send-water-bill', async (req, res) => {
  try {
    const clientId = req.params.clientId;
    const { unitNumber, billingPeriod, userLanguage, recipientEmails, options } = req.body;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }

    if (!unitNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'Unit number is required' 
      });
    }

    if (!billingPeriod) {
      return res.status(400).json({ 
        success: false, 
        error: 'Billing period is required' 
      });
    }

    if (!recipientEmails || recipientEmails.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Recipient emails are required' 
      });
    }

    console.log(`💧 Sending water bill email for ${clientId} Unit ${unitNumber} (${billingPeriod}) in ${userLanguage || 'en'}`);
    
    const result = await sendWaterBillEmail(
      clientId, 
      unitNumber, 
      billingPeriod, 
      userLanguage || 'en', 
      recipientEmails, 
      options || {}
    );
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('❌ Error sending water bill email:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send water bill email',
      details: error.message 
    });
  }
});

// POST /api/clients/:clientId/email/test-water-bill - Test water bill email
router.post('/test-water-bill', async (req, res) => {
  try {
    const clientId = req.params.clientId;
    const { unitNumber, userLanguage, testEmail } = req.body;
    
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

    console.log(`🧪 Testing water bill email for ${clientId} Unit ${unitNumber || '101'} in ${userLanguage || 'en'}`);
    
    const result = await testWaterBillEmail(
      unitNumber || '101', 
      userLanguage || 'en', 
      testEmail
    );
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error testing water bill email:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to test water bill email',
      details: error.message 
    });
  }
});


// POST /api/clients/:clientId/email/send-statement - Send Statement of Account email


// POST /api/clients/:clientId/email/generate-pdfs - Generate and store PDFs for statement
router.post('/generate-pdfs', authenticateUserWithProfile, async (req, res) => {
  try {
    const clientId = req.params.clientId;
    const { unitId, fiscalYear } = req.body;
    const user = req.user;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }
    
    if (!unitId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Unit ID is required' 
      });
    }
    
    if (!fiscalYear) {
      return res.status(400).json({ 
        success: false, 
        error: 'Fiscal year is required' 
      });
    }
    
    // Extract auth token from request headers
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const authToken = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    // Generate and store PDFs (reuse existing function)
    const pdfUrls = await generateAndUploadPdfs(clientId, unitId, fiscalYear, authToken);
    
    res.json({ 
      success: true, 
      message: 'PDFs generated and stored successfully',
      pdfUrls 
    });
  } catch (error) {
    console.error('❌ Error generating PDFs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate PDFs',
      details: error.message 
    });
  }
});


router.post('/send-statement', async (req, res) => {
  try {
    const clientId = req.params.clientId;
    const { unitId, fiscalYear, language, emailContent, statementHtml, statementMeta } = req.body;  // Optional pre-calculated data
    const user = req.user;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }
    
    if (!unitId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Unit ID is required' 
      });
    }
    
    if (!fiscalYear) {
      return res.status(400).json({ 
        success: false, 
        error: 'Fiscal year is required' 
      });
    }
    
    console.log(`📧 Sending statement email for ${clientId} Unit ${unitId} (FY ${fiscalYear})${language ? ` [language override: ${language}]` : ''}${emailContent ? ' [using pre-calculated data]' : ''}${statementHtml ? ' [using pre-generated HTML]' : ''}`);
    
    // Extract auth token from request headers
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const authToken = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    // Pass language override, emailContent, and HTML if provided (for single email from Report View)
    const result = await sendStatementEmail(clientId, unitId, fiscalYear, user, authToken, language, emailContent, statementHtml, statementMeta);
    
    if (result.success) {
      res.json({ success: true, message: 'Statement email sent successfully', ...result });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('❌ Error sending statement email:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send statement email',
      details: error.message 
    });
  }
});


export default router;
