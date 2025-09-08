import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load HOA dues data
const hoaDuesFile = path.join(__dirname, '../AVIIdata/HOADues.json');
const hoaDuesData = JSON.parse(fs.readFileSync(hoaDuesFile, 'utf-8'));

// Load cross-reference data
const crossRefFile = path.join(__dirname, '../AVIIdata/HOA_Transaction_CrossRef.json');
const crossRefData = JSON.parse(fs.readFileSync(crossRefFile, 'utf-8'));

console.log('=== HOA DUES TRANSACTION LINKING ANALYSIS ===\n');

console.log('Cross-reference contains sequences:', Object.keys(crossRefData.bySequence).sort());
console.log(`Total sequences in cross-ref: ${Object.keys(crossRefData.bySequence).length}\n`);

// Extract all sequences from HOA dues
const sequences = [];
let totalPayments = 0;

Object.entries(hoaDuesData).forEach(([unitId, unitData]) => {
  if (unitData.payments) {
    unitData.payments.forEach(payment => {
      totalPayments++;
      const match = payment.notes?.match(/Seq:\s*(\d+)/);
      if (match) {
        const seq = match[1];
        const crossRefEntry = crossRefData.bySequence[seq];
        sequences.push({
          unitId,
          sequence: seq,
          inCrossRef: !!crossRefEntry,
          transactionId: crossRefEntry?.transactionId || 'NOT FOUND'
        });
      }
    });
  }
});

console.log(`Total payments in HOA Dues: ${totalPayments}`);
console.log(`Payments with sequence numbers: ${sequences.length}\n`);

console.log('Sequence Analysis:');
sequences.forEach(s => {
  console.log(`  Unit ${s.unitId}: Seq ${s.sequence} - ${s.inCrossRef ? '✓ Found' : '✗ NOT FOUND'} - Transaction: ${s.transactionId}`);
});

// Show which sequences are NOT in cross-ref
const missingSeqs = sequences.filter(s => !s.inCrossRef);
if (missingSeqs.length > 0) {
  console.log('\n⚠️  Missing sequences not in cross-reference:');
  missingSeqs.forEach(s => {
    console.log(`  - Seq ${s.sequence} (Unit ${s.unitId})`);
  });
}

// Check for sequences in cross-ref that aren't used
const usedSeqs = new Set(sequences.map(s => s.sequence));
const unusedSeqs = Object.keys(crossRefData.bySequence).filter(seq => !usedSeqs.has(seq));
if (unusedSeqs.length > 0) {
  console.log('\n📌 Sequences in cross-ref but not used in HOA dues:');
  unusedSeqs.forEach(seq => {
    console.log(`  - Seq ${seq}`);
  });
}