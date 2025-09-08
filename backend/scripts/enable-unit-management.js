/**
 * Enable Unit Management for All Clients
 * 
 * This script ensures that all clients have Unit Management enabled in their list configuration.
 * It updates the clients/{clientId}/config/lists document to include unit: true.
 * 
 * Usage: node scripts/enable-unit-management.js
 */

import { getDb } from '../firebase.js';

async function enableUnitManagementForAllClients() {
  try {
    console.log('🔧 Starting Unit Management enablement for all clients...');
    
    const db = await getDb();
    
    // Get all clients
    const clientsSnapshot = await db.collection('clients').get();
    
    if (clientsSnapshot.empty) {
      console.log('📋 No clients found');
      return;
    }
    
    let processedCount = 0;
    let updatedCount = 0;
    let createdCount = 0;
    
    for (const clientDoc of clientsSnapshot.docs) {
      const clientId = clientDoc.id;
      processedCount++;
      
      try {
        console.log(`\n🔍 Processing client: ${clientId}`);
        
        // Get client's list configuration
        const listsConfigRef = db.doc(`clients/${clientId}/config/lists`);
        const listsConfigDoc = await listsConfigRef.get();
        
        if (listsConfigDoc.exists) {
          const currentConfig = listsConfigDoc.data();
          console.log(`📋 Current config:`, currentConfig);
          
          // Check if units is already enabled
          if (currentConfig.unit === true) {
            console.log(`✅ Unit Management already enabled for ${clientId}`);
            continue;
          }
          
          // Update configuration to enable units
          await listsConfigRef.update({
            unit: true,
            updatedAt: new Date(),
            updatedBy: 'enable-unit-management-script'
          });
          
          console.log(`✅ Updated Unit Management for ${clientId}`);
          updatedCount++;
          
        } else {
          // Create new configuration with default lists including units
          const defaultConfig = {
            vendor: true,
            category: true,
            method: true,
            unit: true,
            exchangerates: true,
            createdAt: new Date(),
            createdBy: 'enable-unit-management-script'
          };
          
          await listsConfigRef.set(defaultConfig);
          console.log(`✅ Created new configuration with Unit Management for ${clientId}`);
          createdCount++;
        }
        
      } catch (error) {
        console.error(`❌ Error processing client ${clientId}:`, error);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Clients processed: ${processedCount}`);
    console.log(`   Configurations updated: ${updatedCount}`);
    console.log(`   Configurations created: ${createdCount}`);
    console.log(`\n✅ Unit Management enablement completed successfully!`);
    
  } catch (error) {
    console.error('❌ Error enabling Unit Management:', error);
    process.exit(1);
  }
}

// Run the script
enableUnitManagementForAllClients();