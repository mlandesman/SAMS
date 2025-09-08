# SAMS Mobile Vercel Deployment Steps

## Step 1: Deploy to Vercel

Run this command in your terminal:
```bash
cd /Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My\ Drive/Sandyland/SAMS/frontend/mobile-app
vercel
```

## Step 2: Answer Vercel CLI prompts

1. **Set up and deploy?** → Yes
2. **Which scope?** → Select your account
3. **Link to existing project?** → No
4. **Project name?** → `sams-mobile`
5. **Directory?** → `./` (current directory)
6. **Build Command?** → Press Enter (uses default from vercel.json)
7. **Output Directory?** → Press Enter (uses default from vercel.json)
8. **Development Command?** → Press Enter

## Step 3: Configure Environment Variables

Once deployed, go to the Vercel dashboard and add these environment variables:

1. Go to: https://vercel.com/[your-account]/sams-mobile/settings/environment-variables
2. Add each variable for "Production" environment:

```
VITE_FIREBASE_API_KEY=[your-value]
VITE_FIREBASE_AUTH_DOMAIN=[your-value]
VITE_FIREBASE_PROJECT_ID=[your-value]
VITE_FIREBASE_STORAGE_BUCKET=[your-value]
VITE_FIREBASE_MESSAGING_SENDER_ID=[your-value]
VITE_FIREBASE_APP_ID=[your-value]
VITE_USE_EMULATOR=false
```

3. Click "Save" for each variable

## Step 4: Redeploy with Environment Variables

After adding all environment variables:
```bash
vercel --prod
```

## Step 5: Add Custom Domain

1. Go to: https://vercel.com/[your-account]/sams-mobile/settings/domains
2. Add domain: `mobile.sams.sandyland.com.mx`
3. You'll see DNS instructions

## Step 6: Configure DNS in Wix

1. Go to your Wix domain management
2. Add CNAME record:
   - Host/Name: `mobile`
   - Points to: `cname.vercel-dns.com`
   - TTL: 3600 (or default)

## Step 7: Wait for SSL Certificate

- Vercel will automatically provision SSL certificate
- This usually takes 10-30 minutes
- Check status in Vercel domains settings

## Step 8: Test the Deployment

1. Visit: https://mobile.sams.sandyland.com.mx
2. Test on mobile device
3. Try "Add to Home Screen" functionality

## Troubleshooting

### If build fails:
- Check build logs in Vercel dashboard
- Ensure all dependencies are in package.json
- Verify node version compatibility

### If domain doesn't work:
- DNS propagation can take up to 48 hours
- Use https://dnschecker.org to verify CNAME record
- Ensure no conflicting DNS records exist

### If PWA doesn't install:
- Must be served over HTTPS
- Check manifest.json is accessible
- Verify service worker registration

## Production URLs

- Vercel URL: https://sams-mobile.vercel.app
- Custom Domain: https://mobile.sams.sandyland.com.mx