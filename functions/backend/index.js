import dotenv from 'dotenv';
import { getDb, initializeFirebase } from './firebase.js'; // Import initializeFirebase
import express from 'express';
import cors from 'cors';
import { getNow } from './services/DateService.js';
import { logDebug, logInfo, logWarn, logError } from '../shared/logger.js';
// Transactions routes only available via client domain - see clientRoutes.js:49
import clientRoutes from './routes/clientRoutes.js'; // Import client routes
import exchangeRatesRoutes from './routes/exchangeRates.js'; // Import exchange rates routes
// Email routes only available via client domain - see clientRoutes.js:130
import userRoutes from './routes/user.js'; // Import user routes
import documentsRoutes from './routes/documents.js'; // Import documents routes
// Client onboarding routes now mounted via admin domain - see admin.js:103
// Client management routes now mounted via admin domain - see admin.js:106
import adminRoutes from './routes/admin.js'; // Import admin routes
import authRoutes from './routes/auth.js'; // Import auth routes
import versionRoutes from './routes/version.js'; // Import version routes
import waterRoutes from './routes/waterRoutes.js'; // Import clean water routes
import propaneRoutes from './routes/propaneRoutes.js'; // Import propane routes
import hoaDuesRoutes from './routes/hoaDues.js'; // Import HOA dues routes
import creditRoutes from './routes/creditRoutes.js'; // Import credit balance routes
import emailRoutesComm from './routes/emailRoutes.js'; // Import communication email routes
import paymentRoutes from './routes/paymentRoutes.js'; // Import unified payment routes
import reportsRoutes from './routes/reports.js'; // Import reports routes for Statement of Account
import budgetRoutes from './routes/budgets.js'; // Import budget routes
import translateRoutes from './routes/translateRoutes.js'; // Import translation routes for DeepL
import { authenticateUserWithProfile } from './middleware/clientAuth.js'; // Import authentication middleware
import voteRoutes from './routes/voteRoutes.js'; // Import polling & vote routes
import systemErrorRoutes from './routes/systemRoutes.js';

// New comment for testing


// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

// Increase timeout for file uploads (Firebase Functions default is 60s, but we need more for mobile networks)
// This helps with slower mobile network connections
app.use((req, res, next) => {
  // For multipart uploads, extend timeout to handle slower mobile networks
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    req.setTimeout(120000); // 2 minutes for uploads
    res.setTimeout(120000);
  }
  next();
});

// Configure CORS to allow credentials from frontend, PWA, and production
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://sams.sandyland.com.mx',
  'https://mobile.sams.sandyland.com.mx'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or PWA)
    if (!origin) {
      logDebug('🌐 CORS: Allowing request with no origin (mobile app/PWA)');
      return callback(null, true);
    }
    
    // In development, allow localhost and local network origins (for phone testing)
    const isLocalDev = origin.includes('localhost') || origin.match(/^https?:\/\/192\.168\.\d+\.\d+/);
    if (isLocalDev) {
      logDebug('🌐 CORS: Allowing local dev origin:', origin);
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      logDebug('🌐 CORS: Allowing origin:', origin);
      callback(null, true);
    } else {
      logError('🚫 CORS: Blocked origin:', origin);
      logError('🚫 CORS: Allowed origins:', allowedOrigins);
      callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
    }
  },
  credentials: true, // Allow cookies and credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control', 'Pragma'],
  exposedHeaders: ['Content-Length', 'Content-Type']
}));

// Increase request body size limit for email attachments (receipt images)
// CRITICAL: Body parsers must NOT run for multipart/form-data (multer handles it)
// The type function approach doesn't prevent stream consumption, so we use a different strategy:
// Only register body parsers for non-multipart requests by checking in middleware

// Middleware to mark multipart requests so body parsers skip them
app.use((req, res, next) => {
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  if (contentType.startsWith('multipart/form-data')) {
    // Mark request to skip body parsing - multer will handle it
    req._skipBodyParsing = true;
    logDebug('📤 Marked request to skip body parsing for multipart:', contentType);
  }
  next();
});

