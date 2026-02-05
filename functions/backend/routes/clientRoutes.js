// backend/routes/clientRoutes.js
import { logDebug, logInfo, logWarn, logError } from '../../../shared/logger.js';
import express from 'express';
const router = express.Router();
import { getClient, listAuthorizedClients } from '../controllers/clientsController.js';
import { authenticateUserWithProfile } from '../middleware/clientAuth.js';
import hoaDuesRoutes from './hoaDues.js';
import transactionsRoutes from './transactions.js';
import accountsRoutes from './accounts.js';
import vendorsRoutes from './vendors.js';
import categoriesRoutes from './categories.js';
import paymentMethodsRoutes from './paymentMethods.js';
import unitsRoutes from './units.js';
import emailRoutes from './email.js';
import reportsRoutes from './reports.js';
import balancesRoutes from './balances.js';
import projectsRoutes from './projects.js';
import waterRoutes from './waterRoutes.js';
import configRoutes from './config.js';
import yearEndRoutes from './yearEnd.js';

// Test route
router.get('/test', (req, res) => {
  res.send('Test route works!');
});

// List authorized clients for the authenticated user (SECURE)
router.get('/', authenticateUserWithProfile, listAuthorizedClients);

// Get a specific client by ID (SECURE)
router.get('/:id', authenticateUserWithProfile, getClient);

// HOA Dues routes moved to domain-specific mounting at /hoadues
// See backend/index.js:110 for the new mounting pattern

// Mount Transactions routes
router.use('/:clientId/transactions', (req, res, next) => {
  // Make sure clientId from the parent router is available to the child router
  const clientId = req.params.clientId;
  logDebug('🚀 [CLIENT ROUTER] Transactions route - passing clientId:', clientId);
  logDebug('🚀 [CLIENT ROUTER] Full URL:', req.originalUrl);
  logDebug('🚀 [CLIENT ROUTER] All params:', req.params);
  
  // Store original URL parameters before they get overwritten
  req.originalParams = req.originalParams || {};
  req.originalParams.clientId = clientId;
  
  logDebug('🚀 [CLIENT ROUTER] originalParams after setting:', req.originalParams);
  
  next();
}, transactionsRoutes);

// Mount Accounts routes
router.use('/:clientId/accounts', (req, res, next) => {
  // Make sure clientId from the parent router is available to the child router
  const clientId = req.params.clientId;
  logDebug('Client router passing clientId for accounts:', clientId);
  
  // Store original URL parameters before they get overwritten
  req.originalParams = req.originalParams || {};
  req.originalParams.clientId = clientId;
  
  next();
}, accountsRoutes);

// Mount Balances routes
router.use('/:clientId/balances', (req, res, next) => {
  // Make sure clientId from the parent router is available to the child router
  const clientId = req.params.clientId;
  logDebug('Client router passing clientId for balances:', clientId);
  
  // Store original URL parameters before they get overwritten
  req.originalParams = req.originalParams || {};
  req.originalParams.clientId = clientId;
  
  next();
}, balancesRoutes);

// Mount Vendors routes
router.use('/:clientId/vendors', (req, res, next) => {
  // Make sure clientId from the parent router is available to the child router
  const clientId = req.params.clientId;
  logDebug('Client router passing clientId for vendors:', clientId);
  
  // Store original URL parameters before they get overwritten
  req.originalParams = req.originalParams || {};
  req.originalParams.clientId = clientId;
  
  next();
}, vendorsRoutes);

// Mount Categories routes
router.use('/:clientId/categories', (req, res, next) => {
  // Make sure clientId from the parent router is available to the child router
  const clientId = req.params.clientId;
  logDebug('Client router passing clientId for categories:', clientId);
  
  // Store original URL parameters before they get overwritten
  req.originalParams = req.originalParams || {};
  req.originalParams.clientId = clientId;
  
  next();
}, categoriesRoutes);

// Mount Payment Methods routes
router.use('/:clientId/paymentMethods', (req, res, next) => {
  // Make sure clientId from the parent router is available to the child router
  const clientId = req.params.clientId;
  logDebug('Client router passing clientId for payment methods:', clientId);
  
  // Store original URL parameters before they get overwritten
  req.originalParams = req.originalParams || {};
  req.originalParams.clientId = clientId;
  
  next();
}, paymentMethodsRoutes);

// Mount Units routes
router.use('/:clientId/units', (req, res, next) => {
  // Make sure clientId from the parent router is available to the child router
  const clientId = req.params.clientId;
  logDebug('Client router passing clientId for units:', clientId);
  
  // Store original URL parameters before they get overwritten
  req.originalParams = req.originalParams || {};
  req.originalParams.clientId = clientId;
  
  next();
}, unitsRoutes);

// Mount Email routes
router.use('/:clientId/email', (req, res, next) => {
  // Make sure clientId from the parent router is available to the child router
  const clientId = req.params.clientId;
  logDebug('Client router passing clientId for email:', clientId);
  
  // Store original URL parameters before they get overwritten
  req.originalParams = req.originalParams || {};
  req.originalParams.clientId = clientId;
  
  next();
}, emailRoutes);

// Mount Reports routes
router.use('/:clientId/reports', (req, res, next) => {
  // Make sure clientId from the parent router is available to the child router
  const clientId = req.params.clientId;
  logDebug('Client router passing clientId for reports:', clientId);
  
  // Store original URL parameters before they get overwritten
  req.originalParams = req.originalParams || {};
  req.originalParams.clientId = clientId;
  
  next();
}, reportsRoutes);


// Mount Projects routes (generic projects pattern for water bills, propane, etc.)
router.use('/:clientId/projects', (req, res, next) => {
  // Make sure clientId from the parent router is available to the child router
  const clientId = req.params.clientId;
  logDebug('Client router passing clientId for projects:', clientId);
  
  // Store original URL parameters before they get overwritten
  req.originalParams = req.originalParams || {};
  req.originalParams.clientId = clientId;
  
  next();
}, projectsRoutes);

// Mount Water Bills routes (new structure)
// Legacy water bills mounting removed - now uses domain-specific /water routes
// See backend/index.js:75 for domain mounting: app.use('/water', waterRoutes)

// Mount Config routes
router.use('/:clientId/config', (req, res, next) => {
  // Make sure clientId from the parent router is available to the child router
  const clientId = req.params.clientId;
  logDebug('Client router passing clientId for config:', clientId);
  
  // Store original URL parameters before they get overwritten
  req.originalParams = req.originalParams || {};
  req.originalParams.clientId = clientId;
  
  next();
}, configRoutes);

// Mount Year-End Processing routes
router.use('/:clientId/year-end', (req, res, next) => {
  // Make sure clientId from the parent router is available to the child router
  const clientId = req.params.clientId;
  logDebug('Client router passing clientId for year-end:', clientId);
  
  // Store original URL parameters before they get overwritten
  req.originalParams = req.originalParams || {};
  req.originalParams.clientId = clientId;
  
  next();
}, yearEndRoutes);

export default router;