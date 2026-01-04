#!/bin/bash

# ========================================
# SAMS Deployment Manager
# Interactive deployment script with monitoring
# ========================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print colored output
print_header() { echo -e "\n${CYAN}════════════════════════════════════════${NC}"; echo -e "${CYAN}$1${NC}"; echo -e "${CYAN}════════════════════════════════════════${NC}\n"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_step() { echo -e "${CYAN}▶ $1${NC}"; }

# Check if we're in the right directory
if [ ! -f "firebase.json" ]; then
    print_error "Not in SAMS project root directory!"
    exit 1
fi

# ========================================
# MAIN MENU
# ========================================

clear
print_header "🚀 SAMS Deployment Manager"

echo "Select deployment type:"
echo ""
echo "  1) Full Deployment (bump version + deploy)"
echo "  2) Quick Deploy (no version bump)"
echo "  3) Frontend Only (Desktop)"
echo "  4) Backend Only" 
echo "  5) Just Bump Version (no deploy)"
echo "  6) View Current Versions"
echo "  7) PWA Only (Mobile App)"
echo "  8) Exit"
echo ""
read -p "Enter choice [1-8]: " CHOICE

case $CHOICE in
    1)
        DEPLOY_TYPE="full"
        ;;
    2)
        DEPLOY_TYPE="quick"
        ;;
    3)
        DEPLOY_TYPE="frontend"
        ;;
    4)
        DEPLOY_TYPE="backend"
        ;;
    5)
        DEPLOY_TYPE="bump-only"
        ;;
    6)
        DEPLOY_TYPE="view"
        ;;
    7)
        DEPLOY_TYPE="pwa"
        ;;
    8)
        echo "Goodbye!"
        exit 0
        ;;
    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

# ========================================
# VIEW VERSIONS
# ========================================

if [ "$DEPLOY_TYPE" = "view" ]; then
    print_header "📊 Current Version Information"
    
    # Local version
    if [ -f "shared/version.json" ]; then
        LOCAL_VERSION=$(node -p "require('./shared/version.json').version" 2>/dev/null || echo "unknown")
        LOCAL_HASH=$(node -p "require('./shared/version.json').git.hash" 2>/dev/null || echo "unknown")
        LOCAL_BUILD=$(node -p "require('./shared/version.json').build.buildNumber" 2>/dev/null || echo "unknown")
        
        echo "Local (Dev):"
        echo "  Version: v$LOCAL_VERSION"
        echo "  Git Hash: $LOCAL_HASH"
        echo "  Build: $LOCAL_BUILD"
        echo ""
    fi
    
    # Production version
    print_info "Checking production..."
    PROD_VERSION=$(curl -s https://sams-sandyland-prod.web.app/system/version 2>/dev/null | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).version" 2>/dev/null || echo "unavailable")
    
    if [ "$PROD_VERSION" != "unavailable" ]; then
        echo "Production:"
        echo "  Backend Version: v$PROD_VERSION"
        echo "  URL: https://sams-sandyland-prod.web.app"
    else
        print_warning "Could not fetch production version"
    fi
    
    echo ""
    exit 0
fi

# ========================================
# VERSION BUMP SELECTION
# ========================================

if [ "$DEPLOY_TYPE" = "full" ] || [ "$DEPLOY_TYPE" = "bump-only" ]; then
    echo ""
    echo "Select version bump type:"
    echo ""
    echo "  1) Patch (1.0.0 → 1.0.1) - Bug fixes"
    echo "  2) Minor (1.0.0 → 1.1.0) - New features"
    echo "  3) Major (1.0.0 → 2.0.0) - Breaking changes"
    echo ""
    read -p "Enter choice [1-3]: " BUMP_CHOICE
    
    case $BUMP_CHOICE in
        1) BUMP_TYPE="patch" ;;
        2) BUMP_TYPE="minor" ;;
        3) BUMP_TYPE="major" ;;
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac
fi

