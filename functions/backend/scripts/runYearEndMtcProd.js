/**
 * Temporary PROD script: run MTC year-end (closingYear 2025) using controller logic.
 * Uses ADC against sams-sandyland-prod. Do not commit.
 */
import admin from 'firebase-admin';
import { previewYearEnd, executeYearEnd } from '../controllers/yearEndController.js';

const clientId = 'MTC';
const closingYear = 2025;
const openingYear = closingYear + 1;

function initProdAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: 'sams-sandyland-prod'
    });
  }
}

function createMockRes(label = 'res') {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

async function main() {
  console.log('🌎 PROD year-end start (MTC, closingYear=2025)');
  initProdAdmin();

  // Preview
  const previewRes = createMockRes('preview');
  await previewYearEnd(
    {
      params: { closingYear },
      authorizedClientId: clientId,
      user: { email: 'automation@sams', uid: 'automation' }
    },
    previewRes
  );

  if (previewRes.statusCode !== 200) {
    throw new Error(`Preview failed: ${JSON.stringify(previewRes.body)}`);
  }

  const previewData = previewRes.body;
  console.log(`📊 Preview ok: units=${previewData.units?.length ?? 0}, summary:`, previewData.summary);

  const units = (previewData.units || []).map(u => ({
    unitId: u.unitId,
    nextYearScheduledAmount: u.nextYearScheduledAmount
  }));

  // Execute
  const execRes = createMockRes('execute');
  await executeYearEnd(
    {
      body: { closingYear, units, snapshotAccounts: true },
      authorizedClientId: clientId,
      user: { email: 'automation@sams', uid: 'automation' }
    },
    execRes
  );

  if (execRes.statusCode !== 200) {
    throw new Error(`Execute failed: ${JSON.stringify(execRes.body)}`);
  }

  console.log('🚀 Execute result:', execRes.body);
  console.log('🎉 PROD year-end complete');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

