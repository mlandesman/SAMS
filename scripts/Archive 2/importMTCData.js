const { createUnit } = require('../backend/controllers/units');
const { getDb } = require('../src/firebase');
const unitsData = require('../MTCdata/Units.json');
const sizesData = require('../MTCdata/UnitSizes.json');

async function importUnitsForMTC() {
  const clientId = 'MTC';
  const db = getDb();

  const sizeMap = {};
  for (const size of sizesData) {
    if (size.UnitID) {
      sizeMap[size.UnitID.trim()] = {
        squareMeters: parseFloat(size['m² ']) || 0,
        squareFeet: parseFloat(size['ft² ']) || 0,
        ownershipPercentFromSize: parseFloat(size['%']) || 0,
      };
    }
  }

  for (const unit of unitsData) {
    const unitId = unit.UnitID.trim();
    const unitName = unit.UnitID.trim();
    const owner = unit.Owner.trim();
    const email = unit.eMail.trim();
    const duesAmount = parseFloat(unit.Dues) || 0;
    const sizeInfo = sizeMap[unitId] || {};

    const unitData = {
      unitId,
      unitName,
      owners: [owner],
      emails: email ? [email] : [],
      duesAmount,
      percentOwned: sizeInfo.ownershipPercentFromSize || 0,
      squareMeters: sizeInfo.squareMeters || 0,
      squareFeet: sizeInfo.squareFeet || 0,
      type: ['Condo'],
      active: true,
      accessCode: '',
    };

    await createUnit(clientId, unitData, unitId);
    console.log(`✅ Imported unit: ${unitId}`);
  }

  console.log('🏠 Finished importing units for MTC.');
}

importUnitsForMTC().catch((err) => {
  console.error('❌ Error importing units:', err);
});