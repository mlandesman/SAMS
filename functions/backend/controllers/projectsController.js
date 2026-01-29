/**
 * Projects Controller
 * 
 * Handles CRUD operations for special assessment projects.
 * Projects are stored at: clients/{clientId}/projects/{projectId}
 * 
 * Note: This controller handles "special-assessment" type projects, NOT
 * project types like waterBills or propaneTanks which are structural documents.
 */

import { getDb } from '../firebase.js';
import { writeAuditLog } from '../utils/auditLogger.js';

// Documents to exclude from project listings (structural, not projects)
const EXCLUDED_PROJECT_IDS = ['waterBills', 'propaneTanks'];

// Known project types that should be handled by projectsDataController
const KNOWN_PROJECT_TYPES = ['waterBills', 'propaneTanks'];

/**
 * Check if a project document is a valid project (not structural)
 * @param {Object} doc - Firestore document
 * @returns {boolean} True if this is a valid project
 */
function isValidProject(doc) {
  const id = doc.id;
  const data = doc.data();
  
  // Exclude known structural document IDs
  if (EXCLUDED_PROJECT_IDS.includes(id)) {
    return false;
  }
  
  // Must have a 'type' field to be considered a project
  if (!data.type) {
    return false;
  }
  
  return true;
}

/**
 * List all projects for a client, optionally filtered by fiscal year
 * @param {string} clientId - The client ID
 * @param {number|null} fiscalYear - Optional year to filter by (based on startDate)
 * @returns {Promise<Array>} Array of project objects
 */
export async function listProjects(clientId, fiscalYear = null) {
  const db = await getDb();
  
  const projectsRef = db.collection(`clients/${clientId}/projects`);
  const snapshot = await projectsRef.get();
  
  const projects = [];
  
  snapshot.forEach(doc => {
    if (isValidProject(doc)) {
      const data = doc.data();
      const project = {
        projectId: doc.id,
        ...data
      };
      
      // Filter by year if specified (based on startDate)
      if (fiscalYear !== null) {
        if (data.startDate) {
          const projectYear = parseInt(data.startDate.substring(0, 4), 10);
          if (projectYear !== fiscalYear) {
            return; // Skip this project
          }
        } else {
          return; // No startDate, skip when filtering by year
        }
      }
      
      projects.push(project);
    }
  });
  
  // Sort by startDate descending (most recent first)
  projects.sort((a, b) => {
    const dateA = a.startDate || '';
    const dateB = b.startDate || '';
    return dateB.localeCompare(dateA);
  });
  
  return projects;
}

/**
 * Get a single project with full data
 * @param {string} clientId - The client ID
 * @param {string} projectId - The project ID
 * @returns {Promise<Object|null>} Project object or null if not found/excluded
 */
export async function getProject(clientId, projectId) {
  // Return null for excluded IDs
  if (EXCLUDED_PROJECT_IDS.includes(projectId)) {
    return null;
  }
  
  const db = await getDb();
  
  const docRef = db.doc(`clients/${clientId}/projects/${projectId}`);
  const doc = await docRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  const data = doc.data();
  
  // Must have a 'type' field to be considered a valid project
  if (!data.type) {
    return null;
  }
  
  return {
    projectId: doc.id,
    ...data
  };
}

/**
 * Express route handler: List all projects for a client
 * GET /api/clients/:clientId/projects
 * Query params:
 *   - year: Optional fiscal year filter
 */
