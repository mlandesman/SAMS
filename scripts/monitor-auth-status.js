#!/usr/bin/env node

/**
 * Monitor authentication system status
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5001/api';

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

async function checkStatus() {
  console.clear();
  console.log('🔍 SAMS Authentication System Monitor');
  console.log('=====================================\n');
  
  // Backend status
  console.log('🖥️  Backend Status:');
  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();
    console.log(`   ✅ Running (${data.environment} mode)`);
  } catch (error) {
    console.log('   ❌ Not running');
  }
  
  // Database status
  console.log('\n💾 Database Status:');
  initializeFirebase();
  const db = admin.firestore();
  
  try {
    const usersSnapshot = await db.collection('users').get();
    const users = [];
    let emailBasedCount = 0;
    let uidBasedCount = 0;
    
    usersSnapshot.forEach(doc => {
      const docId = doc.id;
      const userData = doc.data();
      
      // Try to decode as base64URL
      let isEmailBased = false;
      try {
        const padding = (4 - (docId.length % 4)) % 4;
        const base64 = docId.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padding);
        const decoded = Buffer.from(base64, 'base64').toString('utf8');
        if (decoded.includes('@')) {
          isEmailBased = true;
          emailBasedCount++;
        }
      } catch (e) {
        // Not base64URL
      }
      
      if (!isEmailBased) {
        uidBasedCount++;
      }
      
      users.push({
        id: docId,
        email: userData.email,
        role: userData.globalRole,
        isEmailBased
      });
    });
    
    console.log(`   ✅ Connected to Firestore`);
    console.log(`   📊 Total users: ${users.length}`);
    console.log(`   📧 Email-based IDs: ${emailBasedCount}`);
    console.log(`   🔑 UID-based IDs: ${uidBasedCount}`);
    
    console.log('\n👥 User Summary:');
    console.log('   ' + '-'.repeat(70));
    console.log('   Email                          | Role        | ID Type');
    console.log('   ' + '-'.repeat(70));
    
    users.sort((a, b) => a.email.localeCompare(b.email)).forEach(user => {
      const idType = user.isEmailBased ? '✅ Email' : '⚠️  UID';
      console.log(`   ${user.email.padEnd(30)} | ${user.role.padEnd(11)} | ${idType}`);
    });
    console.log('   ' + '-'.repeat(70));
    
  } catch (error) {
    console.log('   ❌ Database connection error:', error.message);
  }
  
  console.log('\n📝 Next Steps:');
  console.log('   1. Login through the frontend');
  console.log('   2. Check browser console for errors');
  console.log('   3. Monitor backend logs for auth flow');
  console.log('\n🔄 Status as of:', new Date().toLocaleTimeString());
}

// Run status check
checkStatus().catch(console.error);