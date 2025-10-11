# Quick Deploy Guide

## Interactive Deployment (Recommended)

```bash
./deploySams.sh
```

This launches an interactive menu where you can:

### Menu Options:

1. **Full Deployment** - Bump version + deploy everything
   - Asks for version type (patch/minor/major)
   - Bumps version
   - Builds frontend
   - Deploys to Firebase
   - Monitors deployment (checks every 10 seconds)
   - Pushes to GitHub with tags

2. **Quick Deploy** - Deploy without version bump
   - Builds frontend
   - Deploys to Firebase
   - Monitors deployment
   - No version change

3. **Frontend Only** - Just deploy frontend
   - Builds frontend
   - Deploys hosting only
   - Monitors deployment

4. **Backend Only** - Just deploy backend
   - Deploys Cloud Functions only
   - Monitors deployment

5. **Just Bump Version** - Update version without deploying
   - Bumps version
   - Updates all files
   - Commits and tags
   - Optionally pushes to GitHub

6. **View Current Versions** - Check versions
   - Shows local version
   - Shows production version
   - Shows git hashes
   - No changes made

## Simple Script (Alternative)

If you just want a quick bump and deploy:

```bash
./scripts/bump-version.sh patch   # Bug fix
./scripts/bump-version.sh minor   # New feature
./scripts/bump-version.sh major   # Breaking change
```

## What the Interactive Script Does:

### During Deployment:
- ✅ Shows colored progress messages
- ✅ Validates each step
- ✅ Commits version changes automatically
- ✅ Creates git tags
- ✅ Builds frontend
- ✅ Deploys to Firebase
- ✅ **Monitors deployment** (checks every 10 seconds)
- ✅ Verifies health endpoints
- ✅ Shows deployment duration
- ✅ Pushes to GitHub with tags

### Monitoring:
The script will check the production health endpoint every 10 seconds (up to 30 attempts = 5 minutes):
- Shows HTTP status code
- Updates progress counter
- Verifies backend version
- Reports success or timeout

### Error Handling:
- Stops on any error
- Shows clear error messages
- Provides Firebase Console link if needed
- Safe to re-run if it fails

## When to Use Which:

### Use `./deploySams.sh` when:
- ✅ You want an interactive experience
- ✅ You want to monitor the deployment
- ✅ You want to see detailed progress
- ✅ You want to choose deployment type
- ✅ You want to just check versions
- ✅ You're not sure what to deploy

### Use `./scripts/bump-version.sh` when:
- ✅ You know exactly what you want (quick)
- ✅ You want to script it in CI/CD
- ✅ You always do full deployments
- ✅ You prefer command-line arguments

## Example Session:

```bash
$ ./deploySams.sh

════════════════════════════════════════
🚀 SAMS Deployment Manager
════════════════════════════════════════

Select deployment type:

  1) Full Deployment (bump version + deploy)
  2) Quick Deploy (no version bump)
  3) Frontend Only
  4) Backend Only
  5) Just Bump Version (no deploy)
  6) View Current Versions
  7) Exit

Enter choice [1-7]: 1

Select version bump type:

  1) Patch (1.0.0 → 1.0.1) - Bug fixes
  2) Minor (1.0.0 → 1.1.0) - New features
  3) Major (1.0.0 → 2.0.0) - Breaking changes

Enter choice [1-3]: 1

════════════════════════════════════════
📋 Deployment Summary
════════════════════════════════════════

Type: Full Deployment
Bump: patch
Deploy: Frontend + Backend

Continue? (y/n): y

════════════════════════════════════════
🚀 Starting Deployment
════════════════════════════════════════

▶ Step 1: Bumping version (patch)
✅ Version bumped to v1.0.3
✅ Version changes committed
✅ Created git tag v1.0.3

▶ Step 2: Building frontend
✅ Frontend built successfully

▶ Step 3: Deploying to Firebase
✅ Firebase deployment initiated

════════════════════════════════════════
🔍 Monitoring Deployment
════════════════════════════════════════

ℹ️  Waiting for deployment to stabilize...

  ⏳ Attempt 3/30 - HTTP 200

✅ Deployment successful! (attempt 3)
✅ Backend version: v1.0.3

▶ Step 4: Pushing to GitHub
✅ Pushed to GitHub with tags

════════════════════════════════════════
🎉 Deployment Complete!
════════════════════════════════════════

Duration: 47s
Version: v1.0.3
Environment: Production

URLs:
  Frontend: https://sams-sandyland-prod.web.app
  Custom Domain: https://sams.sandyland.com.mx

▶ Final Health Checks
✅ Health check: OK
✅ Version endpoint: OK

✅ All done! Your deployment is live! 🚀
```

## Troubleshooting:

### "Deployment verification timeout"
- Deployment may still be progressing
- Check Firebase Console
- Usually resolves in a few more minutes
- You can re-run the script to check

### "Frontend build failed"
- Check for TypeScript/linting errors
- Run `cd frontend/sams-ui && npm run build` manually
- Fix errors and try again

### "Could not push to GitHub"
- May need to authenticate
- Can push manually later with `git push origin main --tags`
- Deployment still succeeded

## Tips:

1. **Always commit your changes first** before deploying
2. **Use "View Current Versions"** to check before deploying
3. **Monitor output carefully** - it tells you what's happening
4. **Don't panic on timeout** - check Firebase Console
5. **Use Quick Deploy** for hot fixes that don't need version bump

## For Agents:

The script is fully interactive - just run `./deploySams.sh` and follow the prompts. All deployment types are clearly labeled and the script guides you through each step.

