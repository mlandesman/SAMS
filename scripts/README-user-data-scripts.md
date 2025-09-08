# User Data Scripts

This directory contains scripts for fetching user data from Firestore in different environments.

## Available Scripts

### 1. `get-user-data.js` (Production Only)
Fetches user data from **PRODUCTION** Firestore.

```bash
node scripts/get-user-data.js <uid>
node scripts/get-user-data.js <email>
```

### 2. `get-user-data-dev.js` (Dev Only)
Fetches user data from **DEV** Firestore.

```bash
node scripts/get-user-data-dev.js <uid>
node scripts/get-user-data-dev.js <email>
```

### 3. `get-user-data-enhanced.js` (Environment Switcher)
Can fetch from either production or dev based on flags.

```bash
# Production (default)
node scripts/get-user-data-enhanced.js <uid>

# Dev environment
node scripts/get-user-data-enhanced.js <uid> --dev

# Explicitly production
node scripts/get-user-data-enhanced.js <uid> --prod
```

## Features

All scripts support:
- ✅ Lookup by UID
- ✅ Lookup by email address
- ✅ Display formatted user information
- ✅ Show SAMS profile and permissions
- ✅ Display client access and unit assignments
- ✅ Save full JSON data to file

## Output

The scripts display:
- Basic user info (email, name, phone)
- SAMS profile status and roles
- Client access permissions
- Unit assignments with roles
- Additional debug info (in dev mode)

Data is also saved to a JSON file named:
- Production: `user_<uid>_<timestamp>.json`
- Dev: `user_<uid>_dev_<timestamp>.json`
- Enhanced: `user_<uid>_<env>_<timestamp>.json`

## Service Account Keys

The scripts look for service account keys in these locations:

**Production:**
- `backend/sams-production-serviceAccountKey.json`
- `sams-production-serviceAccountKey.json`

**Dev:**
- `backend/serviceAccountKey.json`
- `serviceAccountKey.json`

## Examples

```bash
# Get Michael's data from production
node scripts/get-user-data.js ms@landesman.com

# Get test user from dev
node scripts/get-user-data-dev.js test@example.com

# Get user from dev using enhanced script
node scripts/get-user-data-enhanced.js test-user-123 --dev

# Get user by UID from production
node scripts/get-user-data.js RXXdmbMQ6CPWJaOPiNBqCPSQbmB3
```

## Troubleshooting

1. **"Could not find service account key"**
   - Ensure the appropriate service account key file exists
   - Check file permissions

2. **"No user found"**
   - Verify the UID/email is correct
   - Check you're using the right environment (prod vs dev)

3. **Dev script shows available test users**
   - If user not found in dev, it lists some available test users