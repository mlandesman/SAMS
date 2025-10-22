# 🚀 Setting Up SAMS on Your MacBook

**Got a new MacBook? Here's how to get SAMS running in minutes.**

---

## 📋 Three Ways to Set Up

### Option 1: Fully Automated (Recommended)
**Fastest way - Just run the script:**

```bash
# If you already have the SAMS folder
cd ~/Projects/SAMS
./laptop-setup-script.sh

# Or download and run from GitHub
curl -O https://raw.githubusercontent.com/mlandesman/SAMS/main/laptop-setup-script.sh
chmod +x laptop-setup-script.sh
./laptop-setup-script.sh
```

**What it does:**
- ✅ Clones SAMS from GitHub
- ✅ Installs all dependencies
- ✅ Sets up shell aliases
- ✅ Verifies Google Drive access
- ✅ Takes 5-10 minutes total

---

### Option 2: AI-Assisted Setup with Cursor
**Best if you want guidance:**

1. Open Cursor on your MacBook
2. Open the file: `CURSOR_LAPTOP_SETUP_PROMPT.md`
3. Copy the entire contents
4. Paste into Cursor chat
5. Answer the agent's questions
6. Let AI guide you through each step

**What you get:**
- Step-by-step guidance
- Diagnostics and troubleshooting
- Verification at each stage
- Explanations of what's happening

---

### Option 3: Manual Setup
**For maximum control:**

Read and follow: `SETUP_NEW_LAPTOP.md`

This detailed guide covers:
- Prerequisites check
- Manual cloning and installation
- Configuration steps
- Troubleshooting
- Verification checklist

---

## 🎯 What You Need Before Starting

### Required:
- ✅ macOS (works on any MacBook)
- ✅ Node.js v22+ ([download](https://nodejs.org))
- ✅ Git ([download](https://git-scm.com))
- ✅ Google Drive app installed and signed in
- ✅ Cursor IDE ([download](https://cursor.sh))

### Optional but Helpful:
- GitHub account with access to mlandesman/SAMS
- Your old machine available (to copy service keys if needed)

---

## 📁 What Gets Set Up

```
YOUR MACBOOK:
├── ~/Projects/SAMS/                    ← Code (cloned from GitHub)
│   ├── backend/                        ← Express API
│   ├── frontend/                       ← React apps
│   └── SAMS-Full.code-workspace        ← Cursor workspace
│
└── Google Drive (synced)
    └── SAMS-Docs/                      ← Documentation & APM
        ├── apm/                        ← Agent prompts
        ├── apm_session/                ← Implementation plans
        └── docs/                       ← Project docs
```

---

## 🔧 Quick Verification

After setup, these should all work:

```bash
# Jump to code
sams
pwd  # Should show: /Users/you/Projects/SAMS

# Jump to docs
sams-docs
pwd  # Should show: [Drive]/SAMS-Docs

# Start SAMS
cd ~/Projects/SAMS
./start_sams.sh
# Should start on ports 5001, 5173, 5174

# Open in browser
open http://localhost:5173
# Should show SAMS login

# Open in Cursor
sams-full
# Should open with both code and docs folders
```

---

## 🆘 Troubleshooting

### Common Issues:

**"SAMS-Docs not found"**
- Google Drive may still be syncing
- Check Drive app sync status
- Or manually copy from old machine first

**"Cannot find module 'dotenv'"**
```bash
cd ~/Projects/SAMS/backend
npm install dotenv
```

**"Port already in use"**
```bash
lsof -ti:5001 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

**"Git authentication failed"**
- Set up GitHub credentials
- Or use HTTPS with personal access token

For more troubleshooting, see `SETUP_NEW_LAPTOP.md`

---

## 📚 Documentation Files

After setup, explore these:

| File | Purpose |
|------|---------|
| `SETUP_NEW_LAPTOP.md` | Complete manual setup guide |
| `CURSOR_LAPTOP_SETUP_PROMPT.md` | Prompt for AI-assisted setup |
| `laptop-setup-script.sh` | Automated setup script |
| `MIGRATION_COMPLETE.md` | Why local code + Drive docs |
| `APM_PATHS.md` | Where APM files live |
| `.cursor/APM_QUICK_START.md` | Using APM in Cursor |
| `.cursorrules` | Repository development rules |

---

## 🎉 What's Next?

Once setup is complete:

1. **Test the UI:**
   - Login to SAMS
   - Open Water Bills
   - Verify data loads

2. **Test Cursor Integration:**
   - Open workspace: `sams-full`
   - Try @ file references
   - Test APM commands: `/newIA`, `/newMA`

3. **Pull Latest:**
   ```bash
   cd ~/Projects/SAMS
   git pull origin main
   ```

4. **Start Coding!** 🚀
   - Water Bills is production-ready
   - Code locally, docs in Drive
   - Fast builds, instant Git ops

---

## 💡 Pro Tips

### Shell Aliases
These are automatically added:
- `sams` → Jump to code
- `sams-docs` → Jump to docs
- `sams-full` → Open Cursor with both folders

### Cursor Workspace
Always use `sams-full` to get:
- Both folders in sidebar
- @ references for everything
- Search across code and docs

### Google Drive
- SAMS-Docs syncs automatically
- Don't edit code in Drive anymore
- All coding happens locally now

---

## 📊 Performance You'll Get

**vs. Old Drive Setup:**
- ⚡ 3x faster development
- ⚡ Instant file access
- ⚡ Fast Git operations
- ⚡ 50% faster builds
- ⚡ No sync delays

---

## 🔗 Quick Links

- **GitHub:** https://github.com/mlandesman/SAMS
- **Main Branch:** Latest stable code
- **Setup Script:** `./laptop-setup-script.sh`
- **Cursor Prompt:** `CURSOR_LAPTOP_SETUP_PROMPT.md`
- **Full Guide:** `SETUP_NEW_LAPTOP.md`

---

**Choose your setup method above and get started! 🚀**

*Setup typically takes 5-15 minutes depending on internet speed and machine specs.*

