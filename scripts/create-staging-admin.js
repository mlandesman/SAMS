import admin from 'firebase-admin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Use staging service account
const serviceAccount = require('../serviceAccountKey-staging.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'sams-sandyland-staging.appspot.com'
});

const auth = admin.auth();
const db = admin.firestore();

async function createStagingAdmin() {
  try {
    console.log('👤 Creating staging admin user...');
    
    const email = 'admin@staging.sams.sandyland.com.mx';
    const password = 'StagingAdmin123!'; // Should be changed immediately after creation
    
    // Create the user in Firebase Auth
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: 'Staging Admin',
      emailVerified: true
    });
    
    console.log('✅ User created in Firebase Auth:', userRecord.uid);
    
    // Create user document in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      email: email,
      displayName: 'Staging Admin',
      role: 'admin',
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'system',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      environment: 'staging'
    });
    
    console.log('✅ User document created in Firestore');
    console.log('📧 Email:', email);
    console.log('🔑 Temporary Password:', password);
    console.log('⚠️  IMPORTANT: Change this password immediately after first login!');
    
    process.exit(0);
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      console.log('ℹ️  Admin user already exists');
      process.exit(0);
    } else {
      console.error('❌ Error creating staging admin:', error);
      process.exit(1);
    }
  }
}

createStagingAdmin();