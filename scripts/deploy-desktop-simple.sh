#!/bin/bash
# Simple desktop deployment script

echo "🚀 Deploying SAMS Desktop to Production"
echo "========================================"

# Navigate to desktop directory
cd "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui"

# Build the project
echo "📦 Building desktop UI..."
npm run build

# Deploy to Vercel
echo "☁️  Deploying to Vercel..."
vercel --prod

echo "✅ Deployment complete!"