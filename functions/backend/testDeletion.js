import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { deleteTransaction } from './controllers/transactionsController.js';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function testDeletion() {
  try {
    console.log('Testing transaction deletion...');
    const result = await deleteTransaction('MTC', 'EbgErVS62Ipqkb8BVq8P');
    console.log('Result:', result);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testDeletion();