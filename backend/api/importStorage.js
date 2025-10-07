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
 * List all files in a Firebase Storage directory
 * @param {string} directoryPath - The directory path (e.g., 'imports/clientId')
 * @param {Object} user - The authenticated user context
 * @returns {Promise<string[]>} Array of file names
 */
export const listFilesInFirebaseStorage = async (directoryPath, user) => {
  try {
    console.log(`📁 Listing files in Firebase Storage directory: ${directoryPath}`);
    
    // Use the properly initialized Firebase app
    const app = await getApp();
    const bucket = app.storage().bucket();
    
    // List all files in the directory
    const [files] = await bucket.getFiles({
      prefix: `${directoryPath}/`
    });
    
    // Extract just the file names (without the directory path)
    const fileNames = files.map(file => {
      const pathParts = file.name.split('/');
      return pathParts[pathParts.length - 1]; // Get the last part (filename)
    });
    
    console.log(`📁 Found ${fileNames.length} files: ${fileNames.join(', ')}`);
    return fileNames;
  } catch (error) {
    console.error(`❌ Failed to list files in ${directoryPath}:`, error);
    throw new Error(`Failed to list files: ${error.message}`);
  }
};

/**
 * Find a file with case-insensitive matching
 * @param {string} directoryPath - The directory path (e.g., 'imports/clientId')
 * @param {string} targetFileName - The target file name (e.g., 'Config.json')
 * @param {Object} user - The authenticated user context
 * @returns {Promise<string|null>} The actual file name if found, null otherwise
 */
export const findFileCaseInsensitive = async (directoryPath, targetFileName, user) => {
  try {
    console.log(`🔍 Looking for file case-insensitively: ${targetFileName} in ${directoryPath}`);
    
    const files = await listFilesInFirebaseStorage(directoryPath, user);
    
    // Try exact match first
    if (files.includes(targetFileName)) {
      console.log(`✅ Found exact match: ${targetFileName}`);
      return targetFileName;
    }
    
    // Try case-insensitive match
    const lowerTarget = targetFileName.toLowerCase();
    const match = files.find(file => file.toLowerCase() === lowerTarget);
    
    if (match) {
      console.log(`✅ Found case-insensitive match: ${match} (looking for ${targetFileName})`);
      return match;
    }
    
    console.log(`❌ No match found for ${targetFileName} in ${files.join(', ')}`);
    return null;
  } catch (error) {
    console.error(`❌ Error finding file ${targetFileName}:`, error);
    return null;
  }
};

/**
 * Write a file to Firebase Storage
 * @param {string} filePath - The storage path (e.g., 'imports/clientId/filename.json')
 * @param {string} content - The file content to write
 * @param {Object} user - The authenticated user context
 * @returns {Promise<void>}
 */
export const writeFileToFirebaseStorage = async (filePath, content, user) => {
  try {
    console.log(`📝 Writing file to Firebase Storage: ${filePath}`);
    
    // Use the properly initialized Firebase app
    const app = await getApp();
    const bucket = app.storage().bucket();
    const file = bucket.file(filePath);
    
    // Write the content
    await file.save(content, {
      metadata: {
        contentType: 'application/json',
        cacheControl: 'public, max-age=3600'
      }
    });
    
    console.log(`✅ Successfully wrote file: ${filePath}`);
  } catch (error) {
    console.error(`❌ Failed to write file ${filePath}:`, error);
    throw new Error(`Failed to write file ${filePath}: ${error.message}`);
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
