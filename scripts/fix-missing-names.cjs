// Fix missing names in vendors and categories
const admin = require('firebase-admin');
const serviceAccount = require('../backend/serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function fixMissingNames() {
  const clientId = 'MTC';
  
  try {
    console.log(`\n🔧 Fixing missing names for client: ${clientId}`);
    console.log('='.repeat(60));
    
    // 1. Fix Vendors
    console.log('\n1️⃣ FIXING VENDORS:');
    const vendorsSnapshot = await db.collection(`clients/${clientId}/vendors`).get();
    let vendorUpdates = 0;
    
    for (const doc of vendorsSnapshot.docs) {
      const data = doc.data();
      if (!data.name) {
        // Use the document ID as name, converting underscores to spaces
        const name = doc.id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        await doc.ref.update({ 
          name: name,
          category: data.category || 'General',
          status: data.status || 'active'
        });
        console.log(`   ✅ Updated vendor ${doc.id} with name: ${name}`);
        vendorUpdates++;
      }
    }
    console.log(`   Total vendors updated: ${vendorUpdates}`);
    
    // 2. Fix Categories
    console.log('\n2️⃣ FIXING CATEGORIES:');
    const categoriesSnapshot = await db.collection(`clients/${clientId}/categories`).get();
    let categoryUpdates = 0;
    
    for (const doc of categoriesSnapshot.docs) {
      const data = doc.data();
      if (!data.name) {
        // Use the document ID as name, converting underscores to spaces
        const name = doc.id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        await doc.ref.update({ 
          name: name,
          type: data.type || 'expense',
          description: data.description || ''
        });
        console.log(`   ✅ Updated category ${doc.id} with name: ${name}`);
        categoryUpdates++;
      }
    }
    console.log(`   Total categories updated: ${categoryUpdates}`);
    
    // 3. Add some standard vendors if none exist
    if (vendorsSnapshot.size === 0) {
      console.log('\n3️⃣ ADDING STANDARD VENDORS:');
      const standardVendors = [
        { name: 'HOA Management', category: 'HOA', email: '', phone: '' },
        { name: 'CFE', category: 'Utilities', email: '', phone: '' },
        { name: 'Aguakan', category: 'Utilities', email: '', phone: '' },
        { name: 'Totalplay', category: 'Internet', email: '', phone: '' }
      ];
      
      for (const vendor of standardVendors) {
        await db.collection(`clients/${clientId}/vendors`).add({
          ...vendor,
          status: 'active',
          created: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`   ✅ Added vendor: ${vendor.name}`);
      }
    }
    
    // 4. Add some standard categories if none exist
    if (categoriesSnapshot.size === 0) {
      console.log('\n4️⃣ ADDING STANDARD CATEGORIES:');
      const standardCategories = [
        { name: 'HOA Dues', type: 'income', description: 'Monthly HOA dues from units' },
        { name: 'Utilities', type: 'expense', description: 'Electricity, water, etc.' },
        { name: 'Maintenance', type: 'expense', description: 'Building maintenance and repairs' },
        { name: 'Administration', type: 'expense', description: 'Administrative expenses' },
        { name: 'Bank Interest', type: 'income', description: 'Interest from bank accounts' }
      ];
      
      for (const category of standardCategories) {
        await db.collection(`clients/${clientId}/categories`).add({
          ...category,
          created: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`   ✅ Added category: ${category.name}`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Data fixes completed');
    
  } catch (error) {
    console.error('❌ Error fixing data:', error);
  }
  
  process.exit(0);
}

fixMissingNames();