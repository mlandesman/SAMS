# Deprecated Components

This directory contains components that are no longer used in the SAMS application but are preserved for historical reference.

## ExpenseEntryModal Files

**Status**: DEPRECATED - Not used anywhere in the application  
**Date Moved**: October 5, 2025  
**Reason**: Replaced by UnifiedExpenseEntry component

### Files Moved:
- `ExpenseEntryModal_layout.jsx` - Original from `/layout/ExpenseEntryModal.jsx`
- `ExpenseEntryModal_layout.css` - Original from `/layout/ExpenseEntryModal.css`
- `ExpenseEntryModal_components.jsx` - Original from `/components/ExpenseEntryModal.jsx`
- `ExpenseEntryModal_components.css` - Original from `/components/ExpenseEntryModal.css`

### Current Active Component:
- **UnifiedExpenseEntry** (`/components/UnifiedExpenseEntry.jsx`) - The only expense entry component currently in use

### Why These Were Moved:
1. **Prevent Confusion**: These files were being accidentally edited instead of the active UnifiedExpenseEntry
2. **Clean Codebase**: Removes unused code from the main development paths
3. **Historical Reference**: Preserved for any future reference needs

### ⚠️ IMPORTANT:
- **DO NOT EDIT** these deprecated files
- **DO NOT MOVE** them back to active directories
- All expense entry functionality should use **UnifiedExpenseEntry** only

---

**Last Updated**: October 5, 2025  
**Moved By**: Implementation Agent (timezone fix cleanup)
