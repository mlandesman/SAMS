#!/bin/bash
# SAMS Node Modules Symlink Setup
# This script moves node_modules to local storage and creates symlinks

set -e  # Exit on error

SAMS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LOCAL_DIR="$HOME/.sams-local"

echo "🔗 SAMS Node Modules Symlink Setup"
echo "=================================="
echo ""
echo "This script will:"
echo "  1. Move node_modules directories OUT of Google Drive"
echo "  2. Store them locally at: $LOCAL_DIR"
echo "  3. Create symlinks in their place"
echo ""
echo "Benefits:"
echo "  ✅ No more syncing thousands of files"
echo "  ✅ Faster Google Drive sync"
echo "  ✅ Each machine has its own node_modules"
echo "  ✅ No sync conflicts"
echo ""

# List of node_modules locations (relative to SAMS root)
MODULES=(
    "."
    "frontend"
    "frontend/mobile-app"
    "frontend/shared-components"
    "frontend/sams-ui"
)

echo "📁 Node_modules directories to process:"
for module_path in "${MODULES[@]}"; do
    if [ -d "$SAMS_DIR/$module_path/node_modules" ]; then
        echo "   ✅ $module_path/node_modules"
    else
        echo "   ⏭️  $module_path/node_modules (doesn't exist, will skip)"
    fi
done
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "🚀 Processing..."
echo ""

for module_path in "${MODULES[@]}"; do
    SOURCE_DIR="$SAMS_DIR/$module_path/node_modules"
    
    # Create a safe directory name for local storage
    if [ "$module_path" = "." ]; then
        LOCAL_NAME="root"
    else
        LOCAL_NAME="${module_path//\//-}"  # Replace / with -
    fi
    
    TARGET_DIR="$LOCAL_DIR/node_modules-$LOCAL_NAME"
    
    # Skip if source doesn't exist
    if [ ! -d "$SOURCE_DIR" ]; then
        echo "⏭️  Skipping $module_path/node_modules (doesn't exist)"
        continue
    fi
    
    # Check if it's already a symlink
    if [ -L "$SOURCE_DIR" ]; then
        LINK_TARGET=$(readlink "$SOURCE_DIR")
        echo "✅ $module_path/node_modules is already a symlink → $LINK_TARGET"
        continue
    fi
    
    echo "📦 Processing: $module_path/node_modules"
    
    # Create target directory if it doesn't exist
    mkdir -p "$TARGET_DIR"
    
    # Move contents if directory has files
    if [ "$(ls -A "$SOURCE_DIR")" ]; then
        echo "   Moving contents to $TARGET_DIR..."
        rsync -a "$SOURCE_DIR/" "$TARGET_DIR/" 2>/dev/null || true
        rm -rf "$SOURCE_DIR"
    else
        # Empty directory, just remove it
        rm -rf "$SOURCE_DIR"
    fi
    
    # Create symlink
    ln -s "$TARGET_DIR" "$SOURCE_DIR"
    
    echo "   ✅ Created symlink: $SOURCE_DIR → $TARGET_DIR"
    echo ""
done

echo ""
echo "✅ Setup Complete!"
echo ""
echo "📊 Summary:"
echo "   Local storage: $LOCAL_DIR"
echo "   Symlinks created in Google Drive folder"
echo ""
echo "🔍 Verify with:"
echo "   ls -la node_modules"
echo "   file node_modules"
echo ""
echo "💡 To setup on another machine:"
echo "   1. npm install (will populate local node_modules)"
echo "   2. Run this script again"
echo ""

