#!/bin/bash
#
# SAMS MacBook Setup Script
# Automates the setup of SAMS on a new MacBook
# Usage: ./laptop-setup-script.sh
#

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "$1"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
}

print_step() {
    echo -e "${BLUE}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_header "🔍 Checking Prerequisites"
    
    local all_good=true
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js installed: $NODE_VERSION"
    else
        print_error "Node.js not found. Please install Node.js v22+"
        all_good=false
    fi
    
    # Check Git
    if command -v git &> /dev/null; then
        GIT_VERSION=$(git --version)
        print_success "Git installed: $GIT_VERSION"
    else
        print_error "Git not found. Please install Git"
        all_good=false
    fi
    
    # Check Cursor
    if command -v cursor &> /dev/null; then
        print_success "Cursor IDE installed"
    else
        print_warning "Cursor IDE not found in PATH (optional, can install later)"
    fi
    
    # Check Google Drive
    if ls /Users/$USER/Library/CloudStorage/GoogleDrive-* &> /dev/null; then
        print_success "Google Drive mounted"
    else
        print_warning "Google Drive not detected. SAMS-Docs won't be accessible yet."
    fi
    
    if [ "$all_good" = false ]; then
        print_error "Please install missing prerequisites before continuing."
        exit 1
    fi
    
    echo ""
}

# Clone repository
clone_repository() {
    print_header "📦 Cloning SAMS Repository"
    
    # Create Projects directory
    mkdir -p ~/Projects
    cd ~/Projects
    
    if [ -d "SAMS" ]; then
        print_warning "SAMS directory already exists at ~/Projects/SAMS"
        read -p "Do you want to remove it and clone fresh? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_step "Removing existing SAMS directory..."
            rm -rf SAMS
        else
            print_step "Keeping existing directory, skipping clone..."
            cd SAMS
            return
        fi
    fi
    
    print_step "Cloning from GitHub..."
    git clone https://github.com/mlandesman/SAMS.git
    cd SAMS
    
    print_success "Repository cloned successfully"
    
    # Show current branch
    BRANCH=$(git branch --show-current)
    print_success "Current branch: $BRANCH"
    echo ""
}

# Install dependencies
install_dependencies() {
    print_header "📚 Installing Dependencies"
    
    cd ~/Projects/SAMS
    
    # Root dependencies
    print_step "Installing root dependencies..."
    npm install
    print_success "Root dependencies installed"
    
    # Backend dependencies
    print_step "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    print_success "Backend dependencies installed"
    
    # Frontend (sams-ui) dependencies
    print_step "Installing frontend (sams-ui) dependencies..."
    cd frontend/sams-ui
    npm install
    cd ../..
    print_success "Frontend dependencies installed"
    
    # Mobile app dependencies
    print_step "Installing mobile app dependencies..."
    cd frontend/mobile-app
    npm install
    cd ../..
    print_success "Mobile app dependencies installed"
    
    # Shared components dependencies
    print_step "Installing shared components dependencies..."
    cd frontend/shared-components
    npm install
    cd ../..
    print_success "Shared components dependencies installed"
    
    echo ""
}

# Configure shell aliases
configure_aliases() {
    print_header "⚙️  Configuring Shell Aliases"
    
    # Check which shell config file to use
    if [ -f ~/.zshrc ]; then
        SHELL_CONFIG=~/.zshrc
        SHELL_NAME="zsh"
    elif [ -f ~/.bash_profile ]; then
        SHELL_CONFIG=~/.bash_profile
        SHELL_NAME="bash"
    else
        SHELL_CONFIG=~/.bash_profile
        SHELL_NAME="bash"
        touch $SHELL_CONFIG
    fi
    
    print_step "Using $SHELL_CONFIG for $SHELL_NAME"
    
    # Check if aliases already exist
    if grep -q "alias sams=" $SHELL_CONFIG; then
        print_warning "SAMS aliases already exist in $SHELL_CONFIG"
        read -p "Overwrite them? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_step "Keeping existing aliases"
            return
        fi
        # Remove old aliases
        sed -i.bak '/# SAMS project shortcuts/d' $SHELL_CONFIG
        sed -i.bak '/alias sams=/d' $SHELL_CONFIG
        sed -i.bak '/alias sams-docs=/d' $SHELL_CONFIG
        sed -i.bak '/alias sams-full=/d' $SHELL_CONFIG
    fi
    
    # Add aliases
    cat >> $SHELL_CONFIG << 'ALIASES_EOF'

# SAMS project shortcuts
alias sams="cd ~/Projects/SAMS"
alias sams-docs="cd /Users/$USER/Library/CloudStorage/GoogleDrive-michael@landesman.com/My\ Drive/Sandyland/SAMS-Docs"
alias sams-full='cursor ~/Projects/SAMS/SAMS-Full.code-workspace'
ALIASES_EOF
    
    print_success "Aliases added to $SHELL_CONFIG"
    print_step "Reload your shell or run: source $SHELL_CONFIG"
    echo ""
}

