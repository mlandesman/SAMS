// PWA Cache Clear Utility for SAMS
// This script can be run in the browser console to force clear all caches

(function() {
  console.log('🧹 Starting SAMS cache clear process...');
  
  // Clear all caches
  if ('caches' in window) {
    caches.keys().then(function(names) {
      console.log(`Found ${names.length} cache(s) to clear:`, names);
      return Promise.all(names.map(function(name) {
        return caches.delete(name);
      }));
    }).then(function() {
      console.log('✅ All caches cleared successfully');
    });
  }
  
  // Unregister all service workers
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      console.log(`Found ${registrations.length} service worker(s) to unregister`);
      for(let registration of registrations) {
        registration.unregister().then(function(success) {
          if (success) {
            console.log('✅ Service worker unregistered');
          }
        });
      }
    });
  }
  
  // Clear localStorage and sessionStorage
  try {
    localStorage.clear();
    sessionStorage.clear();
    console.log('✅ Local and session storage cleared');
  } catch(e) {
    console.warn('⚠️ Could not clear storage:', e);
  }
  
  // Force reload
  setTimeout(function() {
    console.log('🔄 Reloading page in 2 seconds...');
    setTimeout(function() {
      window.location.reload(true);
    }, 2000);
  }, 1000);
})();