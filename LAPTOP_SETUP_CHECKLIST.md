# SAMS Laptop Setup Checklist

**Date Created:** October 19, 2025  
**Purpose:** Enable development on laptop while traveling  
**Google Drive Issue:** node_modules directories MUST be excluded from sync

---

## 🚨 CRITICAL: Stop node_modules Sync FIRST

**Problem:** You have **5 node_modules directories** on Google Drive that are syncing unnecessarily:
- `./node_modules` (148K)
- `./frontend/node_modules`
- `./frontend/mobile-app/node_modules`
- `./frontend/shared-components/node_modules`
- `./frontend/sams-ui/node_modules`

**Impact:** Thousands of files syncing, slowing down Google Drive, consuming bandwidth, causing conflicts.

### Solution: Exclude from Google Drive Sync

#### On Mac (Both Mac Mini AND Laptop):

1. **Open Google Drive Preferences:**
   - Click Google Drive icon in menu bar (top right)
   - Click Settings ⚙️ → Preferences

2. **Go to "Google Drive" Tab:**
   - Select "My Drive"

3. **Configure Selective Sync:**
   - Click "Choose folders"
   - Navigate to: `Sandyland/SAMS/`
   - **Uncheck these folders:**
     - ☐ `node_modules`
     - ☐ `frontend/node_modules`
     - ☐ `frontend/mobile-app/node_modules`
     - ☐ `frontend/shared-components/node_modules`
     - ☐ `frontend/sams-ui/node_modules`

4. **Apply Changes:**
   - Click "Confirm" or "Done"
   - Wait for sync to stop

5. **Verify:**
   ```bash
   cd ~/Library/CloudStorage/GoogleDrive-michael@landesman.com/My\ Drive/Sandyland/SAMS
   ls -la node_modules
   # Should show local files only, not syncing
   ```

#### Alternative: Use .gdignore (If Available)

Some Google Drive apps support `.gdignore` files:
```bash
cd ~/Library/CloudStorage/GoogleDrive-michael@landesman.com/My\ Drive/Sandyland/SAMS
echo "node_modules/" > .gdignore
echo "frontend/*/node_modules/" >> .gdignore
```

---

## ✅ Pre-Flight Checklist (Do BEFORE Traveling)

### 1. Environment Information (Mac Mini)

**Current System:**
- Node: `v22.15.0` (via nvm)
- npm: `11.5.2`
- Firebase CLI: Installed via nvm
- Git: `2.50.1`
- Shell: `/bin/zsh`

**Required Versions:**
- Node: `>=18.0.0` (you have 22.15.0 ✅)
- npm: `>=8.0.0` (you have 11.5.2 ✅)

---

### 2. Code State - Commit Your Work

**Current Status:**
- Branch: `main` (clean with origin)
- Uncommitted files: ~180 modified files (mostly shell scripts)
- **Critical uncommitted changes:**
  - `backend/services/waterPaymentsService.js` (credit balance fix)
  - `frontend/sams-ui/src/components/water/WaterBillsList.jsx` (reload fix)
  - `frontend/sams-ui/src/context/TransactionsContext.jsx` (reload fix)

#### Decision Point:

**Option A: Commit the Fixes (RECOMMENDED)**
```bash
cd ~/Library/CloudStorage/GoogleDrive-michael@landesman.com/My\ Drive/Sandyland/SAMS

# Add the critical fixes
git add backend/services/waterPaymentsService.js
git add frontend/sams-ui/src/components/water/WaterBillsList.jsx
git add frontend/sams-ui/src/context/TransactionsContext.jsx

# Commit with clear message
git commit -m "fix(water-bills): Critical fixes for credit balance and UI refresh

- Fix credit balance restoration on payment deletion (transaction ID now included)
- Add page reload after payment/delete to ensure fresh data display
- Addresses bugs found during Priority 0B Phase 1 validation testing"

# Push to remote
git push origin main
```

**Option B: Stash the Changes**
```bash
git stash save "WIP: Phase 1 validation fixes - credit balance and UI refresh"
# Can apply on laptop with: git stash pop
```

