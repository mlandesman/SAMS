/**
 * Modern Import Utilities
 * Shared utilities for modernized import scripts
 * Uses controllers and DateService for all operations
 * 
 * Phase 2: Import Script Modernization
 * Date: 2025-09-29
 */

import { DateTime } from 'luxon';
import DateService from '../../backend/services/DateService.js';

/**
 * Create mock request/response objects for controller compatibility
 * Controllers expect Express req/res objects with specific properties
 */
export function createMockContext(clientId, user = null) {
  // Create a default admin user if none provided
  const defaultUser = {
    uid: 'import-script-admin',
    email: 'import@sams.system',
    name: 'Import Script Admin',
    isSuperAdmin: () => true,
    hasPropertyAccess: () => true,
    clientId: clientId,
    propertyAccess: [clientId],
    permissions: {
      superAdmin: true
    }
  };

  const mockUser = user || defaultUser;

  const req = {
    params: {
      clientId: clientId
    },
    query: {},
    body: {},
    user: mockUser,
    headers: {
      'x-client-timezone': 'America/Cancun'
    },
    get: (header) => req.headers[header.toLowerCase()]
  };

  const res = {
    status: (code) => ({
      json: (data) => ({ status: code, ...data }),
      send: (data) => ({ status: code, data })
    }),
    json: (data) => ({ status: 200, ...data }),
    send: (data) => ({ status: 200, data })
  };

  return { req, res };
}

/**
 * Create DateService instance with default timezone
 */
export function createDateService(timezone = 'America/Cancun') {
  return new DateService({
    timezone: timezone,
    locale: 'en-US',
    dateFormat: 'MM/dd/yyyy',
    timeFormat: 'h:mm a'
  });
}

/**
 * Progress logger for import operations
 */
export class ProgressLogger {
  constructor(taskName, total) {
    this.taskName = taskName;
    this.total = total;
    this.current = 0;
    this.successes = 0;
    this.errors = 0;
    this.duplicates = 0;
    this.startTime = Date.now();
  }

  logItem(itemName, status = 'processing') {
    this.current++;
    const percentage = Math.round((this.current / this.total) * 100);
    const emoji = status === 'success' ? '✅' : status === 'error' ? '❌' : status === 'duplicate' ? '⚠️' : '📝';
    
    console.log(`${emoji} [${this.current}/${this.total}] (${percentage}%) ${this.taskName}: ${itemName}`);
    
    if (status === 'success') this.successes++;
    else if (status === 'error') this.errors++;
    else if (status === 'duplicate') this.duplicates++;
  }

  logError(itemName, error) {
    this.logItem(itemName, 'error');
    console.error(`   └─ Error: ${error.message}`);
  }

  logSummary() {
    const duration = Date.now() - this.startTime;
    const seconds = Math.round(duration / 1000);
    
    console.log(`\n📊 ${this.taskName} Summary:`);
    console.log(`   Total: ${this.total}`);
    console.log(`   Success: ${this.successes}`);
    console.log(`   Duplicates: ${this.duplicates}`);
    console.log(`   Errors: ${this.errors}`);
    console.log(`   Duration: ${seconds}s`);
    
    return {
      total: this.total,
      success: this.successes,
      duplicates: this.duplicates,
      errors: this.errors,
      duration: duration
    };
  }
}

/**
 * Handle controller responses consistently
 */
export function handleControllerResponse(response) {
  // If response has a status method, it's likely an error
  if (response && response.status) {
    if (response.status >= 400) {
      throw new Error(response.message || 'Controller operation failed');
    }
  }
  
  // Extract ID from various response formats
  if (response && response.id) return response.id;
  if (response && response.data && response.data.id) return response.data.id;
  if (typeof response === 'string') return response;
  
  return null;
}

/**
 * Convert legacy date formats to ISO strings for DateService
 */
export function convertLegacyDate(dateValue, dateService) {
  if (!dateValue) return null;

  try {
    // Handle various date formats
    if (typeof dateValue === 'string') {
      // Check if already ISO format
      if (dateValue.includes('T')) {
        return dateValue;
      }
      
      // Handle MM/DD/YYYY format
      if (dateValue.includes('/')) {
        const [month, day, year] = dateValue.split('/');
        return DateTime.fromObject(
          { year: parseInt(year), month: parseInt(month), day: parseInt(day) },
          { zone: dateService.timezone }
        ).toISO();
      }
      
      // Handle YYYY-MM-DD format
      if (dateValue.includes('-')) {
        return DateTime.fromSQL(dateValue, { zone: dateService.timezone }).toISO();
      }
    }
    
    // Handle Date objects
    if (dateValue instanceof Date) {
      return DateTime.fromJSDate(dateValue, { zone: dateService.timezone }).toISO();
    }
    
    // Handle timestamps
    if (dateValue && typeof dateValue.toDate === 'function') {
      return DateTime.fromJSDate(dateValue.toDate(), { zone: dateService.timezone }).toISO();
    }
    
    return null;
  } catch (error) {
    console.error(`Date conversion error for "${dateValue}":`, error.message);
    return null;
  }
}

/**
 * Validate import data structure
 */
export function validateImportData(data, requiredFields) {
  const errors = [];
  
  if (!Array.isArray(data)) {
    errors.push('Data must be an array');
    return { valid: false, errors };
  }
  
  if (data.length === 0) {
    errors.push('Data array is empty');
    return { valid: false, errors };
  }
  
  // Check first item for required fields
  const firstItem = data[0];
  for (const field of requiredFields) {
    if (!(field in firstItem)) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Load and parse JSON data file
 */
export async function loadJsonData(filePath) {
  try {
    const fs = await import('fs/promises');
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    throw new Error(`Failed to load data from ${filePath}: ${error.message}`);
  }
}

/**
 * Create import summary report
 */
export function createImportSummary(scriptName, results, startTime) {
  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);
  
  return {
    script: scriptName,
    timestamp: new Date().toISOString(),
    duration: `${duration}s`,
    results: results,
    success: results.errors === 0,
    summary: `Imported ${results.success}/${results.total} items with ${results.duplicates} duplicates and ${results.errors} errors`
  };
}