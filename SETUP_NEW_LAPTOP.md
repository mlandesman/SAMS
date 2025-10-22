# 🚀 SAMS Setup Guide for New MacBook

**Purpose:** Get SAMS fully operational on a new MacBook with local code and Drive docs.

**Prerequisites:**
- macOS system
- Google Drive installed and synced
- Git installed
- Node.js v22+ installed
- Cursor IDE installed

---

## 📋 Quick Start (Automated)

```bash
# 1. Download and run the setup script
cd ~/Downloads
curl -O https://raw.githubusercontent.com/mlandesman/SAMS/main/laptop-setup-script.sh
chmod +x laptop-setup-script.sh
./laptop-setup-script.sh
```

**OR** run the manual steps below if you prefer control over each step.

---

## 🔧 Manual Setup Steps

### Step 1: Verify Prerequisites

```bash
# Check Node.js version (need v22+)
node --version

# Check Git
git --version

# Check Google Drive is mounted
ls "/Users/$USER/Library/CloudStorage" | grep GoogleDrive

# Check Cursor is installed
which cursor
```

### Step 2: Create Local Project Directory

```bash
# Create Projects directory
mkdir -p ~/Projects
cd ~/Projects

# Clone SAMS from GitHub
git clone https://github.com/mlandesman/SAMS.git
cd SAMS

# Verify you're on main branch
git branch
git status
```

### Step 3: Install Dependencies

```bash
cd ~/Projects/SAMS

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install
cd ..

# Install frontend dependencies
echo "📦 Installing frontend (sams-ui) dependencies..."
cd frontend/sams-ui
npm install
cd ../..

# Install mobile app dependencies
echo "📦 Installing mobile app dependencies..."
cd frontend/mobile-app
npm install
cd ../..

# Install shared components dependencies
echo "📦 Installing shared components dependencies..."
cd frontend/shared-components
npm install
cd ../..

echo "✅ All dependencies installed!"
```

### Step 4: Verify Google Drive Sync

```bash
# Check that SAMS-Docs exists in Drive
ls "/Users/$USER/Library/CloudStorage/GoogleDrive-"*"/My Drive/Sandyland/SAMS-Docs"

# If it exists, you should see:
# apm  apm_session  docs  [other folders]

# If not found, you need to:
# 1. Ensure Google Drive is fully synced
# 2. Wait for SAMS-Docs folder to sync from Drive
# 3. Or copy it from the old machine first
```

### Step 5: Configure Shell Aliases

```bash
# Add aliases to bash profile
cat >> ~/.bash_profile << 'EOF'

# SAMS project shortcuts (added $(date '+%Y-%m-%d'))
alias sams="cd ~/Projects/SAMS"
alias sams-docs="cd /Users/$USER/Library/CloudStorage/GoogleDrive-michael@landesman.com/My\ Drive/Sandyland/SAMS-Docs"
alias sams-full='cursor ~/Projects/SAMS/SAMS-Full.code-workspace'
EOF

# Reload bash profile
source ~/.bash_profile

# Test aliases
echo "Testing aliases..."
alias | grep sams
```

### Step 6: Configure Firebase Credentials

```bash
cd ~/Projects/SAMS

# The service account keys should already be in the repo:
# - serviceAccountKey-dev.json
# - serviceAccountKey-staging.json
# - serviceAccountKey-prod.json

# Verify they exist
ls -la serviceAccountKey-*.json

# If missing, you'll need to download them from Firebase Console
# or copy from the old machine (they're gitignored for security)
```

### Step 7: Test the Installation

```bash
cd ~/Projects/SAMS

# Start SAMS services
./start_sams.sh

# You should see:
# ✅ Backend: http://localhost:5001
# ✅ Frontend: http://localhost:5173
# ✅ PWA Mobile App: http://localhost:5174

# Open browser and test
open http://localhost:5173
```

### Step 8: Open in Cursor with Full Workspace

```bash
# Open SAMS with both code and docs
sams-full

# Or manually:
cursor ~/Projects/SAMS/SAMS-Full.code-workspace

# Verify you can see both folders in sidebar:
# - SAMS (Code)
# - SAMS-Docs (APM & Documentation)
```