**Option C: Leave Uncommitted**
- ⚠️ Risk: Google Drive sync conflicts if working on both machines
- Only do this if you'll ONLY work on laptop until returning

#### Check for Untracked Files to Keep:
```bash
# These are test data files - probably safe to leave
2025-10-19_090201_697.json
2026.json
credit.json

# These are task assignments - should be preserved
apm_session/Memory/Task_Assignments/Active/Task_Phase1B_Complete_Validation_Testing.md
apm_session/Memory/Task_Completion_Logs/Phase_1_Validation_Complete_With_Fixes_2025-10-19.md
```

**Recommendation:** Add the task assignments to git:
```bash
git add apm_session/Memory/Task_Assignments/Active/
git add apm_session/Memory/Task_Completion_Logs/Phase_1_Validation_Complete_With_Fixes_2025-10-19.md
git commit -m "docs: Add Phase 1 validation testing assignments and completion log"
git push origin main
```

---

### 3. Stop Running Services on Mac Mini

**Before leaving, make sure to stop:**
```bash
cd ~/Library/CloudStorage/GoogleDrive-michael@landesman.com/My\ Drive/Sandyland/SAMS
./stop_sams.sh
```

**Verify nothing is running:**
```bash
# Check for backend process
lsof -i :3000 || echo "Port 3000 free ✅"

# Check for frontend process
lsof -i :5173 || echo "Port 5173 free ✅"
```

---

### 4. Firebase Credentials Check

