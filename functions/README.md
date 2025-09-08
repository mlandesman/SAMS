# SAMS Exchange Rates Cloud Functions

This directory contains Firebase Cloud Functions for automated exchange rate updates in the SAMS application.

## Functions Overview

### 1. `scheduledExchangeRatesUpdate`
- **Type**: Scheduled function (Pub/Sub)
- **Schedule**: Daily at 8:00 AM Mexico City time
- **Purpose**: Automatically updates exchange rates from Banxico and Colombian government APIs
- **Behavior**: Updates rates from the last update date to today (business days only)

### 2. `manualExchangeRatesUpdate`
- **Type**: Callable HTTPS function
- **Purpose**: Allows authenticated users to manually trigger exchange rate updates
- **Parameters**:
  - `mode`: 'quick' (default), 'range', or 'fillGaps'
  - `startDate`: Start date for range mode
  - `endDate`: End date for range mode
  - `fillGaps`: Boolean to fill missing dates

### 3. `syncExchangeRatesFromProdToDev`
- **Type**: Callable HTTPS function
- **Purpose**: Syncs exchange rates from production to development database
- **Parameters**:
  - `daysToSync`: Number of days to sync (default: 30)
  - `overwrite`: Whether to overwrite existing documents (default: false)

### 4. `checkExchangeRatesHealth`
- **Type**: HTTPS endpoint
- **Purpose**: Health check endpoint for monitoring
- **URL**: `https://[region]-[project].cloudfunctions.net/checkExchangeRatesHealth`

## Setup Instructions

### 1. Install Firebase CLI
```bash
npm install -g firebase-tools
```

### 2. Login to Firebase
```bash
firebase login
```

### 3. Initialize Functions (if not already done)
```bash
cd /path/to/SAMS
firebase init functions
```

### 4. Install Dependencies
```bash
cd functions
npm install
```

### 5. Configure Environment Variables

For production-to-dev sync functionality, create a `.env` file:
```bash
cp .env.example .env
```

Edit `.env` and add:
- `DEV_PROJECT_ID`: Your development Firebase project ID
- `DEV_SERVICE_ACCOUNT_PATH`: Path to dev service account JSON file

### 6. Deploy Functions

Deploy all functions:
```bash
firebase deploy --only functions
```

Deploy specific function:
```bash
firebase deploy --only functions:scheduledExchangeRatesUpdate
```

## Testing Functions Locally

### 1. Start Firebase Emulator
```bash
firebase emulators:start --only functions
```

### 2. Test Scheduled Function
```bash
firebase functions:shell
```
Then in the shell:
```javascript
scheduledExchangeRatesUpdate()
```

### 3. Test Callable Functions
Use the Firebase Admin SDK or make HTTP requests to the emulator endpoints.

## Monitoring and Logs

### View Function Logs
```bash
firebase functions:log
```

### View Specific Function Logs
```bash
firebase functions:log --only scheduledExchangeRatesUpdate
```

### Monitor in Firebase Console
1. Go to Firebase Console
2. Navigate to Functions
3. Click on a function to view metrics and logs

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Ensure you're logged in: `firebase login`
   - Check project selection: `firebase use [project-id]`

2. **Deployment Failures**
   - Check Node.js version matches functions requirement (v20)
   - Ensure all dependencies are installed
   - Check for syntax errors: `npm run lint`

3. **Runtime Errors**
   - Check function logs for detailed error messages
   - Verify API tokens are correct
   - Ensure Firestore permissions allow function access

### Debug Mode
Enable detailed logging by setting environment variable:
```bash
export FUNCTIONS_DEBUG=true
```

## Integration with Existing System

The Cloud Functions replace the login-triggered exchange rate updates while maintaining compatibility with the existing data structure and API endpoints. The frontend can continue using the same API calls, but rates will be updated automatically daily instead of on user login.

### Migration Steps
1. Deploy the Cloud Functions
2. Monitor for successful daily updates
3. Once confirmed working, remove the login trigger from `AuthContext.jsx`
4. Keep manual update endpoints for administrative purposes

## Cost Considerations

- **Scheduled Function**: Runs once daily (30 invocations/month)
- **API Calls**: ~30-60 external API calls per day
- **Firestore Operations**: ~30-60 writes per day
- **Estimated Monthly Cost**: < $1 USD for exchange rate updates

## Security Notes

- All callable functions require authentication
- API tokens are stored securely in the function configuration
- Service account credentials should never be committed to version control
- Use Firebase Security Rules to restrict Firestore access