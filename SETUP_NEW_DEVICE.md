# SAMS - New Device Setup Instructions

## Prerequisites
- Node.js v22.15.0 or higher installed
- Git configured and authenticated
- Google Drive synced to this device
- Firebase credentials in place

## Initial Setup Steps

### 1. Clone/Sync Project from Google Drive

The project should automatically sync via Google Drive to:
```
~/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS
```

Wait for Google Drive to complete initial sync before proceeding.

### 2. Create Local node_modules Directories

All `node_modules` are symlinked to device-local directories to avoid cloud sync issues.

```bash
# Create local directories for this device's node_modules
mkdir -p ~/Local_SAMS_Modules/backend
mkdir -p ~/Local_SAMS_Modules/frontend-root
mkdir -p ~/Local_SAMS_Modules/frontend
mkdir -p ~/Local_SAMS_Modules/mobile-app
mkdir -p ~/Local_SAMS_Modules/shared-components
mkdir -p ~/Local_SAMS_Modules/root
mkdir -p ~/Local_SAMS_Modules/scripts
mkdir -p ~/Local_SAMS_Modules/sams-deploy
mkdir -p ~/Local_SAMS_Modules/functions
mkdir -p ~/Local_SAMS_Modules/functions-backend
```

### 3. Navigate to Project Directory

```bash
cd ~/Library/CloudStorage/GoogleDrive-michael@landesman.com/My\ Drive/Sandyland/SAMS
```

### 4. Install Dependencies

Install npm packages for each component. The symlinks will automatically work.

```bash
# Root dependencies
npm install

# Backend dependencies
cd backend
npm install
cd ..

# Frontend dependencies
cd frontend
npm install
cd sams-ui
npm install
cd ../mobile-app
npm install
cd ../shared-components
npm install
cd ../..

# Scripts dependencies
cd scripts
npm install
cd sams-deploy
npm install
cd ../..

# Functions dependencies
cd functions
npm install
cd backend
npm install
cd ../..
```

### 5. Verify Symlinks

Check that all symlinks are pointing to the local directories:

```bash
ls -la backend/node_modules
# Should show: backend/node_modules -> /Users/michael/Local_SAMS_Modules/backend/node_modules

ls -la frontend/node_modules
# Should show: frontend/node_modules -> /Users/michael/Local_SAMS_Modules/frontend-root/node_modules

ls -la frontend/sams-ui/node_modules
# Should show: frontend/sams-ui/node_modules -> /Users/michael/Local_SAMS_Modules/frontend/node_modules
```

### 6. Configure Environment Variables

Ensure these files exist (should be synced from Google Drive):
- `backend/serviceAccountKey.json` (Firebase Admin SDK key)
- `backend/.env` (environment variables)

### 7. Test Backend

```bash
cd backend
npm start
```

You should see:
```
Server is running on port 5001
```

Press Ctrl+C to stop.

### 8. Test Frontend

In a new terminal:
```bash
cd frontend/sams-ui
npm run dev
```

You should see Vite dev server start.

## Troubleshooting

### Problem: "Cannot find module" errors

**Solution**: Make sure you ran `npm install` in all directories (step 4).

### Problem: Symlinks not working

**Solution**: Verify symlinks exist:
```bash
find . -name "node_modules" -type l -maxdepth 5
```

Should show 10 symlinks. If missing, contact support.

### Problem: Port 5001 already in use

**Solution**: Kill existing process:
```bash
pkill -f "node index.js"
```

Then try starting backend again.

### Problem: Firebase authentication errors

**Solution**: Check that `backend/serviceAccountKey.json` exists and is valid.

## Architecture Notes

### Why Symlinks?

`node_modules` directories contain:
- Native binaries compiled for specific OS/architecture
- Thousands of tiny files (kills cloud sync performance)
- Platform-specific dependencies

By using symlinks:
- Each device has its own native modules
- Google Drive doesn't sync the heavy `node_modules` directories
- Faster sync, no binary conflicts between devices

### Project Structure

```
SAMS/ (Google Drive synced)
├── backend/
│   ├── node_modules → ~/Local_SAMS_Modules/backend/node_modules
│   ├── package.json (synced)
│   └── ... (synced)
├── frontend/
│   ├── node_modules → ~/Local_SAMS_Modules/frontend-root/node_modules
│   ├── sams-ui/
│   │   ├── node_modules → ~/Local_SAMS_Modules/frontend/node_modules
│   │   ├── package.json (synced)
│   │   └── ... (synced)
│   └── ... (synced)
└── ... (synced)

~/Local_SAMS_Modules/ (NOT synced, device-local)
├── backend/node_modules/ (real files, device-specific)
├── frontend/node_modules/ (real files, device-specific)
└── ... (real files, device-specific)
```

## Git Workflow

### Important: Use Feature Branches

**NEVER code directly in `main` branch!**

```bash
# Create feature branch for your work
git checkout -b feature/your-feature-name

# Make changes, commit regularly
git add .
git commit -m "Description of changes"

# Push to remote
git push origin feature/your-feature-name

# Create Pull Request on GitHub for review
# Only merge to main after review
```

### Current Branch Status

- **main** (e2b489e): ✅ STABLE - Phase 1 complete
- **feature/phase-2-cache-elimination** (1529bda): ❌ DO NOT MERGE - Broken

## Key Project Information

### Current Version
- Version: 0.1.0
- Last Stable: e2b489e (Phase 1 complete)
- Environment: development

### Main Components
- **Backend**: Express.js API on port 5001
- **Frontend**: React + Vite on port 3000 (default)
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication

### Critical Files
- `backend/serviceAccountKey.json` - Firebase Admin credentials
- `backend/.env` - Environment configuration
- `apm_session/Implementation_Plan.md` - Project roadmap
- `PROJECT_TRACKING_MASTER.md` - Overall status

## Next Steps After Setup

1. Test payment flow in Water Bills module
2. Review current branch status with `git status`
3. Check `apm_session/Memory/Handovers/Manager_Agent_Handovers/Manager_Agent_Handover_File_2025-10-19.md` for latest status
4. Contact project lead before starting new work

---

**Setup Date**: October 19, 2025
**Node Version**: v22.15.0
**Platform**: macOS (darwin)
**Device**: MacBook (new setup)

