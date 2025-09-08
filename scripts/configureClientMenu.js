// Configure client menu items in Firestore
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

// Use createRequire for JSON files
const require = createRequire(import.meta.url);
const serviceAccount = require('../backend/serviceAccountKey.json');

// Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function configureClientMenu() {
  const clientId = 'MTC';
  
  try {
    // Define the menu items - this matches what we saw in the Firebase Console screenshot
    const menuItems = [
      { label: "Dashboard", activity: "Dashboard" },
      { label: "Transactions", activity: "Transactions" },
      { label: "HOA Dues", activity: "HOADues" },
      { label: "Projects", activity: "Projects" },
      { label: "Budgets", activity: "Budgets" },
      { label: "List Management", activity: "ListManagement" },
      { label: "Settings", activity: "Settings" }
    ];
    
    // Set the menu configuration
    await db.doc(`clients/${clientId}/config/activities`).set({
      menu: menuItems
    });
    
    console.log(`Menu configuration for client ${clientId} updated successfully!`);
  } catch (error) {
    console.error('Error updating menu configuration:', error);
  }
}

// Use async IIFE for ES modules
(async () => {
  try {
    await configureClientMenu();
    console.log('Script completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
})();
