/**
 * Scheduled Statement Generation Service
 * 
 * Orchestrates monthly statement generation by calling the existing
 * bulkGenerateStatements controller for each client × language combination.
 * No duplication of generation, upload, or indexing logic.
 */

import { getDb } from '../firebase.js';
import { getNow } from './DateService.js';
import { createInternalApiClient } from './internalApiClient.js';
import { bulkGenerateStatements } from '../controllers/bulkStatementController.js';

async function getActiveClients() {
  const db = await getDb();
  const snapshot = await db.collection('clients').get();
  return snapshot.docs
    .filter(doc => !doc.id.startsWith('_') && !doc.id.startsWith('system'))
    .map(doc => doc.id);
}

async function deleteExistingStatements(clientId, calendarYear, calendarMonth, language) {
  const db = await getDb();
  const snapshot = await db.collection('clients').doc(clientId)
    .collection('accountStatements')
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

function createMockReqRes(clientId, language, authToken) {
  const req = {
    body: { clientId, language },
    headers: { authorization: `Bearer ${authToken}` },
    user: {
      uid: 'system-scheduler',
      email: 'system@sams.sandyland.com.mx',
      globalRole: 'superAdmin',
      isSuperAdmin: () => true,
      hasPropertyAccess: () => true
    },
    authorizedClientId: clientId
  };

  let responseData = null;
  let statusCode = 200;

  const res = {
    status: (code) => { statusCode = code; return res; },
    json: (data) => { responseData = data; return res; }
  };

  return { req, res, getResult: () => ({ statusCode, data: responseData }) };
}

/**
 * Generate monthly statements for all clients and units.
 * Calls bulkGenerateStatements for each client × language — no duplicated logic.
 */
export async function generateMonthlyStatements(options = {}) {
  const { dryRun = false, targetYear, targetMonth } = options;
  const now = getNow();

  let statementYear, statementMonth;
  if (targetYear && targetMonth) {
    statementYear = targetYear;
    statementMonth = targetMonth;
  } else {
    statementYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    statementMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  }

  const period = `${statementYear}-${String(statementMonth).padStart(2, '0')}`;
  console.log(`📄 [MONTHLY-STMT] Generating statements for ${period}`);

  const summary = {
    statementPeriod: period,
    clients: [],
    totalGenerated: 0,
    totalReplaced: 0,
    totalFailed: 0,
    durationMs: 0
  };

  const startTime = Date.now();
  const clients = await getActiveClients();
  console.log(`   Found ${clients.length} active clients`);

  if (dryRun) {
    console.log('   🔍 DRY RUN — skipping generation');
    summary.clients = clients.map(id => ({ clientId: id, status: 'dry_run' }));
    summary.durationMs = Date.now() - startTime;
    return summary;
  }

  let authToken;
  try {
    const api = await createInternalApiClient();
    authToken = api.defaults.headers['Authorization'].replace('Bearer ', '');
  } catch (error) {
    console.error('❌ [MONTHLY-STMT] Failed to create internal API client:', error.message);
    summary.error = `Auth failed: ${error.message}`;
    summary.durationMs = Date.now() - startTime;
    return summary;
  }

  const languages = ['english', 'spanish'];

  for (const clientId of clients) {
    const clientResult = { clientId, generated: 0, replaced: 0, failed: 0 };

    for (const language of languages) {
      const langLabel = language === 'spanish' ? 'ES' : 'EN';

      try {
        const deleted = await deleteExistingStatements(clientId, statementYear, statementMonth, language);
        if (deleted > 0) {
          console.log(`   ♻️ [${clientId}/${langLabel}] Deleted ${deleted} prior statement(s)`);
          clientResult.replaced += deleted;
        }

        const { req, res, getResult } = createMockReqRes(clientId, language, authToken);
        await bulkGenerateStatements(req, res);
        const result = getResult();

        if (result.statusCode === 200 && result.data?.success) {
          const generated = result.data.data?.generated || 0;
          const failed = result.data.data?.failed || 0;
          clientResult.generated += generated;
          clientResult.failed += failed;
          console.log(`   ✅ [${clientId}/${langLabel}] ${generated} generated, ${failed} failed`);
        } else {
          clientResult.failed++;
          console.error(`   ❌ [${clientId}/${langLabel}] HTTP ${result.statusCode}: ${result.data?.error || 'Unknown error'}`);
        }
      } catch (error) {
        clientResult.failed++;
        console.error(`   ❌ [${clientId}/${langLabel}] ${error.message}`);
      }
    }

    summary.totalGenerated += clientResult.generated;
    summary.totalReplaced += clientResult.replaced;
    summary.totalFailed += clientResult.failed;
    summary.clients.push(clientResult);
  }

  summary.durationMs = Date.now() - startTime;
  console.log(`\n📄 [MONTHLY-STMT] Complete in ${Math.round(summary.durationMs / 1000)}s: ${summary.totalGenerated} generated (${summary.totalReplaced} replaced), ${summary.totalFailed} failed`);
  return summary;
}
