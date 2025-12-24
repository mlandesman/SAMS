#!/bin/bash

# SAMS Backup & Restore Menu System
# Interactive menu for all backup and restore operations

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

function print_header() {
    clear
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}  SAMS Backup & Restore System${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
}

function check_prerequisites() {
    local missing_tools=()
    
    if ! command -v gcloud &> /dev/null; then
        missing_tools+=("gcloud")
    fi
    
    if ! command -v gsutil &> /dev/null; then
        missing_tools+=("gsutil")
    fi
    
    if ! command -v node &> /dev/null; then
        missing_tools+=("node")
    fi
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        echo -e "${RED}Error: Missing required tools: ${missing_tools[*]}${NC}"
        echo "Please install the missing tools and try again."
        exit 1
    fi
    
    # Check gcloud authentication
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null | grep -q .; then
        echo -e "${YELLOW}Warning: No active gcloud authentication found${NC}"
        echo "Run: gcloud auth login"
    fi
}

function show_menu() {
    print_header
    echo "What would you like to do?"
    echo ""
    echo -e "${CYAN}BACKUP OPERATIONS:${NC}"
    echo "  1) Create Production Backup (manual)"
    echo "  2) Create Production Backup (nightly)"
    echo "  3) Create Production Backup (pre-deploy)"
    echo ""
    echo -e "${CYAN}RESTORE OPERATIONS:${NC}"
    echo "  4) Restore Dev from Production (latest backup)"
    echo "  5) Restore Dev from Production (select backup)"
    echo "  6) Restore Production (disaster recovery)"
    echo ""
    echo -e "${CYAN}UTILITIES:${NC}"
    echo "  7) List Available Backups"
    echo "  8) Copy Backup Off-Site (local/S3/Drive)"
    echo "  9) Verify Restore Status"
    echo "  10) Setup GCS Bucket (one-time)"
    echo ""
    echo -e "${CYAN}INFORMATION:${NC}"
    echo "  11) Show Quick Reference"
    echo "  12) View Backup Documentation"
    echo ""
    echo "  q) Quit"
    echo ""
    read -p "Choose option: " choice
    
    case $choice in
        1) create_backup_manual ;;
        2) create_backup_nightly ;;
        3) create_backup_predeploy ;;
        4) restore_dev_latest ;;
        5) restore_dev_select ;;
        6) restore_prod ;;
        7) list_backups ;;
        8) copy_offsite ;;
        9) verify_restore ;;
        10) setup_bucket ;;
        11) show_quick_reference ;;
        12) show_documentation ;;
        q|Q) echo -e "${GREEN}Goodbye!${NC}"; exit 0 ;;
        *) echo -e "${RED}Invalid option${NC}"; sleep 1; show_menu ;;
    esac
}

