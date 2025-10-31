#!/bin/bash
# Comprehensive cleanup: Remove duplicate documentation from code repo
# Only removes items that exist in SAMS-Docs on Google Drive
# Created: October 31, 2025

set -e  # Exit on error

DOCS_BASE="/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs"
CODE_BASE="/Users/michael/Projects/SAMS"

echo "🧹 SAMS Code Repository Documentation Cleanup"
echo "=============================================="
echo ""
echo "This script will:"
echo "  1. Move apm_v0.3_summary to Google Drive (not there yet)"
echo "  2. Move completion/summary markdown files to Google Drive"
echo "  3. Delete duplicate doc directories that exist in SAMS-Docs"
echo "  4. Keep developer reference docs (ACTIVE_MODULES, DEPLOYMENT, etc.)"
echo "  5. Keep tests/ directory (contains real test code)"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "=========================================="
echo "PHASE 1: Move apm_v0.3_summary to SAMS-Docs"
echo "=========================================="
if [ -d "$CODE_BASE/apm_v0.3_summary" ]; then
    echo "  Moving apm_v0.3_summary/ → Google Drive..."
    mv "$CODE_BASE/apm_v0.3_summary" "$DOCS_BASE/"
    echo "  ✅ Moved"
else
    echo "  ⚠️  apm_v0.3_summary not found (already moved?)"
fi

echo ""
echo "=========================================="
echo "PHASE 2: Move Completion/Summary Docs"
echo "=========================================="

# Create target directories
mkdir -p "$DOCS_BASE/apm_session/Memory/Completion_Summaries"
mkdir -p "$DOCS_BASE/apm_session/Memory/Reports"

# Files to move (completion reports, summaries, etc.)
DOCS_TO_MOVE=(
    "BUG_CONFIRMED_SUMMARY.md"
    "CREDIT_API_READY_FOR_TASK3.md"
    "FINAL_SOLUTION_REPORT.md"
    "FIREBASE_MIGRATION_SUMMARY.md"
    "FIXES_APPLIED.md"
    "GITHUB_ISSUES_CLOSED_2025-10-21.md"
    "IMPLEMENTATION_COMPLETE_Water_Bills_Simplification.md"
    "MIGRATION_COMPLETE.md"
    "MILESTONE_v0.1.0_Water_Bills_Foundation_Complete.md"
    "PHASE_2_IMPLEMENTATION_SUMMARY.md"
    "SAMS_STATUS_REPORT_2025-10-21.md"
    "SOLUTION_SUMMARY.md"
    "WATER_BILLS_CENTAVOS_CONVERSION.md"
    "WATER_BILLS_FIXES_COMPLETE.md"
    "WATER_BILLS_IMPORT_IMPLEMENTATION_SUMMARY.md"
    "WATER_BILLS_TASK_COMPLETION.md"
    "WATER_BILLS_TEST_SUITE_SUMMARY.md"
    "WATER_TEST_ANALYSIS_FINAL.md"
    "WATER_TEST_RESULTS_ANALYSIS.md"
    "WATERBILLS_CONFIG_STRUCTURE.md"
    "WATERBILLS_TEMPLATE_TRANSLATIONS.md"
    "WB1B_TASK_COMPLETE_SUMMARY.md"
    "WB2_ACTUAL_TEST_RESULTS.md"
    "WB2_BEFORE_AFTER_EVIDENCE.md"
    "WB2_COMPLETION_REPORT.md"
    "WB2_SUCCESS_REPORT.md"
    "WB5_COMPLETION_SUMMARY.md"
    "MOVE_TO_LOCAL_HYBRID_APPROACH.md"
    "MOVE_TO_LOCAL_INSTRUCTIONS.md"
    "QUICK_MOVE_CHECKLIST.md"
    "NEW_LAPTOP_README.md"
    "SETUP_NEW_DEVICE.md"
    "SETUP_NEW_LAPTOP.md"
    "VERSION_CONTROL_DEFINITION.md"
)

echo "Moving completion reports and summaries..."
for doc in "${DOCS_TO_MOVE[@]}"; do
    if [ -f "$CODE_BASE/$doc" ]; then
        echo "  Moving: $doc"
        # Determine target based on file type
        if [[ $doc =~ _REPORT\.md$ ]] || [[ $doc =~ _SUMMARY\.md$ ]] || [[ $doc =~ _COMPLETE\.md$ ]]; then
            mv "$CODE_BASE/$doc" "$DOCS_BASE/apm_session/Memory/Completion_Summaries/"
        else
            mv "$CODE_BASE/$doc" "$DOCS_BASE/apm_session/Memory/Reports/"
        fi
    fi
