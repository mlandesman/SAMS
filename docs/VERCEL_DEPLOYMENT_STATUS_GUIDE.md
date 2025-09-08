# Vercel Deployment Status Guide

## Overview
This guide provides methods to check the deployment status of SAMS on Vercel.

## Project Information

### Frontend (sams-ui)
- **Project ID**: prj_mahTCMBqSlep1dj6OQIPJgC73v7f
- **Production URL**: https://sams.sandyland.com.mx
- **Vercel URLs**: 
  - https://sams-ui-tau.vercel.app
  - https://sams-ui-michael-landesmans-projects.vercel.app

### Backend
- **Project ID**: prj_NeSBFub0ZvcZ8FJhp8jgPNzZgpId
- **Production URL**: https://backend-liart-seven.vercel.app
- **Vercel URLs**:
  - https://backend-michael-landesmans-projects.vercel.app

## Checking Deployment Status

### 1. Using Vercel CLI

#### List Recent Deployments
```bash
# Frontend deployments
cd frontend/sams-ui
npx vercel list

# Backend deployments
cd backend
npx vercel list
```

#### Inspect Specific Deployment
```bash
# Get detailed info about a deployment
npx vercel inspect <deployment-url>

# Example:
npx vercel inspect https://sams-ixos353dk-michael-landesmans-projects.vercel.app
```

#### Check Deployment Logs
```bash
# View recent logs
npx vercel logs <deployment-url>

# View logs from last hour
npx vercel logs <deployment-url> --since 1h

# View build logs
npx vercel logs <deployment-url> --output build
```

### 2. Using Vercel Dashboard
1. Visit https://vercel.com/dashboard
2. Select the project (sams-ui or backend)
3. View deployment history and status
4. Click on any deployment to see:
   - Build logs
   - Function logs
   - Error logs
   - Environment variables

### 3. Direct Status Checks

#### Check if Frontend is Running
```bash
curl -I https://sams.sandyland.com.mx
```

#### Check if Backend is Running
```bash
curl https://backend-liart-seven.vercel.app/health
```

### 4. Common Deployment Issues

#### Build Failures
Check the build configuration in `vercel.json`:
- Frontend: `/vercel.json`
- Backend: `/backend/vercel.json`

#### Environment Variables
Ensure all required environment variables are set in Vercel:
- Frontend needs Firebase config
- Backend needs Firebase admin credentials

#### Build Commands
- Frontend: `cd frontend/sams-ui && npm ci && npm run build`
- Backend: Default Node.js build

## Quick Status Check Script

Create a script to check both deployments:

```bash
#!/bin/bash
echo "Checking SAMS Deployment Status..."
echo ""
echo "Frontend Status:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" https://sams.sandyland.com.mx
echo ""
echo "Backend Status:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" https://backend-liart-seven.vercel.app/health
```

## Deployment Commands

### Deploy Frontend
```bash
cd frontend/sams-ui
npx vercel --prod
```

### Deploy Backend
```bash
cd backend
npx vercel --prod
```

### Deploy from Root (using configured vercel.json)
```bash
# This will deploy the frontend based on root vercel.json
npx vercel --prod
```

## Monitoring Recommendations

1. **Set up Vercel monitoring alerts** in the dashboard
2. **Use Vercel Analytics** to track performance
3. **Enable error tracking** with Vercel's built-in error reporting
4. **Set up health check endpoints** for automated monitoring

## Last Known Deployment Status
- Frontend: ✅ Ready (Last deployed: June 28, 2025)
- Backend: ✅ Ready (Last deployed: June 28, 2025)