function create_backup_manual() {
    print_header
    echo -e "${GREEN}Creating Manual Production Backup...${NC}"
    echo ""
    
    cd "$SCRIPT_DIR"
    ./backup-prod.sh --tag=manual
    
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

function create_backup_nightly() {
    print_header
    echo -e "${GREEN}Creating Nightly Production Backup...${NC}"
    echo ""
    echo -e "${YELLOW}Note: Nightly backups are auto-deleted after 30 days${NC}"
    echo ""
    
    cd "$SCRIPT_DIR"
    ./backup-prod.sh --tag=nightly
    
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

function create_backup_predeploy() {
    print_header
    echo -e "${GREEN}Creating Pre-Deployment Production Backup...${NC}"
    echo ""
    echo -e "${YELLOW}Note: Pre-deploy backups are kept indefinitely${NC}"
    echo ""
    
    cd "$SCRIPT_DIR"
    ./backup-prod.sh --tag=pre-deploy
    
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

function restore_dev_latest() {
    print_header
    echo -e "${YELLOW}Restore Dev from Latest Production Backup${NC}"
    echo ""
    echo -e "${RED}WARNING: This will overwrite Dev Firestore data!${NC}"
    echo "  - Dev users will be preserved"
    echo "  - All other data will be replaced with Production data"
    echo ""
    read -p "Continue? (y/N): " confirm
    
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        cd "$SCRIPT_DIR"
        echo "RESTORE DEV" | ./restore-dev-from-prod.sh --backup=latest
    else
        echo "Restore cancelled."
    fi
    
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

function restore_dev_select() {
    print_header
    echo -e "${YELLOW}Restore Dev from Selected Production Backup${NC}"
    echo ""
    
    cd "$SCRIPT_DIR"
    echo "Available backups:"
    
    # Get list of backups with numbers
    BACKUP_LIST=$(gsutil ls "gs://sams-shared-backups/manifests/" 2>/dev/null | sort -r)
    BACKUP_COUNT=0
    declare -a BACKUP_SELECTIONS
    declare -a BACKUP_PREFIXES
    
    while IFS= read -r manifest_path; do
        BACKUP_COUNT=$((BACKUP_COUNT + 1))
        BACKUP_PREFIX=$(basename "$manifest_path" .json)
        BACKUP_PREFIXES+=("$BACKUP_PREFIX")
        # Extract date part (could be YYYY-MM-DD or YYYY-MM-DD-HHMM)
        BACKUP_DATE=$(echo "$BACKUP_PREFIX" | sed 's/_.*//')
        BACKUP_SELECTIONS+=("$BACKUP_DATE")
        echo "  $BACKUP_COUNT) $BACKUP_PREFIX"
    done <<< "$BACKUP_LIST"
    
    if [ $BACKUP_COUNT -eq 0 ]; then
        echo -e "${RED}No backups found${NC}"
        echo ""
        read -p "Press enter to continue..."
        show_menu
        return
    fi
    
    echo ""
    read -p "Select backup by number (1-$BACKUP_COUNT) or enter date (YYYY-MM-DD or YYYY-MM-DD-HHMM): " selection
    
    # Check if it's a number
    if [[ "$selection" =~ ^[0-9]+$ ]] && [ "$selection" -ge 1 ] && [ "$selection" -le $BACKUP_COUNT ]; then
        backup_date="${BACKUP_SELECTIONS[$((selection-1))]}"
        SELECTED_PREFIX="${BACKUP_PREFIXES[$((selection-1))]}"
        echo "   Selected: $SELECTED_PREFIX"
    elif [ -z "$selection" ]; then
        echo -e "${RED}No backup selected${NC}"
        sleep 1
        show_menu
        return
    else
        backup_date="$selection"
    fi
    
    echo ""
    echo -e "${RED}WARNING: This will overwrite Dev Firestore data!${NC}"
    echo "  - Dev users will be preserved"
    echo "  - All other data will be replaced with Production data"
    echo ""
    read -p "Continue? (y/N): " confirm
    
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        cd "$SCRIPT_DIR"
        echo "RESTORE DEV" | ./restore-dev-from-prod.sh --backup="$backup_date"
    else
        echo "Restore cancelled."
    fi
    
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

function restore_prod() {
    print_header
    echo -e "${RED}════════════════════════════════════════════════${NC}"
    echo -e "${RED}  PRODUCTION DISASTER RECOVERY${NC}"
    echo -e "${RED}════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${RED}⚠️  CRITICAL WARNING:${NC}"
    echo "  This will OVERWRITE ALL Production data!"
    echo "  This includes users and cannot be undone!"
    echo ""
    
    cd "$SCRIPT_DIR"
    echo "Available backups:"
    
    # Get list of backups with numbers
    BACKUP_LIST=$(gsutil ls "gs://sams-shared-backups/manifests/" 2>/dev/null | sort -r)
    BACKUP_COUNT=0
    declare -a BACKUP_SELECTIONS
    declare -a BACKUP_PREFIXES
    
    while IFS= read -r manifest_path; do
        BACKUP_COUNT=$((BACKUP_COUNT + 1))
        BACKUP_PREFIX=$(basename "$manifest_path" .json)
        BACKUP_PREFIXES+=("$BACKUP_PREFIX")
        # Extract date part (could be YYYY-MM-DD or YYYY-MM-DD-HHMM)
        BACKUP_DATE=$(echo "$BACKUP_PREFIX" | sed 's/_.*//')
        BACKUP_SELECTIONS+=("$BACKUP_DATE")
        echo "  $BACKUP_COUNT) $BACKUP_PREFIX"
    done <<< "$BACKUP_LIST"
    
    if [ $BACKUP_COUNT -eq 0 ]; then
        echo -e "${RED}No backups found${NC}"
        echo ""
        read -p "Press enter to continue..."
        show_menu
        return
    fi
    
    echo ""
    read -p "Select backup by number (1-$BACKUP_COUNT) or enter date (YYYY-MM-DD): " selection
    
    # Check if it's a number
    if [[ "$selection" =~ ^[0-9]+$ ]] && [ "$selection" -ge 1 ] && [ "$selection" -le $BACKUP_COUNT ]; then
        backup_date="${BACKUP_SELECTIONS[$((selection-1))]}"
        SELECTED_PREFIX="${BACKUP_PREFIXES[$((selection-1))]}"
        echo "   Selected: $SELECTED_PREFIX"
    elif [ -z "$selection" ]; then
        echo -e "${RED}No backup selected${NC}"
        sleep 1
        show_menu
        return
    else
        backup_date="$selection"
    fi
    
    echo ""
    echo -e "${RED}Final confirmation required:${NC}"
    echo "  Type the project ID to confirm: sams-sandyland-prod"
    read -p "Project ID: " project_confirm
    
    if [ "$project_confirm" != "sams-sandyland-prod" ]; then
        echo -e "${RED}Project ID mismatch. Operation cancelled.${NC}"
        sleep 2
        show_menu
        return
    fi
    
    echo ""
    read -p "Type 'RESTORE PRODUCTION' to confirm: " restore_confirm
    
    if [ "$restore_confirm" != "RESTORE PRODUCTION" ]; then
        echo -e "${RED}Confirmation text mismatch. Operation cancelled.${NC}"
        sleep 2
        show_menu
        return
    fi
    
    cd "$SCRIPT_DIR"
    ./restore-prod.sh --backup="$backup_date" --confirm
    
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

function list_backups() {
    print_header
    echo -e "${GREEN}Listing Available Backups...${NC}"
    echo ""
    
    cd "$SCRIPT_DIR"
    ./list-backups.sh
    
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

function copy_offsite() {
    print_header
    echo -e "${GREEN}Copy Backup Off-Site${NC}"
    echo ""
    
    cd "$SCRIPT_DIR"
    echo "Available backups:"
    
    # Get list of backups with numbers
    BACKUP_LIST=$(gsutil ls "gs://sams-shared-backups/manifests/" 2>/dev/null | sort -r)
    BACKUP_COUNT=0
    declare -a BACKUP_SELECTIONS
    declare -a BACKUP_PREFIXES
    
    while IFS= read -r manifest_path; do
        BACKUP_COUNT=$((BACKUP_COUNT + 1))
        BACKUP_PREFIX=$(basename "$manifest_path" .json)
        BACKUP_PREFIXES+=("$BACKUP_PREFIX")
        # Extract date part (could be YYYY-MM-DD or YYYY-MM-DD-HHMM)
        BACKUP_DATE=$(echo "$BACKUP_PREFIX" | sed 's/_.*//')
        BACKUP_SELECTIONS+=("$BACKUP_DATE")
        echo "  $BACKUP_COUNT) $BACKUP_PREFIX"
    done <<< "$BACKUP_LIST"
    
    if [ $BACKUP_COUNT -eq 0 ]; then
        echo -e "${RED}No backups found${NC}"
        echo ""
        read -p "Press enter to continue..."
        show_menu
        return
    fi
    
    echo ""
    read -p "Select backup by number (1-$BACKUP_COUNT) or enter date (YYYY-MM-DD or 'latest'): " selection
    
    # Check if it's a number
    if [[ "$selection" =~ ^[0-9]+$ ]] && [ "$selection" -ge 1 ] && [ "$selection" -le $BACKUP_COUNT ]; then
        SELECTED_PREFIX="${BACKUP_PREFIXES[$((selection-1))]}"
        backup_prefix="$SELECTED_PREFIX"
        echo "   Selected: $SELECTED_PREFIX"
    elif [ -z "$selection" ] || [ "$selection" = "latest" ]; then
        backup_prefix="latest"
    else
        backup_prefix="$selection"
    fi
    
    echo ""
    echo "Select destination:"
    echo "  1) Local storage (compressed)"
    echo "  2) Local storage (uncompressed)"
    echo "  3) AWS S3"
    echo "  4) Google Drive (requires setup)"
    echo ""
    read -p "Choose destination (1-4): " dest_choice
    
    case $dest_choice in
        1)
            cd "$SCRIPT_DIR"
            if [[ "$backup_prefix" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}_ ]]; then
                ./copy-backup-offsite.sh --backup-prefix="$backup_prefix" --destination=local --compress
            else
                ./copy-backup-offsite.sh --backup="$backup_prefix" --destination=local --compress
            fi
            ;;
        2)
            cd "$SCRIPT_DIR"
            if [[ "$backup_prefix" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}_ ]]; then
                ./copy-backup-offsite.sh --backup-prefix="$backup_prefix" --destination=local
            else
                ./copy-backup-offsite.sh --backup="$backup_prefix" --destination=local
            fi
            ;;
        3)
            cd "$SCRIPT_DIR"
            if [[ "$backup_prefix" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}_ ]]; then
                ./copy-backup-offsite.sh --backup-prefix="$backup_prefix" --destination=s3
            else
                ./copy-backup-offsite.sh --backup="$backup_prefix" --destination=s3
            fi
            ;;
        4)
            cd "$SCRIPT_DIR"
            if [[ "$backup_prefix" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}_ ]]; then
                ./copy-backup-offsite.sh --backup-prefix="$backup_prefix" --destination=drive
            else
                ./copy-backup-offsite.sh --backup="$backup_prefix" --destination=drive
            fi
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            sleep 1
            show_menu
            return
            ;;
    esac
    
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

