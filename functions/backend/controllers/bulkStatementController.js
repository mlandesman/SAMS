/**
 * Bulk Statement Generation Controller
 * Generates and stores Statement of Account PDFs for all units in a client
 * 
 * Storage Structure:
 * - Storage: clients/{clientId}/accountStatements/{fiscalYear}/{YYYY-MM-{unitId}-{LANG}.PDF
 *   where LANG is ES (Spanish) or EN (English)
 * - Metadata: clients/{clientId}/accountStatements/{uuid} (flattened path)
 */

import { getDb, getApp } from '../firebase.js';
import { getNow } from '../services/DateService.js';
import { getFiscalYear, getFiscalYearBounds } from '../utils/fiscalYearUtils.js';
import { generateStatementData } from '../services/statementHtmlService.js';
import { generatePdf } from '../services/pdfService.js';
import { randomUUID } from 'crypto';
import axios from 'axios';
import { getFirstOwnerName } from '../utils/unitContactUtils.js';

/**
 * Get all units for a client (excluding system collections)
 */
async function getAllUnits(clientId) {
  const db = await getDb();
  const unitsSnapshot = await db.collection('clients').doc(clientId)
    .collection('units').get();
  
  const units = [];
  unitsSnapshot.forEach(doc => {
    // Skip system documents like creditBalances
    if (doc.id === 'creditBalances') return;
    
    const data = doc.data();
    // Get owner name (first owner's name if available)
    const ownerName = getFirstOwnerName(data.owners) || null;
    
    units.push({
      unitId: doc.id,
      unitNumber: data.unitNumber || doc.id,
      ownerName: ownerName || null
    });
  });
  
  return units.sort((a, b) => {
    return a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true, sensitivity: 'base' });
  });
}

/**
 * Get client fiscal year configuration
 */
async function getClientFiscalYearConfig(clientId) {
  const db = await getDb();
  const clientDoc = await db.collection('clients').doc(clientId).get();
  if (!clientDoc.exists) {
    return { fiscalYearStartMonth: 1 }; // Default to January
  }
  const clientData = clientDoc.data();
  return {
    fiscalYearStartMonth: clientData.configuration?.fiscalYearStartMonth || 1
  };
}

/**
 * Get storage bucket name based on environment
 */
function getStorageBucketName() {
  if (process.env.NODE_ENV === 'production') {
    return 'sams-sandyland-prod.firebasestorage.app';
  } else if (process.env.NODE_ENV === 'staging') {
    return 'sams-staging-6cdcd.firebasestorage.app';
  }
  return 'sandyland-management-system.firebasestorage.app';
}

/**
 * Upload PDF to Firebase Storage
 */
