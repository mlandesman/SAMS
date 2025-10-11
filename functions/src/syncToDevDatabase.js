import admin from 'firebase-admin';

async function syncExchangeRatesToDev(options = {}) {
  const {
    daysToSync = 30,
    overwrite = false,
    devProjectId = process.env.DEV_PROJECT_ID,
    devServiceAccountPath = process.env.DEV_SERVICE_ACCOUNT_PATH
  } = options;
  
  if (!devProjectId || !devServiceAccountPath) {
    throw new Error('Development database configuration is missing. Please set DEV_PROJECT_ID and DEV_SERVICE_ACCOUNT_PATH.');
  }
  
  console.log('Starting sync from production to development database...');
  console.log(`Options: ${daysToSync} days, overwrite: ${overwrite}`);
  
  try {
    const devApp = admin.initializeApp({
      credential: admin.credential.cert(require(devServiceAccountPath)),
      projectId: devProjectId
    }, 'dev-app');
    
    const prodDb = admin.firestore();
    const devDb = devApp.firestore();
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToSync);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    console.log(`Syncing exchange rates from ${startDateStr} to ${endDateStr}`);
    
    const prodSnapshot = await prodDb.collection('exchangeRates')
      .where('date', '>=', startDateStr)
      .where('date', '<=', endDateStr)
      .orderBy('date', 'desc')
      .get();
    
    console.log(`Found ${prodSnapshot.size} documents to sync`);
    
    const results = {
      synced: 0,
      skipped: 0,
      errors: 0,
      documents: []
    };
    
    const devBatch = devDb.batch();
    let batchCount = 0;
    
    for (const doc of prodSnapshot.docs) {
      try {
        const docRef = devDb.collection('exchangeRates').doc(doc.id);
        
        if (!overwrite) {
          const existingDoc = await docRef.get();
          if (existingDoc.exists) {
            results.skipped++;
            console.log(`Skipping existing document: ${doc.id}`);
            continue;
          }
        }
        
        const data = {
          ...doc.data(),
          syncedFromProd: true,
          syncedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        devBatch.set(docRef, data, { merge: !overwrite });
        batchCount++;
        
        results.synced++;
        results.documents.push(doc.id);
        
        if (batchCount >= 400) {
          await devBatch.commit();
          batchCount = 0;
        }
        
      } catch (error) {
        console.error(`Error syncing document ${doc.id}:`, error);
        results.errors++;
      }
    }
    
    if (batchCount > 0) {
      await devBatch.commit();
    }
    
    await devApp.delete();
    
    console.log('Sync completed:', results);
    return results;
    
  } catch (error) {
    console.error('Failed to sync databases:', error);
    throw error;
  }
}

async function syncLatestRatesToDev() {
  return syncExchangeRatesToDev({
    daysToSync: 7,
    overwrite: true
  });
}

export {
  syncExchangeRatesToDev,
  syncLatestRatesToDev
};