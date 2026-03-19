/**
 * Scheduled Statement Generation Service
 * 
 * Generates Statements of Account for all units across all clients on the 1st
 * of each month. Produces both English and Spanish PDFs, uploads to Firebase
 * Storage, and indexes in Firestore for the Mobile app.
 * 
 * Reuses the existing bulk generation pipeline from bulkStatementController.js.
 */

import { getDb, getApp } from '../firebase.js';
import { getNow } from './DateService.js';
import { getFiscalYear } from '../utils/fiscalYearUtils.js';
import { generateStatementData } from './statementHtmlService.js';
import { generatePdf } from './pdfService.js';
import { resolveOwners, getFirstOwnerName, buildUserCacheForUnits } from '../utils/unitContactUtils.js';
import { createInternalApiClient } from './internalApiClient.js';
import { randomUUID } from 'crypto';

function getStorageBucketName() {
  if (process.env.GCLOUD_PROJECT === 'sams-sandyland-prod' || process.env.NODE_ENV === 'production') {
    return 'sams-sandyland-prod.firebasestorage.app';
  } else if (process.env.NODE_ENV === 'staging') {
    return 'sams-staging-6cdcd.firebasestorage.app';
  }
  return 'sandyland-management-system.firebasestorage.app';
}

async function uploadToStorage(pdfBuffer, storagePath) {
  const app = await getApp();
  const bucketName = getStorageBucketName();
  const bucket = app.storage().bucket(bucketName);
  const file = bucket.file(storagePath);

  await file.save(pdfBuffer, {
    metadata: {
      contentType: 'application/pdf',
      metadata: {
        generatedAt: getNow().toISOString(),
        source: 'scheduled-statement-generator'
      }
    }
  });

  await file.makePublic();
  return `https://storage.googleapis.com/${bucketName}/${storagePath}`;
}

async function storeStatementMetadata(clientId, metadata) {
  const db = await getDb();
  const statementId = randomUUID();
  await db.collection('clients').doc(clientId)
    .collection('accountStatements').doc(statementId)
    .set(metadata);
  return statementId;
}

async function getActiveClients() {
  const db = await getDb();
  const clientsSnapshot = await db.collection('clients').get();
  return clientsSnapshot.docs
    .filter(doc => !doc.id.startsWith('_') && !doc.id.startsWith('system'))
    .map(doc => ({ clientId: doc.id, ...doc.data() }));
}

async function getAllUnits(clientId) {
  const db = await getDb();
  const unitsSnapshot = await db.collection('clients').doc(clientId)
    .collection('units').get();

  const unitsData = [...unitsSnapshot.docs]
    .filter(doc => !doc.id.startsWith('creditBalances'))
    .map(doc => ({ unitId: doc.id, ...doc.data() }));
  const userCache = await buildUserCacheForUnits(unitsData, db);

  const units = [];
  for (const doc of unitsSnapshot.docs) {
    if (doc.id.startsWith('creditBalances')) continue;
    const data = doc.data();
    const resolvedOwners = await resolveOwners(data.owners || [], db, userCache);
    const ownerName = getFirstOwnerName(resolvedOwners) || null;
    units.push({
      unitId: doc.id,
      unitNumber: data.unitNumber || doc.id,
      ownerName
    });
  }

  return units.sort((a, b) =>
    a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true, sensitivity: 'base' })
  );
}

async function deleteExistingStatements(clientId, unitId, calendarYear, calendarMonth, language) {
  const db = await getDb();
  const snapshot = await db.collection('clients').doc(clientId)
    .collection('accountStatements')
    .where('unitId', '==', unitId)
    .where('calendarYear', '==', calendarYear)
    .where('calendarMonth', '==', calendarMonth)
    .where('language', '==', language)
    .get();

  if (snapshot.empty) return 0;

  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  return snapshot.size;
}

/**
 * Generate monthly statements for all clients and units.
 * Runs on the 1st of each month; generates statements dated for the prior month.
 */
