# Move SAMS to Local Storage - Hybrid Approach

**Created:** October 21, 2025  
**Strategy:** Code local, Documentation in Drive  
**Purpose:** Resolve node_modules syncing while keeping docs accessible from any device

## Strategy Overview

### What Goes Local (~/Projects/SAMS)
- ✅ All source code (backend, frontend, functions)
- ✅ Git repository
- ✅ node_modules (never synced)
- ✅ Package files (package.json, package-lock.json)
- ✅ Configuration files (firebase.json, etc.)
- ✅ Build scripts and utilities
- ✅ Test files and test data

### What Stays in Google Drive (~/GoogleDrive/Sandyland/SAMS-Docs)
- ✅ `docs/` - All project documentation
- ✅ `apm_session/` - APM system and agent logs
- ✅ `apm/` - APM prompts and guides
- ✅ `Memory/` - Task logs and handovers
- ✅ `analysis_reports/` - Analysis and reports
- ✅ All Markdown files (*.md) - README, guides, notes
- ✅ `assets/` - Images, logos, design files

### Benefits of This Approach
- 🚀 **Fast local development** - No Drive sync lag
- 📚 **Docs accessible everywhere** - Phone, tablet, other computers
- 🔄 **Git for code sync** - Proper version control between machines
- 📝 **Drive for doc collaboration** - Easy sharing and editing
- 🎯 **Industry standard** - How professional teams work

---

## Pre-Execution Checklist

Before starting:

