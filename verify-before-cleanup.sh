#!/bin/bash
# Verification: Check if SAMS has newer files than SAMS-Docs
# Before deleting anything, ensure we won't lose recent work
# Created: October 31, 2025

DOCS_BASE="/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs"
CODE_BASE="/Users/michael/Projects/SAMS"

echo "🔍 Verification: Comparing SAMS vs SAMS-Docs"
echo "=============================================="
echo ""
echo "Checking for files modified after 2025-10-21 (split date)..."
echo ""

NEWER_FILES_FOUND=0
MISSING_FILES_FOUND=0

# Directories to check
DIRS_TO_CHECK=(
    "apm"
    "apm_session"
    "docs"
    "Memory"
    "analysis_reports"
)

for dir in "${DIRS_TO_CHECK[@]}"; do
    echo "=========================================="
    echo "Checking: $dir/"
    echo "=========================================="
    
    if [ ! -d "$CODE_BASE/$dir" ]; then
        echo "  ⚠️  Directory not found in SAMS (already deleted?)"
        echo ""
        continue
    fi
    
    if [ ! -d "$DOCS_BASE/$dir" ]; then
        echo "  🚨 WARNING: Directory exists in SAMS but NOT in SAMS-Docs!"
        echo "  This entire directory needs to be moved, not deleted!"
        MISSING_FILES_FOUND=$((MISSING_FILES_FOUND + 1))
        echo ""
        continue
    fi
    
    # Find files modified after Oct 21, 2025
    echo "  Files in SAMS modified after 2025-10-21:"
    while IFS= read -r file; do
        if [ -n "$file" ]; then
            NEWER_FILES_FOUND=$((NEWER_FILES_FOUND + 1))
            relative_path="${file#$CODE_BASE/$dir/}"
            mod_date=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$file")
            
            # Check if file exists in SAMS-Docs
            docs_file="$DOCS_BASE/$dir/$relative_path"
            if [ -f "$docs_file" ]; then
                docs_mod_date=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$docs_file")
                echo "    📄 $relative_path"
                echo "       SAMS:      $mod_date"
                echo "       SAMS-Docs: $docs_mod_date"
                
                # Compare timestamps
                if [ "$file" -nt "$docs_file" ]; then
                    echo "       🚨 SAMS version is NEWER!"
                else
                    echo "       ✅ SAMS-Docs version is same or newer"
                fi
            else
                echo "    📄 $relative_path"
                echo "       SAMS:      $mod_date"
                echo "       SAMS-Docs: ❌ FILE DOES NOT EXIST"
                echo "       🚨 File exists in SAMS but NOT in SAMS-Docs!"
            fi
            echo ""
        fi
    done < <(find "$CODE_BASE/$dir" -type f -newermt "2025-10-21" 2>/dev/null)
    
    if [ $NEWER_FILES_FOUND -eq 0 ]; then
        echo "  ✅ No files modified after 2025-10-21"
        echo ""
    fi
done

echo "=========================================="
echo "SUMMARY"
echo "=========================================="
echo ""

if [ $NEWER_FILES_FOUND -eq 0 ] && [ $MISSING_FILES_FOUND -eq 0 ]; then
    echo "✅ SAFE TO DELETE"
    echo ""
    echo "All files in SAMS are either:"
    echo "  - Older than the split date (2025-10-21), OR"
    echo "  - Same or older than their SAMS-Docs counterparts"
    echo ""
    echo "You can safely run: ./cleanup-duplicate-docs.sh"
    exit 0
else
    echo "🚨 WAIT! DO NOT DELETE YET!"
    echo ""
    if [ $NEWER_FILES_FOUND -gt 0 ]; then
        echo "Found $NEWER_FILES_FOUND file(s) in SAMS that may be newer than SAMS-Docs."
    fi
    if [ $MISSING_FILES_FOUND -gt 0 ]; then
        echo "Found $MISSING_FILES_FOUND directory/directories that don't exist in SAMS-Docs."
    fi
    echo ""
    echo "RECOMMENDED ACTIONS:"
    echo "1. Review the files listed above"
    echo "2. For files that are newer in SAMS, manually copy them to SAMS-Docs"
    echo "3. For missing directories, move them instead of delete"
    echo "4. Re-run this verification script"
    echo "5. Only then run cleanup-duplicate-docs.sh"
    exit 1
fi