# ========================================
# CONFIRMATION
# ========================================

echo ""
print_header "📋 Deployment Summary"

case $DEPLOY_TYPE in
    full)
        echo "Type: Full Deployment"
        echo "Bump: $BUMP_TYPE"
        echo "Deploy: Frontend + Backend"
        ;;
    quick)
        echo "Type: Quick Deploy (no version bump)"
        echo "Deploy: Frontend + Backend"
        ;;
    frontend)
        echo "Type: Frontend Only (Desktop)"
        ;;
    backend)
        echo "Type: Backend Only"
        ;;
    bump-only)
        echo "Type: Version Bump Only"
        echo "Bump: $BUMP_TYPE"
        ;;
    pwa)
        echo "Type: PWA Only (Mobile App)"
        echo "Target: https://sams-mobile-pwa.web.app"
        echo "Domain: https://mobile.sams.sandyland.com.mx"
        ;;
esac

echo ""
read -p "Continue? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Cancelled."
    exit 0
fi

# ========================================
# START DEPLOYMENT
# ========================================

print_header "🚀 Starting Deployment"

START_TIME=$(date +%s)

# ========================================
# STEP 1: VERSION BUMP
# ========================================

if [ "$DEPLOY_TYPE" = "full" ] || [ "$DEPLOY_TYPE" = "bump-only" ]; then
    print_step "Step 1: Bumping version ($BUMP_TYPE)"
    
    if node scripts/updateVersion.js bump $BUMP_TYPE; then
        NEW_VERSION=$(node -p "require('./shared/version.json').version")
        print_success "Version bumped to v$NEW_VERSION"
        
        # Commit version changes
        git add shared/version.json frontend/sams-ui/package.json frontend/sams-ui/version.json frontend/mobile-app/package.json frontend/mobile-app/version.json 2>/dev/null || true
        
        if git commit -m "chore: bump version to $NEW_VERSION"; then
            print_success "Version changes committed"
        else
            print_warning "No version changes to commit"
        fi
        
        # Create tag
        if git tag -a "v$NEW_VERSION" -m "Version $NEW_VERSION" 2>/dev/null; then
            print_success "Created git tag v$NEW_VERSION"
        else
            print_warning "Tag v$NEW_VERSION already exists"
        fi
    else
        print_error "Version bump failed"
        exit 1
    fi
    echo ""
fi

if [ "$DEPLOY_TYPE" = "bump-only" ]; then
    print_success "Version bump complete!"
    
    read -p "Push to GitHub? (y/n): " PUSH_CONFIRM
    if [ "$PUSH_CONFIRM" = "y" ] || [ "$PUSH_CONFIRM" = "Y" ]; then
        git push origin main
        git push origin --tags
        print_success "Pushed to GitHub"
    fi
    
    exit 0
fi

# ========================================
# STEP 2: BUILD FRONTEND (Desktop or PWA)
# ========================================

if [ "$DEPLOY_TYPE" = "pwa" ]; then
    print_step "Step 2: Building PWA (Mobile App)"
    
    cd frontend/mobile-app
    if npm run build; then
        print_success "PWA built successfully"
    else
        print_error "PWA build failed"
        cd ../..
        exit 1
    fi
    cd ../..
    echo ""
elif [ "$DEPLOY_TYPE" != "backend" ]; then
    print_step "Step 2: Building frontend (Desktop)"
    
    cd frontend/sams-ui
    if npm run build; then
        print_success "Frontend built successfully"
    else
        print_error "Frontend build failed"
        cd ../..
        exit 1
    fi
    cd ../..
    echo ""
fi

# ========================================
# STEP 3: DEPLOY TO FIREBASE
# ========================================

print_step "Step 3: Deploying to Firebase"

