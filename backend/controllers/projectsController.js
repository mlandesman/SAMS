/**
 * projects.js
 * CRUD operations for projects collection
 */

import { getDb } from '../firebase.js';
import { writeAuditLog } from '../utils/auditLogger.js';

/**
 * CRUD operations for projects under a specific year and status (proposed/current/completed)
 */

// Create a project
async function createProject(clientId, year, status, data) {
  try {
    const db = await getDb();
    const projectRef = await db.collection(`clients/${clientId}/projects/${year}/${status}`).add({
      ...data,
      createdAt: new Date(),
    });

    const auditSuccess = await writeAuditLog({
      module: 'projects',
      action: 'create',
      parentPath: `clients/${clientId}/projects/${year}/${status}/${projectRef.id}`,
      docId: projectRef.id,
      friendlyName: data.projectName || 'Unnamed Project',
      notes: 'Created project record',
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for createProject.');
    }

    return projectRef.id;
  } catch (error) {
    console.error('❌ Error creating project:', error);
    return null;
  }
}

// Update a project
async function updateProject(clientId, year, status, projectId, newData) {
  try {
    const db = await getDb();
    const projectRef = db.doc(`clients/${clientId}/projects/${year}/${status}/${projectId}`);
    await projectRef.update({
      ...newData,
      updatedAt: new Date(),
    });

    const auditSuccess = await writeAuditLog({
      module: 'projects',
      action: 'update',
      parentPath: `clients/${clientId}/projects/${year}/${status}/${projectId}`,
      docId: projectId,
      friendlyName: newData.projectName || 'Unnamed Project',
      notes: 'Updated project record',
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for updateProject.');
    }

    return true;
  } catch (error) {
    console.error('❌ Error updating project:', error);
    return false;
  }
}

// Delete a project
async function deleteProject(clientId, year, status, projectId) {
  try {
    const db = await getDb();
    const projectRef = db.doc(`clients/${clientId}/projects/${year}/${status}/${projectId}`);
    await projectRef.delete();

    const auditSuccess = await writeAuditLog({
      module: 'projects',
      action: 'delete',
      parentPath: `clients/${clientId}/projects/${year}/${status}/${projectId}`,
      docId: projectId,
      friendlyName: '',
      notes: 'Deleted project record',
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for deleteProject.');
    }

    return true;
  } catch (error) {
    console.error('❌ Error deleting project:', error);
    return false;
  }
}

// List all projects under a year/status
async function listProjects(clientId, year, status) {
  try {
    const db = await getDb();
    const snapshot = await db.collection(`clients/${clientId}/projects/${year}/${status}`).get();
    const projects = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      projects.push({
        ...data,
        id: doc.id, // Always use the document ID, overriding any 'id' field in data
      });
    });

    return projects;
  } catch (error) {
    console.error('❌ Error listing projects:', error);
    return [];
  }
}

export {
  createProject,
  updateProject,
  deleteProject,
  listProjects,
};