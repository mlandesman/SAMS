#!/usr/bin/env node

/**
 * Fix AVII access for michael@landesman.com
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const initFirebase = () => {
  const env = process.env.NODE_ENV || 'development';
  console.log(`🔧 Running in ${env} environment`);
  
  let serviceAccountPath;
  if (env === 'production') {
    serviceAccountPath = join(__dirname, '../sams-production-serviceAccountKey.json');
  } else {
    serviceAccountPath = join(__dirname, '../serviceAccountKey.json');
  }
  
  try {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
    
    console.log(`✅ Firebase initialized for project: ${serviceAccount.project_id}`);
    return admin.firestore();
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error.message);
    process.exit(1);
  }
};

async function fixAVIIAccess() {
  const db = initFirebase();
  
  console.log('\n📋 Fixing AVII access for michael@landesman.com\n');
  
  try {
    // Find user by email
    const usersSnapshot = await db.collection('users')
      .where('email', '==', 'michael@landesman.com')
      .limit(1)
      .get();
    
    if (usersSnapshot.empty) {
      console.error('❌ User michael@landesman.com not found');
      process.exit(1);
    }
    
    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();
    
    console.log(`✅ Found user: ${userData.name} (${userId})`);
    
    // Update propertyAccess with proper structure
    const updatedAccess = {
      ...(userData.propertyAccess || {}),
      AVII: {
        role: 'admin',
        isAdmin: true,
        permissions: ['units.view', 'units.edit', 'transactions.create', 'transactions.view'],
        addedDate: new Date().toISOString(),
        addedBy: 'fix-script'
      }
    };
    
    // Update user document
    await db.collection('users').doc(userId).update({
      propertyAccess: updatedAccess,
      lastModifiedDate: new Date().toISOString()
    });
    
    console.log('✅ AVII access fixed with proper admin role!');
    
    // Verify the update
    const updatedDoc = await db.collection('users').doc(userId).get();
    const finalData = updatedDoc.data();
    
    console.log('\n📊 Updated Property Access:');
    console.log(JSON.stringify(finalData.propertyAccess?.AVII, null, 2));
    
    console.log('\n🎉 Script completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the script
fixAVIIAccess();