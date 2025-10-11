#!/usr/bin/env node

/**
 * Script to add AVII access to michael@landesman.com
 * Run with: NODE_ENV=production node addAVIIAccessToMichael.js
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

// Main function to add AVII access
async function addAVIIAccess() {
  const db = initFirebase();
  
  console.log('\n📋 Adding AVII access to michael@landesman.com\n');
  
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
    console.log(`   Current role: ${userData.globalRole}`);
    
    // Check current propertyAccess
    const currentAccess = userData.propertyAccess || {};
    
    if (currentAccess.AVII) {
      console.log(`ℹ️  User already has AVII access with role: ${currentAccess.AVII.role}`);
      console.log(`   AVII access details:`, JSON.stringify(currentAccess.AVII, null, 2));
    } else {
      console.log('➕ Adding AVII access...');
      
      // Add AVII access
      const updatedAccess = {
        ...currentAccess,
        AVII: {
          role: 'admin',
          unitId: null,
          permissions: [],
          addedDate: new Date().toISOString(),
          addedBy: 'migration-script'
        }
      };
      
      // Update user document
      await db.collection('users').doc(userId).update({
        propertyAccess: updatedAccess,
        lastModifiedDate: new Date().toISOString(),
        lastModifiedBy: 'addAVIIAccessToMichael-script'
      });
      
      console.log('✅ AVII access added successfully!');
    }
    
    // Display all current property access
    const updatedDoc = await db.collection('users').doc(userId).get();
    const finalData = updatedDoc.data();
    
    console.log('\n📊 Current Property Access:');
    console.log('='.repeat(50));
    
    if (finalData.propertyAccess) {
      Object.entries(finalData.propertyAccess).forEach(([clientId, access]) => {
        console.log(`• ${clientId}: ${access.role}`);
        if (access.unitId) {
          console.log(`  Unit: ${access.unitId}`);
        }
        if (access.unitAssignments && access.unitAssignments.length > 0) {
          console.log(`  Unit Assignments: ${access.unitAssignments.map(a => `${a.unitId}(${a.role})`).join(', ')}`);
        }
      });
    }
    
    console.log('\n🎉 Script completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the script
addAVIIAccess();