/**
 * Test Logo Accessibility
 * Verifies that client logos can be accessed publicly
 * 
 * Usage: node testLogoAccess.js [clientId]
 */

import { getApp } from '../firebase.js';
import { getDb } from '../firebase.js';
import { getResizedImage } from '../services/imageResizeService.js';

async function testLogoAccess(clientId = 'AVII') {
  console.log(`\n🧪 Testing Logo Access for Client: ${clientId}\n`);
  console.log('='.repeat(60));
  
  try {
    // Get client data
    const db = await getDb();
    const clientDoc = await db.collection('clients').doc(clientId).get();
    
    if (!clientDoc.exists) {
      console.error(`❌ Client not found: ${clientId}`);
      process.exit(1);
    }
    
    const clientData = clientDoc.data();
    const originalLogoUrl = clientData.logoUrl || clientData.branding?.logoUrl || null;
    
    if (!originalLogoUrl) {
      console.error(`❌ No logo URL found for client: ${clientId}`);
      console.log('   Client data keys:', Object.keys(clientData));
      if (clientData.branding) {
        console.log('   Branding keys:', Object.keys(clientData.branding));
      }
      process.exit(1);
    }
    
    console.log(`\n📋 Original Logo URL:`);
    console.log(`   ${originalLogoUrl}`);
    
    // Test 1: Check if original logo is accessible
    console.log(`\n🔍 Test 1: Checking original logo accessibility...`);
    try {
      const response = await fetch(originalLogoUrl, { method: 'HEAD' });
      if (response.ok) {
        console.log(`   ✅ Original logo is accessible (${response.status})`);
        console.log(`   Content-Type: ${response.headers.get('content-type')}`);
      } else {
        console.log(`   ❌ Original logo returned ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.log(`   ❌ Failed to access original logo: ${error.message}`);
    }
    
    // Test 2: Try to resize and get email-sized logo
    console.log(`\n🔍 Test 2: Resizing logo for email...`);
    try {
      const resizedUrl = await getResizedImage(originalLogoUrl, clientId, 'email');
      console.log(`   ✅ Resized logo URL generated:`);
      console.log(`   ${resizedUrl}`);
      
      // Test 3: Check if resized logo is accessible
      console.log(`\n🔍 Test 3: Checking resized logo accessibility...`);
      const resizedResponse = await fetch(resizedUrl, { method: 'HEAD' });
      if (resizedResponse.ok) {
        console.log(`   ✅ Resized logo is accessible (${resizedResponse.status})`);
        console.log(`   Content-Type: ${resizedResponse.headers.get('content-type')}`);
        console.log(`   Content-Length: ${resizedResponse.headers.get('content-length')} bytes`);
        
        // Try a full GET to verify it's actually an image
        const fullResponse = await fetch(resizedUrl);
        if (fullResponse.ok) {
          const buffer = await fullResponse.arrayBuffer();
          console.log(`   ✅ Successfully downloaded ${buffer.byteLength} bytes`);
          console.log(`\n✅ ALL TESTS PASSED - Logo is accessible!\n`);
        } else {
          console.log(`   ❌ Full GET failed: ${fullResponse.status}`);
        }
      } else {
        console.log(`   ❌ Resized logo returned ${resizedResponse.status}: ${resizedResponse.statusText}`);
        const errorText = await resizedResponse.text();
        console.log(`   Error details: ${errorText.substring(0, 200)}`);
      }
    } catch (error) {
      console.log(`   ❌ Failed to resize logo: ${error.message}`);
      console.log(`   Stack: ${error.stack}`);
    }
    
  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    process.exit(1);
  }
}

// Run test
const clientId = process.argv[2] || 'AVII';
testLogoAccess(clientId)
  .then(() => {
    console.log('\n✅ Test complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
