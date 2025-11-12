/**
 * Add Reports activity to client menu configuration
 * Updates both AVII and MTC clients' menu configs to include Reports
 */

import { getDb } from '../firebase.js';

async function addReportsToMenu() {
  try {
    const db = await getDb();
    const clients = ['AVII', 'MTC'];
    
    for (const clientId of clients) {
      console.log(`\n📋 Updating menu configuration for client: ${clientId}`);
      
      // Get current menu config
      const configRef = db.collection('clients').doc(clientId).collection('config').doc('activities');
      const configSnapshot = await configRef.get();
      
      if (!configSnapshot.exists) {
        console.log(`⚠️  Menu configuration document does not exist for ${clientId}, creating it...`);
        
        // Create default menu with Reports
        const defaultMenuItems = [
          { label: "Dashboard", activity: "Dashboard" },
          { label: "Transactions", activity: "Transactions" },
          { label: "HOA Dues", activity: "HOADues" },
          { label: "Projects", activity: "Projects" },
          { label: "Budgets", activity: "Budgets" },
          { label: "List Management", activity: "ListManagement" },
          { label: "Reports", activity: "Reports" },
          { label: "Settings", activity: "Settings" },
          { label: "Water Bills", activity: "WaterBills" }
        ];
        
        await configRef.set({
          menu: defaultMenuItems,
          updatedAt: new Date(),
          updatedBy: 'add-reports-script'
        });
        
        console.log(`✅ Created menu configuration with Reports for ${clientId}`);
        continue;
      }
      
      const configData = configSnapshot.data();
      let menuItems = configData.menu || [];
      
      // Check if Reports is already in the menu
      const hasReports = menuItems.some(item => 
        item.activity?.toLowerCase() === 'reports' || 
        item.label?.toLowerCase() === 'reports'
      );
      
      if (hasReports) {
        console.log(`✅ Reports already exists in menu configuration for ${clientId}`);
      } else {
        // Add Reports to the menu
        // Position it after "List Management" and before "Settings" if Settings exists
        const settingsIndex = menuItems.findIndex(item => 
          item.activity?.toLowerCase() === 'settings'
        );
        
        const reportsMenuItem = {
          activity: 'Reports',
          label: 'Reports'
        };
        
        if (settingsIndex !== -1) {
          // Insert before Settings
          menuItems.splice(settingsIndex, 0, reportsMenuItem);
          console.log(`✅ Added Reports before Settings for ${clientId}`);
        } else {
          // Add after List Management if it exists, otherwise at the end
          const listMgmtIndex = menuItems.findIndex(item => 
            item.activity?.toLowerCase() === 'listmanagement' ||
            item.label?.toLowerCase() === 'list management'
          );
          
          if (listMgmtIndex !== -1) {
            menuItems.splice(listMgmtIndex + 1, 0, reportsMenuItem);
            console.log(`✅ Added Reports after List Management for ${clientId}`);
          } else {
            menuItems.push(reportsMenuItem);
            console.log(`✅ Added Reports to end of menu for ${clientId}`);
          }
        }
        
        // Update the menu configuration
        await configRef.update({
          menu: menuItems,
          updatedAt: new Date(),
          updatedBy: 'add-reports-script'
        });
        
        console.log(`✅ Successfully added Reports to menu for ${clientId}`);
      }
      
      // Display current menu
      console.log(`\n📋 Current menu for ${clientId}:`);
      menuItems.forEach((item, index) => {
        const marker = item.activity?.toLowerCase() === 'reports' ? ' ⭐' : '';
        console.log(`   ${index + 1}. ${item.label} (${item.activity})${marker}`);
      });
    }
    
    console.log('\n✅ Script completed successfully!');
    console.log('\n💡 Note: Refresh your browser to see the Reports menu item in the sidebar.');
    
  } catch (error) {
    console.error('❌ Error updating menu configuration:', error);
    throw error;
  }
}

// Run the script
(async () => {
  try {
    await addReportsToMenu();
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
})();

