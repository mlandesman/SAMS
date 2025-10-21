#!/bin/bash
# Complete Laptop Setup for SAMS
# Handles the case where Mac mini already has symlinks

set -e

echo "🚀 SAMS Complete Laptop Setup"
echo "=============================="
echo ""
echo "This script assumes the Mac mini already has node_modules as symlinks."
echo "We'll set up this laptop with its own local node_modules."
echo ""

SAMS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SAMS_DIR"

# Step 1: Force remove any node_modules directories
echo "1️⃣ Cleaning up any existing node_modules..."
find . -name "node_modules" -type d -maxdepth 3 -exec rm -rf {} + 2>/dev/null || true
echo "   ✅ Cleaned"
echo ""

# Step 2: Install root dependencies
echo "2️⃣ Installing root dependencies..."
if [ -f "package.json" ]; then
    npm install
    echo "   ✅ Root dependencies installed"
else
    echo "   ⚠️  package.json not found"
fi
echo ""

# Step 3: Install backend dependencies
echo "3️⃣ Installing backend dependencies..."
if [ -d "backend" ] && [ -f "backend/package.json" ]; then
    cd backend
    npm install
    cd ..
    echo "   ✅ Backend dependencies installed"
else
    echo "   ⏭️  Backend not found"
fi
echo ""

# Step 4: Install frontend dependencies
echo "4️⃣ Installing frontend dependencies..."
if [ -d "frontend/sams-ui" ] && [ -f "frontend/sams-ui/package.json" ]; then
    cd frontend/sams-ui
    npm install
    cd ../..
    echo "   ✅ Frontend dependencies installed"
else
    echo "   ⏭️  Frontend not found"
fi
echo ""

# Step 5: Convert to symlinks
echo "5️⃣ Converting node_modules to symlinks..."
./setup-node-symlinks.sh <<< "y"
echo ""

# Step 6: Verify
echo "6️⃣ Verifying setup..."
echo ""
echo "Root node_modules:"
file node_modules

if [ -d "frontend/sams-ui/node_modules" ]; then
    echo ""
    echo "Frontend node_modules:"
    file frontend/sams-ui/node_modules
fi

echo ""
echo "✅ Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo "   1. Test the setup: ./start_sams.sh"
echo "   2. Access frontend: http://localhost:5173"
echo "   3. Access backend: http://localhost:3000"
echo ""