export async function listProjectsHandler(req, res) {
  try {
    const { clientId } = req.params;
    const { year } = req.query;
    
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'Client ID is required'
      });
    }
    
    const fiscalYear = year ? parseInt(year, 10) : null;
    
    if (year && isNaN(fiscalYear)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid year parameter'
      });
    }
    
    console.log(`📋 Fetching projects for client: ${clientId}${fiscalYear ? ` (year: ${fiscalYear})` : ''}`);
    
    const projects = await listProjects(clientId, fiscalYear);
    
    console.log(`✅ Found ${projects.length} projects`);
    
    return res.json({
      success: true,
      count: projects.length,
      data: projects
    });
    
  } catch (error) {
    console.error('❌ Error listing projects:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Express route handler: Get a single project
 * GET /api/clients/:clientId/projects/:projectId
 * 
 * Note: If projectId matches a known project type (waterBills, etc),
 * this handler calls next() to let the projectsDataController handle it.
 */
export async function getProjectHandler(req, res, next) {
  try {
    const { clientId, projectId } = req.params;
    
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'Client ID is required'
      });
    }
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID is required'
      });
    }
    
    // If this matches a known project type, let the next handler (projectsDataController) handle it
    if (KNOWN_PROJECT_TYPES.includes(projectId)) {
      console.log(`ℹ️ Project type ${projectId} - forwarding to projectsDataController`);
      return next();
    }
    
    console.log(`📋 Fetching project ${projectId} for client: ${clientId}`);
    
    const project = await getProject(clientId, projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    
    console.log(`✅ Found project: ${project.name}`);
    
    return res.json({
      success: true,
      data: project
    });
    
  } catch (error) {
    console.error('❌ Error getting project:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Create a new project
 * @param {string} clientId - The client ID
 * @param {Object} projectData - The project data
 * @returns {Promise<Object>} Created project object
 */
export async function createProject(clientId, projectData) {
  const db = await getDb();
  
  const projectId = projectData.projectId;
  if (!projectId) {
    throw new Error('Project ID is required');
  }
  
  // Check for excluded IDs
  if (EXCLUDED_PROJECT_IDS.includes(projectId)) {
    throw new Error('Invalid project ID - reserved for system use');
  }
  
  const docRef = db.doc(`clients/${clientId}/projects/${projectId}`);
  
  // Check if project already exists
  const existing = await docRef.get();
  if (existing.exists) {
    throw new Error('Project with this ID already exists');
  }
  
  // Ensure required fields
  const project = {
    _id: projectId,
    projectId: projectId,
    type: 'special-assessment',
    ...projectData,
    metadata: {
      ...projectData.metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
  
  await docRef.set(project);
  
  return { projectId, ...project };
}

/**
 * Update an existing project
 * @param {string} clientId - The client ID
 * @param {string} projectId - The project ID
 * @param {Object} updates - The fields to update
 * @returns {Promise<Object>} Updated project object
 */
export async function updateProject(clientId, projectId, updates) {
  const db = await getDb();
  
  // Check for excluded IDs
  if (EXCLUDED_PROJECT_IDS.includes(projectId)) {
    throw new Error('Cannot modify system project');
  }
  
  const docRef = db.doc(`clients/${clientId}/projects/${projectId}`);
  
  // Check if project exists
  const existing = await docRef.get();
  if (!existing.exists) {
    throw new Error('Project not found');
  }
  
  // Prevent changing the project ID
  delete updates.projectId;
  delete updates._id;
  
  // Update metadata
  const updateData = {
    ...updates,
    'metadata.updatedAt': new Date().toISOString()
  };
  
  await docRef.update(updateData);
  
  // Fetch and return updated project
  const updated = await docRef.get();
  return { projectId, ...updated.data() };
}

/**
 * Delete a project
 * @param {string} clientId - The client ID
 * @param {string} projectId - The project ID
 * @returns {Promise<boolean>} True if deleted
 */
export async function deleteProject(clientId, projectId) {
  const db = await getDb();
  
  // Check for excluded IDs
  if (EXCLUDED_PROJECT_IDS.includes(projectId)) {
    throw new Error('Cannot delete system project');
  }
  
  const docRef = db.doc(`clients/${clientId}/projects/${projectId}`);
  
  // Check if project exists
  const existing = await docRef.get();
  if (!existing.exists) {
    throw new Error('Project not found');
  }
  
  const projectData = existing.data();
  
  // Check for associated transactions - cannot delete if any exist
  const hasCollections = projectData.collections && projectData.collections.length > 0;
  const hasPayments = projectData.payments && projectData.payments.length > 0;
  
  if (hasCollections || hasPayments) {
    const collectionCount = projectData.collections?.length || 0;
    const paymentCount = projectData.payments?.length || 0;
    throw new Error(
      `Cannot delete project with financial records. ` +
      `This project has ${collectionCount} collection(s) and ${paymentCount} payment(s). ` +
      `Archive the project instead.`
    );
  }
  
  await docRef.delete();
  
  return true;
}

/**
 * Express route handler: Create a new project
 * POST /api/clients/:clientId/projects
 */
export async function createProjectHandler(req, res) {
  try {
    const { clientId } = req.params;
    const projectData = req.body;
    
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'Client ID is required'
      });
    }
    
    if (!projectData || !projectData.name) {
      return res.status(400).json({
        success: false,
        error: 'Project name is required'
      });
    }
    
    console.log(`📝 Creating project for client: ${clientId}`);
    
    const project = await createProject(clientId, projectData);
    
    // Audit log
    await writeAuditLog({
      module: 'projects',
      action: 'create',
      parentPath: `clients/${clientId}/projects`,
      docId: project.projectId,
      friendlyName: project.name,
      notes: `Created by ${req.user?.email || 'system'}`,
      clientId: clientId
    });
    
    console.log(`✅ Created project: ${project.name}`);
    
    return res.status(201).json({
      success: true,
      data: project
    });
    
  } catch (error) {
    console.error('❌ Error creating project:', error);
    return res.status(error.message.includes('already exists') ? 409 : 500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Express route handler: Update a project
 * PUT /api/clients/:clientId/projects/:projectId
 */
export async function updateProjectHandler(req, res) {
  try {
    const { clientId, projectId } = req.params;
    const updates = req.body;
    
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'Client ID is required'
      });
    }
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID is required'
      });
    }
    
    // Skip known project types
    if (KNOWN_PROJECT_TYPES.includes(projectId)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot update system project type'
      });
    }
    
    console.log(`📝 Updating project ${projectId} for client: ${clientId}`);
    
    const project = await updateProject(clientId, projectId, updates);
    
    // Audit log
    await writeAuditLog({
      module: 'projects',
      action: 'update',
      parentPath: `clients/${clientId}/projects`,
      docId: project.projectId,
      friendlyName: project.name,
      notes: `Updated by ${req.user?.email || 'system'}`,
      clientId: clientId
    });
    
    console.log(`✅ Updated project: ${project.name}`);
    
    return res.json({
      success: true,
      data: project
    });
    
  } catch (error) {
    console.error('❌ Error updating project:', error);
    return res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Express route handler: Delete a project
 * DELETE /api/clients/:clientId/projects/:projectId
 */
export async function deleteProjectHandler(req, res) {
  try {
    const { clientId, projectId } = req.params;
    
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'Client ID is required'
      });
    }
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID is required'
      });
    }
    
    // Skip known project types
    if (KNOWN_PROJECT_TYPES.includes(projectId)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete system project type'
      });
    }
    
    console.log(`🗑️ Deleting project ${projectId} for client: ${clientId}`);
    
    await deleteProject(clientId, projectId);
    
    // Audit log
    await writeAuditLog({
      module: 'projects',
      action: 'delete',
      parentPath: `clients/${clientId}/projects`,
      docId: projectId,
      friendlyName: `Project ${projectId}`,
      notes: `Deleted by ${req.user?.email || 'system'}`,
      clientId: clientId
    });
    
    console.log(`✅ Deleted project: ${projectId}`);
    
    return res.json({
      success: true,
      message: 'Project deleted'
    });
    
  } catch (error) {
    // Check if this is a validation rejection (not a real error)
    if (error.message.includes('Cannot delete project with financial records')) {
      console.log(`ℹ️ Delete blocked for ${req.params.projectId}: has financial records`);
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    
    // Actual errors
    console.error('❌ Error deleting project:', error);
    return res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
}