// JSON parser - only runs if not multipart
app.use((req, res, next) => {
  if (req._skipBodyParsing) {
    return next(); // Skip body parsing for multipart
  }
  // Only parse JSON content type
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  if (contentType.includes('application/json')) {
    express.json({ limit: '50mb' })(req, res, next);
  } else {
    next();
  }
});

// URL encoded parser - only runs if not multipart
app.use((req, res, next) => {
  if (req._skipBodyParsing) {
    return next(); // Skip body parsing for multipart
  }
  // Only parse URL encoded content type
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  if (contentType.includes('application/x-www-form-urlencoded')) {
    express.urlencoded({ limit: '50mb', extended: true })(req, res, next);
  } else {
    next();
  }
});

// Add middleware to handle multer errors before they become 500 errors
app.use((err, req, res, next) => {
  if (err.name === 'MulterError') {
    logError('📤 Multer error caught in middleware:', {
      code: err.code,
      message: err.message,
      field: err.field,
      url: req.url,
      method: req.method,
      contentType: req.headers['content-type']
    });
    
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ error: `File upload error: ${err.message}` });
  }
  
  // Handle "Unexpected end of form" errors from busboy
  if (err.message && err.message.includes('Unexpected end of form')) {
    logError('📤 Busboy "Unexpected end of form" error:', {
      message: err.message,
      url: req.url,
      method: req.method,
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length']
    });
    return res.status(400).json({ 
      error: 'File upload incomplete. The request was truncated. Please try again.',
      code: 'UPLOAD_INCOMPLETE'
    });
  }
  
  next(err);
});

// Initialize Firebase before mounting routes
// Wrap in async function for Vercel serverless compatibility
const initializeApp = async () => {
  try {
    await initializeFirebase();
    logInfo('✅ Firebase initialized successfully');

    const db = await getDb();
    const { registerErrorSink } = await import('../shared/logger.js');
    const { createErrorSinkForFirestore } = await import('./services/errorCaptureService.js');
    const errorSink = createErrorSinkForFirestore(db);
    registerErrorSink(errorSink);
    logInfo('✅ Error capture sink registered');

    // Email health check (non-blocking)
    try {
      const { getTransporter } = await import('./services/emailService.js');
      const transporter = getTransporter();
      if (transporter && typeof transporter.verify === 'function') {
        transporter.verify()
          .then(() => logInfo('✅ Email transporter verified'))
          .catch((emailErr) => logError('❌ Email transporter verification failed — emails will not send', emailErr));
      }
    } catch (healthErr) {
      logError('❌ Email health check failed to initialize', healthErr);
    }
  } catch (error) {
    logError('❌ Firebase initialization failed:', error);
    // Don't throw - let server start anyway for debugging
  }
};

// Call initialization (handles async properly)
initializeApp().catch(console.error);

// PUBLIC ROUTES (NO auth required) - Mount BEFORE authenticated routes
logDebug('Mounting system routes (public)');
app.use('/system/exchange-rates', exchangeRatesRoutes); // Move to /system path (public)
app.use('/system/version', versionRoutes); // Clean architecture (public)

// System error monitor API (authenticated, domain-specific route)
app.use('/error-reporting', systemErrorRoutes);

// COMMUNICATION ROUTES (domain-specific email functionality)
logDebug('Mounting communication email routes');
app.use('/comm/email', emailRoutesComm); // Communication email routes

// AUTHENTICATED ROUTES (require auth)
logDebug('Mounting water routes');
app.use('/water', waterRoutes); // Domain-specific water billing
logDebug('Mounting propane routes');
app.use('/propane', propaneRoutes); // Domain-specific propane tank readings
logDebug('Mounting vote routes');
app.use('/vote', voteRoutes); // Polling and voting domain

// AUTH & USER MANAGEMENT DOMAIN
logDebug('Mounting auth domain routes');
app.use('/api/auth', authRoutes); // Authentication endpoints  
app.use('/auth/user', userRoutes); // User management (migrated to auth domain)

// CLIENT DOMAIN (same pattern as /auth, /water, /comm)
logDebug('Mounting clients domain routes');
app.use('/clients', clientRoutes); // Client domain (same pattern as /auth, /water, /comm)

// Email routes now mounted only via clientRoutes.js to avoid duplication
// See backend/routes/clientRoutes.js:130 for the single mounting point

