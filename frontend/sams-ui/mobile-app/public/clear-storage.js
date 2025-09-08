// Logout utility script
console.log('Clearing browser storage and Firebase auth...');

// Clear localStorage
localStorage.clear();

// Clear sessionStorage  
sessionStorage.clear();

// Clear IndexedDB (Firebase uses this)
if ('indexedDB' in window) {
  indexedDB.deleteDatabase('firebaseLocalStorageDb');
}

console.log('✅ Storage cleared. Please refresh the page.');
