// controllers/projectsDataController.js
import ProjectsService from '../services/projectsService.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { getNow } from '../services/DateService.js';

const projectsService = new ProjectsService();

/**
 * Generic endpoints that work for any project type (water bills, propane, etc.)
 */

export const getProjectPeriod = async (req, res) => {
  try {
    const { clientId, projectType, year, month } = req.params;
    
    // Validate parameters
    if (!clientId || !projectType || !year || month === undefined) {
      return res.status(400).json({ 
        error: 'Missing required parameters: clientId, projectType, year, month' 
      });
    }
    
    const data = await projectsService.getProjectPeriod(
      clientId, 
      projectType, 
      parseInt(year), 
      parseInt(month)
    );
    
    res.json({
      success: true,
      projectType,
      year: parseInt(year),
      month: parseInt(month),
      data
    });
  } catch (error) {
    console.error('Error fetching project data:', error);
    res.status(500).json({ 
      error: error.message,
      type: 'PROJECT_DATA_FETCH_ERROR'
    });
  }
};

export const updateProjectData = async (req, res) => {
  try {
    const { clientId, projectType, year, month } = req.params;
    const { readings } = req.body;
    
    // Validate parameters
    if (!clientId || !projectType || !year || month === undefined) {
      return res.status(400).json({ 
        error: 'Missing required parameters: clientId, projectType, year, month' 
      });
    }
    
    if (!readings || typeof readings !== 'object') {
      return res.status(400).json({ 
        error: 'Missing or invalid readings object' 
      });
    }
    
    const updated = await projectsService.updateReadings(
      clientId,
      projectType,
      parseInt(year),
      parseInt(month),
      readings
    );
    
    // Write audit log
    await writeAuditLog({
      module: 'projects',
      action: 'update',
      parentPath: `clients/${clientId}/projects/${projectType}/${year}/data`,
      docId: `month-${month}`,
      friendlyName: `${projectType} readings for ${year}-${month}`,
      notes: `Updated ${Object.keys(updated).length} units`,
      clientId
    });
    
    res.json({
      success: true,
      updated: Object.keys(updated).length,
      data: updated
    });
  } catch (error) {
    console.error('Error updating project data:', error);
    res.status(500).json({ 
      error: error.message,
      type: 'PROJECT_DATA_UPDATE_ERROR'
    });
  }
};

export const processProjectPayment = async (req, res) => {
  try {
    const { clientId, projectType, year, month } = req.params;
    const { unitId, amount, method } = req.body;
    
    // Validate parameters
    if (!clientId || !projectType || !year || month === undefined) {
      return res.status(400).json({ 
        error: 'Missing required parameters: clientId, projectType, year, month' 
      });
    }
    
    if (!unitId || !amount || amount <= 0) {
      return res.status(400).json({ 
        error: 'Missing or invalid payment data: unitId, amount (must be > 0)' 
      });
    }
    
    // CRITICAL: Using unitId NOT id per requirements
    const payment = await projectsService.processPayment(
      clientId,
      projectType,
      parseInt(year),
      parseInt(month),
      unitId, // Using unitId field name per critical requirements
      Math.round(amount * 100), // Convert dollars to cents
      method || 'cash'
    );
    
    // Write audit log
    await writeAuditLog({
      module: 'projects',
      action: 'payment',
      parentPath: `clients/${clientId}/projects/${projectType}/${year}/data`,
      docId: `${unitId}-payment`,
      friendlyName: `Payment for unit ${unitId}`,
      notes: `Payment: $${amount}, Method: ${method || 'cash'}`,
      clientId
    });
    
    res.json({
      success: true,
      payment
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ 
      error: error.message,
      type: 'PROJECT_PAYMENT_ERROR'
    });
  }
};

/**
 * Water-specific convenience endpoints
 * These are shortcuts that set projectType to 'waterBills'
 */

export const submitWaterReadings = async (req, res) => {
  // Set projectType and delegate to generic endpoint
  req.params.projectType = 'waterBills';
  return updateProjectData(req, res);
};