**Verify these files exist (they're in Google Drive):**
```bash
ls -l serviceAccountKey-dev.json
ls -l serviceAccountKey-prod.json
ls -l serviceAccountKey-staging.json
ls -l sandyland-management-system-firebase-adminsdk-fbsvc-a06371f054.json
```

**These SHOULD sync to laptop** ✅

---

### 5. Create Quick Setup Script

Save this as `laptop-setup.sh` in the SAMS directory:

```bash
#!/bin/bash
# SAMS Laptop Setup Script
# Run this on your laptop after Google Drive syncs

echo "🚀 SAMS Laptop Setup Starting..."
echo ""

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "📍 Working directory: $PWD"
echo ""

# Check Node.js
echo "1️⃣ Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "   ✅ Node.js: $NODE_VERSION"
    
    # Check if version is >= 18
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        echo "   ⚠️  WARNING: Node.js version should be >= 18.0.0"
        echo "   Visit: https://nodejs.org/ or use nvm"
    fi
else
    echo "   ❌ Node.js NOT FOUND"
    echo "   Install from: https://nodejs.org/ or use nvm"
    exit 1
fi
echo ""

# Check npm
echo "2️⃣ Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "   ✅ npm: $NPM_VERSION"
else
    echo "   ❌ npm NOT FOUND (should come with Node.js)"
    exit 1
fi
echo ""

# Check Git
echo "3️⃣ Checking Git..."
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    echo "   ✅ $GIT_VERSION"
else
    echo "   ❌ Git NOT FOUND"
    echo "   Install from: https://git-scm.com/"
    exit 1
fi
echo ""

# Check Firebase CLI
echo "4️⃣ Checking Firebase CLI..."
if command -v firebase &> /dev/null; then
    FIREBASE_VERSION=$(firebase --version)
    echo "   ✅ Firebase CLI: $FIREBASE_VERSION"
else
    echo "   ⚠️  Firebase CLI NOT FOUND"
    echo "   Install with: npm install -g firebase-tools"
    read -p "   Install now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm install -g firebase-tools
    fi
fi
echo ""

# Check git status
echo "5️⃣ Checking Git repository..."
git status --short
echo ""

# Install root dependencies
echo "6️⃣ Installing root dependencies..."
if [ -f "package.json" ]; then
    npm install
    echo "   ✅ Root dependencies installed"
else
    echo "   ⚠️  package.json not found"
fi
echo ""

# Install backend dependencies
echo "7️⃣ Installing backend dependencies..."
if [ -d "backend" ] && [ -f "backend/package.json" ]; then
    cd backend
    npm install
    cd ..
    echo "   ✅ Backend dependencies installed"
else
    echo "   ⚠️  Backend directory or package.json not found"
fi
echo ""

# Install frontend dependencies
echo "8️⃣ Installing frontend dependencies..."
if [ -d "frontend/sams-ui" ] && [ -f "frontend/sams-ui/package.json" ]; then
    cd frontend/sams-ui
    npm install
    cd ../..
    echo "   ✅ Frontend dependencies installed"
else
    echo "   ⚠️  Frontend directory or package.json not found"
fi
echo ""

# Check Firebase credentials
echo "9️⃣ Checking Firebase credentials..."
if [ -f "serviceAccountKey-dev.json" ]; then
    echo "   ✅ Dev credentials found"
else
    echo "   ⚠️  Dev credentials NOT FOUND (should sync from Google Drive)"
fi

if [ -f "serviceAccountKey-prod.json" ]; then
    echo "   ✅ Prod credentials found"
else
    echo "   ⚠️  Prod credentials NOT FOUND (should sync from Google Drive)"
fi
echo ""

# Summary
echo "✅ Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo "   1. Check that Google Drive has finished syncing"
echo "   2. Review git status above for any uncommitted changes"
echo "   3. Start development with: ./start_sams.sh"
echo ""
echo "🔗 Quick Commands:"
echo "   Start all:     ./start_sams.sh"
echo "   Stop all:      ./stop_sams.sh"
echo "   Frontend only: cd frontend/sams-ui && npm run dev"
echo "   Backend only:  cd backend && npm start"
echo ""
echo "📝 Current Project Status:"
echo "   Priority: 0B - HOA Dues Refactor Preparation"
echo "   Phase: Phase 1 Validation (in progress)"
echo "   See: apm_session/Implementation_Plan.md"
echo ""
```

Create the script:
```bash
cat > laptop-setup.sh << 'EOFSCRIPT'
[paste script above]
EOFSCRIPT
chmod +x laptop-setup.sh
```

---

## 🖥️ Laptop Setup Steps

### Day 1: Before Leaving

1. ✅ Stop node_modules sync on Mac Mini (see instructions above)
2. ✅ Commit or stash your work (see Section 2)
3. ✅ Stop all running services (`./stop_sams.sh`)
4. ✅ Create `laptop-setup.sh` script
5. ✅ Wait for Google Drive to finish syncing
6. ✅ Test that credentials are in place

### Day 2: On Laptop (At Home Before Leaving)

1. **Ensure Google Drive is installed and synced:**
   - Open Google Drive app
   - Wait for full sync (may take a while for first time)
   - Verify SAMS folder exists at:
     ```
     ~/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS
     ```

2. **Stop node_modules sync on laptop:**
   - Follow same steps as Mac Mini (Section 1)
   - This MUST be done or sync will never finish

3. **Run the setup script:**
   ```bash
   cd ~/Library/CloudStorage/GoogleDrive-michael@landesman.com/My\ Drive/Sandyland/SAMS
   ./laptop-setup.sh
   ```

4. **Test the setup:**
   ```bash
   # Start the development environment
   ./start_sams.sh
   
   # Wait for both services to start (~30 seconds)
   # Backend should be on: http://localhost:3000
   # Frontend should be on: http://localhost:5173
   ```

5. **Test Firebase connection:**
   ```bash
   firebase projects:list
   # Should show: sandyland-management-system
   ```

6. **Open Cursor and test AI assistance:**
   - Open Cursor on laptop
   - Load the SAMS workspace
   - Run `/newMA` to initialize Manager Agent
   - Verify access to codebase

---

## 🧪 Validation Tests

Run these to ensure everything works:

### Test 1: Environment
```bash
node --version    # Should be >= 18.0.0
npm --version     # Should be >= 8.0.0
git --version     # Any recent version
firebase --version # Should be installed
```

### Test 2: Dependencies
```bash
cd ~/Library/CloudStorage/GoogleDrive-michael@landesman.com/My\ Drive/Sandyland/SAMS
npm list --depth=0  # Should show installed packages, no errors
cd frontend/sams-ui
npm list --depth=0  # Should show installed packages, no errors
```

### Test 3: Git Status
```bash
cd ~/Library/CloudStorage/GoogleDrive-michael@landesman.com/My\ Drive/Sandyland/SAMS
git status
git log --oneline -5
# Should show same state as Mac Mini
```

### Test 4: Start Services
```bash
./start_sams.sh
# Wait 30 seconds
# Check logs in ./backend-server.log
```

### Test 5: Browser Access
- Frontend: http://localhost:5173 (should load SAMS login)
- Backend: http://localhost:3000/health (should return OK)

### Test 6: Firebase Auth
```bash
firebase login:list
# Should show your Google account
```

---

## 🚨 Troubleshooting

### Issue: Google Drive sync taking forever
**Solution:** Make sure node_modules are excluded (see Section 1)

### Issue: "Module not found" errors
**Solution:** Run `npm install` in the directory showing errors

### Issue: Port already in use
**Solution:** 
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Issue: Firebase credentials not found
**Solution:** 
- Wait for Google Drive to finish syncing
- Check that credential files are NOT excluded from sync
- Verify in Finder that files exist

### Issue: Git shows many uncommitted files
**Solution:** 
- If working on laptop only: This is OK, continue working
- If switching between machines: Commit your work before switching

---

## 📱 Working on the Road

### Golden Rule: ONE MACHINE AT A TIME
- **DO NOT** work on both Mac Mini and laptop simultaneously
- **ALWAYS** commit and push before switching machines
- **WAIT** for Google Drive sync to complete before working

### Workflow:
1. **Before working:** Pull latest from git (`git pull origin main`)
2. **While working:** Commit frequently
3. **After working:** Push to git (`git push origin main`)
4. **Before switching machines:** Wait for Google Drive sync

### Internet Requirements:
- **Development:** Can work offline (services run locally)
- **Firebase operations:** Requires internet
- **Git push/pull:** Requires internet
- **Google Drive sync:** Requires internet

---

## 🏠 Returning Home

### On Laptop (Before Leaving Location):
1. Commit all work: `git commit -am "Work from [location]"`
2. Push to remote: `git push origin main`
3. Stop services: `./stop_sams.sh`
4. Wait for Google Drive to sync

### On Mac Mini (After Returning):
1. Pull latest changes: `git pull origin main`
2. Check for any Google Drive sync conflicts
3. Run `npm install` if package.json changed
4. Start working: `./start_sams.sh`

---

## 📊 Current Project Status

**Phase:** Priority 0B - HOA Dues Refactor Preparation  
**Status:** Phase 1 Validation in progress  
**Recent Work:** Critical fixes applied (credit balance, UI refresh)  
**Next:** Complete Phase 1B validation testing (9 scenarios)

**Key Files:**
- Implementation Plan: `apm_session/Implementation_Plan.md`
- Active Tasks: `apm_session/Memory/Task_Assignments/Active/`
- Recent Completion: `apm_session/Memory/Task_Completion_Logs/Phase_1_Validation_Complete_With_Fixes_2025-10-19.md`

---

## ✅ Final Checklist

Before traveling:
- [ ] Stop node_modules sync (Mac Mini AND Laptop)
- [ ] Commit or stash uncommitted work
- [ ] Stop all services on Mac Mini
- [ ] Create `laptop-setup.sh` script
- [ ] Ensure laptop has Google Drive installed
- [ ] Test laptop setup at home first

On laptop:
- [ ] Wait for Google Drive sync
- [ ] Stop node_modules sync on laptop
- [ ] Run `./laptop-setup.sh`
- [ ] Test `./start_sams.sh`
- [ ] Test browser access (localhost:5173)
- [ ] Test Cursor with `/newMA`

Ready to travel! 🚀

