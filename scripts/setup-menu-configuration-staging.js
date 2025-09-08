import admin from 'firebase-admin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Use staging service account
const serviceAccount = require('../serviceAccountKey-staging.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'sams-sandyland-staging.appspot.com'
});

const db = admin.firestore();

const menuConfiguration = {
  categories: [
    {
      id: "appetizers",
      name: "Appetizers",
      icon: "🥗",
      order: 1,
      active: true
    },
    {
      id: "salads",
      name: "Salads",
      icon: "🥙",
      order: 2,
      active: true
    },
    {
      id: "sandwiches",
      name: "Sandwiches",
      icon: "🥪",
      order: 3,
      active: true
    },
    {
      id: "burgers",
      name: "Burgers",
      icon: "🍔",
      order: 4,
      active: true
    },
    {
      id: "tacos",
      name: "Tacos",
      icon: "🌮",
      order: 5,
      active: true
    },
    {
      id: "pizza",
      name: "Pizza",
      icon: "🍕",
      order: 6,
      active: true
    },
    {
      id: "pasta",
      name: "Pasta",
      icon: "🍝",
      order: 7,
      active: true
    },
    {
      id: "entrees",
      name: "Entrees",
      icon: "🍽️",
      order: 8,
      active: true
    },
    {
      id: "asian",
      name: "Asian",
      icon: "🥡",
      order: 9,
      active: true
    },
    {
      id: "desserts",
      name: "Desserts",
      icon: "🍰",
      order: 10,
      active: true
    },
    {
      id: "beverages",
      name: "Beverages",
      icon: "🥤",
      order: 11,
      active: true
    },
    {
      id: "breakfast",
      name: "Breakfast",
      icon: "🥞",
      order: 12,
      active: true
    }
  ]
};

async function setupMenuConfiguration() {
  try {
    console.log('🔧 Setting up menu configuration for staging environment...');
    
    // Create or update the menu configuration document
    await db.collection('configuration').doc('menu').set(menuConfiguration);
    
    console.log('✅ Menu configuration created successfully');
    console.log(`📋 Total categories: ${menuConfiguration.categories.length}`);
    
    // Verify the configuration
    const doc = await db.collection('configuration').doc('menu').get();
    if (doc.exists) {
      console.log('✅ Configuration verified in Firestore');
      console.log('Categories:', doc.data().categories.map(c => c.name).join(', '));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up menu configuration:', error);
    process.exit(1);
  }
}

setupMenuConfiguration();