---

## ✅ Verification Checklist

After setup, verify everything works:

- [ ] Git repository cloned successfully
- [ ] Node modules installed (root, backend, frontend, mobile)
- [ ] Google Drive mounted and SAMS-Docs accessible
- [ ] Shell aliases working (`sams`, `sams-docs`, `sams-full`)
- [ ] Backend starts on port 5001
- [ ] Frontend starts on port 5173
- [ ] Can login to SAMS UI
- [ ] Water Bills module loads and works
- [ ] Cursor workspace opens both folders
- [ ] @ file references work in Cursor

---

## 🏗️ Directory Structure (After Setup)

```
LOCAL (~)
├── Projects/
│   └── SAMS/                           ← Code (cloned from GitHub)
│       ├── .git/                       ← Full git history
│       ├── backend/
│       │   ├── node_modules/           ← Installed
│       │   └── ...
│       ├── frontend/
│       │   ├── sams-ui/
│       │   │   ├── node_modules/       ← Installed
│       │   │   └── ...
│       │   ├── mobile-app/
│       │   │   ├── node_modules/       ← Installed
│       │   │   └── ...
│       │   └── shared-components/
│       │       ├── node_modules/       ← Installed
│       │       └── ...
│       ├── SAMS-Full.code-workspace    ← Cursor workspace
│       └── ...

DRIVE (Google Drive)
└── Library/CloudStorage/GoogleDrive-.../My Drive/Sandyland/
    └── SAMS-Docs/                      ← Synced from Drive
        ├── apm/
        ├── apm_session/
        └── docs/
```

---

## 🚨 Troubleshooting

### Backend Won't Start - Missing dotenv
```bash
cd ~/Projects/SAMS/backend
npm install dotenv
```

### Can't Find SAMS-Docs
```bash
# Check Drive is mounted
ls "/Users/$USER/Library/CloudStorage"

# Check specific Drive path (update with your email)
ls "/Users/$USER/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/"

# If SAMS-Docs not there, check Google Drive sync status
# or copy from old machine first
```

### Aliases Don't Work
```bash
# Reload bash profile
source ~/.bash_profile

# Check if aliases were added
tail -10 ~/.bash_profile

# Test each alias
sams && pwd
sams-docs && pwd
```

### Port Already in Use
```bash
# Kill processes on ports 5001, 5173
lsof -ti:5001 | xargs kill -9
lsof -ti:5173 | xargs kill -9

# Then restart
cd ~/Projects/SAMS
./start_sams.sh
```

### Git Authentication Issues
```bash
# Configure Git credentials
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Set up GitHub authentication (if needed)
# Use GitHub token or SSH key
```

---

## 🔐 Security Notes

1. **Service Account Keys:** NOT in Git for security. Copy manually from secure location.
2. **Environment Variables:** Check if `.env` files exist in backend/frontend.
3. **Firebase Config:** Already in repo, but double-check they're for the right project.

---

## 📊 Expected Results

**Startup Times:**
- Backend: ~2-3 seconds
- Frontend: ~3-5 seconds
- Total startup: < 10 seconds

**Performance:**
- File operations: Instant (local)
- Git operations: Fast (local)
- Builds: 50% faster than Drive
- Water Bills load: < 1 second

---

## 🎯 Next Steps After Setup

1. **Test Water Bills:** Login → Water Bills → Verify data loads
2. **Test Payments:** Make a test payment (use test client)
3. **Test APM:** Try `/newIA` or `/newMA` commands in Cursor
4. **Pull Latest:** `git pull origin main` to get any updates
5. **Start Coding:** You're ready! 🚀

---

## 📞 Need Help?

If you run into issues:
1. Check this guide's Troubleshooting section
2. Review `MIGRATION_COMPLETE.md` for context
3. Check `APM_PATHS.md` for path references
4. Review `.cursor/APM_QUICK_START.md` for Cursor tips

---

**Created:** October 21, 2025  
**For:** MacBook setup (syncs with Google Drive)  
**Source:** GitHub `main` branch (https://github.com/mlandesman/SAMS)

