# Testing Protected Routes Locally

This guide explains how to test the newly protected API routes on localhost before deployment.

## Quick Start

### Method 1: Using the Node.js Test Script (Recommended)

```bash
# Test with anonymous auth (limited access)
node scripts/test-protected-routes.js

# Test with your actual user account (full access)
node scripts/test-protected-routes.js your-email@example.com your-password
```

This script will:
1. Test all routes WITHOUT authentication (should return 401)
2. Authenticate and get a Firebase token
3. Test all routes WITH authentication (should return 200/404)
4. Show actual data counts if using email/password auth

### Method 2: Using cURL

```bash
# Test without authentication (expect 401 errors)
./scripts/test-routes-with-curl.sh

# Test with authentication (need a Firebase token)
./scripts/test-routes-with-curl.sh YOUR_FIREBASE_TOKEN
```

## Getting a Firebase Auth Token

### Option 1: From the Mobile/Desktop App
1. Login to the SAMS app
2. Open Browser DevTools (F12)
3. Go to Network tab
4. Make any API request
5. Find the `Authorization: Bearer TOKEN` header
6. Copy the token (everything after "Bearer ")

### Option 2: Using Firebase Auth REST API
```bash
# Replace with your Firebase API key from .env
API_KEY="your-firebase-api-key"
EMAIL="your-email@example.com"
PASSWORD="your-password"

# Get ID token
curl -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"returnSecureToken\":true}"
```

The response will include an `idToken` field.

### Option 3: From Frontend Console
If you're logged into the app, open the browser console and run:
```javascript
// Get current user's token
firebase.auth().currentUser.getIdToken().then(token => console.log(token))
```

## Manual Testing Examples

### Test a Protected Route Without Auth (Should Fail)
```bash
curl http://localhost:5001/api/clients/MTC/accounts
# Expected: 401 Unauthorized
```

### Test a Protected Route With Auth (Should Succeed)
```bash
TOKEN="your-firebase-id-token"
curl -H "Authorization: Bearer $TOKEN" http://localhost:5001/api/clients/MTC/accounts
# Expected: 200 OK with account data
```

### Test Creating Data
```bash
TOKEN="your-firebase-id-token"

# Create a vendor
curl -X POST http://localhost:5001/api/clients/MTC/vendors \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Vendor", "email": "test@vendor.com"}'

# Create a category
curl -X POST http://localhost:5001/api/clients/MTC/categories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Category", "type": "expense"}'
```

## Protected Routes List

All these routes now require authentication:

1. **Accounts** - `/api/clients/:clientId/accounts`
2. **Vendors** - `/api/clients/:clientId/vendors`
3. **Categories** - `/api/clients/:clientId/categories`
4. **Payment Methods** - `/api/clients/:clientId/paymentMethods`
5. **Email** - `/api/clients/:clientId/email/*`
6. **Transactions** - `/api/clients/:clientId/transactions` (was already protected)
7. **Units** - `/api/clients/:clientId/units` (was already protected)
8. **Reports** - `/api/clients/:clientId/reports/*` (was already protected)

## Troubleshooting

### Getting 401 Errors with Valid Token
- Check token hasn't expired (tokens expire after 1 hour)
- Ensure you're including "Bearer " prefix in Authorization header
- Verify the user has access to the client (MTC)

### Getting 403 Forbidden
- User is authenticated but doesn't have access to the requested client
- Check user's `samsProfile.clientAccess` in Firestore

### Backend Not Reflecting Changes
- Make sure to restart the backend after changes:
  ```bash
  # Kill existing process
  kill $(lsof -t -i:5001)
  
  # Start backend
  cd backend && npm run dev
  ```

## Security Notes

- Never commit tokens to version control
- Tokens expire after 1 hour
- Each user can only access clients they have permission for
- The `authenticateUserWithProfile` middleware validates tokens and loads user permissions