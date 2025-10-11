import { listUnits } from '../controllers/unitsController.js';

async function inspectUnitData() {
  console.log('Inspecting unit data structure...\n');
  
  const units = await listUnits('AVII');
  
  if (units.length > 0) {
    console.log('Sample unit (first unit):');
    console.log(JSON.stringify(units[0], null, 2));
    
    console.log('\n\nAll unit IDs and their owner-related fields:');
    units.forEach(unit => {
      console.log(`\nUnit ${unit.unitId}:`);
      console.log('  owners:', unit.owners);
      console.log('  owner:', unit.owner);
      console.log('  ownerLastName:', unit.ownerLastName);
      console.log('  ownerFirstName:', unit.ownerFirstName);
      
      // Check if owners is an array with objects
      if (Array.isArray(unit.owners) && unit.owners.length > 0) {
        console.log('  First owner in array:', unit.owners[0]);
      }
    });
  }
}

inspectUnitData().catch(console.error);