async function uploadToStorage(pdfBuffer, storagePath) {
  const app = await getApp();
  const bucketName = getStorageBucketName();
  const bucket = app.storage().bucket(bucketName);
  
  const file = bucket.file(storagePath);
  
  await file.save(pdfBuffer, {
    metadata: {
      contentType: 'application/pdf',
      metadata: {
        generatedAt: new Date().toISOString(),
        source: 'bulk-statement-generator'
      }
    }
  });
  
  // Get the public URL
  const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media`;
  
  return publicUrl;
}

/**
 * Store statement metadata in Firestore
 * Flattened path: clients/{clientId}/accountStatements/{uuid}
 */
async function storeStatementMetadata(clientId, metadata) {
  const db = await getDb();
  const statementId = randomUUID();
  const metadataRef = db.collection('clients').doc(clientId)
    .collection('accountStatements').doc(statementId);
  
  await metadataRef.set(metadata);
  
  return statementId;
}

/**
 * Generate PDF for a single unit
 */
async function generatePdfForUnit(api, clientId, unitId, fiscalYear, language) {
  try {
    const { html: htmlOutput, meta: htmlMeta } = await generateStatementData(
      api, 
      clientId, 
      unitId, 
      { fiscalYear, language }
    );
    
    const pdfBuffer = await generatePdf(htmlOutput, {
      footerMeta: {
        statementId: htmlMeta?.statementId,
        generatedAt: htmlMeta?.generatedAt,
        language: htmlMeta?.language
      }
    });
    
    return { success: true, pdfBuffer, meta: htmlMeta };
  } catch (error) {
    // Enhanced error logging
    const errorMessage = error.response 
      ? `HTTP ${error.response.status}: ${error.response.statusText} - ${error.response.data?.error || error.message}`
      : error.message;
    console.error(`   Error generating PDF for ${unitId}:`, errorMessage);
    if (error.response) {
      console.error(`   Response data:`, error.response.data);
      console.error(`   Request URL:`, error.config?.url);
    }
    return { success: false, error: errorMessage };
  }
}


/**
 * Bulk generate statements for all units in a client
 */
export async function bulkGenerateStatements(req, res) {
  try {
    const { clientId, fiscalYear: requestedFiscalYear, language = 'english' } = req.body;
    const user = req.user;
    
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'clientId is required'
      });
    }
    
    // Verify client access (for admin routes, check user permissions)
    // Admin routes may not set authorizedClientId, so check user permissions directly
    const hasAccess = req.authorizedClientId === clientId || 
                      (req.user && (
                        req.user.isSuperAdmin?.() || 
                        req.user.hasPropertyAccess?.(clientId) ||
                        req.user.globalRole === 'superAdmin'
                      ));
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this client'
      });
    }
    
    console.log(`🚀 Starting bulk statement generation for ${clientId}`);
    
    // Get client configuration
    const fiscalConfig = await getClientFiscalYearConfig(clientId);
    const fiscalYearStartMonth = fiscalConfig.fiscalYearStartMonth;
    
    // Determine fiscal year
    const currentDate = getNow();
    const fiscalYear = requestedFiscalYear || getFiscalYear(currentDate, fiscalYearStartMonth);
    
    // Get all units
    const units = await getAllUnits(clientId);
    console.log(`   Found ${units.length} units`);
    
    // Create authenticated API client (same pattern as reports.js route handler)
    // Use API_BASE_URL env var or default to localhost:5001
    const baseURL = process.env.API_BASE_URL || 'http://localhost:5001';
    
    // Get auth token from request (passed via Authorization header)
    const authToken = req.headers.authorization?.replace('Bearer ', '');
    
    if (!authToken) {
      return res.status(401).json({
        success: false,
        error: 'Authentication token required'
      });
    }
    
    // Create API client (same pattern as reports.js)
    const api = axios.create({
      baseURL: baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      timeout: 60000 // 60 second timeout for PDF generation
    });    
    const results = {
      clientId,
      fiscalYear,
      totalUnits: units.length,
      generated: 0,
      failed: 0,
      statements: []
    };
    
    // Set up streaming response for progress updates
    // Set headers before writing
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Send initial progress
    const sendProgress = (currentUnit, status, messagePrefix, unitId = null, ownerName = null) => {
      // Format message with owner name if available
      let displayMessage;
      if (unitId && ownerName && ownerName !== 'N/A' && ownerName !== null) {
        displayMessage = messagePrefix 
          ? `${messagePrefix} ${unitId} (${ownerName})`
          : `${unitId} (${ownerName})`;
      } else if (unitId) {
        displayMessage = messagePrefix 
          ? `${messagePrefix} ${unitId}`
          : unitId;
      } else {
        displayMessage = messagePrefix || '';
      }
      
      const progress = {
        type: 'progress',
        current: currentUnit,
        total: units.length,
        status,
        message: displayMessage,
        generated: results.generated,
        failed: results.failed
      };
      res.write(JSON.stringify(progress) + '\n');
    };
    
    // Process each unit
    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      const { unitId, unitNumber, ownerName } = unit;
      
      // Send progress update: starting this unit
      sendProgress(i + 1, 'processing', 'Generating statement for', unitId, ownerName);
      
      try {
        // Generate PDF
        const pdfResult = await generatePdfForUnit(api, clientId, unitId, fiscalYear, language);
        
        if (!pdfResult.success) {
          console.log(`   ❌ ${unitId}: ${pdfResult.error}`);
          results.failed++;
          results.statements.push({
            unitId,
            unitNumber,
            status: 'failed',
            error: pdfResult.error
          });
          // Send progress update: failed
          sendProgress(i + 1, 'failed', `${unitId}${ownerName && ownerName !== 'N/A' && ownerName !== null ? ` (${ownerName})` : ''} failed: ${pdfResult.error}`, unitId, ownerName);
          continue;
        }
        
        // Get statement date from metadata (report period date)
        const statementDate = new Date(pdfResult.meta?.statementDate || currentDate);
        const calendarYear = statementDate.getFullYear();
        const calendarMonth = statementDate.getMonth() + 1; // 1-12
        
        // Calculate fiscal month (0-indexed: 0-11)
        let fiscalMonth;
        if (calendarMonth >= fiscalYearStartMonth) {
          fiscalMonth = calendarMonth - fiscalYearStartMonth; // 0-indexed
        } else {
          fiscalMonth = 12 - fiscalYearStartMonth + calendarMonth; // 0-indexed
        }
        
        // Get language code (ES or EN) for filename
        const langCode = (language || 'english').toLowerCase() === 'spanish' ? 'ES' : 'EN';
        
        // Create filename: YYYY-MM-{unitId}-{LANG}.PDF
        const fileName = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${unitId}-${langCode}.PDF`;
        
        // Storage path: clients/{clientId}/accountStatements/{fiscalYear}/{fileName}
        const storagePath = `clients/${clientId}/accountStatements/${fiscalYear}/${fileName}`;
        
        // Upload to Storage
        const storageUrl = await uploadToStorage(pdfResult.pdfBuffer, storagePath);
        
        // Store metadata
        const reportGenerated = getNow();
        const metadata = {
          unitId,
          date: statementDate, // Report period date (what the report covers)
          calendarYear,
          calendarMonth,
          fiscalYear,
          fiscalMonth,
          language,
          storagePath,
          fileName,
          reportGenerated, // Admin timestamp (when PDF was created)
          generatedBy: user.email || user.uid,
          storageUrl
        };
        
        await storeStatementMetadata(clientId, metadata);
        
        console.log(`   ✅ ${unitId}: ${fileName} (${Math.round(pdfResult.pdfBuffer.length / 1024)} KB)`);
        results.generated++;
        results.statements.push({
          unitId,
          unitNumber,
          status: 'success',
          fileName,
          storagePath,
          storageUrl
        });
        
        // Send progress update: completed
        sendProgress(i + 1, 'completed', `${unitId}${ownerName && ownerName !== 'N/A' && ownerName !== null ? ` (${ownerName})` : ''} completed successfully`, unitId, ownerName);
        
        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`   ❌ ${unitId}: ${error.message}`);
        results.failed++;
        results.statements.push({
          unitId,
          unitNumber,
          status: 'error',
          error: error.message
        });
        // Send progress update: error
        sendProgress(i + 1, 'error', `${unitId}${ownerName && ownerName !== 'N/A' && ownerName !== null ? ` (${ownerName})` : ''} error: ${error.message}`, unitId, ownerName);
      }
    }
    
    console.log(`✅ Bulk generation complete: ${results.generated} successful, ${results.failed} failed`);
    
    // Send final result
    const finalResult = {
      type: 'complete',
      success: true,
      data: results
    };
    res.write(JSON.stringify(finalResult) + '\n');
    res.end();
    
  } catch (error) {
    console.error('❌ Bulk statement generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
