#!/usr/bin/env node
import { getDb } from './firebase.js';

async function checkAVIIStructure() {
  const db = await getDb();
  
  console.log('🏢 Checking AVII HOA Dues Structure\n');
  
  // Check path used by controller
  console.log('📍 Path 1: clients/AVII/units/{unitId}/dues/2026');
  const unitsRef = db.collection('clients').doc('AVII').collection('units');
  const units = await unitsRef.listDocuments();
  console.log(`   Found ${units.length} units`);
  
  let foundInPath1 = 0;
  for (const unitDoc of units) {
    const duesRef = unitDoc.collection('dues').doc('2026');
    const duesDoc = await duesRef.get();
    if (duesDoc.exists) {
      foundInPath1++;
      const data = duesDoc.data();
      console.log(`   Unit ${unitDoc.id}: Found! Payments: ${data.payments?.length || 0}`);
    }
  }
  console.log(`   Total in Path 1: ${foundInPath1}\n`);
  
  // Check alternative path
  console.log('📍 Path 2: clients/AVII/hoaDues/2026/units/{unitId}');
  const hoaDuesRef = db.collection('clients').doc('AVII').collection('hoaDues');
  const hoaDuesDoc = await hoaDuesRef.doc('2026').get();
  
  if (hoaDuesDoc.exists) {
    console.log('   Year 2026 document exists');
    const unitsRef2 = hoaDuesDoc.ref.collection('units');
    const units2 = await unitsRef2.listDocuments();
    console.log(`   Found ${units2.length} units in hoaDues collection`);
    
    for (const unitDoc of units2) {
      const data = await unitDoc.get();
      if (data.exists) {
        const d = data.data();
        console.log(`   Unit ${unitDoc.id}: Payments: ${d.payments?.length || 0}, Paid: $${d.totalPaid / 100}`);
      }
    }
  } else {
    console.log('   Year 2026 document NOT found');
  }
  
  process.exit(0);
}

checkAVIIStructure().catch(console.error);
