import { getDb } from '../firebase.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { getNow } from '../services/DateService.js';

const db = await getDb();
const clientsCollection = db.collection('clients');

// Create a new client
async function createClient(data) {
  try {
    const docRef = await clientsCollection.add({
      ...data,
      accounts: data.accounts || [], // Initialize accounts array
      createdAt: getNow(),
    });

    const auditSuccess = await writeAuditLog({
      module: 'clients',
      action: 'create',
      parentPath: `clients/${docRef.id}`,
      docId: docRef.id,
      friendlyName: data.fullName || data.name || 'Unnamed Client',
      notes: 'Created new client record',
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for createClient.');
    }

    return docRef.id;
  } catch (error) {
    console.error('❌ Error creating client:', error);
    return null;
  }
}

// Update an existing client
async function updateClient(clientId, newData) {
  try {
    const clientRef = clientsCollection.doc(clientId);
    await clientRef.update({
      ...newData,
      updatedAt: getNow(),
    });

    const auditSuccess = await writeAuditLog({
      module: 'clients',
      action: 'update',
      parentPath: `clients/${clientId}`,
      docId: clientId,
      friendlyName: newData.fullName || newData.name || 'Unnamed Client',
      notes: 'Updated client record',
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for updateClient.');
    }

    return true;
  } catch (error) {
    console.error('❌ Error updating client:', error);
    return false;
  }
}

// Delete a client
async function deleteClient(clientId) {
  try {
    const clientRef = clientsCollection.doc(clientId);
    await clientRef.delete();

    const auditSuccess = await writeAuditLog({
      module: 'clients',
      action: 'delete',
      parentPath: `clients/${clientId}`,
      docId: clientId,
      friendlyName: '',
      notes: 'Deleted client record',
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for deleteClient.');
    }

    return true;
  } catch (error) {
    console.error('❌ Error deleting client:', error);
    return false;
  }
}

// List all clients (INSECURE - deprecated)
async function listClients() {
  try {
    const snapshot = await clientsCollection.get();
    const clients = [];

    snapshot.forEach(doc => {
      clients.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return clients;
  } catch (error) {
    console.error('❌ Error listing clients:', error);
    return [];
  }
}

// List clients accessible to authenticated user (SECURE)
async function listAuthorizedClients(req, res) {
  try {
    const { user } = req;
    
    // SuperAdmin can see all clients
    if (user.isSuperAdmin()) {
      const snapshot = await clientsCollection.get();
      const clients = [];
      
      snapshot.forEach(doc => {
        clients.push({
          id: doc.id,
          ...doc.data(),
        });
      });
      
      console.log(`✅ SuperAdmin ${user.email} fetched ${clients.length} clients`);
      return res.json(clients);
    }
    
    // Regular users can only see clients they have access to
    const authorizedClients = [];
    const propertyAccess = user.samsProfile?.propertyAccess || {};
    
    // Only fetch clients the user has access to
    for (const clientId of Object.keys(propertyAccess)) {
      try {
        const clientDoc = await clientsCollection.doc(clientId).get();
        if (clientDoc.exists) {
          authorizedClients.push({
            id: clientId,
            ...clientDoc.data(),
          });
        }
      } catch (error) {
        console.error(`Error fetching client ${clientId}:`, error);
      }
    }
    
    console.log(`✅ User ${user.email} fetched ${authorizedClients.length} authorized clients`);
    return res.json(authorizedClients);
    
  } catch (error) {
    console.error('❌ Error listing authorized clients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Get a specific client by ID (SECURE)
async function getClient(req, res) {
  try {
    const clientId = req.params.id;
    const { user } = req;
    
    console.log(`🔍 Attempting to retrieve client: ${clientId} for user: ${user?.email}`);

    // Validate client access (unless SuperAdmin)
    // Note: Middleware uses hasPropertyAccess/getPropertyAccess (not hasClientAccess)
    if (!user?.isSuperAdmin() && !user?.hasPropertyAccess?.(clientId)) {
      console.warn(`🚫 Access denied: ${user?.email} attempted to access client ${clientId}`);
      return res.status(404).json({ error: 'Not found' }); // Generic error - don't reveal if client exists
    }

    const clientRef = clientsCollection.doc(clientId);
    const doc = await clientRef.get();

    if (!doc.exists) {
      console.log(`Client with ID: ${clientId} not found`);
      return res.status(404).json({ error: 'Not found' });
    }

    // Get the client data and explicitly add the document ID as an id field
    const client = {
      id: clientId,
      ...doc.data()
    };
    
    // DEBUG: Log what we're sending
    console.log(`✅ Client data retrieved successfully for ${user?.email}: ${clientId}`);
    console.log('🔍 Client configuration being sent:', client.configuration);
    console.log('🔍 Fiscal year start month:', client.configuration?.fiscalYearStartMonth);
    
    res.status(200).json(client);
  } catch (error) {
    console.error('❌ Error getting client:', error);
    return res.status(404).json({ error: 'Not found' }); // Generic error
  }
}

// CLIENT MANAGEMENT ADDITIONS: SuperAdmin-only functions
import { 
  createClientFromTemplate as templateCreateClient, 
  validateClientData, 
  updateClientWithMetadata as templateUpdateClient,
  validateClientIdFormat 
} from '../templates/clientTemplates.js';

// Create client using template system (SuperAdmin only)
async function createClientWithTemplate(clientData, creatorUserId) {
  try {
    // Validate data first
    const validation = validateClientData(clientData);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Create client using template
    const newClient = templateCreateClient(clientData, creatorUserId);
    
    // Use user-provided Client ID as document key  
    const clientId = newClient.basicInfo.clientId;
    if (!clientId) {
      throw new Error('Client ID is required - must be provided in basicInfo.clientId field');
    }

    // Check if client ID already exists
    const existingClient = await clientsCollection.doc(clientId).get();
    if (existingClient.exists) {
      throw new Error(`Client ID '${clientId}' already exists. Please choose a different ID.`);
    }
    
    // Save to Firestore
    await clientsCollection.doc(clientId).set(newClient);
    
    const auditSuccess = await writeAuditLog({
      module: 'client_management',
      action: 'create_from_template',
      parentPath: `clients/${clientId}`,
      docId: clientId,
      friendlyName: newClient.basicInfo.fullName,
      notes: 'Created client using template system',
      userId: creatorUserId
    });
    
    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for createClientWithTemplate.');
    }
    
    return {
      success: true,
      clientId,
      data: newClient
    };
  } catch (error) {
    console.error('❌ Error creating client from template:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Update client with metadata tracking (SuperAdmin only)
async function updateClientWithTemplate(clientId, updates, updaterUserId) {
  try {
    // Validate updates
    const validation = validateClientData(updates);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    
    const clientRef = clientsCollection.doc(clientId);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      throw new Error('Client not found');
    }
    
    const existingClient = clientDoc.data();
    const updatedClient = templateUpdateClient(existingClient, updates, updaterUserId);
    
    await clientRef.set(updatedClient);
    
    const auditSuccess = await writeAuditLog({
      module: 'client_management',
      action: 'update_with_template',
      parentPath: `clients/${clientId}`,
      docId: clientId,
      friendlyName: updatedClient.basicInfo?.fullName || 'Unnamed Client',
      notes: 'Updated client using template system',
      userId: updaterUserId
    });
    
    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for updateClientWithTemplate.');
    }
    
    return {
      success: true,
      data: updatedClient
    };
  } catch (error) {
    console.error('❌ Error updating client with template:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export {
  createClient,
  updateClient,
  deleteClient,
  listClients,
  listAuthorizedClients,
  getClient,
  createClientWithTemplate,
  updateClientWithTemplate,
};