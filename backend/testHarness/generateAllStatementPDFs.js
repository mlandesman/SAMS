/**
 * Generate Statement of Account PDFs for ALL units for both clients
 * Saves to Firebase Storage: /clients/{clientId}/accountStatements/{FiscalYear-Month}/
 * 
 * Usage: node backend/testHarness/generateAllStatementPDFs.js
 * 
 * Options:
 *   --client=MTC|AVII  Only process one client
 *   --dry-run          Preview what would be generated without saving
 *   --language=english|spanish  Default: english
 */

import { getDb, getApp } from '../firebase.js';
import { getNow } from '../services/DateService.js';
import { getFiscalYear, getFiscalYearBounds } from '../utils/fiscalYearUtils.js';
import { generateStatementData } from '../services/statementHtmlService.js';
import { generatePdf } from '../services/pdfService.js';
import axios from 'axios';
import { testConfig } from '../testing/config.js';
import { tokenManager } from '../testing/tokenManager.js';
import admin from 'firebase-admin';

// Configuration
const CONFIG = {
  clients: ['MTC', 'AVII'],
  language: 'english',
  dryRun: false,
  specificClient: null
};

// Parse command line arguments
process.argv.slice(2).forEach(arg => {
  if (arg.startsWith('--client=')) {
    CONFIG.specificClient = arg.split('=')[1].toUpperCase();
  } else if (arg === '--dry-run') {
    CONFIG.dryRun = true;
  } else if (arg.startsWith('--language=')) {
    CONFIG.language = arg.split('=')[1].toLowerCase();
  }
});

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
    units.push({
      unitId: doc.id,
      unitNumber: data.unitNumber || doc.id,
      ownerName: data.owners?.[0] || 'N/A'
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
 * Calculate folder name based on fiscal year and current month
 * Uses 0-indexed months within fiscal year:
 * MTC (Jan start): 2025-11 for December 2025 (Dec = month 11, 0-indexed)
 * AVII (July start): 2026-05 for December 2025 (Dec = 5th month of FY2026, 0-indexed)
 */
function getFolderName(fiscalYearStartMonth) {
  const now = getNow();
  const currentMonth = now.getMonth() + 1; // 1-12 (calendar month)
  
  // Calculate fiscal year
  const fiscalYear = getFiscalYear(now, fiscalYearStartMonth);
  
  // Calculate month within fiscal year (0-indexed: 0-11)
  let fiscalMonth;
  if (currentMonth >= fiscalYearStartMonth) {
    fiscalMonth = currentMonth - fiscalYearStartMonth; // 0-indexed
  } else {
    fiscalMonth = 12 - fiscalYearStartMonth + currentMonth; // 0-indexed
  }
  
  // Format: FiscalYear-FiscalMonth (e.g., 2025-11 for MTC Dec, 2026-05 for AVII Dec)
  return `${fiscalYear}-${String(fiscalMonth).padStart(2, '0')}`;
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
    return { success: false, error: error.message };
  }
}

/**
 * Get the storage bucket name based on environment
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
 * Process all units for a client
 */
async function processClient(clientId, api, results) {
  console.log(`\n📋 Processing ${clientId}...`);
  
  // Get client config
  const fiscalConfig = await getClientFiscalYearConfig(clientId);
  const fiscalYearStartMonth = fiscalConfig.fiscalYearStartMonth;
  
  // Get current fiscal year
  const currentDate = getNow();
  const fiscalYear = getFiscalYear(currentDate, fiscalYearStartMonth);
  
  // Get folder name
  const folderName = getFolderName(fiscalYearStartMonth);
  console.log(`   📁 Storage folder: clients/${clientId}/accountStatements/${folderName}/`);
  console.log(`   📅 Fiscal Year: ${fiscalYear} (starts month ${fiscalYearStartMonth})`);
  
  // Get all units
  const units = await getAllUnits(clientId);
  console.log(`   Found ${units.length} units`);
  
  const clientResults = {
    clientId,
    folderName,
    fiscalYear,
    totalUnits: units.length,
    successful: 0,
    failed: 0,
    files: []
  };
  
  for (const unit of units) {
    const { unitId, unitNumber, ownerName } = unit;
    const fileName = `${unitId}_Statement_FY${fiscalYear}.pdf`;
    const storagePath = `clients/${clientId}/accountStatements/${folderName}/${fileName}`;
    
    process.stdout.write(`   Generating ${unitId} (${unitNumber})... `);
    
    if (CONFIG.dryRun) {
      console.log('✅ [DRY RUN - would save to ' + storagePath + ']');
      clientResults.successful++;
      clientResults.files.push({ unitId, fileName, storagePath, status: 'dry-run' });
      continue;
    }
    
    try {
      // Generate PDF
      const result = await generatePdfForUnit(api, clientId, unitId, fiscalYear, CONFIG.language);
      
      if (!result.success) {
        console.log(`❌ Failed: ${result.error}`);
        clientResults.failed++;
        clientResults.files.push({ unitId, fileName, storagePath, status: 'failed', error: result.error });
        continue;
      }
      
      // Upload to storage
      const url = await uploadToStorage(result.pdfBuffer, storagePath);
      
      console.log(`✅ Saved (${Math.round(result.pdfBuffer.length / 1024)} KB)`);
      clientResults.successful++;
      clientResults.files.push({ unitId, fileName, storagePath, status: 'success', url, size: result.pdfBuffer.length });
      
      // Small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      clientResults.failed++;
      clientResults.files.push({ unitId, fileName, storagePath, status: 'error', error: error.message });
    }
  }
  
  results.push(clientResults);
  console.log(`   ✅ Completed ${clientId}: ${clientResults.successful} successful, ${clientResults.failed} failed`);
}

/**
 * Create an authenticated API client for internal calls
 */
async function createInternalApiClient() {
  // Get auth token from token manager
  const token = await tokenManager.getToken(testConfig.DEFAULT_TEST_UID);
  
  const api = axios.create({
    baseURL: testConfig.API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    timeout: 60000 // 60 second timeout for PDF generation
  });
  
  return api;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Bulk Statement of Account PDF Generator');
  console.log('==========================================');
  console.log(`📅 Date: ${getNow().toISOString()}`);
  console.log(`🌐 Language: ${CONFIG.language}`);
  if (CONFIG.dryRun) {
    console.log('⚠️  DRY RUN MODE - No files will be saved');
  }
  if (CONFIG.specificClient) {
    console.log(`🎯 Processing only: ${CONFIG.specificClient}`);
  }
  
  const results = [];
  
  try {
    // Create authenticated API client
    console.log('\n🔑 Authenticating...');
    const api = await createInternalApiClient();
    console.log('✅ Authentication ready');
    
    // Process clients
    const clientsToProcess = CONFIG.specificClient 
      ? [CONFIG.specificClient] 
      : CONFIG.clients;
    
    for (const clientId of clientsToProcess) {
      await processClient(clientId, api, results);
    }
    
    // Summary
    console.log('\n==========================================');
    console.log('📊 SUMMARY');
    console.log('==========================================');
    
    let totalSuccess = 0;
    let totalFailed = 0;
    
    for (const result of results) {
      console.log(`\n${result.clientId}:`);
      console.log(`   📁 Folder: clients/${result.clientId}/accountStatements/${result.folderName}/`);
      console.log(`   📅 Fiscal Year: ${result.fiscalYear}`);
      console.log(`   ✅ Successful: ${result.successful}`);
      console.log(`   ❌ Failed: ${result.failed}`);
      
      totalSuccess += result.successful;
      totalFailed += result.failed;
    }
    
    console.log('\n------------------------------------------');
    console.log(`Total: ${totalSuccess} successful, ${totalFailed} failed`);
    
    // Save results summary to local file
    const fs = await import('fs');
    const path = await import('path');
    const outputPath = path.join(process.cwd(), 'test-results', `bulk-statements-${Date.now()}.json`);
    
    // Ensure directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      language: CONFIG.language,
      dryRun: CONFIG.dryRun,
      results
    }, null, 2));
    
    console.log(`\n📝 Results saved to: ${outputPath}`);
    
    if (totalFailed > 0) {
      console.log('\n⚠️  Some statements failed to generate. Check the results file for details.');
    } else {
      console.log('\n🎉 All statements generated successfully!');
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run
main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
