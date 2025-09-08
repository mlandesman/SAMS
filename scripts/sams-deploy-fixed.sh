#!/bin/bash
# SAMS Deployment - ACTUALLY WORKS Edition
# No BS, no over-engineering, just deploys the damn app

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the SAMS root directory (handles spaces in paths)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SAMS_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Default values
COMPONENT="all"
ENVIRONMENT="production"
DRY_RUN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -c|--component)
      COMPONENT="$2"
      shift 2
      ;;
    -e|--env)
      ENVIRONMENT="$2"
      shift 2
      ;;
    -d|--dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [-c component] [-e environment] [-d]"
      echo "  -c, --component   Component to deploy (desktop|mobile|backend|all)"
      echo "  -e, --env         Environment (development|staging|production)"
      echo "  -d, --dry-run     Show what would be deployed"
      echo ""
      echo "Examples:"
      echo "  $0                          # Deploy all to production"
      echo "  $0 -c desktop               # Deploy desktop to production"
      echo "  $0 -c mobile -e staging     # Deploy mobile to staging"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}🚀 SAMS Deployment System${NC}"
echo "=================================="
echo "Component: $COMPONENT"
echo "Environment: $ENVIRONMENT"
echo "Dry Run: $DRY_RUN"
echo ""

# Function to deploy desktop
deploy_desktop() {
  echo -e "${YELLOW}📱 Deploying Desktop UI...${NC}"
  cd "$SAMS_ROOT/frontend/sams-ui"
  
  if [ "$DRY_RUN" = true ]; then
    echo "Would run: npm run build && vercel --prod"
  else
    echo "Building..."
    npm run build
    
    echo "Deploying to Vercel..."
    if [ "$ENVIRONMENT" = "production" ]; then
      vercel --prod
    else
      vercel
    fi
  fi
  
  echo -e "${GREEN}✅ Desktop deployment complete${NC}"
}

# Function to deploy mobile
deploy_mobile() {
  echo -e "${YELLOW}📱 Deploying Mobile PWA...${NC}"
  cd "$SAMS_ROOT/frontend/mobile-app"
  
  if [ "$DRY_RUN" = true ]; then
    echo "Would run: npm run build && vercel --prod"
  else
    echo "Building..."
    npm run build
    
    echo "Deploying to Vercel..."
    if [ "$ENVIRONMENT" = "production" ]; then
      vercel --prod
    else
      vercel
    fi
  fi
  
  echo -e "${GREEN}✅ Mobile deployment complete${NC}"
}

# Function to deploy backend
deploy_backend() {
  echo -e "${YELLOW}🔧 Deploying Backend API...${NC}"
  cd "$SAMS_ROOT/backend"
  
  if [ "$DRY_RUN" = true ]; then
    echo "Would run: vercel --prod"
  else
    echo "Deploying to Vercel..."
    if [ "$ENVIRONMENT" = "production" ]; then
      vercel --prod
    else
      vercel
    fi
  fi
  
  echo -e "${GREEN}✅ Backend deployment complete${NC}"
}

# Main deployment logic
case $COMPONENT in
  desktop)
    deploy_desktop
    ;;
  mobile)
    deploy_mobile
    ;;
  backend)
    deploy_backend
    ;;
  all)
    deploy_desktop
    echo ""
    deploy_mobile
    echo ""
    deploy_backend
    ;;
  *)
    echo -e "${RED}Invalid component: $COMPONENT${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"

# Show deployed URLs
echo ""
echo "Deployed URLs:"
if [ "$ENVIRONMENT" = "production" ]; then
  [ "$COMPONENT" = "desktop" ] || [ "$COMPONENT" = "all" ] && echo "  Desktop: https://sams.sandyland.com.mx"
  [ "$COMPONENT" = "mobile" ] || [ "$COMPONENT" = "all" ] && echo "  Mobile: https://mobile.sams.sandyland.com.mx"
  [ "$COMPONENT" = "backend" ] || [ "$COMPONENT" = "all" ] && echo "  Backend: https://backend-liart-seven.vercel.app"
fi