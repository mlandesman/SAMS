#!/bin/bash
echo "🚀 Deploying SAMS Mobile to Firebase..."

# Build the PWA
cd "$(dirname "$0")"
npm run build

# Deploy to Firebase (mobile target only)
cd ../..
firebase deploy --only hosting:mobile

echo "✅ Deployment complete!"
echo "🌐 URL: https://sams-mobile.web.app"