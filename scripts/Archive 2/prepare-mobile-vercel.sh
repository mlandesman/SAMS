#!/bin/bash

# prepare-mobile-vercel.sh - Prepare mobile app for Vercel deployment by copying shared components

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Preparing SAMS Mobile for Vercel deployment...${NC}"

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Navigate to mobile app directory
cd "$PROJECT_ROOT/frontend/mobile-app"

echo -e "${YELLOW}📦 Copying shared components...${NC}"
# Remove old copy if exists
rm -rf node_modules/@sams/shared-components

# Copy shared components to node_modules
mkdir -p node_modules/@sams
cp -r ../shared-components node_modules/@sams/

echo -e "${YELLOW}🔧 Updating package.json for Vercel...${NC}"
# Create a temporary package.json without the file: reference
node -e "
const pkg = require('./package.json');
// Remove the file: reference for Vercel
if (pkg.dependencies['@sams/shared-components']) {
  pkg.dependencies['@sams/shared-components'] = '1.0.0';
}
require('fs').writeFileSync('./package.json', JSON.stringify(pkg, null, 2));
"

echo -e "${GREEN}✅ Mobile app prepared for Vercel deployment!${NC}"
echo -e "${BLUE}📍 Next steps:${NC}"
echo "  1. Run: ./deploy.sh --prod"
echo "  2. Add environment variables in Vercel dashboard"
echo "  3. Configure custom domain"