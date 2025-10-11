import admin from 'firebase-admin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Load service account to get expected project ID
const getExpectedProjectId = () => {
  if (process.env.NODE_ENV === 'production') {
    return require('../sams-production-serviceAccountKey.json').project_id;
  } else if (process.env.NODE_ENV === 'staging') {
    return require('../serviceAccountKey-staging.json').project_id;
  }
  return require('../serviceAccountKey.json').project_id;
};

// Authentication middleware to verify Firebase ID tokens
export const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No valid authorization header' });
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Invalid authorization format - use 'Bearer YOUR_TOKEN'" });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify the Firebase ID token
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (verifyError) {
      // Re-throw with proper context for error handling below
      throw verifyError;
    }
    
    // Check if token is from correct Firebase project
    const expectedProjectId = getExpectedProjectId();
    if (decodedToken.aud !== expectedProjectId) {
      console.error(`Token from wrong project. Expected: ${expectedProjectId}, Got: ${decodedToken.aud}`);
      return res.status(401).json({ error: "Token is from incorrect Firebase project" });
    }
    
    // Add user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.display_name,
      emailVerified: decodedToken.email_verified
    };
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    // Provide specific error messages based on Firebase error codes
    let errorMessage = 'Invalid token format - not a valid Firebase token'; // Default for truly invalid tokens
    
    if (error.code === 'auth/id-token-expired') {
      errorMessage = 'Token has expired - please log in again';
    } else if (error.code === 'auth/id-token-revoked') {
      errorMessage = 'Token has been revoked - please log in again';
    } else if (error.code === 'auth/argument-error' || error.code === 'auth/invalid-id-token') {
      // These are the actual error codes for malformed tokens
      errorMessage = 'Invalid token format - not a valid Firebase token';
    } else if (error.code === 'auth/invalid-argument') {
      // This can happen when token is completely malformed
      errorMessage = 'Invalid token format - not a valid Firebase token';
    } else if (error.message && error.message.includes('Firebase ID token has incorrect')) {
      // This should be caught by our explicit project ID check above, but keep as fallback
      errorMessage = 'Token is from incorrect Firebase project';
    } else if (error.message && error.message.includes('Decoding Firebase ID token failed')) {
      // Generic decoding failure
      errorMessage = 'Invalid token format - not a valid Firebase token';
    }
    
    res.status(401).json({ error: errorMessage });
  }
};
