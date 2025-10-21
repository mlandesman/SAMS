# Move SAMS from Google Drive to Local Storage

**Created:** October 21, 2025  
**Purpose:** Resolve node_modules syncing issue with Google Drive by moving project to local storage and using git for machine synchronization

## Problem Summary

Google Drive Desktop cannot properly handle symlinks for `node_modules` directories. When symlinks are created in a Drive folder, they get replaced with real directories by build processes, causing thousands of files to sync. Google Drive for Mac doesn't offer folder exclusion, making it impossible to prevent this.

## Solution

Move the entire SAMS project to local storage (`~/Projects/SAMS`) and use git to sync code between machines (Laptop and Mac Mini). This is the industry-standard approach used by all professional developers.

---

## Pre-Execution Checklist

Before running these commands:

- [ ] Stop any active debugging sessions
- [ ] Close Cursor IDE (or at least close SAMS workspace)
- [ ] Stop any running SAMS services (`./stop_sams.sh`)
- [ ] Commit any uncommitted work to git
- [ ] Note your current branch (likely `simplify-water-bills`)

---

## Phase 1: Stop Active Processes

### 1.1 Kill processes that may recreate node_modules

```bash
# Check for running npm/node processes
ps aux | grep -E "npm|esbuild" | grep -v grep

# If you see esbuild or npm processes, kill them
# Replace <PID> with actual process ID from above
kill <PID>

# Stop SAMS services if running
cd "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS"
./stop_sams.sh 2>/dev/null || echo "No services running"
```

### 1.2 Delete node_modules from Google Drive location

```bash
cd "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS"

# Remove all node_modules directories (let them finish syncing)
rm -rf node_modules
rm -rf backend/node_modules
rm -rf frontend/mobile-app/node_modules
rm -rf frontend/shared-components/node_modules
rm -rf frontend/sams-ui/node_modules
rm -rf functions/node_modules
rm -rf functions/backend/node_modules
rm -rf scripts/node_modules
rm -rf scripts/sams-deploy/node_modules

echo "✅ Removed node_modules - wait 30 seconds for Google Drive to finish syncing deletions"
sleep 30
```

---

## Phase 2: Copy to Local Storage

### 2.1 Create local project directory

```bash
mkdir -p ~/Projects
```

### 2.2 Copy SAMS to local (excluding node_modules)

```bash
# This will take a few minutes - excludes node_modules and large git objects
rsync -av --progress \
  --exclude='node_modules/' \
  --exclude='**/node_modules/' \
  --exclude='.git/objects/pack/*.pack' \
  "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/" \
  ~/Projects/SAMS/

echo "✅ Copy complete"
```

### 2.3 Verify git status

```bash
cd ~/Projects/SAMS

# Check current branch
git branch --show-current

# Check git status
git status

# Verify remote is configured
git remote -v

# Should show origin pointing to GitHub repository
```

---

## Phase 3: Install Dependencies

### 3.1 Install root dependencies

```bash
cd ~/Projects/SAMS
npm install
```

### 3.2 Install frontend dependencies

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
```

### 3.3 Install backend dependencies (if needed)

```bash
cd ~/Projects/SAMS/backend
npm install 2>/dev/null || echo "Backend has no package.json, skipping"
```

---

## Phase 4: Test Local Setup

### 4.1 Update shell to use new location

```bash
cd ~/Projects/SAMS
```

### 4.2 Test starting SAMS

```bash
# Start SAMS services from new location
./start_sams.sh

# If this fails, you may need to update paths in the script
# Check if any absolute paths reference Google Drive
```

### 4.3 Open in Cursor

```bash
# Open Cursor in new location
cursor ~/Projects/SAMS
```

### 4.4 Verify everything works

- [ ] SAMS services start successfully
- [ ] Frontend builds without errors
- [ ] Can access the application
- [ ] No errors in console

---

## Phase 5: Update Workflow

### 5.1 Update workspace settings

If you have any Cursor/VSCode workspace settings that reference Google Drive paths, update them to use `~/Projects/SAMS`.

### 5.2 Git workflow for multi-machine setup

**On Mac Mini (after making changes):**
```bash
cd ~/Projects/SAMS
git add .
git commit -m "Description of changes"
git push origin simplify-water-bills
```

**On Laptop (to get changes):**
```bash
cd ~/Projects/SAMS  # or wherever SAMS is on laptop
git pull origin simplify-water-bills
npm install  # if package.json changed
```

### 5.3 Create .zshrc alias (optional)

```bash
echo 'alias sams="cd ~/Projects/SAMS"' >> ~/.zshrc
source ~/.zshrc

# Now you can type 'sams' to jump to project
```

---

## Phase 6: Clean Up Google Drive (Optional)

### Option A: Keep as backup only

Leave the SAMS folder in Google Drive but never edit it. It serves as a backup.

### Option B: Delete from Google Drive

```bash
# After confirming local setup works for a few days
rm -rf "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS"

# This will delete from Drive on all machines
# Make sure you've pushed all git changes first!
```

### Option C: Keep docs in Drive, delete code

```bash
# Move documentation back to Drive
mkdir -p "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs"

cd ~/Projects/SAMS

# Copy documentation folders
cp -r docs "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/"
cp -r apm_session "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/"
cp -r analysis_reports "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/"
cp *.md "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/"

# Then delete old SAMS folder from Drive
```

---

## Laptop Setup (When Ready)

When you're ready to set up the laptop:

```bash
# On Laptop
mkdir -p ~/Projects
cd ~/Projects

# Clone from GitHub (or copy from Drive backup)
git clone <your-github-url> SAMS
cd SAMS

# Install dependencies
npm install
cd frontend/mobile-app && npm install
cd ../shared-components && npm install
cd ../sams-ui && npm install

# Ready to work!
```

---

## Benefits of This Setup

✅ **No more sync conflicts** - node_modules stay local to each machine  
✅ **Faster development** - local I/O is much faster than Drive  
✅ **Proper version control** - git history, branches, rollbacks  
✅ **Industry standard** - how all professional developers work  
✅ **Machine-specific builds** - each machine compiles its own dependencies  
✅ **Still using Google Cloud** - Firebase, Firestore, etc. unchanged  

---

## Troubleshooting

### If services won't start from new location

Check `start_sams.sh` and other scripts for hardcoded Google Drive paths:

```bash
cd ~/Projects/SAMS
grep -r "GoogleDrive" . --include="*.sh" --include="*.js"
```

Update any absolute paths to use relative paths or `$(pwd)`.

### If npm install fails

```bash
# Clear npm cache
npm cache clean --force

# Try again
npm install
```

### If git complains about changes

```bash
# See what changed
git status

# If it's just package-lock.json from npm install
git checkout package-lock.json

# Or commit the changes
git add .
git commit -m "Update dependencies after local move"
```

---

## Questions?

If you run into issues:
1. Check that git repository is intact (`git log` should show history)
2. Verify all dependencies installed (`ls node_modules` should show packages)
3. Check that Firebase credentials are in place (serviceAccountKey files)
4. Ensure start scripts use relative paths, not absolute

---

**Remember:** This is the **correct** way to do development. Google's own engineers don't code in Google Drive! You're moving to industry best practices.