- [ ] Stop any debugging sessions in Cursor
- [ ] Stop all SAMS services (`./stop_sams.sh`)
- [ ] Verify current git status is clean
- [ ] Note your current branch (you're on `main` now)
- [ ] Close Cursor IDE completely

---

## Phase 1: Prepare Google Drive for Docs-Only

### 1.1 Stop active processes

```bash
# Check for running processes
ps aux | grep -E "npm|esbuild|node.*backend" | grep -v grep

# Stop SAMS if running
cd "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS"
./stop_sams.sh 2>/dev/null || echo "No services running"
```

### 1.2 Delete node_modules from Drive (let them sync)

```bash
cd "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS"

# Remove all node_modules
find . -name "node_modules" -type d -prune -exec rm -rf {} \;

echo "✅ Removed node_modules - waiting 30 seconds for Drive sync"
sleep 30
```

---

## Phase 2: Copy Code to Local Storage

### 2.1 Create local project directory

```bash
mkdir -p ~/Projects
```

### 2.2 Copy entire SAMS to local (excluding node_modules)

```bash
# This preserves git history and all files
rsync -av --progress \
  --exclude='node_modules/' \
  --exclude='**/node_modules/' \
  --exclude='.DS_Store' \
  "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/" \
  ~/Projects/SAMS/

echo "✅ Full copy to local complete"
```

### 2.3 Verify git status in local copy

```bash
cd ~/Projects/SAMS

# Verify git is intact
git status
git log --oneline -5

# Verify remote is configured
git remote -v

# Should show: origin https://github.com/mlandesman/SAMS.git
```

---

## Phase 3: Create Documentation-Only Drive Folder

### 3.1 Create new SAMS-Docs folder structure

```bash
# Create new docs folder in Drive
mkdir -p "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs"

cd "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs"

# Create subfolder structure
mkdir -p docs apm apm_session Memory analysis_reports assets
```

### 3.2 Copy documentation from local to Drive docs folder

```bash
cd ~/Projects/SAMS

# Copy main documentation folders
rsync -av --progress docs/ "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/docs/"
rsync -av --progress apm/ "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/apm/"
rsync -av --progress apm_session/ "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/apm_session/"
rsync -av --progress Memory/ "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/Memory/" 2>/dev/null || echo "No Memory folder"
rsync -av --progress analysis_reports/ "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/analysis_reports/"
rsync -av --progress assets/ "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/assets/"

# Copy all markdown files from root
cp *.md "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/" 2>/dev/null || echo "Some .md files may be missing"

echo "✅ Documentation copied to SAMS-Docs"
```

### 3.3 Create README in SAMS-Docs explaining the setup

```bash
cat > "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/README.md" << 'EOF'
# SAMS Documentation Repository

**Last Updated:** October 21, 2025

## Important: This is Documentation Only

**Source Code Location:** `~/Projects/SAMS` (local on each machine)  
**This Folder Contains:** Documentation, APM system, guides, and reports

## Folder Structure

- `docs/` - Project documentation, issues, guides
- `apm/` - APM prompts and agent guides
- `apm_session/` - Active APM session logs and task tracking
- `Memory/` - Historical task logs and handovers
- `analysis_reports/` - System analysis and recommendations
- `assets/` - Images, logos, design files
- `*.md` - Root-level documentation files

## Working with Code

The SAMS codebase is stored locally on each development machine:

### On Mac Mini
```bash
cd ~/Projects/SAMS
```

### On Laptop
```bash
cd ~/Projects/SAMS
```

### Sync Code Between Machines
Use Git (not Google Drive):
```bash
# Push from one machine
git push origin main

# Pull on another machine
git pull origin main
```

## Working with Documentation

All documentation in this folder is synced via Google Drive and accessible from any device:
- Mac Mini
- Laptop
- Phone/Tablet (Google Drive app)
- Web browser (drive.google.com)

### Updating Documentation

After making changes to docs in local codebase, sync to Drive:

```bash
cd ~/Projects/SAMS

# Sync specific doc changes
rsync -av docs/ "/path/to/GoogleDrive/Sandyland/SAMS-Docs/docs/"
rsync -av apm_session/ "/path/to/GoogleDrive/Sandyland/SAMS-Docs/apm_session/"
```

Or update via Cursor AI agent while working on the local codebase.

## Benefits of This Setup

✅ **Code is fast** - Local storage, no sync lag  
✅ **Docs are accessible** - Available on all devices via Drive  
✅ **Git for code** - Proper version control  
✅ **Drive for docs** - Easy collaboration and access  
✅ **No node_modules sync** - Each machine builds locally  

## GitHub Repository

**URL:** https://github.com/mlandesman/SAMS  
**Main Branch:** `main`  
**Active Branch:** Check with `git branch --show-current`

---

**Questions?** This documentation is always accessible via Google Drive!
EOF

echo "✅ README created in SAMS-Docs"
```

---

## Phase 4: Install Dependencies in Local Copy

### 4.1 Install root dependencies

```bash
cd ~/Projects/SAMS
npm install
```

### 4.2 Install frontend dependencies

```bash
# Mobile app
cd ~/Projects/SAMS/frontend/mobile-app
npm install

# Shared components
cd ~/Projects/SAMS/frontend/shared-components
npm install

# SAMS UI (main desktop app)
cd ~/Projects/SAMS/frontend/sams-ui
npm install

cd ~/Projects/SAMS
echo "✅ All frontend dependencies installed"
```

### 4.3 Install other dependencies (if needed)

```bash
cd ~/Projects/SAMS

# Backend (if it has package.json)
cd backend && npm install 2>/dev/null || echo "Backend has no package.json"

# Functions
cd ~/Projects/SAMS/functions
npm install 2>/dev/null || echo "Functions dependencies already handled by Firebase"

cd ~/Projects/SAMS
echo "✅ All dependencies installed"
```

---

## Phase 5: Test Local Setup

### 5.1 Verify directory structure

```bash
cd ~/Projects/SAMS

# Check main folders exist
ls -la

# Verify git works
git status

# Verify node_modules installed
ls -la node_modules | head -20
ls -la frontend/sams-ui/node_modules | head -20
```

### 5.2 Test starting SAMS

```bash
cd ~/Projects/SAMS

# Start services
./start_sams.sh

# If script fails due to hardcoded paths, we'll fix them
```

### 5.3 Check for hardcoded Google Drive paths

```bash
cd ~/Projects/SAMS

# Find any scripts referencing Google Drive
grep -r "GoogleDrive" . --include="*.sh" --include="*.js" | grep -v node_modules

# If found, these need to be updated to use relative paths
```

### 5.4 Open in Cursor

```bash
# Close Cursor first if it's open
# Then open from new location
cursor ~/Projects/SAMS
```

### 5.5 Verify everything works

Test checklist:
- [ ] SAMS services start successfully
- [ ] Frontend builds without errors (check terminal)
- [ ] Can access the application at http://localhost:5173
- [ ] Backend responds at http://localhost:5001
- [ ] Water Bills page loads correctly
- [ ] No errors in browser console
- [ ] Documentation accessible in Drive SAMS-Docs folder

---

## Phase 6: Create Sync Script for Documentation

### 6.1 Create sync-docs-to-drive.sh script

```bash
cd ~/Projects/SAMS

cat > sync-docs-to-drive.sh << 'EOFSCRIPT'
#!/bin/bash
# Sync documentation from local SAMS to Google Drive SAMS-Docs

DRIVE_DOCS="/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs"
LOCAL_SAMS="$HOME/Projects/SAMS"

echo "📚 Syncing SAMS documentation to Google Drive..."

# Sync documentation folders
rsync -av --progress "$LOCAL_SAMS/docs/" "$DRIVE_DOCS/docs/"
rsync -av --progress "$LOCAL_SAMS/apm/" "$DRIVE_DOCS/apm/"
rsync -av --progress "$LOCAL_SAMS/apm_session/" "$DRIVE_DOCS/apm_session/"
rsync -av --progress "$LOCAL_SAMS/analysis_reports/" "$DRIVE_DOCS/analysis_reports/" 2>/dev/null || true
rsync -av --progress "$LOCAL_SAMS/assets/" "$DRIVE_DOCS/assets/" 2>/dev/null || true

# Sync root markdown files
rsync -av --progress "$LOCAL_SAMS/"*.md "$DRIVE_DOCS/" 2>/dev/null || true

echo "✅ Documentation sync complete!"
echo "📍 Drive location: $DRIVE_DOCS"
EOFSCRIPT

chmod +x sync-docs-to-drive.sh

echo "✅ Created sync-docs-to-drive.sh"
```

### 6.2 Test the sync script

```bash
cd ~/Projects/SAMS
./sync-docs-to-drive.sh
```

### 6.3 Add to .zshrc for easy access

```bash
# Add aliases for convenience
cat >> ~/.zshrc << 'EOF'

# SAMS project shortcuts
alias sams="cd ~/Projects/SAMS"
alias sams-docs="cd '/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs'"
alias sams-sync-docs="cd ~/Projects/SAMS && ./sync-docs-to-drive.sh"

EOF

source ~/.zshrc

echo "✅ Added SAMS aliases to .zshrc"
echo "   Use: sams (go to code), sams-docs (go to docs), sams-sync-docs (sync docs)"
```

---

## Phase 7: Update .gitignore (if needed)

### 7.1 Verify documentation is still tracked by git

```bash
cd ~/Projects/SAMS

# Check if docs are in .gitignore
grep -E "^docs/|^apm/|^apm_session/" .gitignore

# Good: Documentation should still be tracked in git AND in Drive
# This gives you two backups: git history + Drive sync
```

**Note:** We're NOT excluding docs from git. They're in both places:
- Git: Version controlled, history, branches
- Drive: Easy access from any device

---

## Phase 8: Clean Up Old Drive Folder (After Testing)

### Option A: Keep old SAMS folder as backup (RECOMMENDED)

Leave it for a week or two, then archive or delete.

### Option B: Rename old SAMS folder to SAMS-OLD

```bash
# In Finder or Terminal
mv "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS" \
   "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-OLD-Backup"

echo "✅ Old SAMS folder renamed to SAMS-OLD-Backup"
echo "⚠️  Test local setup for a few days, then delete SAMS-OLD-Backup"
```

### Option C: Delete old SAMS folder (only after confirmed working)

```bash
# DANGER: Only run this after testing local setup for several days!
# Make sure you've pushed all git changes first!

cd ~/Projects/SAMS
git status  # Should be clean
git push origin main  # Ensure everything is pushed

# Then delete
rm -rf "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS"

echo "✅ Old SAMS folder deleted from Drive"
```

---

## Phase 9: Setup Laptop (When Ready)

When you want to work on the laptop:

### 9.1 Clone from GitHub

```bash
# On Laptop
mkdir -p ~/Projects
cd ~/Projects

# Clone from GitHub
git clone https://github.com/mlandesman/SAMS.git
cd SAMS

# Verify it worked
git log --oneline -5
git branch --show-current
```

### 9.2 Install dependencies on laptop

```bash
cd ~/Projects/SAMS

# Root
npm install

# Frontend apps
cd frontend/mobile-app && npm install
cd ../shared-components && npm install
cd ../sams-ui && npm install

cd ~/Projects/SAMS
echo "✅ Laptop setup complete!"
```

### 9.3 Add service account keys

```bash
cd ~/Projects/SAMS

# Copy Firebase keys from Drive (they're in SAMS-Docs or email)
# Or download from Firebase Console
```

### 9.4 Add .zshrc aliases on laptop

```bash
# On Laptop
cat >> ~/.zshrc << 'EOF'

# SAMS project shortcuts
alias sams="cd ~/Projects/SAMS"
alias sams-docs="cd '/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs'"
alias sams-sync-docs="cd ~/Projects/SAMS && ./sync-docs-to-drive.sh"

EOF

source ~/.zshrc
```

---

## Daily Workflow

### Working on Mac Mini

```bash
# 1. Navigate to project
sams

# 2. Make sure you have latest code
git pull origin main

# 3. Create/switch to feature branch
git checkout -b feature/my-new-feature

# 4. Work on code...

# 5. Commit changes
git add .
git commit -m "Description of changes"

# 6. Push to GitHub
git push origin feature/my-new-feature

# 7. Sync documentation to Drive (if you updated docs)
sams-sync-docs
```

### Working on Laptop

```bash
# 1. Navigate to project
sams

# 2. Pull latest changes
git pull origin main

# 3. Continue work...

# 4. Commit and push
git add .
git commit -m "More changes"
git push origin feature/my-new-feature

# 5. Sync docs if needed
sams-sync-docs
```

### Accessing Documentation from Phone/Tablet

1. Open Google Drive app
2. Navigate to: **Sandyland > SAMS-Docs**
3. Read any doc, APM log, or guide
4. Can even edit markdown files on mobile!

---

## Troubleshooting

### If services won't start from local

```bash
cd ~/Projects/SAMS

# Check for hardcoded paths
grep -r "GoogleDrive" start_sams.sh stop_sams.sh

# Update paths to use $(pwd) or relative paths
# Example: Replace absolute path with:
# SAMS_ROOT="$(cd "$(dirname "$0")" && pwd)"
```

### If npm install fails

```bash
# Clear cache and retry
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### If git push fails with authentication

```bash
# May need to set up GitHub personal access token
git remote set-url origin https://<TOKEN>@github.com/mlandesman/SAMS.git

# Or use SSH
git remote set-url origin git@github.com:mlandesman/SAMS.git
```

### If Drive sync is slow

```bash
# Verify SAMS-Docs is syncing
ls -la "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs"

# Check Google Drive status in menu bar
# Should show cloud icon, not sync icon
```

### If you need a file from old SAMS folder

```bash
# It's still there! Just renamed
cd "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-OLD-Backup"

# Copy what you need
cp <file> ~/Projects/SAMS/
```

---

## File Locations Reference

### Code (Local - Fast)
```
~/Projects/SAMS/
├── backend/
├── frontend/
│   ├── sams-ui/        (main app)
│   ├── mobile-app/
│   └── shared-components/
├── functions/
├── scripts/
├── tests/
└── [all source code]
```

### Documentation (Drive - Accessible)
```
~/GoogleDrive/Sandyland/SAMS-Docs/
├── docs/              (issues, guides, specs)
├── apm/               (agent prompts)
├── apm_session/       (current task logs)
├── Memory/            (historical logs)
├── analysis_reports/  (analyses)
├── assets/            (images, logos)
└── *.md              (README, guides, etc.)
```

### Both Places (Belt & Suspenders)
- Documentation exists in both git (version control) and Drive (accessibility)
- This gives you the best of both worlds

---

## Benefits Recap

✅ **Development Speed** - Local I/O is 10-100x faster than Drive  
✅ **No Sync Conflicts** - node_modules never touch Drive  
✅ **Proper Version Control** - Git branches, history, rollbacks  
✅ **Doc Accessibility** - Read/edit docs from any device  
✅ **Industry Standard** - How all professional developers work  
✅ **Machine-Specific Builds** - Each machine compiles for its architecture  
✅ **Collaboration Ready** - Easy to share docs without sharing code  
✅ **Firebase Unchanged** - Cloud services still work perfectly  

---

## Questions?

If you encounter issues:

1. **Git problems** - Check `git status` and `git log`
2. **Dependency problems** - Try `rm -rf node_modules && npm install`
3. **Path problems** - Search for "GoogleDrive" in scripts
4. **Drive sync problems** - Check Google Drive menu bar icon
5. **Can't find files** - Check both ~/Projects/SAMS and Drive/SAMS-Docs

---

**You're migrating to the industry-standard development setup! This is how Google, Facebook, and every tech company works. Code local, docs accessible, version control everything.**


