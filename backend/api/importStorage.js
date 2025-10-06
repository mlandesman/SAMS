/**
 * Firebase Storage API for backend import file operations
 * Handles reading JSON files from Firebase Storage for client onboarding
 * Uses properly initialized Firebase app for Storage operations
 */

import { getApp } from '../firebase.js';

/**
 * Read a file from Firebase Storage using user authentication
 * @param {string} filePath - The storage path (e.g., 'imports/clientId/filename.json')
 * @param {Object} user - The authenticated user context
 * @returns {Promise<string>} The file content as text
 */
export const readFileFromFirebaseStorage = async (filePath, user) => {
  try {
    console.log(`📖 Reading file from Firebase Storage: ${filePath}`);
    
    // Use the properly initialized Firebase app
    const app = await getApp();
    const bucket = app.storage().bucket();
    
    // Get file reference
    const file = bucket.file(filePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Download file content
    const [buffer] = await file.download();
    const text = buffer.toString('utf-8');
    
    console.log(`✅ Successfully read file: ${filePath}`);
    return text;
  } catch (error) {
    console.error(`❌ Failed to read file ${filePath}:`, error);
    throw new Error(`Failed to read file ${filePath}: ${error.message}`);
  }
};

/**
 * Delete files from Firebase Storage using user authentication
 * @param {string} clientId - The client ID
 * @param {Object} user - The authenticated user context
 * @returns {Promise<void>}
 */
export const deleteImportFiles = async (clientId, user) => {
  try {
    console.log(`🗑️ Deleting existing import files for client: ${clientId}`);
    
    // Use the properly initialized Firebase app
    const app = await getApp();
    const bucket = app.storage().bucket();
    
    // List all files in the imports directory for this client
    const [files] = await bucket.getFiles({
      prefix: `imports/${clientId}/`
    });
    
    if (files.length === 0) {
      console.log(`📁 No existing files found in imports/${clientId}/`);
      return;
    }
    
    // Delete all files
    const deletePromises = files.map(file => file.delete());
    await Promise.all(deletePromises);
    
    console.log(`✅ Deleted ${files.length} existing files from imports/${clientId}/`);
  } catch (error) {
    console.error(`❌ Failed to delete import files for ${clientId}:`, error);
    
    // If the directory doesn't exist, that's not an error - just log and continue
    if (error.code === 'storage/object-not-found' || error.message.includes('not found')) {
      console.log(`📁 No existing import directory found for ${clientId} - this is normal for first import`);
      return;
    }
    
    throw new Error(`Failed to delete import files: ${error.message}`);
  }
};

/**
 * List all client directories in the imports folder
 * @param {Object} user - The authenticated user context
 * @returns {Promise<string[]>} Array of client IDs
 */
export const listImportClientDirectories = async (user) => {
  try {
    console.log(`📁 Listing client directories in imports/`);
    
    // Use the properly initialized Firebase app
    const app = await getApp();
    const bucket = app.storage().bucket();
    
    // List all files with imports/ prefix
    const [files] = await bucket.getFiles({
      prefix: 'imports/',
      delimiter: '/'
    });
    
    // Extract unique client IDs from the file paths
    const clientIds = new Set();
    files.forEach(file => {
      const pathParts = file.name.split('/');
      if (pathParts.length >= 2 && pathParts[0] === 'imports') {
        clientIds.add(pathParts[1]);
      }
    });
    
    const clientIdArray = Array.from(clientIds);
    console.log(`📁 Found client directories: ${clientIdArray.join(', ')}`);
    return clientIdArray;
  } catch (error) {
    console.error(`❌ Failed to list client directories:`, error);
    throw new Error(`Failed to list client directories: ${error.message}`);
  }
};

/**
 * Check if a file exists in Firebase Storage
 * @param {string} filePath - The storage path
 * @param {Object} user - The authenticated user context
 * @returns {Promise<boolean>} True if file exists
 */
export const fileExistsInFirebaseStorage = async (filePath, user) => {
  try {
    // Use the properly initialized Firebase app
    const app = await getApp();
    const bucket = app.storage().bucket();
    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    return exists;
  } catch (error) {
    console.error(`❌ Error checking file existence ${filePath}:`, error);
    return false;
  }
};
