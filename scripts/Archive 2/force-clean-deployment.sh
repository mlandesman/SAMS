#!/bin/bash

# Force Clean Deployment Script
# This ensures a complete fresh build with no cached artifacts

echo "🚀 Starting Force Clean Deployment Process"
echo "========================================="

# 1. Clean local build artifacts
echo "1️⃣ Cleaning local build artifacts..."
rm -rf frontend/sams-ui/dist
rm -rf frontend/sams-ui/node_modules/.vite
rm -rf frontend/shared-components/dist
rm -rf backend/.vercel

# 2. Update package.json to force cache bust
echo "2️⃣ Updating deployment timestamp..."
TIMESTAMP=$(date +%s)
echo "export const DEPLOYMENT_TIMESTAMP = '$TIMESTAMP';" > frontend/sams-ui/src/deploymentTimestamp.js

# 3. Force cache clear by updating a deployment marker file
echo "3️⃣ Creating deployment marker to force cache clear..."
echo "{ \"deploymentId\": \"$TIMESTAMP\", \"date\": \"$(date)\" }" > frontend/sams-ui/src/deploymentMarker.json

# 4. Commit all changes
echo "4️⃣ Committing deployment changes..."
git add -A
git commit -m "deployment: Force clean build #$TIMESTAMP

- Clear all build caches
- Force Vercel to rebuild everything
- Ensure all Dev changes are included
- Deployment ID: $TIMESTAMP"

# 5. Push to trigger frontend deployment
echo "5️⃣ Pushing to GitHub (triggers frontend deployment)..."
git push origin main

# 6. Deploy backend if requested
echo ""
echo "📦 Backend Deployment"
echo "===================="
echo "The frontend will auto-deploy via Vercel."
echo ""
read -p "Do you also want to deploy the backend? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🚀 Deploying backend to production..."
  cd backend
  npx vercel --prod
  cd ..
  echo "✅ Backend deployment complete!"
else
  echo "ℹ️  Skipping backend deployment."
  echo "   To deploy backend later, run:"
  echo "   cd backend && npx vercel --prod"
fi

echo ""
echo "✅ Force clean deployment initiated!"
echo "📊 Deployment ID: $TIMESTAMP"
echo ""
echo "Next steps:"
echo "1. Monitor Vercel dashboard for build progress"
echo "2. After deployment, clear browser cache"
echo "3. Verify all features are present in production"
echo ""
echo "To verify deployment:"
echo "- Check /deploymentTimestamp.js should show: $TIMESTAMP"
echo "- All Dev features should be visible"
echo "- Backend API should be responding at: https://backend-michael-landesmans-projects.vercel.app/api"