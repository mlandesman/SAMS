/**
 * Emergency script to force clear all mobile app caches
 * Run this in browser console on mobile.sams.sandyland.com.mx
 */

async function forceCleanAllCaches() {
  console.log('🧹 Starting emergency cache cleanup...');
  
  try {
    // 1. Clear service worker caches
    if ('caches' in window) {
      console.log('📦 Clearing service worker caches...');
      const cacheNames = await caches.keys();
      console.log(`Found ${cacheNames.length} caches:`, cacheNames);
      
      const deletePromises = cacheNames.map(async (cacheName) => {
        console.log(`🗑️ Deleting cache: ${cacheName}`);
        return caches.delete(cacheName);
      });
      
      await Promise.all(deletePromises);
      console.log('✅ All service worker caches cleared');
    }
    
    // 2. Unregister service worker
    if ('serviceWorker' in navigator) {
      console.log('🔧 Unregistering service workers...');
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log(`Found ${registrations.length} service worker registrations`);
      
      for (let registration of registrations) {
        console.log('🗑️ Unregistering:', registration.scope);
        await registration.unregister();
      }
      console.log('✅ All service workers unregistered');
    }
    
    // 3. Clear localStorage
    console.log('🗄️ Clearing localStorage...');
    localStorage.clear();
    console.log('✅ localStorage cleared');
    
    // 4. Clear sessionStorage
    console.log('📝 Clearing sessionStorage...');
    sessionStorage.clear();
    console.log('✅ sessionStorage cleared');
    
    // 5. Clear IndexedDB
    if ('indexedDB' in window) {
      console.log('🗃️ Attempting to clear IndexedDB...');
      try {
        // This is a best effort - some apps have protected IndexedDB
        const dbs = await indexedDB.databases();
        for (const db of dbs) {
          if (db.name) {
            console.log(`🗑️ Deleting IndexedDB: ${db.name}`);
            indexedDB.deleteDatabase(db.name);
          }
        }
        console.log('✅ IndexedDB cleanup attempted');
      } catch (e) {
        console.warn('⚠️ IndexedDB cleanup failed:', e.message);
      }
    }
    
    console.log('🎉 Emergency cache cleanup complete!');
    console.log('📱 Please refresh the page or restart the app');
    
    // Return success object
    return {
      success: true,
      message: 'All caches cleared successfully. Please refresh the page.',
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('💥 Emergency cache cleanup failed:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Auto-run and provide global access
console.log('🚀 Emergency cache cleanup script loaded');
console.log('💡 Run forceCleanAllCaches() to clear all caches');

// Make function globally available
window.forceCleanAllCaches = forceCleanAllCaches;

// Show instructions
console.log(`
🔧 EMERGENCY CACHE CLEANUP INSTRUCTIONS:

1. Copy this entire script
2. Open Developer Tools (F12) on mobile.sams.sandyland.com.mx
3. Go to Console tab
4. Paste and press Enter
5. Run: forceCleanAllCaches()
6. Wait for completion message
7. Refresh the page (Ctrl+F5 or Cmd+Shift+R)

This will completely clear all caches, service workers, and storage.
`);