// Add missing accounts to MTC client
const admin = require('firebase-admin');
const serviceAccount = require('../backend/serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function fixMTCAccounts() {
  const clientId = 'MTC';
  
  try {
    console.log(`\n🔧 Adding accounts to client: ${clientId}`);
    
    // Define default accounts for MTC
    const accounts = [
      {
        id: 'bank-cibanco-001',
        name: 'Cibanco',
        type: 'bank',
        currency: 'MXN',
        balance: 0,
        active: true
      },
      {
        id: 'bank-hsbc-001',
        name: 'HSBC',
        type: 'bank',
        currency: 'MXN',
        balance: 0,
        active: true
      },
      {
        id: 'cash-petty-001',
        name: 'Petty Cash',
        type: 'cash',
        currency: 'MXN',
        balance: 0,
        active: true
      }
    ];
    
    // Update client document with accounts
    await db.doc(`clients/${clientId}`).update({
      accounts: accounts
    });
    
    console.log(`✅ Added ${accounts.length} accounts to MTC client`);
    accounts.forEach(acc => {
      console.log(`   - ${acc.name} (${acc.type})`);
    });
    
  } catch (error) {
    console.error('❌ Error adding accounts:', error);
  }
  
  process.exit(0);
}

fixMTCAccounts();