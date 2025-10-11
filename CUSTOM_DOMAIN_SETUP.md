# Custom Domain Setup for Firebase

## Current Status

- ✅ **Firebase URL**: https://sams-sandyland-prod.web.app (WORKING)
- ⚠️ **Custom Domain**: sams.sandyland.com.mx (STILL ON VERCEL)

## Steps to Migrate Custom Domain to Firebase

### 1. Add Custom Domain in Firebase

1. Go to Firebase Console:
   ```
   https://console.firebase.google.com/project/sams-sandyland-prod/hosting/sites
   ```

2. Click **"Add custom domain"** button

3. Enter your domain: `sams.sandyland.com.mx`

4. Click **"Continue"**

5. Firebase will provide you with DNS records. You'll see something like:

   **For apex domain (sams.sandyland.com.mx):**
   ```
   Type: A
   Name: @
   Value: 151.101.1.195
   
   Type: A
   Name: @
   Value: 151.101.65.195
   ```

   **For www subdomain:**
   ```
   Type: CNAME
   Name: www
   Value: sams-sandyland-prod.web.app
   ```

### 2. Update DNS Records

Go to your domain registrar (wherever you registered sams.sandyland.com.mx) and:

1. **Delete old Vercel records** (look for A or CNAME records pointing to Vercel)

2. **Add Firebase A records**:
   - Type: `A`
   - Host: `@` (or blank for apex)
   - Value: `151.101.1.195`
   - TTL: Auto or 3600

   - Type: `A`
   - Host: `@` (or blank for apex)
   - Value: `151.101.65.195`
   - TTL: Auto or 3600

3. **Add CNAME for www** (if you want www.sams.sandyland.com.mx):
   - Type: `CNAME`
   - Host: `www`
   - Value: `sams-sandyland-prod.web.app`
   - TTL: Auto or 3600

### 3. Wait for DNS Propagation

- DNS changes take 5 minutes to 48 hours (usually ~30 minutes)
- Check status in Firebase Console
- Firebase will automatically provision SSL certificate

### 4. Remove from Vercel (Important!)

1. Go to Vercel Dashboard: https://vercel.com
2. Find your SAMS project
3. Go to **Settings** → **Domains**
4. Remove `sams.sandyland.com.mx` from the domain list

This prevents conflicts and ensures Vercel isn't serving the old code.

## Verification

After DNS propagates, test:

```bash
# Check DNS
dig sams.sandyland.com.mx

# Check if it's resolving to Firebase
curl -I https://sams.sandyland.com.mx

# Should return Firebase headers
```

## Quick Reference

| What | Where | Status |
|------|-------|--------|
| Firebase URL | sams-sandyland-prod.web.app | ✅ Live |
| Custom Domain | sams.sandyland.com.mx | ⚠️ Needs DNS update |
| Backend API | Same domain via rewrites | ✅ Working |
| SSL Certificate | Auto by Firebase | ✅ Will be auto-provisioned |

## Troubleshooting

### "Domain still showing Vercel"
- Clear browser cache (Cmd+Shift+R)
- Try incognito window
- Check DNS: `dig sams.sandyland.com.mx`
- Wait for DNS propagation (can take hours)

### "SSL Certificate Pending"
- Normal during setup
- Firebase auto-provisions Let's Encrypt cert
- Takes 5-30 minutes after DNS validates
- Don't visit site until Firebase shows "Connected"

### "DNS records look correct but not working"
- Check if Vercel domain is removed
- Verify DNS has propagated: https://dnschecker.org
- Check if old DNS is cached (flush your DNS: `sudo dscacheutil -flushcache`)

## Current Caching Issue

The version info showing "7/2/2025" is because the About modal was using old cached data.

**Solution Applied:**
- ✅ Regenerated version.json with current build info
- ✅ Rebuilt frontend with new version
- ✅ Deployed to Firebase

**To see new version:**
1. Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. Or open incognito window
3. Visit: https://sams-sandyland-prod.web.app
4. Click status bar to see About modal
5. Should now show: v1.0.2, Build: 251011.1847, Git Hash: 7db9cf8

## For Future Agents

When deploying, the version info automatically updates if you use:
- `./deploySams.sh` (interactive)
- `./scripts/bump-version.sh [type]` (quick)

Both scripts call `node scripts/updateVersion.js` which captures:
- Current version number
- Build timestamp
- Git commit hash
- Git branch
- Node version
- Platform info

This info gets baked into the build and displays in the About modal.

