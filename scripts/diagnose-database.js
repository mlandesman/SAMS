#!/usr/bin/env node

/**
 * diagnose-database.js
 * Diagnostic script to see what's actually in the database
 */

import { initializeFirebase, printEnvironmentInfo } from './utils/environment-config.js';

const ENV = process.env.FIRESTORE_ENV || 'dev';
const CLIENT_ID = 'MTC';

async function diagnoseDatabaseState() {
  console.log('🔍 Diagnosing Database State...\n');
  
  // Print environment information
  printEnvironmentInfo(ENV);
  
  try {
    // Initialize Firebase
    const { db } = await initializeFirebase(ENV);
    
    console.log('\n📊 SCANNING DATABASE CONTENTS:\n');
    
    // Check top-level collections
    console.log('🔍 Top-level collections:');
    const collections = await db.listCollections();
    for (const collection of collections) {
      const snapshot = await collection.limit(5).get();
      console.log(`   📁 ${collection.id}: ${snapshot.size}+ documents`);
      
      if (snapshot.size > 0) {
        const sampleDoc = snapshot.docs[0];
        const data = sampleDoc.data();
        console.log(`      Sample doc: ${sampleDoc.id}`);
        if (data.clientId) console.log(`      ClientId: ${data.clientId}`);
        if (data.module) console.log(`      Module: ${data.module}`);
      }
    }
    
    // Check clients collection specifically
    console.log('\n🔍 Clients collection:');
    const clientsRef = db.collection('clients');
    const clientsSnapshot = await clientsRef.get();
    console.log(`   📁 clients: ${clientsSnapshot.size} documents`);
    
    for (const clientDoc of clientsSnapshot.docs) {
      console.log(`   🏢 Client: ${clientDoc.id}`);
      
      // Check subcollections
      const subcollections = await clientDoc.ref.listCollections();
      for (const subcollection of subcollections) {
        const subSnapshot = await subcollection.limit(5).get();
        console.log(`      📁 ${subcollection.id}: ${subSnapshot.size}+ documents`);
        
        // Check for nested collections (like dues under units)
        if (subcollection.id === 'units' && subSnapshot.size > 0) {
          for (const unitDoc of subSnapshot.docs.slice(0, 2)) {
            console.log(`         🏠 Unit: ${unitDoc.id}`);
            const unitSubcollections = await unitDoc.ref.listCollections();
            for (const unitSubcollection of unitSubcollections) {
              const unitSubSnapshot = await unitSubcollection.limit(5).get();
              console.log(`            📁 ${unitSubcollection.id}: ${unitSubSnapshot.size}+ documents`);
            }
          }
        }
      }
    }
    
    // Check audit logs for MTC
    console.log('\n🔍 AuditLogs for MTC:');
    try {
      const auditRef = db.collection('auditLogs');
      
      // Try simple query first
      const allAuditSnapshot = await auditRef.limit(10).get();
      console.log(`   📁 Total auditLogs (sample): ${allAuditSnapshot.size} documents`);
      
      // Check if any have clientId = MTC
      let mtcAuditCount = 0;
      for (const doc of allAuditSnapshot.docs) {
        const data = doc.data();
        if (data.clientId === CLIENT_ID) {
          mtcAuditCount++;
        }
      }
      console.log(`   🎯 MTC audit logs in sample: ${mtcAuditCount}`);
      
      // Show sample audit log
      if (allAuditSnapshot.size > 0) {
        const sampleAudit = allAuditSnapshot.docs[0].data();
        console.log(`   📄 Sample audit log:`, {
          clientId: sampleAudit.clientId,
          module: sampleAudit.module,
          action: sampleAudit.action,
          timestamp: sampleAudit.timestamp?.toDate?.()
        });
      }
      
    } catch (error) {
      console.log(`   ❌ Error querying audit logs: ${error.message}`);
    }
    
    // Check users collection
    console.log('\n🔍 Users collection:');
    const usersRef = db.collection('users');
    const usersSnapshot = await usersRef.limit(5).get();
    console.log(`   📁 users: ${usersSnapshot.size}+ documents`);
    
    if (usersSnapshot.size > 0) {
      const sampleUser = usersSnapshot.docs[0].data();
      console.log(`   👤 Sample user:`, {
        email: sampleUser.email,
        propertyAccess: Object.keys(sampleUser.propertyAccess || {})
      });
    }
    
    console.log('\n✅ Database diagnosis complete!');
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
    process.exit(1);
  }
}

// Execute
diagnoseDatabaseState()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Diagnosis script failed:', error);
    process.exit(1);
  });