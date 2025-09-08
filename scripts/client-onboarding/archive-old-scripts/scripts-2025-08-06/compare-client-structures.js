import { initializeFirebase } from './utils/environment-config.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase
const { db } = await initializeFirebase();

async function compareClientStructures(clientId1, clientId2) {
  try {
    console.log(`🔍 Comparing structures: ${clientId1} vs ${clientId2}\n`);
    
    // Get both client documents
    const [client1Doc, client2Doc] = await Promise.all([
      db.collection('clients').doc(clientId1).get(),
      db.collection('clients').doc(clientId2).get()
    ]);
    
    if (!client1Doc.exists || !client2Doc.exists) {
      throw new Error('One or both clients not found');
    }
    
    const client1Data = client1Doc.data();
    const client2Data = client2Doc.data();
    
    // Compare structures
    const differences = {
      missingInClient2: [],
      missingInClient1: [],
      typeMismatches: [],
      structuralDifferences: []
    };
    
    // Deep comparison function
    function compareObjects(obj1, obj2, path = '') {
      // Check fields in obj1
      for (let key in obj1) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (!(key in obj2)) {
          differences.missingInClient2.push(currentPath);
        } else if (typeof obj1[key] !== typeof obj2[key]) {
          differences.typeMismatches.push({
            path: currentPath,
            type1: typeof obj1[key],
            type2: typeof obj2[key]
          });
        } else if (typeof obj1[key] === 'object' && obj1[key] !== null) {
          compareObjects(obj1[key], obj2[key], currentPath);
        }
      }
      
      // Check fields in obj2 that aren't in obj1
      for (let key in obj2) {
        const currentPath = path ? `${path}.${key}` : key;
        if (!(key in obj1)) {
          differences.missingInClient1.push(currentPath);
        }
      }
    }
    
    compareObjects(client1Data, client2Data);
    
    // Check config subcollections
    console.log('📂 Comparing config subcollections...\n');
    
    const [config1Docs, config2Docs] = await Promise.all([
      db.collection('clients').doc(clientId1).collection('config').get(),
      db.collection('clients').doc(clientId2).collection('config').get()
    ]);
    
    const config1Names = config1Docs.docs.map(doc => doc.id);
    const config2Names = config2Docs.docs.map(doc => doc.id);
    
    const missingConfig2 = config1Names.filter(name => !config2Names.includes(name));
    const missingConfig1 = config2Names.filter(name => !config1Names.includes(name));
    
    // Print results
    console.log('📊 COMPARISON RESULTS:\n');
    
    if (differences.missingInClient2.length > 0) {
      console.log(`❌ Fields in ${clientId1} missing from ${clientId2}:`);
      differences.missingInClient2.forEach(field => console.log(`   - ${field}`));
      console.log();
    }
    
    if (differences.missingInClient1.length > 0) {
      console.log(`❌ Fields in ${clientId2} missing from ${clientId1}:`);
      differences.missingInClient1.forEach(field => console.log(`   - ${field}`));
      console.log();
    }
    
    if (differences.typeMismatches.length > 0) {
      console.log('⚠️  Type mismatches:');
      differences.typeMismatches.forEach(mismatch => {
        console.log(`   - ${mismatch.path}: ${mismatch.type1} vs ${mismatch.type2}`);
      });
      console.log();
    }
    
    if (missingConfig2.length > 0) {
      console.log(`❌ Config documents in ${clientId1} missing from ${clientId2}:`);
      missingConfig2.forEach(doc => console.log(`   - config/${doc}`));
      console.log();
    }
    
    if (missingConfig1.length > 0) {
      console.log(`❌ Config documents in ${clientId2} missing from ${clientId1}:`);
      missingConfig1.forEach(doc => console.log(`   - config/${doc}`));
      console.log();
    }
    
    // Save detailed report
    const report = {
      comparison: `${clientId1} vs ${clientId2}`,
      timestamp: new Date().toISOString(),
      differences,
      configDifferences: {
        [`missingFrom${clientId2}`]: missingConfig2,
        [`missingFrom${clientId1}`]: missingConfig1
      }
    };
    
    const reportPath = path.join(__dirname, `comparison-${clientId1}-vs-${clientId2}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ Error comparing structures:', error);
    process.exit(1);
  }
}

// Run if called directly
const clientId1 = process.argv[2] || 'MTC';
const clientId2 = process.argv[3] || 'AVII';

compareClientStructures(clientId1, clientId2)
  .then(() => {
    console.log('\n✅ Comparison complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed:', error);
    process.exit(1);
  });

export { compareClientStructures };