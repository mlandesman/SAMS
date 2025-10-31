#!/bin/bash
# Cleanup script: Move misplaced APM docs from code repo to Google Drive
# Created: October 31, 2025

DOCS_BASE="/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs"
CODE_BASE="/Users/michael/Projects/SAMS"

echo "🧹 Cleaning up misplaced APM documentation..."
echo ""

# Create target directories if they don't exist
mkdir -p "${DOCS_BASE}/apm_session/Memory/Task_Completion_Logs"
mkdir -p "${DOCS_BASE}/apm_session/Memory/Testing"
mkdir -p "${DOCS_BASE}/apm_session/Memory/Phase_03_Water_Bills"
mkdir -p "${DOCS_BASE}/apm_session/Memory/Phase_04_HOA_Dues"

# Function to move file if it exists
move_if_exists() {
    local source="$1"
    local target_dir="$2"
    
    if [ -f "$source" ]; then
        local filename=$(basename "$source")
        echo "  Moving: $filename → $(basename "$target_dir")/"
        mv "$source" "$target_dir/"
    fi
}

# Task completion docs
echo "📋 Task completion docs..."
move_if_exists "$CODE_BASE/TASK_4_3_COMPLETE.md" "$DOCS_BASE/apm_session/Memory/Task_Completion_Logs"

# Testing docs
echo "🧪 Testing documentation..."
move_if_exists "$CODE_BASE/backend/testing/FINAL_VERIFICATION_AggregatedData_Fix.md" "$DOCS_BASE/apm_session/Memory/Testing"
move_if_exists "$CODE_BASE/backend/testing/TASK_1_TEST_RESULTS.md" "$DOCS_BASE/apm_session/Memory/Testing"
move_if_exists "$CODE_BASE/backend/testing/TESTING_GUIDE_FOR_AGENTS.md" "$DOCS_BASE/apm_session/Memory/Testing"
move_if_exists "$CODE_BASE/functions/backend/testing/FINAL_VERIFICATION_AggregatedData_Fix.md" "$DOCS_BASE/apm_session/Memory/Testing"
move_if_exists "$CODE_BASE/functions/backend/testing/TASK_1_TEST_RESULTS.md" "$DOCS_BASE/apm_session/Memory/Testing"
move_if_exists "$CODE_BASE/functions/backend/testing/TESTING_GUIDE_FOR_AGENTS.md" "$DOCS_BASE/apm_session/Memory/Testing"

# Phase documentation
echo "📦 Phase documentation..."
move_if_exists "$CODE_BASE/backend/PHASE_3_TEST_SUITES_README.md" "$DOCS_BASE/apm_session/Memory/Phase_03_Water_Bills"
move_if_exists "$CODE_BASE/functions/backend/PHASE_3_TEST_SUITES_README.md" "$DOCS_BASE/apm_session/Memory/Phase_03_Water_Bills"

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Next steps:"
echo "1. Run: git status"
echo "2. Verify misplaced docs are no longer tracked"
echo "3. Clean up any remaining with: git rm --cached <file>"
echo "4. Commit the .gitignore and .cursorrules changes"
echo ""

