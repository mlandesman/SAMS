/**
 * Firebase Storage API for import file operations
 * Handles uploading and deleting JSON files for client onboarding
 */

import { getStorage, ref, uploadBytes, deleteObject, listAll, getDownloadURL } from 'firebase/storage';
import { getApp } from 'firebase/app';

const storage = getStorage(getApp());

/**
 * Upload a single file to Firebase Storage
 * @param {string} filePath - The storage path (e.g., 'imports/clientId/filename.json')
 * @param {File} file - The file to upload
 * @returns {Promise<string>} The storage path
 */
export const uploadFileToFirebaseStorage = async (filePath, file) => {
  try {
    console.log(`📤 Uploading ${file.name} to ${filePath}`);
    const storageRef = ref(storage, filePath);
    await uploadBytes(storageRef, file);
    console.log(`✅ Successfully uploaded ${file.name}`);
    return filePath;
  } catch (error) {
    console.error(`❌ Failed to upload ${file.name}:`, error);
    throw new Error(`Failed to upload ${file.name}: ${error.message}`);
  }
};

/**
 * Delete all files from an import directory
 * @param {string} clientId - The client ID
 * @returns {Promise<void>}
 */
export const deleteImportFiles = async (clientId) => {
  try {
    console.log(`🗑️ Deleting existing import files for client: ${clientId}`);
    const importRef = ref(storage, `imports/${clientId}`);
    
    // List all files in the directory
    const listResult = await listAll(importRef);
    
    if (listResult.items.length === 0) {
      console.log(`📁 No existing files found in imports/${clientId}/`);
      return;
    }
    
    // Delete all files
    const deletePromises = listResult.items.map(item => deleteObject(item));
    await Promise.all(deletePromises);
    
    console.log(`✅ Deleted ${listResult.items.length} existing files from imports/${clientId}/`);
  } catch (error) {
    console.error(`❌ Failed to delete import files for ${clientId}:`, error);
    throw new Error(`Failed to delete import files: ${error.message}`);
  }
};

/**
 * Upload multiple files to Firebase Storage with progress tracking
 * @param {string} clientId - The client ID
 * @param {File[]} files - Array of files to upload
 * @returns {Promise<void>}
 */
export const uploadImportFilesWithProgress = async (clientId, files) => {
  try {
    console.log(`📤 Starting upload of ${files.length} JSON files to /imports/${clientId}/`);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`📤 Uploading ${i + 1} of ${files.length}: ${file.name}`);
      
      const filePath = `imports/${clientId}/${file.name}`;
      await uploadFileToFirebaseStorage(filePath, file);
      
      // Simple progress logging for small files
      console.log(`✅ Uploaded ${file.name} (${i + 1}/${files.length})`);
    }
    
    console.log('✅ All files uploaded successfully to Firebase Storage');
  } catch (error) {
    console.error('❌ Failed to upload import files:', error);
    throw new Error(`Upload failed: ${error.message}`);
  }
};

/**
 * Read a file from Firebase Storage
 * @param {string} filePath - The storage path
 * @returns {Promise<string>} The file content as text
 */
export const readFileFromFirebaseStorage = async (filePath) => {
  try {
    console.log(`📖 Reading file from Firebase Storage: ${filePath}`);
    const fileRef = ref(storage, filePath);
    
    // Get download URL and fetch the file
    const url = await getDownloadURL(fileRef);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const text = await response.text();
    console.log(`✅ Successfully read file: ${filePath}`);
    return text;
  } catch (error) {
    console.error(`❌ Failed to read file ${filePath}:`, error);
    throw new Error(`Failed to read file ${filePath}: ${error.message}`);
  }
};

/**
 * Check if a file exists in Firebase Storage
 * @param {string} filePath - The storage path
 * @returns {Promise<boolean>} True if file exists
 */
export const fileExistsInFirebaseStorage = async (filePath) => {
  try {
    const fileRef = ref(storage, filePath);
    await getDownloadURL(fileRef);
    return true;
  } catch (error) {
    if (error.code === 'storage/object-not-found') {
      return false;
    }
    throw error;
  }
};

/**
 * List all files in an import directory
 * @param {string} clientId - The client ID
 * @returns {Promise<string[]>} Array of file names
 */
export const listImportFiles = async (clientId) => {
  try {
    const importRef = ref(storage, `imports/${clientId}`);
    const listResult = await listAll(importRef);
    
    return listResult.items.map(item => item.name);
  } catch (error) {
    console.error(`❌ Failed to list import files for ${clientId}:`, error);
    throw new Error(`Failed to list import files: ${error.message}`);
  }
};
