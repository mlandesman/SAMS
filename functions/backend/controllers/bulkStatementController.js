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
 * Upload PDF to Firebase Storage and make it publicly accessible
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
  
  // Make file publicly readable (same as email service)
  await file.makePublic();
  
  // Get signed URL with far future expiration (same as email service)
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: '03-01-2500' // Far future expiration
  });
  
  return signedUrl;
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
 * Create or update bulk generation progress document
 * Path: clients/{clientId}/bulkProgress/statements
 */
async function updateBulkProgress(clientId, progress) {
  const db = await getDb();
  const progressRef = db.collection('clients').doc(clientId)
    .collection('bulkProgress').doc('statements');
  
  await progressRef.set({
    ...progress,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

/**
 * Get bulk generation progress
 */
async function getBulkProgress(clientId) {
  const db = await getDb();
  const progressRef = db.collection('clients').doc(clientId)
    .collection('bulkProgress').doc('statements');
  
  const doc = await progressRef.get();
  return doc.exists ? doc.data() : null;
}

/**
 * Clear bulk generation progress (call when complete or on error)
 */
async function clearBulkProgress(clientId) {
  const db = await getDb();
  const progressRef = db.collection('clients').doc(clientId)
    .collection('bulkProgress').doc('statements');
  
  await progressRef.delete();
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
 * Get bulk generation progress (for polling)
 */
export async function getBulkStatementProgress(req, res) {
  try {
    const { clientId } = req.params;
    
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'clientId is required'
      });
    }
    
    const progress = await getBulkProgress(clientId);
    
    if (!progress) {
      return res.json({
        success: true,
        data: null,
        message: 'No bulk generation in progress'
      });
    }
    
    return res.json({
      success: true,
      data: progress
    });
    
  } catch (error) {
    console.error('❌ Error getting bulk progress:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Bulk generate statements for all units in a client
 * Uses Firestore-based progress tracking for reliable polling
 */
export async function bulkGenerateStatements(req, res) {
  const { clientId, fiscalYear: requestedFiscalYear, language = 'english' } = req.body;
  
  try {
    const user = req.user;
    
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'clientId is required'
      });
    }
    
    // Verify client access (for admin routes, check user permissions)
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
    
    // Create authenticated API client
    const baseURL = process.env.API_BASE_URL || 'http://localhost:5001';
    const authToken = req.headers.authorization?.replace('Bearer ', '');
    
    if (!authToken) {
      return res.status(401).json({
        success: false,
        error: 'Authentication token required'
      });
    }
    
    const api = axios.create({
      baseURL: baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      timeout: 60000
    });
    
    const results = {
      clientId,
      fiscalYear,
      totalUnits: units.length,
      generated: 0,
      failed: 0,
      statements: []
    };
    
    // Helper to format progress message
    const formatMessage = (prefix, unitId, ownerName) => {
      if (ownerName && ownerName !== 'N/A') {
        return `${prefix} ${unitId} (${ownerName})`;
      }
      return `${prefix} ${unitId}`;
    };
    
    // Helper to update Firestore progress
    const saveProgress = async (current, status, message) => {
      await updateBulkProgress(clientId, {
        status,
        current,
        total: units.length,
        generated: results.generated,
        failed: results.failed,
        message,
        startedAt: results.startedAt || new Date().toISOString()
      });
    };
    
    // Initialize progress in Firestore
    results.startedAt = new Date().toISOString();
    await saveProgress(0, 'starting', 'Initializing bulk generation...');
    
    // Process each unit
    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      const { unitId, unitNumber, ownerName } = unit;
      
      // Update progress: starting this unit
      await saveProgress(i + 1, 'processing', formatMessage('Generating statement for', unitId, ownerName));
      
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
          continue;
        }
        
        // Get statement date from metadata
        const statementDate = new Date(pdfResult.meta?.statementDate || currentDate);
        const calendarYear = statementDate.getFullYear();
        const calendarMonth = statementDate.getMonth() + 1;
        
        // Calculate fiscal month
        let fiscalMonth;
        if (calendarMonth >= fiscalYearStartMonth) {
          fiscalMonth = calendarMonth - fiscalYearStartMonth;
        } else {
          fiscalMonth = 12 - fiscalYearStartMonth + calendarMonth;
        }
        
        // Get language code for filename
        const langCode = (language || 'english').toLowerCase() === 'spanish' ? 'ES' : 'EN';
        
        // Create filename and path
        const fileName = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${unitId}-${langCode}.PDF`;
        const storagePath = `clients/${clientId}/accountStatements/${fiscalYear}/${fileName}`;
        
        // Upload to Storage (now makes public and returns signed URL)
        const storageUrl = await uploadToStorage(pdfResult.pdfBuffer, storagePath);
        
        // Store metadata
        const reportGenerated = getNow();
        const metadata = {
          unitId,
          date: statementDate,
          calendarYear,
          calendarMonth,
          fiscalYear,
          fiscalMonth,
          language,
          storagePath,
          fileName,
          reportGenerated,
          generatedBy: user.email || user.uid,
          storageUrl,
          isPublic: true // Mark as publicly accessible
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
      }
    }
    
    console.log(`✅ Bulk generation complete: ${results.generated} successful, ${results.failed} failed`);
    
    // Update final progress in Firestore
    await updateBulkProgress(clientId, {
      status: 'complete',
      current: units.length,
      total: units.length,
      generated: results.generated,
      failed: results.failed,
      message: `Complete: ${results.generated} generated, ${results.failed} failed`,
      completedAt: new Date().toISOString()
    });
    
    // Return final result
    return res.json({
      success: true,
      data: results
    });
    
  } catch (error) {
    console.error('❌ Bulk statement generation error:', error);
    
    // Update progress with error status
    if (clientId) {
      try {
        await updateBulkProgress(clientId, {
          status: 'error',
          message: error.message,
          errorAt: new Date().toISOString()
        });
      } catch (progressError) {
        console.error('Failed to update progress with error:', progressError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
