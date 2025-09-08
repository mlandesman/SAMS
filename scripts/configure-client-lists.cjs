// Configure client lists configuration in Firestore
const admin = require('firebase-admin');
const serviceAccount = require('../backend/serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function configureClientLists() {
  const clientId = 'MTC';
  
  try {
    console.log(`🔧 Setting up lists configuration for client: ${clientId}`);
    
    // Define the lists configuration
    // These match the list IDs in ListManagementView.jsx
    const listsConfig = {
      vendor: true,           // Vendors list
      category: true,         // Categories list
      method: true,           // Payment Methods list
      unit: true,             // Units list
      exchangerates: true,    // Exchange rates list
      // Note: users and clients are handled separately as admin components
    };
    
    // Set the lists configuration
    await db.doc(`clients/${clientId}/config/lists`).set({
      ...listsConfig,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'configuration-script'
    });
    
    console.log(`✅ Lists configuration for client ${clientId} created successfully!`);
    console.log('Enabled lists:', Object.entries(listsConfig).filter(([, enabled]) => enabled).map(([id]) => id));
    
    // Verify the configuration
    const verifyDoc = await db.doc(`clients/${clientId}/config/lists`).get();
    if (verifyDoc.exists) {
      const data = verifyDoc.data();
      console.log('\n✅ Verification successful:');
      console.log('Lists configuration:', JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error configuring lists:', error);
  }
  
  process.exit(0);
}

configureClientLists();