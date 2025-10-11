#!/usr/bin/env node

/**
 * Debug ms@landesman.com authentication issue
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { sanitizeEmailForDocId } from '../backend/utils/emailDocId.js';

// Initialize Firebase
function initializeFirebase() {
  const serviceAccountPath = '../backend/serviceAccountKey.json';
  const serviceAccount = JSON.parse(readFileSync(new URL(serviceAccountPath, import.meta.url)));
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'sandyland-management-system'
    });
  }
}

async function debugUser() {
  initializeFirebase();
  const db = admin.firestore();
  const auth = admin.auth();
  
  const email = 'ms@landesman.com';
  console.log('\n🔍 Debugging authentication for:', email);
  
  // 1. Check Firebase Auth user
  console.log('\n1️⃣ Firebase Auth User:');
  try {
    const authUser = await auth.getUserByEmail(email);
    console.log('   ✅ Auth user exists');
    console.log('   UID:', authUser.uid);
    console.log('   Email:', authUser.email);
    console.log('   Email Verified:', authUser.emailVerified);
    console.log('   Disabled:', authUser.disabled);
    
    // 2. Check Firestore document by email
    console.log('\n2️⃣ Firestore Document (by email):');
    const emailDocId = sanitizeEmailForDocId(email);
    console.log('   Email Doc ID:', emailDocId);
    
    const emailDoc = await db.collection('users').doc(emailDocId).get();
    if (emailDoc.exists) {
      console.log('   ✅ Found by email ID');
      const data = emailDoc.data();
      console.log('   Stored UID:', data.uid);
      console.log('   Matches Auth UID:', data.uid === authUser.uid);
    } else {
      console.log('   ❌ NOT found by email ID');
    }
    
    // 3. Check Firestore document by UID
    console.log('\n3️⃣ Firestore Document (by UID):');
    const uidDoc = await db.collection('users').doc(authUser.uid).get();
    if (uidDoc.exists) {
      console.log('   ⚠️  STILL EXISTS by UID - This could cause issues!');
      console.log('   This means migration may not have completed properly');
    } else {
      console.log('   ✅ No document with UID (correct)');
    }
    
    // 4. Check for duplicate documents
    console.log('\n4️⃣ Checking for duplicates:');
    const emailQuery = await db.collection('users').where('email', '==', email).get();
    console.log('   Documents with this email:', emailQuery.size);
    if (emailQuery.size > 1) {
      console.log('   ⚠️  MULTIPLE documents found!');
      emailQuery.forEach(doc => {
        console.log('     - Doc ID:', doc.id);
      });
    }
    
    // 5. Test what the backend would do
    console.log('\n5️⃣ Backend Lookup Simulation:');
    console.log('   Backend will look for:', emailDocId);
    console.log('   Document exists:', emailDoc.exists);
    console.log('   Has required fields:', emailDoc.exists ? {
      globalRole: emailDoc.data().globalRole,
      hasClientAccess: !!emailDoc.data().clientAccess,
      isActive: emailDoc.data().isActive
    } : 'N/A');
    
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  
  console.log('\n💡 Possible Issues:');
  console.log('   - UID mismatch between Firebase Auth and Firestore');
  console.log('   - Missing or incorrect data migration');
  console.log('   - Backend expecting different document structure');
  console.log('   - CORS or authentication middleware issues');
}

debugUser().catch(console.error);