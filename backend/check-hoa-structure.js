#!/usr/bin/env node
import { getDb } from './firebase.js';

async function checkHOAStructure() {
  const db = await getDb();
  
  // Check MTC hoaDues collection structure
  console.log('🏢 Checking MTC HOA Dues Structure\n');
  
  const hoaDuesRef = db.collection('clients').doc('MTC').collection('hoaDues');
  const years = await hoaDuesRef.listDocuments();
  
  console.log(`Found ${years.length} year document(s):`);
  for (const yearDoc of years) {
    console.log(`  Year: ${yearDoc.id}`);
    
    const unitsRef = yearDoc.collection('units');
    const units = await unitsRef.listDocuments();
    console.log(`    Units: ${units.length}`);
    
    for (const unitDoc of units) {
      console.log(`      Unit ID: ${unitDoc.id}`);
      const data = await unitDoc.get();
      if (data.exists) {
        const d = data.data();
        console.log(`        Scheduled: $${d.scheduledAmount / 100}, Paid: $${d.totalPaid / 100}`);
        console.log(`        Payments: ${d.payments?.length || 0} months`);
      }
    }
  }
  
  console.log('\n📊 Checking alternative structure...');
  
  // Check if HOA data is in units/dues collection
  const unitsRef = db.collection('clients').doc('MTC').collection('units');
  const units = await unitsRef.listDocuments();
  
  console.log(`Found ${units.length} units`);
  
  for (const unitDoc of units) {
    console.log(`  Unit: ${unitDoc.id}`);
    const duesRef = unitDoc.collection('dues');
    const duesDocs = await duesRef.listDocuments();
    
    for (const duesDoc of duesDocs) {
      console.log(`    Dues Year: ${duesDoc.id}`);
      const data = await duesDoc.get();
      if (data.exists) {
        const d = data.data();
        console.log(`      Scheduled: $${d.scheduledAmount / 100}, Paid: $${d.totalPaid / 100}`);
        console.log(`      Payments: ${d.payments?.length || 0} months`);
      }
    }
  }
  
  process.exit(0);
}

checkHOAStructure().catch(console.error);
