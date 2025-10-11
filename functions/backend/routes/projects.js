// routes/projects.js
import express from 'express';
import { authenticateUserWithProfile, enforceClientAccess } from '../middleware/clientAuth.js';
import {
  getProjectPeriod,
  updateProjectData,
  processProjectPayment,
  submitWaterReadings,
  getWaterBills,
  processWaterPayment,
  getProjectDataForYear,
  getProjectConfig,
  setProjectConfig,
  initializeProject
} from '../controllers/projectsDataController.js';

const router = express.Router({ mergeParams: true });

// Apply authentication to all routes
router.use(authenticateUserWithProfile);

// Apply client access validation to all routes
// This ensures users can only access projects for clients they have permission to access
router.use(enforceClientAccess);

/**
 * Generic project routes
 * These work for any project type: waterBills, propane, roofAssessments, etc.
 */

// Get project data for a specific period
// GET /api/clients/:clientId/projects/:projectType/:year/:month
router.get('/:projectType/:year/:month', getProjectPeriod);

// Update project data (readings, measurements, etc.)
// POST /api/clients/:clientId/projects/:projectType/:year/:month/data
router.post('/:projectType/:year/:month/data', updateProjectData);

// Process payment for a project
// POST /api/clients/:clientId/projects/:projectType/:year/:month/payments
router.post('/:projectType/:year/:month/payments', processProjectPayment);

// Get all project data for a year (bulk fetch)
// GET /api/clients/:clientId/projects/:projectType/:year
router.get('/:projectType/:year', getProjectDataForYear);

// Project configuration endpoints
// GET /api/clients/:clientId/projects/:projectType/config
router.get('/:projectType/config', getProjectConfig);

// POST /api/clients/:clientId/projects/:projectType/config
router.post('/:projectType/config', setProjectConfig);

// Initialize project structure for a year
// POST /api/clients/:clientId/projects/:projectType/:year/initialize
router.post('/:projectType/:year/initialize', initializeProject);

/**
 * Water-specific convenience routes
 * These are shortcuts for the most common project type
 */

// Submit water meter readings
// POST /api/clients/:clientId/projects/waterBills/:year/:month/readings
router.post('/waterBills/:year/:month/readings', submitWaterReadings);

// Get water bills for a period
// GET /api/clients/:clientId/projects/waterBills/:year/:month
router.get('/waterBills/:year/:month', getWaterBills);

// Process water bill payment
// POST /api/clients/:clientId/projects/waterBills/:year/:month/payments
router.post('/waterBills/:year/:month/payments', processWaterPayment);

/**
 * Error handling middleware
 */
router.use((error, req, res, next) => {
  console.error('Projects route error:', error);
  
  // Handle specific error types
  if (error.message.includes('No data for month')) {
    return res.status(404).json({
      error: 'Period data not found',
      message: error.message,
      type: 'PERIOD_NOT_FOUND'
    });
  }
  
  if (error.message.includes('No bill for unit')) {
    return res.status(404).json({
      error: 'Unit bill not found',
      message: error.message,
      type: 'UNIT_BILL_NOT_FOUND'
    });
  }
  
  if (error.message.includes('Data integrity error')) {
    return res.status(422).json({
      error: 'Data integrity violation',
      message: error.message,
      type: 'DATA_INTEGRITY_ERROR'
    });
  }
  
  // Generic server error
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
    type: 'INTERNAL_ERROR'
  });
});

export default router;