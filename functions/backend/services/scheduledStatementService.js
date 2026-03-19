/**
 * Scheduled Statement Generation Service
 * 
 * Orchestrates monthly statement generation by calling the existing
 * bulkGenerateStatements controller for each client × language combination.
 * No duplication of generation, upload, or indexing logic.
 * 
 * Overwrite safety: The controller uses deterministic Firestore doc IDs
 * ({unitId}-{YYYY}-{MM}-{language}) and deterministic Storage paths,
 * so re-generating naturally overwrites without pre-deletion.
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

function createMockReqRes(clientId, language, authToken, calendarMonth, calendarYear) {
  const req = {
    body: { clientId, language, calendarMonth, calendarYear },
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
 * Determine the statement period (prior month).
 * Running on April 1 → generates March statements (calendarMonth=3, calendarYear=2026).
 * Running on January 1 → generates December of the prior year.
 */
function getStatementPeriod(now, targetYear, targetMonth) {
  if (targetYear && targetMonth) {
    return { calendarYear: targetYear, calendarMonth: targetMonth };
  }
  const month = now.getMonth(); // 0-based: Jan=0, Apr=3
  if (month === 0) {
    return { calendarYear: now.getFullYear() - 1, calendarMonth: 12 };
  }
  return { calendarYear: now.getFullYear(), calendarMonth: month };
}

/**
 * Generate monthly statements for all clients and units.
 * Calls bulkGenerateStatements for each client × language — no duplicated logic.
 */
export async function generateMonthlyStatements(options = {}) {
  const { dryRun = false, targetYear, targetMonth } = options;
  const now = getNow();

  const { calendarYear, calendarMonth } = getStatementPeriod(now, targetYear, targetMonth);

  const period = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}`;
  console.log(`📄 [MONTHLY-STMT] Generating statements for ${period}`);

  const summary = {
    statementPeriod: period,
    calendarYear,
    calendarMonth,
    clients: [],
    totalGenerated: 0,
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

  for (const clientId of clients) {
    const clientResult = { clientId, generated: 0, failed: 0 };

    try {
      const { req, res, getResult } = createMockReqRes(clientId, 'both', authToken, calendarMonth, calendarYear);
      await bulkGenerateStatements(req, res);
      const result = getResult();

      if (result.statusCode === 200 && result.data?.success) {
        const generated = result.data.data?.generated || 0;
        const failed = result.data.data?.failed || 0;
        clientResult.generated += generated;
        clientResult.failed += failed;
        console.log(`   ✅ [${clientId}] ${generated} generated (EN+ES), ${failed} failed`);
      } else {
        clientResult.failed++;
        console.error(`   ❌ [${clientId}] HTTP ${result.statusCode}: ${result.data?.error || 'Unknown error'}`);
      }
    } catch (error) {
      clientResult.failed++;
      console.error(`   ❌ [${clientId}] ${error.message}`);
    }

    summary.totalGenerated += clientResult.generated;
    summary.totalFailed += clientResult.failed;
    summary.clients.push(clientResult);
  }

  summary.durationMs = Date.now() - startTime;
  console.log(`\n📄 [MONTHLY-STMT] Complete in ${Math.round(summary.durationMs / 1000)}s: ${summary.totalGenerated} generated, ${summary.totalFailed} failed`);
  return summary;
}
