/**
 * This script updates the MTC client's menu configuration to include the List Management activity
 */

// Use the Firebase setup from the backend directory
import { getDb } from '../backend/firebase.js';

async function updateMenuConfig() {
  try {
    // Get Firestore instance
    const db = await getDb();
    
    // MTC client ID
    const clientId = 'MTC';
    
    console.log(`Updating menu configuration for client: ${clientId}`);
    
    // First, get current menu config
    const configRef = db.collection('clients').doc(clientId).collection('config').doc('activities');
    const configSnapshot = await configRef.get();
    
    if (!configSnapshot.exists) {
      console.error('Menu configuration document does not exist for MTC');
      return;
    }
    
    const configData = configSnapshot.data();
    let menuItems = configData.menu || [];
    
    // Check if List Management is already in the menu
    const hasListManagement = menuItems.some(item => item.activity === 'lists');
    
    if (hasListManagement) {
      console.log('List Management already exists in the menu configuration');
    } else {
      // Add List Management to the menu
      // Find a reasonable position in the menu - before Settings if it exists
      const settingsIndex = menuItems.findIndex(item => item.activity === 'Settings');
      
      const newMenuItem = {
        activity: 'lists',
        label: 'List Management'
      };
      
      if (settingsIndex !== -1) {
        // Insert before Settings
        menuItems.splice(settingsIndex, 0, newMenuItem);
      } else {
        // Add at the end
        menuItems.push(newMenuItem);
      }
      
      // Update the menu configuration
      await configRef.update({
        menu: menuItems
      });
      
      console.log('✅ Successfully added List Management to the menu');
    }
    
    console.log('Current menu configuration:');
    console.log(menuItems);
    
  } catch (error) {
    console.error('Error updating menu configuration:', error);
  }
}

// Run the setup
updateMenuConfig()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error in update process:', err);
    process.exit(1);
  });
