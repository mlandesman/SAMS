# Quick Move to Local - Checklist

**Strategy:** Code → Local, Docs → Drive  
**Time:** ~15 minutes  
**Full Guide:** See `MOVE_TO_LOCAL_HYBRID_APPROACH.md`

---

## ⚡ Quick Steps

### 1️⃣ Prep (2 min)
```bash
# Stop services
cd "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS"
./stop_sams.sh

# Delete node_modules from Drive
find . -name "node_modules" -type d -prune -exec rm -rf {} \;
sleep 30  # Let Drive sync deletions
```

### 2️⃣ Copy to Local (3 min)
```bash
# Copy everything to local
mkdir -p ~/Projects
rsync -av --progress --exclude='node_modules/' --exclude='**/node_modules/' \
  "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/" \
  ~/Projects/SAMS/
```

### 3️⃣ Install Dependencies (5 min)
```bash
cd ~/Projects/SAMS
npm install

cd frontend/mobile-app && npm install
cd ../shared-components && npm install
cd ../sams-ui && npm install
```

### 4️⃣ Create Docs Folder (3 min)
```bash
# Create SAMS-Docs in Drive
mkdir -p "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs"

cd ~/Projects/SAMS

# Copy docs to Drive
rsync -av docs/ "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/docs/"
rsync -av apm/ "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/apm/"
rsync -av apm_session/ "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/apm_session/"
rsync -av analysis_reports/ "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/analysis_reports/"
rsync -av assets/ "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/assets/"
cp *.md "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/" 2>/dev/null
```

### 5️⃣ Test (2 min)
```bash
cd ~/Projects/SAMS
./start_sams.sh
cursor ~/Projects/SAMS
```

### 6️⃣ Add Aliases
```bash
cat >> ~/.zshrc << 'EOF'
alias sams="cd ~/Projects/SAMS"
alias sams-docs="cd '/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs'"
EOF
source ~/.zshrc
```

---

## ✅ Verification

After migration:
- [ ] `cd ~/Projects/SAMS` works
- [ ] `git status` shows clean working tree
- [ ] Services start: `./start_sams.sh`
- [ ] Frontend loads: http://localhost:5173
- [ ] Docs visible in Drive: `SAMS-Docs/` folder
- [ ] Can access Water Bills page
- [ ] No errors in console

---

## 🔄 Daily Workflow

### Push changes:
```bash
cd ~/Projects/SAMS
git add .
git commit -m "Your changes"
git push origin main
```

### Pull changes on other machine:
```bash
cd ~/Projects/SAMS
git pull origin main
npm install  # if package.json changed
```

### Sync docs to Drive:
```bash
cd ~/Projects/SAMS
rsync -av docs/ "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/docs/"
rsync -av apm_session/ "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/apm_session/"
```

---

## 🎯 What You Get

✅ **Fast:** Local development is 10-100x faster  
✅ **Clean:** No node_modules syncing to Drive  
✅ **Accessible:** Docs available on all devices  
✅ **Standard:** Industry best practice  

---

## 🆘 If Something Breaks

**Services won't start?**
```bash
cd ~/Projects/SAMS
grep -r "GoogleDrive" *.sh
# Update any hardcoded paths to relative paths
```

**Git issues?**
```bash
cd ~/Projects/SAMS
git status
git remote -v  # Should show GitHub
```

**Need old files?**
```bash
# Old SAMS folder still in Drive!
cd "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS"
```

---

**See `MOVE_TO_LOCAL_HYBRID_APPROACH.md` for detailed guide**