DEPLOY_TARGET=""
case $DEPLOY_TYPE in
    frontend) DEPLOY_TARGET="--only hosting:desktop" ;;
    backend) DEPLOY_TARGET="--only functions:api" ;;
    pwa) DEPLOY_TARGET="--only hosting:mobile" ;;
    *) DEPLOY_TARGET="" ;;
esac

print_info "Running: firebase deploy $DEPLOY_TARGET"

if firebase deploy $DEPLOY_TARGET; then
    print_success "Firebase deployment initiated"
else
    print_error "Firebase deployment failed"
    exit 1
fi

echo ""

# ========================================
# STEP 4: MONITOR DEPLOYMENT
# ========================================

print_header "🔍 Monitoring Deployment"

MAX_ATTEMPTS=30
ATTEMPT=0
HEALTH_URL="https://sams-sandyland-prod.web.app/system/health"

print_info "Waiting for deployment to stabilize (checking every 10 seconds)..."
echo ""

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    
    # Try to fetch health endpoint
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL 2>/dev/null || echo "000")
    
    if [ "$HTTP_CODE" = "200" ]; then
        print_success "Deployment successful! (attempt $ATTEMPT)"
        
        # Fetch version info
        print_info "Verifying deployment..."
        DEPLOYED_VERSION=$(curl -s https://sams-sandyland-prod.web.app/system/version 2>/dev/null | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).version" 2>/dev/null || echo "unknown")
        
        if [ "$DEPLOYED_VERSION" != "unknown" ]; then
            print_success "Backend version: v$DEPLOYED_VERSION"
        fi
        
        break
    else
        if [ $ATTEMPT -eq 1 ]; then
            print_warning "Deployment in progress (HTTP $HTTP_CODE)..."
        else
            echo -ne "\r$(printf '  ⏳ Attempt %d/%d - HTTP %s' $ATTEMPT $MAX_ATTEMPTS $HTTP_CODE)"
        fi
        
        if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
            sleep 10
        fi
    fi
done

echo ""

if [ $ATTEMPT -ge $MAX_ATTEMPTS ]; then
    print_error "Deployment verification timeout"
    print_warning "Deployment may still be in progress. Check Firebase Console:"
    echo "  https://console.firebase.google.com/project/sams-sandyland-prod"
    exit 1
fi

# ========================================
# STEP 5: PUSH TO GITHUB
# ========================================

if [ "$DEPLOY_TYPE" = "full" ]; then
    echo ""
    print_step "Step 4: Pushing to GitHub"
    
    if git push origin main && git push origin --tags; then
        print_success "Pushed to GitHub with tags"
    else
        print_warning "Could not push to GitHub (may need manual push)"
    fi
fi

# ========================================
# COMPLETION
# ========================================

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
print_header "🎉 Deployment Complete!"

echo "Duration: ${DURATION}s"
if [ "$NEW_VERSION" != "" ]; then
    echo "Version: v$NEW_VERSION"
fi
echo "Environment: Production"
echo ""
echo "URLs:"
if [ "$DEPLOY_TYPE" = "pwa" ]; then
    echo "  PWA (Mobile): https://sams-mobile-pwa.web.app"
    echo "  Custom Domain: https://mobile.sams.sandyland.com.mx"
else
    echo "  Frontend (Desktop): https://sams-sandyland-prod.web.app"
    echo "  Custom Domain: https://sams.sandyland.com.mx"
fi
echo "  Firebase Console: https://console.firebase.google.com/project/sams-sandyland-prod"
echo ""

# Quick health checks
print_step "Final Health Checks"

# Check health endpoint
if curl -s $HEALTH_URL | grep -q "ok"; then
    print_success "Health check: OK"
else
    print_warning "Health check: Could not verify"
fi

# Check version endpoint
if curl -s https://sams-sandyland-prod.web.app/system/version | grep -q "version"; then
    print_success "Version endpoint: OK"
else
    print_warning "Version endpoint: Could not verify"
fi

echo ""
print_success "All done! Your deployment is live! 🚀"
echo ""
