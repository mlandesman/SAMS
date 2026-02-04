// routes/projects.js
import express from 'express';
import { authenticateUserWithProfile, enforceClientAccess } from '../middleware/clientAuth.js';
import {
  listProjectsHandler,
  getProjectHandler,
  createProjectHandler,
  updateProjectHandler,
  deleteProjectHandler,
  // Bids handlers
  listBidsHandler,
  getBidHandler,
  createBidHandler,
  updateBidHandler,
  deleteBidHandler,
  selectBidHandler,
  unselectBidHandler
} from '../controllers/projectsController.js';
import { generateBidComparisonHtml } from '../services/bidComparisonHtmlService.js';
import { generatePdf } from '../services/pdfService.js';
import { getApp } from '../firebase.js';
import { DateTime } from 'luxon';
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
 * Special Assessment Projects Routes (MUST be before :projectType routes)
 * These handle actual project entities like "column-repairs-2025"
 */

// List all projects for a client
// GET /api/clients/:clientId/projects
// Query params: year (optional) - filter by fiscal year
router.get('/', listProjectsHandler);

// Create a new project
// POST /api/clients/:clientId/projects
router.post('/', createProjectHandler);

// Get a single project by ID
// GET /api/clients/:clientId/projects/:projectId
// Note: If projectId matches a known projectType (waterBills, etc), it falls through to the next handler
router.get('/:projectId', getProjectHandler);

// Update a project
// PUT /api/clients/:clientId/projects/:projectId
router.put('/:projectId', updateProjectHandler);

// Delete a project
// DELETE /api/clients/:clientId/projects/:projectId
router.delete('/:projectId', deleteProjectHandler);

/**
 * Bids Routes (subcollection under projects)
 * These handle bid management for special assessment projects
 */

// List all bids for a project
// GET /api/clients/:clientId/projects/:projectId/bids
router.get('/:projectId/bids', listBidsHandler);

// Unselect current bid (must be before /:bidId routes)
// POST /api/clients/:clientId/projects/:projectId/bids/unselect
router.post('/:projectId/bids/unselect', unselectBidHandler);

// Create a new bid
// POST /api/clients/:clientId/projects/:projectId/bids
router.post('/:projectId/bids', createBidHandler);

// Get a single bid
// GET /api/clients/:clientId/projects/:projectId/bids/:bidId
router.get('/:projectId/bids/:bidId', getBidHandler);

// Update a bid
// PUT /api/clients/:clientId/projects/:projectId/bids/:bidId
router.put('/:projectId/bids/:bidId', updateBidHandler);

// Delete a bid
// DELETE /api/clients/:clientId/projects/:projectId/bids/:bidId
router.delete('/:projectId/bids/:bidId', deleteBidHandler);

// Select a bid
// POST /api/clients/:clientId/projects/:projectId/bids/:bidId/select
router.post('/:projectId/bids/:bidId/select', selectBidHandler);

/**
 * Generate Bid Comparison PDF for Poll Attachment
 * POST /api/clients/:clientId/projects/:projectId/bids/comparison-pdf
 * Body: { language: 'english' | 'spanish' }
 * Response: { success: true, document: { url, filename, language, projectId } }
 * 
 * Generates a bid comparison PDF, stores it in Firebase Storage with a public URL,
 * and returns the URL for attaching to a poll/vote.
 */
router.post('/:projectId/bids/comparison-pdf', async (req, res) => {
  try {
    const clientId = req.originalParams?.clientId || req.params.clientId;
    const { projectId } = req.params;
    const { language = 'english' } = req.body;
    const user = req.user;
    
    if (!clientId || !projectId) {
      return res.status(400).json({
        success: false,
        error: 'Client ID and Project ID are required'
      });
    }
    
    // Generate HTML
    const { html, meta } = await generateBidComparisonHtml(clientId, projectId, language);
    
    // Generate PDF from HTML
    const pdfBuffer = await generatePdf(html, {
      format: 'Letter',
      landscape: meta.bidCount > 3, // Use landscape for many bids
      footerMeta: {
        statementId: meta.reportId,
        generatedAt: DateTime.now().setZone('America/Cancun').toFormat('dd-MMM-yy'),
        language
      }
    });
    
    // Upload to Firebase Storage
    const app = await getApp();
    const bucket = app.storage().bucket();
    const langCode = language === 'spanish' ? 'es' : 'en';
    const filename = `project-${projectId}-bids-${langCode}.pdf`;
    const storagePath = `clients/${clientId}/poll-documents/${filename}`;
    
    const file = bucket.file(storagePath);
    await file.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        metadata: {
          clientId,
          projectId,
          projectName: meta.projectName,
          language,
          bidCount: String(meta.bidCount),
          generatedBy: user?.email || 'system',
          generatedAt: new Date().toISOString()
        }
      }
    });
    
    // Make file publicly readable
    await file.makePublic();
    
    // Generate public URL
    const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    
    res.json({
      success: true,
      document: {
        url,
        filename,
        language,
        projectId,
        projectName: meta.projectName,
        bidCount: meta.bidCount,
        storagePath
      }
    });
  } catch (error) {
    console.error('Bid comparison PDF for poll error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Generic project TYPE routes
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