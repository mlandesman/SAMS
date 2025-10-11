import { deleteTransactionWithDocuments } from './controllers/transactionsController.js';

async function debugDeletion() {
  try {
    console.log('Starting debug deletion...');
    const result = await deleteTransactionWithDocuments('MTC', 'EbgErVS62Ipqkb8BVq8P');
    console.log('Deletion result:', result);
  } catch (error) {
    console.error('Deletion error:', error);
    console.error('Error stack:', error.stack);
  }
}

debugDeletion();