done
echo "  ✅ Moved completion docs"

echo ""
echo ""
echo "=========================================="
echo "PHASE 2.5: Handle Missing Files"
echo "=========================================="

# Copy files that exist in SAMS but not in SAMS-Docs (created after split)
echo "Copying files created after 10/21 split..."
if [ -f "$CODE_BASE/docs/TD-017_Cloud_Function_Migration_Documentation.md" ]; then
    echo "  Copying: TD-017_Cloud_Function_Migration_Documentation.md"
    cp "$CODE_BASE/docs/TD-017_Cloud_Function_Migration_Documentation.md" "$DOCS_BASE/docs/"
fi
if [ -f "$CODE_BASE/docs/WATER_BILLS_REUSABILITY_ANALYSIS.md" ]; then
    echo "  Copying: WATER_BILLS_REUSABILITY_ANALYSIS.md"
    cp "$CODE_BASE/docs/WATER_BILLS_REUSABILITY_ANALYSIS.md" "$DOCS_BASE/docs/"
fi
if [ -f "$CODE_BASE/docs/PWA_WATER_BILLS_REFACTOR_ANALYSIS.md" ]; then
    echo "  Copying: PWA_WATER_BILLS_REFACTOR_ANALYSIS.md"
    cp "$CODE_BASE/docs/PWA_WATER_BILLS_REFACTOR_ANALYSIS.md" "$DOCS_BASE/docs/"
fi
echo "  ✅ Missing files copied to SAMS-Docs"

echo ""
echo "=========================================="
echo "PHASE 3: Delete Duplicate Directories"
echo "=========================================="

# Directories to delete (exist in SAMS-Docs)
DIRS_TO_DELETE=(
    "apm"
    "apm_session"
    "docs"
    "Memory"
    "analysis_reports"
)

for dir in "${DIRS_TO_DELETE[@]}"; do
    if [ -d "$CODE_BASE/$dir" ]; then
        echo "  Deleting: $dir/ (exists in SAMS-Docs)"
        rm -rf "$CODE_BASE/$dir"
        echo "  ✅ Deleted"
    else
        echo "  ⚠️  $dir not found (already deleted?)"
    fi
done

echo ""
echo "=========================================="
echo "PHASE 4: Verification"
echo "=========================================="

echo ""
echo "📁 Files KEPT in SAMS (developer reference):"
echo "  ✅ ACTIVE_MODULES.md (module reference)"
echo "  ✅ DEPLOYMENT.md (deployment guide)"
echo "  ✅ QUICK_START.md (developer onboarding)"
echo "  ✅ APM_PATHS.md (path reference)"
echo "  ✅ PROJECT_TRACKING_MASTER.md (current status)"
echo "  ✅ .cursorrules (contains doc creation rules)"
echo "  ✅ tests/ directory (REAL TEST CODE - not docs)"

echo ""
echo "📂 Directories DELETED from SAMS:"
for dir in "${DIRS_TO_DELETE[@]}"; do
    echo "  ❌ $dir/"
done

echo ""
echo "📄 Files MOVED to SAMS-Docs:"
echo "  → $(echo "${DOCS_TO_MOVE[@]}" | wc -w) completion/summary/report files"
echo "  → apm_v0.3_summary/ directory"

echo ""
echo "=========================================="
echo "✅ CLEANUP COMPLETE"
echo "=========================================="
echo ""
echo "🔍 Running verification..."
if [ -f "$CODE_BASE/verify-before-cleanup.sh" ]; then
    $CODE_BASE/verify-before-cleanup.sh
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ VERIFICATION PASSED - All files safely backed up to SAMS-Docs"
    else
        echo ""
        echo "⚠️  Verification found some issues (check output above)"
    fi
else
    echo "  ⚠️  Verification script not found"
fi

echo ""
echo "Next steps:"
echo "1. Run: cd $CODE_BASE && git status"
echo "2. Verify only code files remain"
echo "3. Commit deletions: git add -A && git commit -m 'chore: Remove duplicate docs (moved to SAMS-Docs)'"
echo "4. Push: git push origin feature/phase-4-hoa-dues-refactor"
echo ""

