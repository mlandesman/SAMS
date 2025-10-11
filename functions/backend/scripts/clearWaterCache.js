// Simple script to clear water bills cache
console.log('🧹 Clearing water bills cache...');

// Clear sessionStorage cache
if (typeof window !== 'undefined' && window.sessionStorage) {
  const keys = Object.keys(sessionStorage);
  const waterKeys = keys.filter(key => key.startsWith('water_bills_'));
  
  waterKeys.forEach(key => {
    sessionStorage.removeItem(key);
    console.log(`Removed cache key: ${key}`);
  });
  
  console.log(`✅ Cleared ${waterKeys.length} water cache keys`);
} else {
  console.log('⚠️ This script should be run in browser console');
}