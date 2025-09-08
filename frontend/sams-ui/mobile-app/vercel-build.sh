#!/bin/bash
# Build script for Vercel that handles shared components

echo "Building SAMS Mobile with shared components..."

# Create a temporary symlink for shared-components
echo "Setting up shared components..."
mkdir -p node_modules/@sams
ln -sf ../../../shared-components node_modules/@sams/shared-components

# Install dependencies if needed
if [ ! -d "node_modules/@sams/shared-components/node_modules" ]; then
  echo "Installing shared-components dependencies..."
  cd ../shared-components
  npm install
  cd ../mobile-app
fi

# Now run the regular build
echo "Running build..."
npm run build