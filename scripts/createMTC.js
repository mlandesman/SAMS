// scripts/createMtcClient.js
const { getDb } = require('../src/firebase');
const db = getDb();

async function createMtcClient() {
  const clientId = 'MTC'; // Human-friendly ID
  
  const clientData = {
    fullName: 'MTC',
    notes: 'Marina Turquesa Condominiums',
    email: 'michael@sandyland.com.mx',
    phone: '+52 984-178-0331',
    address: 'M20 L12 Privada Xel-há, Puerto Aventuras, QR 77733 México',
    iconUrl: 'https://firebasestorage.googleapis.com/v0/b/sandyland-management-system.firebasestorage.app/o/icons%2FMTC%20ICON.png?alt=media&token=6b6006a4-6d8d-4512-9bc1-c08dc1a6acde',
    logoUrl: 'https://firebasestorage.googleapis.com/v0/b/sandyland-management-system.firebasestorage.app/o/logos%2Fmarina-turquesa-condos-high-resolution-logo-transparent.png?alt=media&token=11363e40-3bb3-4a92-ab4a-90b9c101157b',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  try {
    const clientRef = db.collection('clients').doc(clientId);
    const existing = await clientRef.get();

    if (existing.exists) {
      console.error(`❌ Client ID '${clientId}' already exists. Not overwriting.`);
      return;
    }

    await clientRef.set(clientData);
    console.log(`✅ MTC client successfully created.`);
  } catch (error) {
    console.error('❌ Error creating MTC client:', error);
  }
}

createMtcClient();