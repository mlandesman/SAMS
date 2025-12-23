#!/usr/bin/env node

/**
 * Update MTC Client Configuration with Statement Footer
 * Updates /clients/MTC/config.statementFooter with English and Spanish footer text
 * 
 * Usage:
 *   Development: node scripts/updateMTCStatementFooter.js
 *   Production:  node scripts/updateMTCStatementFooter.js --prod
 */

import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check for --prod flag to use production with ADC
const useProduction = process.argv.includes('--prod');
const productionProjectId = 'sams-sandyland-prod';

// Initialize Firebase Admin SDK
if (useProduction) {
  // Use Application Default Credentials for production
  console.log(`🌍 Environment: PRODUCTION`);
  console.log(`🔥 Firebase Project: ${productionProjectId}`);
  console.log(`🔑 Using Application Default Credentials (ADC)`);
  console.log(`   Run 'gcloud auth application-default login' if not authenticated\n`);
  
  // Clear GOOGLE_APPLICATION_CREDENTIALS if it's set to placeholder/invalid path
  // This ensures applicationDefault() uses ADC instead of trying to read a file
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && 
      (process.env.GOOGLE_APPLICATION_CREDENTIALS.includes('/path/to/') || 
       !existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS))) {
    console.log(`⚠️  Clearing invalid GOOGLE_APPLICATION_CREDENTIALS env var`);
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: productionProjectId
    });
  }
} else {
  // Use service account key for development
  const possiblePaths = [
    join(__dirname, '../serviceAccountKey.json'),
    join(__dirname, '../../serviceAccountKey.json'),
    join(__dirname, '../../../serviceAccountKey.json'),
  ];

  let serviceAccount = null;
  let foundPath = null;
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      try {
        serviceAccount = JSON.parse(readFileSync(path, 'utf8'));
        foundPath = path;
        break;
      } catch (e) {
        console.warn(`⚠️ Found ${path} but could not parse: ${e.message}`);
        continue;
      }
    }
  }

  if (!serviceAccount) {
    console.error('❌ Could not find serviceAccountKey.json');
    console.error('Tried paths:', possiblePaths);
    process.exit(1);
  }

  console.log(`🌍 Environment: DEVELOPMENT`);
  console.log(`✅ Loaded service account from: ${foundPath}`);
  console.log(`🔥 Firebase Project: ${serviceAccount.project_id}\n`);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
}

// Get Firestore instance
function getDb() {
  return admin.firestore();
}

async function updateMTCStatementFooter() {
  console.log('📄 Updating MTC client configuration with statement footer...\n');
  
  try {
    const db = await getDb();
    
    // Account Statements config document path (in config subcollection)
    const configPath = `clients/MTC/config/accountStatements`;
    const configRef = db.doc(configPath);
    const configDoc = await configRef.get();
    
    // Get client info for display
    const clientDoc = await db.doc('clients/MTC').get();
    if (!clientDoc.exists) {
      console.error('❌ Client document not found: clients/MTC');
      process.exit(1);
    }
    const clientData = clientDoc.data();
    
    console.log('📋 Current Configuration:');
    console.log(`   Client ID: MTC`);
    console.log(`   Name: ${clientData.basicInfo?.fullName || clientData.basicInfo?.displayName || 'N/A'}`);
    console.log(`   Config Path: ${configPath}`);
    if (configDoc.exists) {
      const existingConfig = configDoc.data();
      console.log(`   Config exists: true`);
      if (existingConfig.statementFooter) {
        console.log(`   Has statementFooter: true`);
        console.log(`   English footer length: ${existingConfig.statementFooter.en?.length || 0} chars`);
        console.log(`   Spanish footer length: ${existingConfig.statementFooter.es?.length || 0} chars`);
      } else {
        console.log(`   Has statementFooter: false`);
      }
    } else {
      console.log(`   Config exists: false (will be created)`);
    }
    console.log('');
    
    // MTC Statement Footer Text (with bullets, no extra newlines)
    const statementFooter = {
      en: `● Please make your payment in the condominium's bank account and send us your receipt.
● Maintenance fees are due before the first of each month in which they apply.
● Payments are applied first to the penalties and then to the oldest installments as indicated in articles 2281 and 2282 of the Civil Code of the State of Quintana Roo.
● Credit Balances will be used to pay any unpaid fees on the day they are due. Make your payment during that period and it will be credited back to your account balance.`,
      es: `● Por favor realice su pago en la cuenta bancaria del condominio y envíenos su recibo.
● Las tarifas de mantenimiento vencen antes del primero de cada mes en el que se aplican.
● Los pagos se aplican primero a las sanciones y luego a las cuotas más antiguas según lo indican los artículos 2281 y 2282 del Código Civil del Estado de Quintana Roo.
● Los saldos de crédito se utilizarán para pagar las tarifas pendientes de pago el día de su vencimiento. Realice su pago durante ese período y se acreditará al saldo de su cuenta.`
    };
    
    // Prepare update - merge with existing config or create new
    const existingConfig = configDoc.exists ? configDoc.data() : {};
    const updates = {
      ...existingConfig,
      statementFooter: statementFooter,
      updated: admin.firestore.Timestamp.now(),
      updatedBy: 'updateMTCStatementFooter-script'
    };
    
    // Update or create config document
    await configRef.set(updates, { merge: true });
    
    console.log('✅ Account Statements configuration updated successfully!');
    console.log(`📍 Path: ${configPath}`);
    console.log('\n📋 Updated Configuration:');
    console.log(`   statementFooter.en: ${statementFooter.en.length} characters`);
    console.log(`   statementFooter.es: ${statementFooter.es.length} characters`);
    console.log('');
    console.log('📝 English Footer Preview:');
    console.log('   ' + statementFooter.en.split('\n')[0].substring(0, 80) + '...');
    console.log('');
    console.log('📝 Spanish Footer Preview:');
    console.log('   ' + statementFooter.es.split('\n')[0].substring(0, 80) + '...');
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('   1. Test statement generation for MTC unit to verify footer displays correctly');
    console.log('   2. Verify both English and Spanish statements show MTC footer');
    console.log('   3. Confirm bullets render correctly in HTML output');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error updating client configuration:', error);
    throw error;
  }
}

// Run the update
updateMTCStatementFooter()
  .then(() => {
    console.log('✅ Update complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Update failed:', error);
    process.exit(1);
  });

