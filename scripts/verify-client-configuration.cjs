// Verify complete client configuration
const admin = require('firebase-admin');
const serviceAccount = require('../backend/serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function verifyClientConfiguration(clientId) {
  console.log(`\n🔍 Verifying configuration for client: ${clientId}`);
  console.log('='.repeat(50));
  
  const issues = [];
  const fixes = [];
  
  try {
    // 1. Check client document exists
    const clientDoc = await db.doc(`clients/${clientId}`).get();
    if (!clientDoc.exists) {
      console.log('❌ Client document not found!');
      return;
    }
    console.log('✅ Client document exists');
    
    // 2. Check config/activities (menu configuration)
    const activitiesDoc = await db.doc(`clients/${clientId}/config/activities`).get();
    if (!activitiesDoc.exists) {
      console.log('❌ Menu configuration (config/activities) missing');
      issues.push('Menu configuration missing');
      fixes.push('Run: node scripts/configureClientMenu.js');
    } else {
      const menuData = activitiesDoc.data();
      console.log(`✅ Menu configuration found with ${menuData.menu?.length || 0} items`);
    }
    
    // 3. Check config/lists (lists configuration)
    const listsDoc = await db.doc(`clients/${clientId}/config/lists`).get();
    if (!listsDoc.exists) {
      console.log('❌ Lists configuration (config/lists) missing');
      issues.push('Lists configuration missing');
      fixes.push('Run: node scripts/configure-client-lists.cjs');
    } else {
      const listsData = listsDoc.data();
      const enabledLists = Object.entries(listsData)
        .filter(([key, value]) => value === true && !['createdAt', 'updatedAt', 'updatedBy'].includes(key))
        .map(([key]) => key);
      console.log(`✅ Lists configuration found with enabled: ${enabledLists.join(', ')}`);
    }
    
    // 4. Check essential collections
    const collections = ['categories', 'vendors', 'paymentMethods', 'units', 'accounts'];
    for (const collection of collections) {
      const snapshot = await db.collection(`clients/${clientId}/${collection}`).limit(1).get();
      if (snapshot.empty) {
        console.log(`⚠️  Collection '${collection}' is empty`);
      } else {
        console.log(`✅ Collection '${collection}' has data`);
      }
    }
    
    // 5. Check for any users with access to this client
    const usersSnapshot = await db.collection('users')
      .where(`propertyAccess.${clientId}`, '!=', null)
      .limit(5)
      .get();
    
    if (usersSnapshot.empty) {
      console.log('⚠️  No users have access to this client');
      issues.push('No users have propertyAccess to this client');
    } else {
      console.log(`✅ ${usersSnapshot.size} user(s) have access to this client`);
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    if (issues.length === 0) {
      console.log('✅ Client configuration is complete!');
    } else {
      console.log(`⚠️  Found ${issues.length} configuration issue(s):`);
      issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
        if (fixes[i]) {
          console.log(`      Fix: ${fixes[i]}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error verifying configuration:', error);
  }
}

// Main execution
(async () => {
  const clientId = process.argv[2] || 'MTC';
  await verifyClientConfiguration(clientId);
  process.exit(0);
})();