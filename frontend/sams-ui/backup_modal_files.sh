#!/bin/bash

# Backup Script for Sophisticated Transaction Confirmation Modal
# Created: June 22, 2025
# Purpose: Preserve working modal functionality before further changes

# Get current date/time for backup folder
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./MODAL_BACKUP_${TIMESTAMP}"

echo "🔄 Creating backup directory: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

echo "📁 Copying critical modal files..."

# Copy the main modal component
echo "  ➜ TransactionConfirmationModal.jsx"
cp "src/components/TransactionConfirmationModal.jsx" "$BACKUP_DIR/"

# Copy the modal CSS
echo "  ➜ TransactionConfirmationModal.css"
cp "src/components/TransactionConfirmationModal.css" "$BACKUP_DIR/"

# Copy the integration handler
echo "  ➜ TransactionsView.jsx"
cp "src/views/TransactionsView.jsx" "$BACKUP_DIR/"

# Create a README with details
cat << 'EOF' > "$BACKUP_DIR/README.md"
# Sophisticated Transaction Confirmation Modal Backup

**Created:** June 22, 2025
**Purpose:** Preserve working professional modal with document viewer integration

## What's Working
- ✅ Professional PWA-style design with green gradient header
- ✅ Transaction ID prominently displayed
- ✅ Icons for each field (Amount, Date, Category, etc.)
- ✅ Clickable document names that open DocumentViewer
- ✅ Modal appears AFTER transaction save (not before)
- ✅ File upload system completely untouched and working
- ✅ Mobile responsive design

## Key Files
1. **TransactionConfirmationModal.jsx** - Main component with professional layout
2. **TransactionConfirmationModal.css** - Complete professional styling
3. **TransactionsView.jsx** - Integration handler (lines 1153-1210)

## To Restore
Simply copy these files back to their original locations:
- TransactionConfirmationModal.jsx → src/components/
- TransactionConfirmationModal.css → src/components/  
- TransactionsView.jsx → src/views/

## Integration Points
- Modal triggered in TransactionsView.jsx onSubmit handler (line 1204)
- Uses existing working file upload system
- Shows AFTER transaction save with real transaction ID
- Documents are clickable and open DocumentViewer

This backup preserves the sophisticated confirmation modal that was working
on June 22, 2025 before any further modifications.
EOF

echo "📝 Created README.md with restoration instructions"

# Make the backup directory read-only to protect it
chmod -R 444 "$BACKUP_DIR"
echo "🔒 Made backup directory read-only for protection"

echo ""
echo "✅ BACKUP COMPLETE!"
echo "📂 Location: $BACKUP_DIR"
echo "🛡️  Files are now protected (read-only)"
echo ""
echo "To restore later, run:"
echo "  chmod -R 644 $BACKUP_DIR"
echo "  cp $BACKUP_DIR/* src/components/ && cp $BACKUP_DIR/TransactionsView.jsx src/views/"
echo ""