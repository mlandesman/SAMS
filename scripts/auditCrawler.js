const { getDb } = require('../src/firebase');  // or '../src/firebase' from scripts
const db = getDb();

async function crawlAuditLogs() {
  console.log('🔎 Audit Logs:');

  try {
    const snapshot = await db.collection('auditLogs').orderBy('timestamp', 'desc').get();

    if (snapshot.empty) {
      console.log('No audit logs found.');
      return;
    }

    snapshot.forEach(doc => {
      const log = doc.data();
      console.log(
        `${log.timestamp.toDate().toISOString()} | ${log.module} | ${log.action} | ${log.friendlyName} (${log.docId}) | ${log.notes}`
      );
    });

  } catch (error) {
    console.error('❌ Error crawling audit logs:', error);
  }
}

crawlAuditLogs();