import dotenv from 'dotenv';
import { getDb, initializeFirebase } from './firebase.js'; // Import initializeFirebase
import express from 'express';
import cors from 'cors';
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
import hoaDuesRoutes from './routes/hoaDues.js'; // Import HOA dues routes
import emailRoutesComm from './routes/emailRoutes.js'; // Import communication email routes
import { authenticateUserWithProfile } from './middleware/clientAuth.js'; // Import authentication middleware

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

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
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // In development, allow any localhost origin
    if (process.env.NODE_ENV === 'development' && origin.includes('localhost')) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true // Allow cookies and credentials
}));

// Increase request body size limit for email attachments (receipt images)
app.use(express.json({ limit: '50mb' })); // for parsing application/json
app.use(express.urlencoded({ limit: '50mb', extended: true })); // for parsing application/x-www-form-urlencoded

// Initialize Firebase before importing routes
await initializeFirebase();

// PUBLIC ROUTES (NO auth required) - Mount BEFORE authenticated routes
console.log('Mounting system routes (public)');
app.use('/system/exchange-rates', exchangeRatesRoutes); // Move to /system path (public)
app.use('/system/version', versionRoutes); // Clean architecture (public)

// COMMUNICATION ROUTES (domain-specific email functionality)
console.log('Mounting communication email routes');
app.use('/comm/email', emailRoutesComm); // Communication email routes

// AUTHENTICATED ROUTES (require auth)
console.log('Mounting water routes');
app.use('/water', waterRoutes); // Domain-specific water billing

// AUTH & USER MANAGEMENT DOMAIN
console.log('Mounting auth domain routes');
app.use('/api/auth', authRoutes); // Authentication endpoints  
app.use('/auth/user', userRoutes); // User management (migrated to auth domain)

// CLIENT DOMAIN (same pattern as /auth, /water, /comm)
console.log('Mounting clients domain routes');
app.use('/clients', clientRoutes); // Client domain (same pattern as /auth, /water, /comm)

// Email routes now mounted only via clientRoutes.js to avoid duplication
// See backend/routes/clientRoutes.js:130 for the single mounting point

// Mount document routes under each client
console.log('Mounting document routes');
app.use('/clients/:clientId/documents', documentsRoutes); // Add document routes

// Client onboarding routes migrated to admin domain
// See /admin domain mounting at line 103

// Client management routes migrated to admin domain
// See /admin domain mounting at line 103

// ADMIN DOMAIN (domain-specific)
console.log('Mounting admin domain routes');
app.use('/admin', adminRoutes); // Admin functions under dedicated domain

// Version routes now mounted under /system (see above)

// HOA DUES DOMAIN (domain-specific with authentication)
console.log('Mounting HOA dues domain routes');
app.use('/hoadues', authenticateUserWithProfile, hoaDuesRoutes); // HOA dues under dedicated domain with auth

// SYSTEM HEALTH CHECK (under system domain)
app.get('/system/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
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
    ],
    legacy: [
      '/api/clients/*',          // LEGACY: Being migrated to domain-specific
    ]
  });
});

// Error handling middleware for malformed JSON - must be before app.listen()
app.use((err, req, res, next) => {
  // Only handle JSON syntax errors specifically
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: "Invalid JSON format",
      code: "INVALID_JSON"
    });
  }
  
  // Let other errors pass through to existing handlers
  next(err);
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});