// Mount document routes under each client
logDebug('Mounting document routes');
app.use('/clients/:clientId/documents', documentsRoutes); // Add document routes

// Client onboarding routes migrated to admin domain
// See /admin domain mounting at line 103

// Client management routes migrated to admin domain
// See /admin domain mounting at line 103

// ADMIN DOMAIN (domain-specific)
logDebug('Mounting admin domain routes');
app.use('/admin', adminRoutes); // Admin functions under dedicated domain

// Version routes now mounted under /system (see above)

// HOA DUES DOMAIN (domain-specific with authentication)
logDebug('Mounting HOA dues domain routes');
app.use('/hoadues', authenticateUserWithProfile, hoaDuesRoutes); // HOA dues under dedicated domain with auth

// REPORTS DOMAIN (domain-specific Statement of Account endpoints)
logDebug('Mounting reports domain routes');
app.use(
  '/reports/:clientId',
  (req, res, next) => {
    const clientId = req.params.clientId;
    logDebug('Reports domain route - clientId:', clientId);

    // Preserve existing pattern used by clientRoutes for compatibility
    req.originalParams = req.originalParams || {};
    req.originalParams.clientId = clientId;

    next();
  },
  reportsRoutes
);

// CREDIT BALANCE DOMAIN (domain-independent with authentication)
logDebug('Mounting credit balance domain routes');
app.use('/credit', authenticateUserWithProfile, creditRoutes); // Credit balance operations (domain-independent)

// UNIFIED PAYMENT DOMAIN (cross-module payments with authentication)
logDebug('Mounting unified payment domain routes');
app.use('/payments', paymentRoutes); // Unified payment endpoints (authentication handled in routes)

// BUDGET DOMAIN (budget entry and management)
logDebug('Mounting budget domain routes');
app.use('/budgets', budgetRoutes); // Budget endpoints (authentication handled in routes)

// TRANSLATION DOMAIN (DeepL translation proxy)
logDebug('Mounting translation routes');
app.use('/translate', translateRoutes); // Translation endpoints (authentication handled in routes)

// SYSTEM HEALTH CHECK (under system domain)
app.get('/system/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: getNow().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Add root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'SAMS Backend API',
    version: '2.0.0',
    architecture: 'domain-specific-routing',
    domains: [
      '/system/*',     // System services (health, version, exchange rates)
      '/auth/*',       // Authentication & user management
      '/water/*',      // Water billing & meter management
      '/comm/*',       // Communications & email
      '/admin/*',      // Admin functions (users, clients, onboarding, management)
      '/hoadues/*',    // HOA dues & assessments
      '/payments/*',   // Unified payments (cross-module)
    ],
    legacy: [
      '/api/clients/*',          // LEGACY: Being migrated to domain-specific
    ]
  });
});

// Error handling middleware - must be before app.listen()
app.use((err, req, res, next) => {
  logError('🚨 Error middleware caught error:', {
    message: err.message,
    stack: err.stack,
    name: err.name,
    code: err.code,
    status: err.status,
    url: req.url,
    method: req.method
  });

  // Handle JSON syntax errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: "Invalid JSON format",
      code: "INVALID_JSON"
    });
  }
  
  // Handle multer errors (file upload errors)
  if (err.name === 'MulterError') {
    logError('📤 Multer error:', err.code, err.message);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large. Maximum size is 10MB.',
        code: 'FILE_TOO_LARGE'
      });
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files. Maximum is 1 file per upload.',
        code: 'TOO_MANY_FILES'
      });
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected file field. Expected field name: "file".',
        code: 'UNEXPECTED_FILE_FIELD'
      });
    } else {
      return res.status(400).json({
        error: `File upload error: ${err.message}`,
        code: 'MULTER_ERROR'
      });
    }
  }
  
  // Handle other known errors
  if (err.status) {
    return res.status(err.status).json({
      error: err.message || 'An error occurred',
      code: err.code || 'UNKNOWN_ERROR'
    });
  }
  
  // Default 500 error for unhandled errors
  logError('❌ Unhandled error, returning 500:', err);
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    logInfo(`Server is running on port ${port}`);
  });
}

// Export for Vercel serverless
export default app;