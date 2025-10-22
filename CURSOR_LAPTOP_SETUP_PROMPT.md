# Cursor Agent Prompt: Setup SAMS on New MacBook

**Copy and paste this entire prompt into Cursor on your MacBook to get AI-assisted setup.**

---

## Your Task

You are helping me set up the SAMS (Sandyland Asset Management System) project on my MacBook for the first time. SAMS is a Firebase-based property management system that runs with:
- **Code:** Local storage (`~/Projects/SAMS`)
- **Documentation:** Google Drive (`SAMS-Docs/`)
- **Stack:** Node.js, React, Firebase, Express

## Context You Need to Know

### Current State of This MacBook
- [ ] Fresh machine or existing development environment?
- [ ] Google Drive installed and synced?
- [ ] Node.js installed (need v22+)?
- [ ] Git configured?
- [ ] Cursor IDE installed?

### Project Structure
```
LOCAL (~)
└── Projects/
    └── SAMS/              ← Clone from GitHub here
        ├── backend/       ← Express API (port 5001)
        ├── frontend/      ← React apps (ports 5173, 5174)
        ├── scripts/       ← Utilities
        └── ...

DRIVE (Google Drive)
└── Sandyland/
    └── SAMS-Docs/         ← Must sync from Drive
        ├── apm/           ← APM prompts and memory
        ├── apm_session/   ← Current implementation plan
        └── docs/          ← Project documentation
```

## Your Setup Process

### Phase 1: Discovery
Ask me these questions first:
1. Is this a fresh MacBook or do you have development tools installed?
2. Run: `node --version` - What's the result?
3. Run: `git --version` - What's the result?
4. Run: `ls ~/Projects` - Does SAMS directory already exist?
5. Run: `ls "/Users/$USER/Library/CloudStorage" | grep GoogleDrive` - Is Drive mounted?

### Phase 2: Automated Setup (Recommended)
If I have Git and Node.js installed, use the automated script:

```bash
# Option A: If SAMS already cloned
cd ~/Projects/SAMS
./laptop-setup-script.sh

# Option B: If starting from scratch
curl -O https://raw.githubusercontent.com/mlandesman/SAMS/main/laptop-setup-script.sh
chmod +x laptop-setup-script.sh
./laptop-setup-script.sh
```

**What the script does:**
1. Checks prerequisites (Node, Git, Cursor, Drive)
2. Clones SAMS from GitHub to `~/Projects/SAMS`
3. Installs dependencies (root, backend, frontend, mobile)
4. Adds shell aliases (sams, sams-docs, sams-full)
5. Verifies Google Drive access
6. Reports what's working and what needs attention

### Phase 3: Manual Steps (If Script Can't Run)
If the automated script fails or I prefer manual setup, guide me through:

1. **Clone Repository**
   ```bash
   mkdir -p ~/Projects
   cd ~/Projects
   git clone https://github.com/mlandesman/SAMS.git
   cd SAMS
   ```

2. **Install Dependencies** (in order)
   - Root: `npm install`
   - Backend: `cd backend && npm install && cd ..`
   - Frontend: `cd frontend/sams-ui && npm install && cd ../..`
   - Mobile: `cd frontend/mobile-app && npm install && cd ../..`
   - Shared: `cd frontend/shared-components && npm install && cd ../..`

3. **Configure Aliases**
   Add to `~/.bash_profile` or `~/.zshrc`:
   ```bash
   alias sams="cd ~/Projects/SAMS"
   alias sams-docs="cd /Users/$USER/Library/CloudStorage/GoogleDrive-michael@landesman.com/My\ Drive/Sandyland/SAMS-Docs"
   alias sams-full='cursor ~/Projects/SAMS/SAMS-Full.code-workspace'
   ```

4. **Verify Google Drive**
   Check: `/Users/$USER/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs`

### Phase 4: Verification
Run these checks and report status:

```bash
cd ~/Projects/SAMS

# Check Git status
git status
git branch

# Check dependencies installed
ls node_modules backend/node_modules frontend/sams-ui/node_modules

# Check Drive access
ls "/Users/$USER/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs"

# Test starting services
./start_sams.sh
```

Expected results:
- ✅ Backend starts on port 5001
- ✅ Frontend starts on port 5173
- ✅ PWA Mobile starts on port 5174
- ✅ Can access http://localhost:5173

### Phase 5: Cursor Workspace Setup
Help me open Cursor with both code and docs:

```bash
# Open with full workspace
cursor ~/Projects/SAMS/SAMS-Full.code-workspace
```

Verify in Cursor:
- Sidebar shows "SAMS (Code)" folder
- Sidebar shows "SAMS-Docs (APM & Documentation)" folder
- @ file references work for both locations
- Can read files from both folders

## Common Issues & Solutions

### Issue: "Cannot find module 'dotenv'"
**Solution:**
```bash
cd ~/Projects/SAMS/backend
npm install dotenv
```

### Issue: "SAMS-Docs not found in Drive"
**Possible causes:**
1. Google Drive still syncing (wait)
2. Different Drive email path (check path)
3. SAMS-Docs not copied from old machine yet

**Solution:** Verify Drive path:
```bash
ls "/Users/$USER/Library/CloudStorage"
# Find the actual GoogleDrive folder name
```

### Issue: "Port already in use"
**Solution:**
```bash
lsof -ti:5001 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

### Issue: "Git authentication failed"
**Solution:** Set up GitHub credentials:
```bash
git config --global user.name "Michael Landesman"
git config --global user.email "michael@landesman.com"
# Then set up GitHub token or SSH key
```

## Key Files to Reference

Once setup is complete, read these files for context:
- `SETUP_NEW_LAPTOP.md` - Full manual setup guide
- `MIGRATION_COMPLETE.md` - Why we moved to local storage
- `APM_PATHS.md` - Where APM documentation lives
- `.cursor/APM_QUICK_START.md` - How to use APM in Cursor
- `.cursorrules` - Repository rules and constraints

## Success Criteria

Setup is complete when:
- [x] SAMS cloned to `~/Projects/SAMS`
- [x] All dependencies installed (no errors)
- [x] Shell aliases work (`sams`, `sams-docs`, `sams-full`)
- [x] Services start successfully (ports 5001, 5173, 5174)
- [x] Can access SAMS UI at http://localhost:5173
- [x] Can login to SAMS
- [x] Water Bills module loads and displays data
- [x] Cursor workspace opens with both folders
- [x] @ file references work in Cursor
- [x] Google Drive SAMS-Docs accessible

## After Setup Is Complete

Once everything works, help me:
1. Test Water Bills functionality
2. Verify APM commands work (`/newIA`, `/newMA`)
3. Pull latest changes: `git pull origin main`
4. Understand the local vs. Drive structure
5. Start coding! 🚀

## Your Approach

Please:
1. **Be diagnostic first** - Check what's already installed/configured
2. **Be systematic** - Follow phases in order
3. **Be clear** - Explain what each command does
4. **Be proactive** - Catch issues early
5. **Be thorough** - Verify each step before moving to next

Start by asking me the discovery questions, then guide me through setup based on my answers.

---

**Ready to begin! What's the current state of this MacBook?**

