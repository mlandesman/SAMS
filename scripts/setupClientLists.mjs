/**
 * This script initializes the list configuration for MTC client
 * It creates/updates the clients/{clientId}/config/lists document in Firestore
 */

// Use the Firebase setup from the backend directory
import { getDb } from '../backend/firebase.js';

async function setupClientLists() {
  try {
    // Get Firestore instance
    const db = await getDb();
    
    // MTC client ID
    const clientId = 'MTC';
    
    console.log(`Setting up list configuration for client: ${clientId}`);
    
    // Create/update the lists configuration
    const listsConfig = {
      vendor: true,
      category: true,
      method: true,  // Payment Methods
      unit: true     // Units - Enable for MTC since it's a multi-unit property
    };
    
    // Save to Firestore
    await db.collection('clients').doc(clientId).collection('config').doc('lists').set(listsConfig);
    
    console.log('✅ Successfully configured list settings for MTC');
    
    // Verify that the menu config includes the List Management activity
    console.log('Tip: Ensure that your menu configuration in Firestore includes the List Management activity.');
    console.log('Recommended menu entry:');
    console.log(`
    {
      "activity": "lists",
      "label": "List Management"
    }
    `);
    
  } catch (error) {
    console.error('Error setting up client lists:', error);
  }
}

// Run the setup
setupClientLists()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error in setup process:', err);
    process.exit(1);
  });
