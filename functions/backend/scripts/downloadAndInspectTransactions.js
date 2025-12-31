/**
 * Download Transactions.json and check for sequence numbers
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase
if (getApps().length === 0) {
  const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
  const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));
  initializeApp({
    credential: cert(serviceAccount),
    storageBucket: 'sandyland-management-system.firebasestorage.app'
  });
}

async function downloadAndInspect() {
  console.log('\n📥 Downloading Transactions.json from Firebase Storage...\n');
  
  const bucket = getStorage().bucket();
  const file = bucket.file('imports/AVII/Transactions.json');
  
  const [content] = await file.download();
  const transactions = JSON.parse(content.toString('utf8'));
  
  console.log(`Total transactions: ${transactions.length}\n`);
  
  // Check for sequence numbers in the unnamed first column
  const withSequence = transactions.filter(t => t[""] && t[""].toString().match(/^\d+$/));
  const hoaDues = transactions.filter(t => t.Category === "HOA Dues");
  const hoaDuesWithSeq = hoaDues.filter(t => t[""] && t[""].toString().match(/^\d+$/));
  
  console.log(`Transactions with sequence numbers: ${withSequence.length}`);
  console.log(`HOA Dues transactions: ${hoaDues.length}`);
  console.log(`HOA Dues with sequence numbers: ${hoaDuesWithSeq.length}\n`);
  
  // Show sample HOA Dues transactions
  console.log('📋 Sample HOA Dues transactions with sequence numbers:\n');
  hoaDuesWithSeq.slice(0, 10).forEach(t => {
    console.log(`  Seq: ${t[""]}  Unit: ${t.Unit}  Amount: ${t.Amount}  Date: ${t.Date}`);
  });
  
  // Build cross-ref preview
  console.log('\n\n🔗 Cross-reference preview (sequence → unit):\n');
  const seqNumbers = ['25035', '25057', '25046', '25008', '25049', '25045', '25053', '25063', '25066', '25033', '25056', '25022'];
  
  for (const seq of seqNumbers) {
    const match = transactions.find(t => String(t[""]) === seq);
    if (match) {
      console.log(`  ✅ Seq ${seq}: Unit ${match.Unit}, ${match.Amount}, ${match.Date}`);
    } else {
      console.log(`  ❌ Seq ${seq}: NOT FOUND`);
    }
  }
  
  // Save locally for reference
  const outputPath = path.resolve(__dirname, '../data/imports/Transactions_AVII.json');
  await writeFile(outputPath, JSON.stringify(transactions, null, 2));
  console.log(`\n💾 Saved to: ${outputPath}`);
}

downloadAndInspect()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });

