#!/bin/bash
# SAMS Laptop Setup Script
# Run this on your laptop after Google Drive syncs

echo "🚀 SAMS Laptop Setup Starting..."
echo ""

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "📍 Working directory: $PWD"
echo ""

# Check Node.js
echo "1️⃣ Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "   ✅ Node.js: $NODE_VERSION"
    
    # Check if version is >= 18
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        echo "   ⚠️  WARNING: Node.js version should be >= 18.0.0"
        echo "   Visit: https://nodejs.org/ or use nvm"
    fi
else
    echo "   ❌ Node.js NOT FOUND"
    echo "   Install from: https://nodejs.org/ or use nvm"
    exit 1
fi
echo ""

# Check npm
echo "2️⃣ Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "   ✅ npm: $NPM_VERSION"
else
    echo "   ❌ npm NOT FOUND (should come with Node.js)"
    exit 1
fi
echo ""

# Check Git
echo "3️⃣ Checking Git..."
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    echo "   ✅ $GIT_VERSION"
else
    echo "   ❌ Git NOT FOUND"
    echo "   Install from: https://git-scm.com/"
    exit 1
fi
echo ""

# Check Firebase CLI
echo "4️⃣ Checking Firebase CLI..."
if command -v firebase &> /dev/null; then
    FIREBASE_VERSION=$(firebase --version)
    echo "   ✅ Firebase CLI: $FIREBASE_VERSION"
else
    echo "   ⚠️  Firebase CLI NOT FOUND"
    echo "   Install with: npm install -g firebase-tools"
    read -p "   Install now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm install -g firebase-tools
    fi
fi
echo ""

# Check git status
echo "5️⃣ Checking Git repository..."
git status --short
echo ""

# Install root dependencies
echo "6️⃣ Installing root dependencies..."
if [ -f "package.json" ]; then
    npm install
    echo "   ✅ Root dependencies installed"
else
    echo "   ⚠️  package.json not found"
fi
echo ""

# Install backend dependencies
echo "7️⃣ Installing backend dependencies..."
if [ -d "backend" ] && [ -f "backend/package.json" ]; then
    cd backend
    npm install
    cd ..
    echo "   ✅ Backend dependencies installed"
else
    echo "   ⚠️  Backend directory or package.json not found"
fi
echo ""

# Install frontend dependencies
echo "8️⃣ Installing frontend dependencies..."
if [ -d "frontend/sams-ui" ] && [ -f "frontend/sams-ui/package.json" ]; then
    cd frontend/sams-ui
    npm install
    cd ../..
    echo "   ✅ Frontend dependencies installed"
else
    echo "   ⚠️  Frontend directory or package.json not found"
fi
echo ""

# Check Firebase credentials
echo "9️⃣ Checking Firebase credentials..."
if [ -f "serviceAccountKey-dev.json" ]; then
    echo "   ✅ Dev credentials found"
else
    echo "   ⚠️  Dev credentials NOT FOUND (should sync from Google Drive)"
fi

if [ -f "serviceAccountKey-prod.json" ]; then
    echo "   ✅ Prod credentials found"
else
    echo "   ⚠️  Prod credentials NOT FOUND (should sync from Google Drive)"
fi
echo ""

# Summary
echo "✅ Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo "   1. Check that Google Drive has finished syncing"
echo "   2. Review git status above for any uncommitted changes"
echo "   3. Start development with: ./start_sams.sh"
echo ""
echo "🔗 Quick Commands:"
echo "   Start all:     ./start_sams.sh"
echo "   Stop all:      ./stop_sams.sh"
echo "   Frontend only: cd frontend/sams-ui && npm run dev"
echo "   Backend only:  cd backend && npm start"
echo ""
echo "📝 Current Project Status:"
echo "   Priority: 0B - HOA Dues Refactor Preparation"
echo "   Phase: Phase 1 Validation (in progress)"
echo "   See: SAMS-Docs/Agile/Sprint_Groups.md and SAMS-Docs/Agile/Roadmap_and_Timeline.md"
echo ""