export const getWaterBills = async (req, res) => {
  // Set projectType and delegate to generic endpoint
  req.params.projectType = 'waterBills';
  return getProjectPeriod(req, res);
};

export const processWaterPayment = async (req, res) => {
  // Set projectType and delegate to generic endpoint
  req.params.projectType = 'waterBills';
  return processProjectPayment(req, res);
};

/**
 * Bulk data operations following SAMS pattern
 */

export const getProjectDataForYear = async (req, res) => {
  try {
    const { clientId, projectType, year } = req.params;
    
    // Validate parameters
    if (!clientId || !projectType || !year) {
      return res.status(400).json({ 
        error: 'Missing required parameters: clientId, projectType, year' 
      });
    }
    
    const data = await projectsService.getProjectDataForYear(
      clientId,
      projectType,
      parseInt(year)
    );
    
    res.json({
      success: true,
      clientId,
      projectType,
      year: parseInt(year),
      dataFetched: getNow().toISOString(),
      data
    });
  } catch (error) {
    console.error('Error fetching project year data:', error);
    res.status(500).json({ 
      error: error.message,
      type: 'PROJECT_YEAR_DATA_ERROR'
    });
  }
};

/**
 * Configuration management
 */

export const getProjectConfig = async (req, res) => {
  try {
    const { clientId, projectType } = req.params;
    
    if (!clientId || !projectType) {
      return res.status(400).json({ 
        error: 'Missing required parameters: clientId, projectType' 
      });
    }
    
    const config = await projectsService.getProjectConfig(clientId, projectType);
    
    res.json({
      success: true,
      clientId,
      projectType,
      config
    });
  } catch (error) {
    console.error('Error fetching project config:', error);
    res.status(500).json({ 
      error: error.message,
      type: 'PROJECT_CONFIG_ERROR'
    });
  }
};

export const setProjectConfig = async (req, res) => {
  try {
    const { clientId, projectType } = req.params;
    const config = req.body;
    
    if (!clientId || !projectType) {
      return res.status(400).json({ 
        error: 'Missing required parameters: clientId, projectType' 
      });
    }
    
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ 
        error: 'Missing or invalid configuration object' 
      });
    }
    
    const savedConfig = await projectsService.setProjectConfig(clientId, projectType, config);
    
    // Write audit log
    await writeAuditLog({
      module: 'projects',
      action: 'config',
      parentPath: `clients/${clientId}/projects/${projectType}/config`,
      docId: 'settings',
      friendlyName: `${projectType} configuration`,
      notes: `Updated configuration for ${projectType}`,
      clientId
    });
    
    res.json({
      success: true,
      config: savedConfig
    });
  } catch (error) {
    console.error('Error setting project config:', error);
    res.status(500).json({ 
      error: error.message,
      type: 'PROJECT_CONFIG_UPDATE_ERROR'
    });
  }
};

/**
 * Project initialization
 */

export const initializeProject = async (req, res) => {
  try {
    const { clientId, projectType, year } = req.params;
    const config = req.body;
    
    if (!clientId || !projectType || !year) {
      return res.status(400).json({ 
        error: 'Missing required parameters: clientId, projectType, year' 
      });
    }
    
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ 
        error: 'Missing or invalid configuration object' 
      });
    }
    
    const initialized = await projectsService.initializeProjectYear(
      clientId,
      projectType,
      parseInt(year),
      config
    );
    
    // Write audit log
    await writeAuditLog({
      module: 'projects',
      action: 'create',
      parentPath: `clients/${clientId}/projects/${projectType}/${year}`,
      docId: 'data',
      friendlyName: `${projectType} initialization for ${year}`,
      notes: `Initialized ${projectType} structure for year ${year}`,
      clientId
    });
    
    res.json({
      success: true,
      initialized
    });
  } catch (error) {
    console.error('Error initializing project:', error);
    res.status(500).json({ 
      error: error.message,
      type: 'PROJECT_INIT_ERROR'
    });
  }
};