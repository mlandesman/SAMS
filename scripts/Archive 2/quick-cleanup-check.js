#!/usr/bin/env node
/**
 * Periodic Auto-Cleanup Monitor
 * Run this periodically to track cleanup progress
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';

async function quickCheck() {
  await initializeFirebase();
  const db = await getDb();
  const clientRef = db.collection('clients').doc('MTC');
  
  const collections = await clientRef.listCollections();
  
  console.log(`${new Date().toISOString()}: ${collections.length} ghost collections remaining`);
  
  if (collections.length === 0) {
    console.log('✅ Auto-cleanup completed!');
  } else {
    collections.forEach(col => console.log(`   👻 ${col.id}`));
  }
}

quickCheck().then(() => process.exit(0));