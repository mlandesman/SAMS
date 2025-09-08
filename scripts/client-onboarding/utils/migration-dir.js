/**
 * Shared utility for finding migration directories
 * Ensures exact client matching (AVII != AVII-TEST)
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the latest migration directory for a specific client
 * @param {string} clientId - The exact client ID
 * @returns {Promise<string>} Path to the latest migration directory
 */
export async function getLatestMigrationDir(clientId) {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const latestLink = path.join(migrationsDir, `${clientId}-latest`);
  
  try {
    // Try to follow symlink first (most reliable)
    const stats = await fs.lstat(latestLink);
    if (stats.isSymbolicLink()) {
      const target = await fs.readlink(latestLink);
      // If relative path, resolve it
      if (!path.isAbsolute(target)) {
        return path.join(migrationsDir, target);
      }
      return target;
    }
  } catch (err) {
    // Symlink doesn't exist, find latest directory
  }
  
  // Find latest migration directory for this EXACT client
  const entries = await fs.readdir(migrationsDir);
  
  // Use strict pattern matching to avoid AVII matching AVII-TEST
  const timestampPattern = new RegExp(`^${clientId}-\\d{4}-\\d{2}-\\d{2}-\\d{2}-\\d{2}-\\d{2}-\\d{3}$`);
  const clientDirs = entries
    .filter(entry => timestampPattern.test(entry))
    .sort()
    .reverse();
  
  if (clientDirs.length === 0) {
    throw new Error(`No migration found for client ${clientId}. Run init-migration.js first.`);
  }
  
  return path.join(migrationsDir, clientDirs[0]);
}

/**
 * Update metadata file in migration directory
 * @param {string} migrationDir - Path to migration directory
 * @param {Object} updates - Updates to apply to metadata
 * @returns {Promise<Object>} Updated metadata
 */
export async function updateMetadata(migrationDir, updates) {
  const metadataPath = path.join(migrationDir, 'metadata.json');
  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
  
  // Deep merge updates
  if (updates.phases) {
    metadata.phases = { ...metadata.phases, ...updates.phases };
  }
  Object.assign(metadata, updates);
  
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  return metadata;
}

/**
 * Write log entry to migration log
 * @param {string} migrationDir - Path to migration directory
 * @param {string} message - Log message
 * @param {string} level - Log level (INFO, WARN, ERROR)
 */
export async function writeLog(migrationDir, message, level = 'INFO') {
  const logPath = path.join(migrationDir, 'migration.log');
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} [${level}] ${message}\n`;
  
  try {
    await fs.appendFile(logPath, logEntry);
  } catch (error) {
    await fs.writeFile(logPath, logEntry);
  }
}