export async function generateMonthlyStatements(options = {}) {
  const { dryRun = false } = options;
  const now = getNow();

  const statementYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const statementMonth = now.getMonth() === 0 ? 12 : now.getMonth();

  console.log(`📄 [MONTHLY-STMT] Generating statements for ${statementYear}-${String(statementMonth).padStart(2, '0')}`);
  if (dryRun) console.log('   🔍 DRY RUN — no files will be generated');

  const summary = {
    statementPeriod: `${statementYear}-${String(statementMonth).padStart(2, '0')}`,
    clients: [],
    totalUnits: 0,
    totalGenerated: 0,
    totalReplaced: 0,
    totalFailed: 0,
    durationMs: 0
  };

  const startTime = Date.now();

  let api;
  if (!dryRun) {
    try {
      api = await createInternalApiClient();
    } catch (error) {
      console.error('❌ [MONTHLY-STMT] Failed to create internal API client:', error.message);
      summary.error = `Auth failed: ${error.message}`;
      summary.durationMs = Date.now() - startTime;
      return summary;
    }
  }

  const clients = await getActiveClients();
  console.log(`   Found ${clients.length} active clients`);

  const languages = ['english', 'spanish'];

  for (const client of clients) {
    const { clientId } = client;
    const clientResult = {
      clientId,
      units: 0,
      generated: 0,
      replaced: 0,
      failed: 0,
      errors: []
    };

    const fiscalYearStartMonth = client.configuration?.fiscalYearStartMonth || 1;
    const statementDate = new Date(statementYear, statementMonth - 1, 1);
    const fiscalYear = getFiscalYear(statementDate, fiscalYearStartMonth);

    let units;
    try {
      units = await getAllUnits(clientId);
    } catch (error) {
      console.error(`   ❌ ${clientId}: Failed to load units — ${error.message}`);
      clientResult.errors.push({ unitId: '*', error: error.message });
      clientResult.failed = 1;
      summary.clients.push(clientResult);
      summary.totalFailed++;
      continue;
    }

    clientResult.units = units.length;
    summary.totalUnits += units.length;
    console.log(`\n📋 [${clientId}] Processing ${units.length} units × ${languages.length} languages...`);

    for (const unit of units) {
      const { unitId, unitNumber } = unit;

      for (const language of languages) {
        const langCode = language === 'spanish' ? 'ES' : 'EN';

        try {
          if (dryRun) {
            console.log(`   [DRY] Would generate ${unitId}-${langCode}`);
            clientResult.generated++;
            summary.totalGenerated++;
            continue;
          }

          const { html, meta } = await generateStatementData(
            api, clientId, unitId,
            { fiscalYear, language }
          );

          const pdfBuffer = await generatePdf(html, {
            footerMeta: {
              statementId: meta?.statementId,
              generatedAt: meta?.generatedAt,
              language: meta?.language
            }
          });

          const fileName = `${statementYear}-${String(statementMonth).padStart(2, '0')}-${unitId}-${langCode}.PDF`;
          const storagePath = `clients/${clientId}/accountStatements/${fiscalYear}/${fileName}`;
          const storageUrl = await uploadToStorage(pdfBuffer, storagePath);

          let fiscalMonth;
          if (statementMonth >= fiscalYearStartMonth) {
            fiscalMonth = statementMonth - fiscalYearStartMonth;
          } else {
            fiscalMonth = 12 - fiscalYearStartMonth + statementMonth;
          }

          const deleted = await deleteExistingStatements(clientId, unitId, statementYear, statementMonth, language);
          if (deleted > 0) {
            console.log(`   ♻️ ${unitId}-${langCode}: replaced ${deleted} prior statement(s)`);
            clientResult.replaced = (clientResult.replaced || 0) + deleted;
          }

          await storeStatementMetadata(clientId, {
            unitId,
            date: statementDate,
            calendarYear: statementYear,
            calendarMonth: statementMonth,
            fiscalYear,
            fiscalMonth,
            language,
            storagePath,
            fileName,
            reportGenerated: getNow(),
            generatedBy: 'scheduled',
            storageUrl,
            isPublic: true
          });

          clientResult.generated++;
          summary.totalGenerated++;
          console.log(`   ✅ ${unitId}-${langCode}: ${fileName} (${Math.round(pdfBuffer.length / 1024)} KB)`);

          await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
          clientResult.failed++;
          summary.totalFailed++;
          clientResult.errors.push({ unitId, language, error: error.message });
          console.error(`   ❌ ${unitId}-${langCode}: ${error.message}`);
        }
      }
    }

    summary.totalReplaced += clientResult.replaced || 0;
    summary.clients.push(clientResult);
    console.log(`   [${clientId}] Done: ${clientResult.generated} generated (${clientResult.replaced || 0} replaced), ${clientResult.failed} failed`);
  }

  summary.durationMs = Date.now() - startTime;
  console.log(`\n📄 [MONTHLY-STMT] Complete in ${Math.round(summary.durationMs / 1000)}s: ${summary.totalGenerated} generated (${summary.totalReplaced} replaced), ${summary.totalFailed} failed`);

  return summary;
}
