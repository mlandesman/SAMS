# Firebase Authentication Testing Guide

This guide explains how to obtain Firebase authentication tokens for testing the SAMS API endpoints.

## Overview

The SAMS backend uses Firebase Authentication to secure API endpoints. All protected endpoints require a valid Firebase ID token in the Authorization header:

```
Authorization: Bearer <id-token>
```

## Methods to Get Auth Tokens

### 1. Email/Password Authentication

The most common method for testing with existing users:

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCvZ7_mhNbIQDHGg_CSxOYBmSqvKBW5lJo",
  authDomain: "sandyland-management-system.firebaseapp.com",
  projectId: "sandyland-management-system",
  storageBucket: "sandyland-management-system.firebasestorage.app",
  messagingSenderId: "1086002290145",
  appId: "1:1086002290145:web:a1a1fe980ead7630d186a0",
  measurementId: "G-BSPD6YFJ25"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Sign in and get token
const userCredential = await signInWithEmailAndPassword(auth, email, password);
const idToken = await userCredential.user.getIdToken();
```

### 2. Custom Token Authentication (Admin SDK)

For creating test tokens programmatically:

```javascript
import admin from 'firebase-admin';

// Initialize admin SDK with service account
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'sandyland-management-system'
});

// Create custom token
const customToken = await admin.auth().createCustomToken(uid, {
  email: 'test@example.com',
  // Add custom claims as needed
});

// Exchange custom token for ID token using client SDK
const userCredential = await signInWithCustomToken(auth, customToken);
const idToken = await userCredential.user.getIdToken();
```

### 3. Anonymous Authentication

For testing without user credentials:

```javascript
import { signInAnonymously } from 'firebase/auth';

const userCredential = await signInAnonymously(auth);
const idToken = await userCredential.user.getIdToken();
```

## Using the Test Scripts

### Get Firebase Test Token Script

We've provided a comprehensive script to generate test tokens:

```bash
# Install dependencies first
cd scripts
npm install commander

# Email/Password authentication
node get-firebase-test-token.js --email user@example.com --password yourpassword

# Custom token authentication
node get-firebase-test-token.js --custom-auth user@example.com

# Anonymous authentication
node get-firebase-test-token.js --anonymous

# Show usage examples
node get-firebase-test-token.js --email user@example.com --password yourpassword --show-usage
```

### Example Test Script

See `scripts/test-with-auth-token.js` for a complete example of:
- Authenticating a user
- Getting the ID token
- Making authenticated API requests
- Testing protected endpoints

## Using Tokens in Tests

### With fetch (Node.js)

```javascript
const response = await fetch('http://localhost:5001/api/user/profile', {
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  }
});
```

### With axios

```javascript
const axios = require('axios');
axios.defaults.headers.common['Authorization'] = `Bearer ${idToken}`;

const response = await axios.get('http://localhost:5001/api/user/profile');
```

### With curl

```bash
curl -H "Authorization: Bearer ${ID_TOKEN}" \
     -H "Content-Type: application/json" \
     http://localhost:5001/api/user/profile
```

## Token Details

- **Validity**: Firebase ID tokens are valid for 1 hour
- **Refresh**: Call `getIdToken()` again to get a fresh token
- **Force Refresh**: Use `getIdToken(true)` to force token refresh
- **Claims**: Tokens include user email, UID, and custom claims

## Backend Token Validation

The backend validates tokens in the `authenticateUserWithProfile` middleware:

1. Extracts token from `Authorization: Bearer <token>` header
2. Verifies token using Firebase Admin SDK
3. Loads user profile from Firestore
4. Adds user context to request object

## Security Best Practices

1. **Test Users**: Create dedicated test users with limited permissions
2. **Environment Variables**: Store test credentials in environment variables
3. **Token Storage**: Never commit tokens to version control
4. **Token Rotation**: Refresh tokens regularly in long-running tests
5. **Cleanup**: Delete test users and data after testing

## Common Issues

### "No valid authorization header"
- Ensure you include the `Bearer` prefix
- Check that the token is properly formatted

### "Invalid or expired token"
- Token may have expired (1 hour lifetime)
- Token may be malformed
- Firebase project mismatch

### "Access denied to this client"
- User doesn't have access to the requested client
- Check user's `clientAccess` in Firestore

## Example Test Users

For development testing, you can create test users with specific roles:

```javascript
// Create a test user with admin access to MTC client
const testUser = {
  email: 'test-admin@example.com',
  globalRole: 'user',
  clientAccess: {
    'MTC': {
      role: 'admin',
      clientName: 'MTC Test Client'
    }
  }
};
```

## Related Scripts

- `scripts/get-firebase-test-token.js` - Generate auth tokens
- `scripts/test-with-auth-token.js` - Example authenticated API tests
- `scripts/createTestUser.js` - Create test users
- `scripts/test-auth-system.js` - Comprehensive auth system tests
- `scripts/test-client-isolation.js` - Client access control tests

## Additional Resources

- [Firebase Auth REST API](https://firebase.google.com/docs/reference/rest/auth)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [ID Token Verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens)