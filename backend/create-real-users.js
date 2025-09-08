// Create a real user for testing authentication
import { getDb } from './firebase.js';

const createRealUser = async () => {
  console.log('👤 Creating real user for authentication testing...');
  
  try {
    const db = await getDb();
    
    // Create a user with the email we use for testing
    const userId = 'real-user-michael'; // In real app, this would be Firebase UID
    const realUser = {
      email: 'michael@landesman.com',
      name: 'Michael Landesman',
      phone: '+1-555-0123',
      clientAccess: {
        "MTC": { role: "admin", unitId: null },
        "CV": { role: "admin", unitId: null }
      },
      globalRole: "admin",
      preferredClient: "MTC",
      notifications: {
        email: true,
        sms: false,
        duesReminders: true
      },
      createdAt: new Date(),
      lastLogin: new Date(),
      lastProfileUpdate: new Date()
    };
    
    await db.collection('users').doc(userId).set(realUser);
    console.log('✅ Real user created successfully');
    console.log('📄 User data:', JSON.stringify(realUser, null, 2));
    
    // Create a second test user with unit owner role
    const unitOwnerId = 'unit-owner-test';
    const unitOwnerUser = {
      email: 'owner@example.com',
      name: 'John Smith',
      phone: '+1-555-0456',
      clientAccess: {
        "MTC": { role: "unitOwner", unitId: "1A" }
      },
      globalRole: "user",
      preferredClient: "MTC",
      notifications: {
        email: true,
        sms: true,
        duesReminders: true
      },
      createdAt: new Date(),
      lastLogin: new Date(),
      lastProfileUpdate: new Date()
    };
    
    await db.collection('users').doc(unitOwnerId).set(unitOwnerUser);
    console.log('✅ Unit owner test user created successfully');
    
    // List all users
    console.log('\n👥 All users in system:');
    const allUsers = await db.collection('users').get();
    allUsers.forEach((doc) => {
      const userData = doc.data();
      console.log(`   📝 ${doc.id}: ${userData.email} (${userData.globalRole})`);
    });
    
  } catch (error) {
    console.error('❌ Error creating real user:', error);
  }
};

createRealUser();
