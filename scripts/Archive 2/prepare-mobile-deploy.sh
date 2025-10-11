#!/bin/bash

# prepare-mobile-deploy.sh - Prepare mobile app for Vercel deployment

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Preparing SAMS Mobile for deployment...${NC}"

# Navigate to mobile app directory
cd "$(dirname "$0")/../frontend/mobile-app"

# Update manifest.json for production
echo -e "${YELLOW}📱 Updating PWA manifest...${NC}"
cat > public/manifest.json << 'EOF'
{
  "name": "SAMS Mobile - Sandyland Asset Management",
  "short_name": "SAMS Mobile",
  "description": "Mobile access to Sandyland Asset Management System",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#1e40af",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512x512.png", 
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["business", "finance", "productivity"],
  "screenshots": [
    {
      "src": "/screenshots/dashboard.png",
      "sizes": "1170x2532",
      "type": "image/png"
    }
  ]
}
EOF

# Create vercel.json for mobile deployment
echo -e "${YELLOW}⚙️  Creating Vercel configuration...${NC}"
cat > vercel.json << 'EOF'
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-cache, no-store, must-revalidate"
        },
        {
          "key": "Service-Worker-Allowed",
          "value": "/"
        }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options", 
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
EOF

# Update package.json name
echo -e "${YELLOW}📦 Updating package.json...${NC}"
npm pkg set name="sams-mobile"

# Create deployment checklist
echo -e "${YELLOW}📋 Creating deployment checklist...${NC}"
cat > DEPLOY_CHECKLIST.md << 'EOF'
# SAMS Mobile Deployment Checklist

## Pre-Deployment
- [ ] Test on physical iOS device
- [ ] Test on physical Android device
- [ ] Verify offline functionality
- [ ] Test "Add to Home Screen" flow
- [ ] Ensure all icons are present

## Vercel Setup
- [ ] Run `vercel` in this directory
- [ ] Set project name: `sams-mobile`
- [ ] Configure environment variables:
  - VITE_FIREBASE_API_KEY
  - VITE_FIREBASE_AUTH_DOMAIN
  - VITE_FIREBASE_PROJECT_ID
  - VITE_FIREBASE_STORAGE_BUCKET
  - VITE_FIREBASE_MESSAGING_SENDER_ID
  - VITE_FIREBASE_APP_ID
  - VITE_USE_EMULATOR=false

## Domain Configuration
- [ ] Add custom domain in Vercel: `mobile.sams.sandyland.com.mx`
- [ ] Update DNS records (CNAME to cname.vercel-dns.com)
- [ ] Wait for SSL certificate provisioning
- [ ] Test HTTPS access

## Post-Deployment
- [ ] Verify PWA installation on iOS
- [ ] Verify PWA installation on Android
- [ ] Test core features:
  - [ ] Login
  - [ ] Dashboard view
  - [ ] Exchange rate calculator
  - [ ] Unit reports
- [ ] Create user installation guide
EOF

echo -e "${GREEN}✅ Mobile deployment preparation complete!${NC}"
echo -e "${BLUE}📍 Next steps:${NC}"
echo "  1. Review DEPLOY_CHECKLIST.md"
echo "  2. Run 'vercel' to deploy"
echo "  3. Configure domain in Vercel dashboard"
echo ""
echo -e "${YELLOW}💡 To deploy:${NC}"
echo "  cd frontend/sams-ui/mobile-app"
echo "  vercel --prod"