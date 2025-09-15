/**
 * Client Configuration API Routes
 * Handles client configuration documents from Firebase
 */

import express from 'express';
import { authenticateUserWithProfile } from '../middleware/clientAuth.js';
import { getDb } from '../firebase.js';

const router = express.Router({ mergeParams: true });

// Apply authentication to ALL routes in this file
router.use(authenticateUserWithProfile);

// GET /api/clients/:clientId/config/emailTemplates - Get emailTemplates document from Firebase
router.get('/emailTemplates', async (req, res) => {
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

// GET /api/clients/:clientId/config/:configDoc - Get any config document from Firebase
router.get('/:configDoc', async (req, res) => {
  try {
    const clientId = req.params.clientId;
    const configDoc = req.params.configDoc;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }

    if (!configDoc) {
      return res.status(400).json({ 
        success: false, 
        error: 'Config document name is required' 
      });
    }

    console.log(`📋 Fetching config document for client: ${clientId}, doc: ${configDoc}`);
    
    const db = await getDb();
    
    // Fetch config document from Firebase
    const configDocument = await db.collection('clients').doc(clientId)
      .collection('config').doc(configDoc).get();
    
    if (!configDocument.exists) {
      return res.status(404).json({
        success: false,
        error: `Config document '${configDoc}' not found for client ${clientId}`
      });
    }
    
    const configData = configDocument.data();
    
    console.log(`✅ Config document '${configDoc}' fetched for ${clientId}`);
    
    res.json({
      success: true,
      data: configData
    });
    
  } catch (error) {
    console.error('❌ Error fetching config document:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch config document',
      details: error.message 
    });
  }
});

export default router;