function verify_restore() {
    print_header
    echo -e "${GREEN}Verifying Restore Status...${NC}"
    echo ""
    
    cd "$SCRIPT_DIR"
    if [ -f "./verify-restore.sh" ]; then
        ./verify-restore.sh
    else
        echo -e "${YELLOW}Verification script not found${NC}"
        echo "Checking manually..."
        echo ""
        gcloud firestore operations list --project=sandyland-management-system --limit=3 --format="table(name,done,operationState,startTime)"
    fi
    
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

function setup_bucket() {
    print_header
    echo -e "${GREEN}Setting Up GCS Backup Bucket${NC}"
    echo ""
    echo "This will:"
    echo "  - Create the shared backup bucket"
    echo "  - Configure IAM permissions"
    echo "  - Set lifecycle policies"
    echo ""
    read -p "Continue? (y/N): " confirm
    
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        cd "$SCRIPT_DIR"
        ./setup-gcs-bucket.sh
    else
        echo "Setup cancelled."
    fi
    
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

function show_quick_reference() {
    print_header
    echo -e "${GREEN}Quick Reference${NC}"
    echo ""
    
    if [ -f "$SCRIPT_DIR/QUICK_REFERENCE.md" ]; then
        cat "$SCRIPT_DIR/QUICK_REFERENCE.md"
    else
        echo "Quick reference not found. Showing basic commands:"
        echo ""
        echo "Backup:"
        echo "  ./backup-prod.sh --tag=manual"
        echo ""
        echo "Restore Dev:"
        echo "  ./restore-dev-from-prod.sh --backup=latest"
        echo ""
        echo "List Backups:"
        echo "  ./list-backups.sh"
    fi
    
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

function show_documentation() {
    print_header
    echo -e "${GREEN}Backup & Restore Documentation${NC}"
    echo ""
    
    if [ -f "$SCRIPT_DIR/README.md" ]; then
        # Show first 50 lines, then allow paging
        head -50 "$SCRIPT_DIR/README.md"
        echo ""
        echo -e "${YELLOW}... (showing first 50 lines)${NC}"
        echo "Full documentation: $SCRIPT_DIR/README.md"
    else
        echo "Documentation not found at $SCRIPT_DIR/README.md"
    fi
    
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

# Main execution
print_header
check_prerequisites
show_menu

