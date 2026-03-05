/**
 * Projects Controller
 * 
 * Handles CRUD operations for special assessment projects.
 * Projects are stored at: clients/{clientId}/projects/{projectId}
 * 
 * Note: This controller handles "special-assessment" type projects, NOT
 * project types like waterBills or propaneTanks which are structural documents.
 */

import admin from 'firebase-admin';
import { getDb } from '../firebase.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { getMexicoDateString } from '../utils/timezone.js';
import { getNow } from '../../shared/services/DateService.js';
import { listUnits } from './unitsController.js';
import { allocateByOwnership } from '../../shared/utils/allocationUtils.js';
import { logDebug, logInfo, logWarn, logError } from '../../shared/logger.js';

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
 * Build ownership map from units (ownershipPercentage or percentOwned)
 * @param {Array} units - Units from listUnits
 * @returns {Object<string, number>} unitId -> decimal (0-1)
 */
function buildOwnershipMapFromUnits(units) {
  const map = {};
  for (const u of units || []) {
    const unitId = u.unitId ?? u.id;
    if (!unitId) continue;
    const raw = u.ownershipPercentage ?? u.percentOwned;
    if (raw == null || Number.isNaN(Number(raw))) continue;
    const num = typeof raw === 'number' ? raw : parseFloat(raw);
    // ownershipPercentage is stored as 0-1 decimal; legacy percentOwned as 0-100
    const decimal = num > 1 ? num / 100 : num;
    if (decimal >= 0 && decimal <= 1) map[unitId] = decimal;
  }
  return map;
}

/**
 * Compute an allocation snapshot for a given amount, ownership, and participation.
 * Callers provide the amount (bid or project totalCost) and can pass a pre-fetched
 * ownershipMap to avoid redundant listUnits calls.
 *
 * @param {string} clientId - Client ID (used only if ownershipMap not provided)
 * @param {number} amountCentavos - Amount to allocate (integer centavos)
 * @param {Object} options
 * @param {Object<string,'in'|'out'>} [options.participationMap] - unitId -> 'in'|'out'
 * @param {Object<string,number>} [options.ownershipMap] - unitId -> decimal (0-1). If omitted, fetched live.
 * @returns {Object|null} Snapshot to persist, or null if cannot compute
 */
async function computeAllocationSnapshot(clientId, amountCentavos, { participationMap = {}, ownershipMap } = {}) {
  const total = Math.round(Number(amountCentavos));
  if (!total || !Number.isInteger(total) || total <= 0) return null;

  let ownership = ownershipMap;
  if (!ownership || typeof ownership !== 'object' || Object.keys(ownership).length === 0) {
    const units = await listUnits(clientId);
    ownership = buildOwnershipMapFromUnits(units);
  }

  if (Object.keys(ownership).length === 0) return null;

  try {
    const { allocations, reconciliation } = allocateByOwnership(total, ownership, participationMap);
    return {
      inputs: {
        ownership,
        participation: participationMap
      },
      allocations,
      reconciliation,
      computedAt: getNow().toISOString()
    };
  } catch (err) {
    logWarn(`Allocation compute failed: ${err.message}`);
    return null;
  }
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
    
    logDebug(`📋 Fetching projects for client: ${clientId}${fiscalYear ? ` (year: ${fiscalYear})` : ''}`);
    
    const projects = await listProjects(clientId, fiscalYear);
    
    logDebug(`✅ Found ${projects.length} projects`);
    
    return res.json({
      success: true,
      count: projects.length,
      data: projects
    });
    
  } catch (error) {
    logError('❌ Error listing projects:', error);
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
      logDebug(`ℹ️ Project type ${projectId} - forwarding to projectsDataController`);
      return next();
    }
    
    logDebug(`📋 Fetching project ${projectId} for client: ${clientId}`);
    
    const project = await getProject(clientId, projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    
    logDebug(`✅ Found project: ${project.name}`);
    
    return res.json({
      success: true,
      data: project
    });
    
  } catch (error) {
    logError('❌ Error getting project:', error);
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
      createdAt: getNow().toISOString(),
      updatedAt: getNow().toISOString()
    }
  };
  
  await docRef.set(project);
  
  return { projectId, ...project };
}

/**
 * Validate bid revision installments (milestone-based)
 * @param {Array} installments - Array of { milestone, percentOfTotal }
 * @throws {Error} If validation fails
 */
