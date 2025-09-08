# Staging Deployment Workflow

## Overview

SAMS now has a staging environment at `staging.sandyland.com.mx` for safe testing before production deployment. This document outlines the workflow for using the staging environment.

## Architecture

```
Development (localhost:5173)
       ↓
Staging Branch → staging.sandyland.com.mx
       ↓ [Testing & QA]
Main Branch → sams.sandyland.com.mx
```

## Deployment Configuration

### Branch Strategy

- **`staging` branch**: Deploys to staging.sandyland.com.mx
- **`main` branch**: Deploys to sams.sandyland.com.mx (production)

### Environment Files

- **Development**: `.env.development` (local development)
- **Staging**: `.env.staging` (staging deployment)
- **Production**: `.env.production` (production deployment)

## Development Workflow

### 1. Feature Development

```bash
# Start from staging branch
git checkout staging
git pull origin staging

# Create feature branch
git checkout -b feature/your-feature-name

# Make your changes
# ... develop and test locally ...
```

### 2. Deploy to Staging

```bash
# Merge to staging branch
git checkout staging
git merge feature/your-feature-name
git push origin staging

# This automatically triggers deployment to staging.sandyland.com.mx
```

### 3. Test on Staging

Visit https://staging.sandyland.com.mx to test:

- ✅ PWA functionality (manifest, service worker, install)
- ✅ Mobile responsive layout
- ✅ All user flows and features
- ✅ API integrations
- ✅ Performance on mobile devices

### 4. Promote to Production

After successful testing:

```bash
# Switch to main branch
git checkout main
git pull origin main

# Merge staging changes
git merge staging
git push origin main

# This automatically triggers deployment to sams.sandyland.com.mx
```

## Vercel Configuration

### Setting Up Branch Deployments

1. **In Vercel Dashboard**:
   - Go to Project Settings → Git
   - Enable "Preview Deployments" for `staging` branch
   - Add custom domain: staging.sandyland.com.mx to staging branch

2. **Environment Variables**:
   - Set staging-specific variables in Vercel dashboard
   - Use different values for API endpoints if needed

### CNAME Configuration for DNS

**For staging.sandyland.com.mx**:

```
Type: CNAME
Name: staging
Value: cname.vercel-dns.com
TTL: 300
```

**Note**: The exact CNAME target will be provided by Vercel when you add the custom domain. It's typically `cname.vercel-dns.com` for custom domains.

## Environment-Specific Features

### Staging Environment Features

The staging environment includes:
- Debug mode enabled (`VITE_DEBUG_MODE=true`)
- Dev tools visible (`VITE_SHOW_DEV_TOOLS=true`)
- Staging banner (if implemented)
- Test data capabilities

### Production Environment Features

The production environment has:
- Debug mode disabled
- Dev tools hidden
- Optimized performance settings
- Maintenance mode capability

## Quick Commands Reference

```bash
# Switch to staging and update
git checkout staging && git pull origin staging

# Deploy feature to staging
git merge feature/branch-name && git push origin staging

# Promote staging to production
git checkout main && git merge staging && git push origin main

# Check deployment status
curl -I https://staging.sandyland.com.mx
```

## Troubleshooting

### Domain Not Resolving

1. Check DNS propagation: https://dnschecker.org/
2. Verify CNAME record in Wix.com DNS settings
3. Check Vercel domain configuration

### Deployment Failed

1. Check Vercel dashboard for build logs
2. Ensure all dependencies are installed
3. Verify environment variables are set

### PWA Not Working

1. Check manifest.json is accessible
2. Verify service worker registration
3. Ensure HTTPS is working (required for PWA)
4. Test in Chrome DevTools → Application tab

## Best Practices

1. **Always test on staging first** - Never push directly to main
2. **Use feature branches** - Create branches from staging for new work
3. **Test mobile thoroughly** - PWA features are mobile-critical
4. **Monitor deployments** - Check Vercel dashboard after pushes
5. **Keep staging in sync** - Regularly merge main back to staging

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [PWA Testing Guide](https://web.dev/pwa-checklist/)
- [Chrome DevTools for PWA](https://developer.chrome.com/docs/devtools/progressive-web-apps/)