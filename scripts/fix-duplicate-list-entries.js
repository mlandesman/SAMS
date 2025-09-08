import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { generateVendorId, generateCategoryId, generatePaymentMethodId } from '../backend/utils/documentIdGenerator.js';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('../backend/serviceAccountKey.json', 'utf8'));
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function fixDuplicateEntries() {
  const clientId = 'MTC';
  console.log(`🔧 Fixing duplicate entries for client: ${clientId}`);
  
  // Fix vendors
  console.log('\n📋 Processing vendors...');
  const vendorsRef = db.collection(`clients/${clientId}/vendors`);
  const vendorsSnapshot = await vendorsRef.get();
  
  const vendorsByName = new Map();
  
  // Group vendors by name
  vendorsSnapshot.forEach(doc => {
    const data = doc.data();
    const name = data.name;
    if (!vendorsByName.has(name)) {
      vendorsByName.set(name, []);
    }
    vendorsByName.get(name).push({ id: doc.id, data });
  });
  
  // Process duplicates
  for (const [name, vendors] of vendorsByName) {
    if (vendors.length > 1) {
      console.log(`\n⚠️  Found ${vendors.length} entries for "${name}"`);
      
      // Determine which one should be kept (prefer custom ID format)
      const customId = generateVendorId(name);
      let keepVendor = vendors.find(v => v.id === customId);
      
      if (!keepVendor) {
        // If no custom ID exists, keep the most recently updated
        keepVendor = vendors.reduce((newest, current) => {
          const newestUpdated = newest.data.updated || newest.data.created;
          const currentUpdated = current.data.updated || current.data.created;
          return currentUpdated > newestUpdated ? current : newest;
        });
      }
      
      console.log(`✅ Keeping: ${keepVendor.id}`);
      
      // Delete the duplicates
      for (const vendor of vendors) {
        if (vendor.id !== keepVendor.id) {
          console.log(`🗑️  Deleting duplicate: ${vendor.id}`);
          await vendorsRef.doc(vendor.id).delete();
        }
      }
      
      // If the kept vendor doesn't have the custom ID, recreate it
      if (keepVendor.id !== customId) {
        console.log(`🔄 Migrating ${keepVendor.id} to ${customId}`);
        await vendorsRef.doc(customId).set(keepVendor.data);
        await vendorsRef.doc(keepVendor.id).delete();
      }
    }
  }
  
  // Fix categories
  console.log('\n📋 Processing categories...');
  const categoriesRef = db.collection(`clients/${clientId}/categories`);
  const categoriesSnapshot = await categoriesRef.get();
  
  const categoriesByName = new Map();
  
  // Group categories by name
  categoriesSnapshot.forEach(doc => {
    const data = doc.data();
    const name = data.name;
    if (!categoriesByName.has(name)) {
      categoriesByName.set(name, []);
    }
    categoriesByName.get(name).push({ id: doc.id, data });
  });
  
  // Process duplicates
  for (const [name, categories] of categoriesByName) {
    if (categories.length > 1) {
      console.log(`\n⚠️  Found ${categories.length} entries for "${name}"`);
      
      // Determine which one should be kept (prefer custom ID format)
      const customId = generateCategoryId(name);
      let keepCategory = categories.find(c => c.id === customId);
      
      if (!keepCategory) {
        // If no custom ID exists, keep the most recently updated
        keepCategory = categories.reduce((newest, current) => {
          const newestUpdated = newest.data.updated || newest.data.created;
          const currentUpdated = current.data.updated || current.data.created;
          return currentUpdated > newestUpdated ? current : newest;
        });
      }
      
      console.log(`✅ Keeping: ${keepCategory.id}`);
      
      // Delete the duplicates
      for (const category of categories) {
        if (category.id !== keepCategory.id) {
          console.log(`🗑️  Deleting duplicate: ${category.id}`);
          await categoriesRef.doc(category.id).delete();
        }
      }
      
      // If the kept category doesn't have the custom ID, recreate it
      if (keepCategory.id !== customId) {
        console.log(`🔄 Migrating ${keepCategory.id} to ${customId}`);
        await categoriesRef.doc(customId).set(keepCategory.data);
        await categoriesRef.doc(keepCategory.id).delete();
      }
    }
  }
  
  console.log('\n✅ Duplicate cleanup complete!');
}

// Run the fix
fixDuplicateEntries().catch(console.error);