function validateBidInstallments(installments) {
  if (!installments || !Array.isArray(installments)) {
    throw new Error('At least one installment row is required');
  }
  if (installments.length === 0) {
    throw new Error('At least one installment row is required');
  }
  let sum = 0;
  for (let i = 0; i < installments.length; i++) {
    const row = installments[i];
    const milestone = String(row.milestone || '').trim();
    if (!milestone) {
      throw new Error(`Installment row ${i + 1}: milestone is required`);
    }
    const pct = Number(row.percentOfTotal);
    if (!Number.isInteger(pct) || pct <= 0 || pct > 100) {
      throw new Error(`Installment row ${i + 1}: percentOfTotal must be an integer between 1 and 100`);
    }
    sum += pct;
  }
  if (sum !== 100) {
    throw new Error(`Installment schedule must total 100% (currently ${sum}%)`);
  }
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

  // Handle metadata separately to avoid Firestore conflict
  // (can't set both 'metadata' object and 'metadata.updatedAt' in same update)
  const { metadata: incomingMetadata, ...otherUpdates } = updates;
  
  let updateData;
  if (incomingMetadata) {
    // Merge incoming metadata with updatedAt
    updateData = {
      ...otherUpdates,
      metadata: {
        ...incomingMetadata,
        updatedAt: getNow().toISOString()
      }
    };
  } else {
    // No metadata in updates, just set the timestamp via dot notation
    updateData = {
      ...otherUpdates,
      'metadata.updatedAt': getNow().toISOString()
    };
  }

  // Recompute allocation when totalCost, unitParticipation, or status (to approved) changes
  const existingData = existing.data();
  const totalCostChanged = 'totalCost' in otherUpdates;
  const participationChanged = 'unitParticipation' in otherUpdates || 'participation' in otherUpdates;
  const statusToApproved = otherUpdates.status === 'approved' && existingData.status !== 'approved';
  if (totalCostChanged || participationChanged || statusToApproved) {
    const mergedProject = { ...existingData, ...otherUpdates };
    const mergedCost = mergedProject.totalCost ?? 0;
    const participationMap = mergedProject.unitParticipation ?? mergedProject.participation ?? {};

    // Use locked ownership if approved, otherwise fetch live (single call)
    const isApproved = mergedProject.status === 'approved';
    const lockedOwnership = existingData.allocationInputs?.ownership;
    let ownershipMap;

    if (isApproved && lockedOwnership && typeof lockedOwnership === 'object') {
      ownershipMap = lockedOwnership;
    } else {
      const units = await listUnits(clientId);
      ownershipMap = buildOwnershipMapFromUnits(units);

      // Lock ownership when project becomes approved
      if (statusToApproved) {
        updateData.allocationInputs = {
          ownership: ownershipMap,
          lockedAt: getNow().toISOString()
        };
      }
    }

    const snapshot = await computeAllocationSnapshot(clientId, mergedCost, { participationMap, ownershipMap });
    if (snapshot) {
      updateData.allocationSnapshot = snapshot;
    }
  }
  
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
    
    logDebug(`📝 Creating project for client: ${clientId}`);
    
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
    
    logDebug(`✅ Created project: ${project.name}`);
    
    return res.status(201).json({
      success: true,
      data: project
    });
    
  } catch (error) {
    logError('❌ Error creating project:', error);
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
    
    logDebug(`📝 Updating project ${projectId} for client: ${clientId}`);
    
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
    
    logDebug(`✅ Updated project: ${project.name}`);
    
    return res.json({
      success: true,
      data: project
    });
    
  } catch (error) {
    logError('❌ Error updating project:', error);
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
    
    logDebug(`🗑️ Deleting project ${projectId} for client: ${clientId}`);
    
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
    
    logDebug(`✅ Deleted project: ${projectId}`);
    
    return res.json({
      success: true,
      message: 'Project deleted'
    });
    
  } catch (error) {
    // Check if this is a validation rejection (not a real error)
    if (error.message.includes('Cannot delete project with financial records')) {
      logDebug(`ℹ️ Delete blocked for ${req.params.projectId}: has financial records`);
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    
    // Actual errors
    logError('❌ Error deleting project:', error);
    return res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
}

// ============================================================
// BIDS MANAGEMENT
// Bids are stored as a subcollection: clients/{clientId}/projects/{projectId}/bids/{bidId}
// ============================================================

/**
 * List all bids for a project
 * @param {string} clientId - The client ID
 * @param {string} projectId - The project ID
 * @returns {Promise<Array>} Array of bid objects
 */
export async function listBids(clientId, projectId) {
  const db = await getDb();
  
  const bidsRef = db.collection(`clients/${clientId}/projects/${projectId}/bids`);
  const snapshot = await bidsRef.orderBy('createdAt', 'desc').get();
  
  const bids = [];
  snapshot.forEach(doc => {
    bids.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  return bids;
}

/**
 * Get a single bid
 * @param {string} clientId - The client ID
 * @param {string} projectId - The project ID
 * @param {string} bidId - The bid ID
 * @returns {Promise<Object|null>} Bid object or null
 */
export async function getBid(clientId, projectId, bidId) {
  const db = await getDb();
  
  const docRef = db.doc(`clients/${clientId}/projects/${projectId}/bids/${bidId}`);
  const doc = await docRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  return {
    id: doc.id,
    ...doc.data()
  };
}

/**
 * Create a new bid
 * @param {string} clientId - The client ID
 * @param {string} projectId - The project ID
 * @param {Object} bidData - The bid data
 * @returns {Promise<Object>} Created bid object
 */
export async function createBid(clientId, projectId, bidData) {
  const db = await getDb();
  
  const bidsRef = db.collection(`clients/${clientId}/projects/${projectId}/bids`);
  
  // Installments: new format required. Legacy paymentTerms converted at read/display only.
  const installments = bidData.installments;
  if (installments && installments.length > 0) {
    validateBidInstallments(installments);
  } else {
    throw new Error('At least one installment row is required (milestone + percent must total 100%)');
  }

  const initialRevision = {
    revisionNumber: 1,
    submittedAt: bidData.submittedAt || getMexicoDateString(),
    amount: bidData.amount || 0,
    timeline: bidData.timeline || '',
    description: bidData.description || '',
    inclusions: bidData.inclusions || '',
    exclusions: bidData.exclusions || '',
    installments: installments.map(({ milestone, percentOfTotal }) => ({
      milestone: String(milestone || '').trim(),
      percentOfTotal: Number(percentOfTotal) || 0
    })),
    notes: bidData.notes || '',
    documents: bidData.documents || []
  };
  
  // Fetch project participation for allocation computation
  const projectRef = db.doc(`clients/${clientId}/projects/${projectId}`);
  const projectDoc = await projectRef.get();
  const participationMap = projectDoc.exists
    ? (projectDoc.data().unitParticipation ?? projectDoc.data().participation ?? {})
    : {};

  const bidAmount = initialRevision.amount;
  let allocationSnapshot = null;
  if (bidAmount && Number.isInteger(bidAmount) && bidAmount > 0) {
    allocationSnapshot = await computeAllocationSnapshot(clientId, bidAmount, { participationMap });
  }

  const bid = {
    vendorName: bidData.vendorName,
    vendorContact: bidData.vendorContact || {},
    status: 'active',
    currentRevision: 1,
    revisions: [initialRevision],
    communications: [],
    createdAt: getNow().toISOString(),
    updatedAt: getNow().toISOString()
  };
  if (allocationSnapshot) {
    bid.allocationSnapshot = allocationSnapshot;
  }
  
  const docRef = await bidsRef.add(bid);
  
  return {
    id: docRef.id,
    ...bid
  };
}

/**
 * Update a bid (add revision or update metadata)
 * @param {string} clientId - The client ID
 * @param {string} projectId - The project ID
 * @param {string} bidId - The bid ID
 * @param {Object} updates - The updates
 * @returns {Promise<Object>} Updated bid object
 */
export async function updateBid(clientId, projectId, bidId, updates) {
  const db = await getDb();
  
  const docRef = db.doc(`clients/${clientId}/projects/${projectId}/bids/${bidId}`);
  const doc = await docRef.get();
  
  if (!doc.exists) {
    throw new Error('Bid not found');
  }
  
  const currentData = doc.data();
  
  // If adding a new revision
  if (updates.newRevision) {
    const rev = updates.newRevision;
    const installments = rev.installments;
    if (installments && installments.length > 0) {
      validateBidInstallments(installments);
    } else {
      throw new Error('At least one installment row is required (milestone + percent must total 100%)');
    }

    const newRevisionNumber = currentData.currentRevision + 1;
    const newRevision = {
      revisionNumber: newRevisionNumber,
      submittedAt: rev.submittedAt || getMexicoDateString(),
      amount: rev.amount,
      timeline: rev.timeline || '',
      description: rev.description || '',
      inclusions: rev.inclusions || '',
      exclusions: rev.exclusions || '',
      installments: installments.map(({ milestone, percentOfTotal }) => ({
        milestone: String(milestone || '').trim(),
        percentOfTotal: Number(percentOfTotal) || 0
      })),
      notes: rev.notes || '',
      documents: rev.documents || []
    };

    const revisionUpdate = {
      currentRevision: newRevisionNumber,
      revisions: [...currentData.revisions, newRevision],
      updatedAt: getNow().toISOString()
    };

    // Recompute bid allocation if the revision amount changed
    const newAmount = newRevision.amount;
    if (newAmount && Number.isInteger(newAmount) && newAmount > 0) {
      const projectRef = db.doc(`clients/${clientId}/projects/${projectId}`);
      const projectDoc = await projectRef.get();
      const participationMap = projectDoc.exists
        ? (projectDoc.data().unitParticipation ?? projectDoc.data().participation ?? {})
        : {};
      const snapshot = await computeAllocationSnapshot(clientId, newAmount, { participationMap });
      if (snapshot) {
        revisionUpdate.allocationSnapshot = snapshot;
      }
    }

    await docRef.update(revisionUpdate);
  } 
  // If adding a communication
  else if (updates.newCommunication) {
    const comm = {
      date: getMexicoDateString(),
      type: updates.newCommunication.type || 'note',
      message: updates.newCommunication.message,
      by: updates.newCommunication.by || 'Unknown'
    };
    
    await docRef.update({
      communications: [...currentData.communications, comm],
      updatedAt: getNow().toISOString()
    });
  }
  // General metadata update
  else {
    const allowedFields = ['vendorName', 'vendorContact', 'status'];
    const updateData = { updatedAt: getNow().toISOString() };
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    }
    
    await docRef.update(updateData);
  }
  
  // Fetch and return updated bid
  const updated = await docRef.get();
  return {
    id: updated.id,
    ...updated.data()
  };
}

/**
 * Delete a bid
 * @param {string} clientId - The client ID
 * @param {string} projectId - The project ID
 * @param {string} bidId - The bid ID
 * @returns {Promise<boolean>} True if deleted
 */
export async function deleteBid(clientId, projectId, bidId) {
  const db = await getDb();
  
  const docRef = db.doc(`clients/${clientId}/projects/${projectId}/bids/${bidId}`);
  const doc = await docRef.get();
  
  if (!doc.exists) {
    throw new Error('Bid not found');
  }
  
  const bidData = doc.data();
  
  // Cannot delete a selected bid
  if (bidData.status === 'selected') {
    throw new Error('Cannot delete a selected bid. Unselect it first.');
  }
  
  await docRef.delete();
  
  return true;
}

/**
 * Select a bid - marks it as selected, rejects others, updates project
 * @param {string} clientId - The client ID
 * @param {string} projectId - The project ID
 * @param {string} bidId - The bid ID to select
 * @returns {Promise<Object>} Updated project object
 */
export async function selectBid(clientId, projectId, bidId) {
  const db = await getDb();
  
  // Get the bid to select
  const bidRef = db.doc(`clients/${clientId}/projects/${projectId}/bids/${bidId}`);
  const bidDoc = await bidRef.get();
  
  if (!bidDoc.exists) {
    throw new Error('Bid not found');
  }
  
  const bidData = bidDoc.data();
  const currentRevision = bidData.revisions[bidData.currentRevision - 1];
  
  // Get all bids for this project
  const bidsRef = db.collection(`clients/${clientId}/projects/${projectId}/bids`);
  const allBids = await bidsRef.get();
  
  // Update all bids: selected one gets 'selected', others get 'rejected'
  const batch = db.batch();
  
  allBids.forEach(doc => {
    if (doc.id === bidId) {
      batch.update(doc.ref, { 
        status: 'selected',
        selectedAt: getNow().toISOString(),
        updatedAt: getNow().toISOString()
      });
    } else if (doc.data().status === 'active') {
      batch.update(doc.ref, { 
        status: 'rejected',
        updatedAt: getNow().toISOString()
      });
    }
  });
  
  // Lock ownership and compute project-level allocation (single listUnits call)
  const projectRef = db.doc(`clients/${clientId}/projects/${projectId}`);
  const projectDoc = await projectRef.get();
  const projectData = projectDoc.exists ? projectDoc.data() : {};
  const participationMap = projectData.unitParticipation ?? projectData.participation ?? {};

  const units = await listUnits(clientId);
  const ownershipMap = buildOwnershipMapFromUnits(units);

  const allocationSnapshot = await computeAllocationSnapshot(
    clientId, currentRevision.amount, { participationMap, ownershipMap }
  );

  const batchUpdates = {
    vendor: {
      name: bidData.vendorName,
      contact: bidData.vendorContact?.phone || bidData.vendorContact?.email || '',
      notes: `Selected from bid on ${getMexicoDateString()}`
    },
    vendors: [bidData.vendorName],
    totalCost: currentRevision.amount,
    selectedBidId: bidId,
    status: 'approved',
    allocationInputs: {
      ownership: ownershipMap,
      lockedAt: getNow().toISOString()
    },
    'metadata.updatedAt': getNow().toISOString()
  };
  if (allocationSnapshot) {
    batchUpdates.allocationSnapshot = allocationSnapshot;
  }
  // Promote winning bid's installments to project
  if (currentRevision.installments && Array.isArray(currentRevision.installments) && currentRevision.installments.length > 0) {
    batchUpdates.installments = currentRevision.installments.map(({ milestone, percentOfTotal }) => ({
      milestone: String(milestone || '').trim(),
      percentOfTotal: Number(percentOfTotal) || 0
    }));
  } else if (currentRevision.paymentTerms) {
    // Legacy: convert paymentTerms to single 100% installment
    batchUpdates.installments = [{ milestone: currentRevision.paymentTerms || 'Full Payment', percentOfTotal: 100 }];
  }
  batch.update(projectRef, batchUpdates);
  
  await batch.commit();
  
  // Return updated project
  const updatedProject = await projectRef.get();
  return {
    projectId: updatedProject.id,
    ...updatedProject.data()
  };
}

/**
 * Unselect the current bid - allows re-selection
 * @param {string} clientId - The client ID
 * @param {string} projectId - The project ID
 * @returns {Promise<Object>} Updated project object
 */
export async function unselectBid(clientId, projectId) {
  const db = await getDb();
  
  // Get all bids for this project
  const bidsRef = db.collection(`clients/${clientId}/projects/${projectId}/bids`);
  const allBids = await bidsRef.get();
  
  // Reset all bids to 'active'
  const batch = db.batch();
  
  allBids.forEach(doc => {
    const status = doc.data().status;
    if (status === 'selected' || status === 'rejected') {
      batch.update(doc.ref, { 
        status: 'active',
        updatedAt: getNow().toISOString()
      });
    }
  });
  
  // Clear project's selected bid info, installments, and allocation data
  const projectRef = db.doc(`clients/${clientId}/projects/${projectId}`);
  batch.update(projectRef, {
    selectedBidId: null,
    status: 'bidding',
    installments: admin.firestore.FieldValue.delete(),
    allocationSnapshot: admin.firestore.FieldValue.delete(),
    allocationInputs: admin.firestore.FieldValue.delete(),
    'metadata.updatedAt': getNow().toISOString()
  });
  
  await batch.commit();
  
  // Return updated project
  const updatedProject = await projectRef.get();
  return {
    projectId: updatedProject.id,
    ...updatedProject.data()
  };
}

// ============================================================
// BIDS EXPRESS HANDLERS
// ============================================================

/**
 * List all bids for a project
 * GET /api/clients/:clientId/projects/:projectId/bids
 */
export async function listBidsHandler(req, res) {
  try {
    const { clientId, projectId } = req.params;
    
    logDebug(`📋 Fetching bids for project ${projectId}`);
    
    const bids = await listBids(clientId, projectId);
    
    logDebug(`✅ Found ${bids.length} bids`);
    
    return res.json({
      success: true,
      count: bids.length,
      data: bids
    });
    
  } catch (error) {
    logError('❌ Error listing bids:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get a single bid
 * GET /api/clients/:clientId/projects/:projectId/bids/:bidId
 */
export async function getBidHandler(req, res) {
  try {
    const { clientId, projectId, bidId } = req.params;
    
    const bid = await getBid(clientId, projectId, bidId);
    
    if (!bid) {
      return res.status(404).json({
        success: false,
        error: 'Bid not found'
      });
    }
    
    return res.json({
      success: true,
      data: bid
    });
    
  } catch (error) {
    logError('❌ Error getting bid:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Create a new bid
 * POST /api/clients/:clientId/projects/:projectId/bids
 */
export async function createBidHandler(req, res) {
  try {
    const { clientId, projectId } = req.params;
    const bidData = req.body;
    
    if (!bidData.vendorName) {
      return res.status(400).json({
        success: false,
        error: 'Vendor name is required'
      });
    }
    
    logDebug(`📝 Creating bid for project ${projectId}`);
    
    const bid = await createBid(clientId, projectId, bidData);
    
    // Audit log
    await writeAuditLog({
      module: 'bids',
      action: 'create',
      parentPath: `clients/${clientId}/projects/${projectId}/bids`,
      docId: bid.id,
      friendlyName: `Bid from ${bid.vendorName}`,
      notes: `Created by ${req.user?.email || 'system'}`,
      clientId: clientId
    });
    
    logDebug(`✅ Created bid from ${bid.vendorName}`);
    
    return res.status(201).json({
      success: true,
      data: bid
    });
    
  } catch (error) {
    logError('❌ Error creating bid:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Update a bid
 * PUT /api/clients/:clientId/projects/:projectId/bids/:bidId
 */
export async function updateBidHandler(req, res) {
  try {
    const { clientId, projectId, bidId } = req.params;
    const updates = req.body;
    
    logDebug(`📝 Updating bid ${bidId}`);
    
    const bid = await updateBid(clientId, projectId, bidId, updates);
    
    logDebug(`✅ Updated bid ${bidId}`);
    
    return res.json({
      success: true,
      data: bid
    });
    
  } catch (error) {
    logError('❌ Error updating bid:', error);
    return res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Delete a bid
 * DELETE /api/clients/:clientId/projects/:projectId/bids/:bidId
 */
export async function deleteBidHandler(req, res) {
  try {
    const { clientId, projectId, bidId } = req.params;
    
    logDebug(`🗑️ Deleting bid ${bidId}`);
    
    await deleteBid(clientId, projectId, bidId);
    
    // Audit log
    await writeAuditLog({
      module: 'bids',
      action: 'delete',
      parentPath: `clients/${clientId}/projects/${projectId}/bids`,
      docId: bidId,
      friendlyName: `Bid ${bidId}`,
      notes: `Deleted by ${req.user?.email || 'system'}`,
      clientId: clientId
    });
    
    logDebug(`✅ Deleted bid ${bidId}`);
    
    return res.json({
      success: true,
      message: 'Bid deleted'
    });
    
  } catch (error) {
    // Handle validation errors cleanly
    if (error.message.includes('Cannot delete')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    
    logError('❌ Error deleting bid:', error);
    return res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Select a bid
 * POST /api/clients/:clientId/projects/:projectId/bids/:bidId/select
 */
export async function selectBidHandler(req, res) {
  try {
    const { clientId, projectId, bidId } = req.params;
    
    logDebug(`✅ Selecting bid ${bidId} for project ${projectId}`);
    
    const project = await selectBid(clientId, projectId, bidId);
    
    // Audit log
    await writeAuditLog({
      module: 'bids',
      action: 'select',
      parentPath: `clients/${clientId}/projects/${projectId}/bids`,
      docId: bidId,
      friendlyName: `Selected bid for ${project.name}`,
      notes: `Selected by ${req.user?.email || 'system'}, amount: ${project.totalCost}`,
      clientId: clientId
    });
    
    logDebug(`✅ Bid selected, project updated`);
    
    return res.json({
      success: true,
      data: project
    });
    
  } catch (error) {
    logError('❌ Error selecting bid:', error);
    return res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Unselect the current bid
 * POST /api/clients/:clientId/projects/:projectId/bids/unselect
 */
export async function unselectBidHandler(req, res) {
  try {
    const { clientId, projectId } = req.params;
    
    logDebug(`↩️ Unselecting bid for project ${projectId}`);
    
    const project = await unselectBid(clientId, projectId);
    
    logDebug(`✅ Bid unselected, project back to bidding`);
    
    return res.json({
      success: true,
      data: project
    });
    
  } catch (error) {
    logError('❌ Error unselecting bid:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
