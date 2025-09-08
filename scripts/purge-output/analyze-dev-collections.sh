#!/bin/bash
# Analyze Dev Firestore Collections
# Task: PURGE-DEV-DATA-001

echo "=== DEV FIRESTORE COLLECTION ANALYSIS ==="
echo ""

# Check current project
echo "Current Firebase project:"
firebase use
echo ""

# CRITICAL: Ensure we're not in production
current_project=$(firebase use | grep -oE 'sams-[a-zA-Z-]+' || echo "unknown")
if [[ "$current_project" == *"prod"* ]]; then
    echo "⚠️  ERROR: You are currently in PRODUCTION project!"
    echo "⚠️  Switch to dev with: firebase use sandyland-management-dev"
    exit 1
fi

echo "Switching to dev project..."
firebase use sandyland-management-dev 2>/dev/null || {
    echo "❌ Failed to switch to dev project"
    echo "Available projects:"
    firebase projects:list
    exit 1
}

echo ""
echo "=== COLLECTION DISCOVERY ==="
echo ""
echo "Note: Firebase CLI doesn't support listing collections directly."
echo "We'll use the Firestore emulator or Admin SDK for complete discovery."
echo ""

# Create a simple Node.js script to analyze collections
cat > temp-analyze.cjs << 'EOF'
const admin = require('firebase-admin');
const serviceAccount = require('../backend/serviceAccountKey.json');

// Initialize with dev project override
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'sandyland-management-dev'
});

const db = admin.firestore();

async function analyzeCollections() {
  console.log('Attempting to connect to Dev Firestore...\n');
  
  try {
    // Test connection
    const collections = await db.listCollections();
    console.log(`Found ${collections.length} root collections:\n`);
    
    for (const col of collections) {
      const snapshot = await col.count().get();
      const count = snapshot.data().count;
      console.log(`- /${col.id}: ${count} documents`);
      
      // Special handling for clients collection
      if (col.id === 'clients') {
        const mtcDoc = await col.doc('MTC').get();
        if (mtcDoc.exists) {
          console.log('  └── MTC client exists');
          const mtcCollections = await mtcDoc.ref.listCollections();
          for (const subCol of mtcCollections) {
            const subSnapshot = await subCol.count().get();
            const subCount = subSnapshot.data().count;
            console.log(`      └── ${subCol.id}: ${subCount} documents`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\nThis may indicate:');
    console.log('1. No dev service account available');
    console.log('2. Cross-project access restrictions');
    console.log('3. Dev environment not properly configured');
  }
  
  process.exit();
}

analyzeCollections();
EOF

echo "Running collection analysis..."
node temp-analyze.cjs 2>&1 || {
    echo ""
    echo "⚠️  Direct analysis failed. This is expected if we don't have dev credentials."
    echo ""
    echo "Alternative approach: Use Firebase Console"
    echo "1. Visit: https://console.firebase.google.com"
    echo "2. Select project: sandyland-management-dev"
    echo "3. Navigate to Firestore Database"
    echo "4. Manually verify collections before purging"
}

# Cleanup
rm -f temp-analyze.cjs

echo ""
echo "=== NEXT STEPS ==="
echo "1. Ensure you're in the dev project: firebase use sandyland-management-dev"
echo "2. Verify collections in Firebase Console"
echo "3. Run the purge script only after confirmation"