# Verify Google Drive access
verify_drive_access() {
    print_header "☁️  Verifying Google Drive Access"
    
    DRIVE_PATH="/Users/$USER/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs"
    
    if [ -d "$DRIVE_PATH" ]; then
        print_success "SAMS-Docs found in Google Drive"
        
        # Check key directories
        if [ -d "$DRIVE_PATH/apm" ]; then
            print_success "APM directory found"
        else
            print_warning "APM directory not found - may still be syncing"
        fi
        
        if [ -d "$DRIVE_PATH/apm_session" ]; then
            print_success "APM Session directory found"
        else
            print_warning "APM Session directory not found - may still be syncing"
        fi
    else
        print_warning "SAMS-Docs not found in Google Drive yet"
        print_step "This is normal if:"
        print_step "  1. Google Drive is still syncing"
        print_step "  2. This is a fresh machine and you need to copy SAMS-Docs from old machine"
        print_step "  3. The Drive path is different (check your Drive email)"
    fi
    
    echo ""
}

# Final verification
final_verification() {
    print_header "✅ Verification"
    
    cd ~/Projects/SAMS
    
    # Check directory exists
    if [ -d ~/Projects/SAMS ]; then
        print_success "SAMS directory: ~/Projects/SAMS"
    fi
    
    # Check Git status
    if [ -d .git ]; then
        BRANCH=$(git branch --show-current)
        print_success "Git repository on branch: $BRANCH"
    fi
    
    # Check node_modules
    if [ -d node_modules ]; then
        print_success "Root node_modules installed"
    fi
    
    if [ -d backend/node_modules ]; then
        print_success "Backend node_modules installed"
    fi
    
    if [ -d frontend/sams-ui/node_modules ]; then
        print_success "Frontend node_modules installed"
    fi
    
    # Check workspace file
    if [ -f SAMS-Full.code-workspace ]; then
        print_success "Cursor workspace file present"
    fi
    
    echo ""
}

# Print next steps
print_next_steps() {
    print_header "🎯 Setup Complete!"
    
    cat << 'EOF'
Next Steps:

1. Reload your shell:
   source ~/.bash_profile  (or ~/.zshrc)

2. Test aliases:
   sams        # Jump to code
   sams-docs   # Jump to docs (if Drive synced)
   
3. Start SAMS services:
   cd ~/Projects/SAMS
   ./start_sams.sh

4. Open in browser:
   http://localhost:5173

5. Open in Cursor with full workspace:
   sams-full

6. Verify in Cursor:
   - Check sidebar shows both folders
   - Test @ file references
   - Try APM commands (/newIA, /newMA)

📚 Documentation:
   ~/Projects/SAMS/SETUP_NEW_LAPTOP.md    - Full manual guide
   ~/Projects/SAMS/MIGRATION_COMPLETE.md  - Migration context
   ~/Projects/SAMS/APM_PATHS.md           - APM path reference

🎉 You're ready to code!

EOF
}

# Main execution
main() {
    clear
    
    cat << 'EOF'
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║              🚀 SAMS MacBook Setup Script                     ║
║                                                                ║
║  This script will:                                            ║
║  1. Clone SAMS from GitHub                                    ║
║  2. Install all dependencies                                  ║
║  3. Configure shell aliases                                   ║
║  4. Verify Google Drive access                                ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

EOF
    
    read -p "Press Enter to begin setup, or Ctrl+C to cancel..."
    
    # Run setup steps
    check_prerequisites
    clone_repository
    install_dependencies
    configure_aliases
    verify_drive_access
    final_verification
    print_next_steps
    
    print_success "Setup script completed successfully!"
}

# Run main function
main

