#!/bin/bash
# Cleanup remaining APM docs missed by first pass
# Created: October 31, 2025

DOCS_BASE="/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs"
CODE_BASE="/Users/michael/Projects/SAMS"

echo "🧹 Cleaning up remaining APM documentation..."
echo ""

# Create target directories
mkdir -p "${DOCS_BASE}/apm_session/Memory/Testing"
mkdir -p "${DOCS_BASE}/apm_session/Memory/Security_Testing"
mkdir -p "${DOCS_BASE}/apm_session/Memory/Phase_03_Water_Bills"

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

echo "🔒 Security testing docs..."
move_if_exists "$CODE_BASE/backend/testing/BROWSER_TEST_VERIFICATION.md" "$DOCS_BASE/apm_session/Memory/Security_Testing"
move_if_exists "$CODE_BASE/backend/testing/COMPREHENSIVE_SECURITY_TEST_REPORT.md" "$DOCS_BASE/apm_session/Memory/Security_Testing"
move_if_exists "$CODE_BASE/backend/testing/CORRECT_TEST_HARNESS_USAGE.md" "$DOCS_BASE/apm_session/Memory/Security_Testing"
move_if_exists "$CODE_BASE/backend/testing/FINAL_SECURITY_TEST_REPORT.md" "$DOCS_BASE/apm_session/Memory/Security_Testing"
move_if_exists "$CODE_BASE/backend/testing/SECURITY_TEST_FINAL_SUMMARY.md" "$DOCS_BASE/apm_session/Memory/Security_Testing"

move_if_exists "$CODE_BASE/functions/backend/testing/BROWSER_TEST_VERIFICATION.md" "$DOCS_BASE/apm_session/Memory/Security_Testing"
move_if_exists "$CODE_BASE/functions/backend/testing/COMPREHENSIVE_SECURITY_TEST_REPORT.md" "$DOCS_BASE/apm_session/Memory/Security_Testing"
move_if_exists "$CODE_BASE/functions/backend/testing/CORRECT_TEST_HARNESS_USAGE.md" "$DOCS_BASE/apm_session/Memory/Security_Testing"
move_if_exists "$CODE_BASE/functions/backend/testing/FINAL_SECURITY_TEST_REPORT.md" "$DOCS_BASE/apm_session/Memory/Security_Testing"
move_if_exists "$CODE_BASE/functions/backend/testing/SECURITY_TEST_FINAL_SUMMARY.md" "$DOCS_BASE/apm_session/Memory/Security_Testing"

echo "🧪 Test coverage docs..."
move_if_exists "$CODE_BASE/backend/testing/TEST_COVERAGE_MATRIX.md" "$DOCS_BASE/apm_session/Memory/Testing"
move_if_exists "$CODE_BASE/backend/testing/TEST_EXECUTION_RESULTS_JULY22.md" "$DOCS_BASE/apm_session/Memory/Testing"
move_if_exists "$CODE_BASE/backend/testing/TEST_EXECUTION_SUMMARY_USERS_AUTH.md" "$DOCS_BASE/apm_session/Memory/Testing"

move_if_exists "$CODE_BASE/functions/backend/testing/TEST_COVERAGE_MATRIX.md" "$DOCS_BASE/apm_session/Memory/Testing"
move_if_exists "$CODE_BASE/functions/backend/testing/TEST_EXECUTION_RESULTS_JULY22.md" "$DOCS_BASE/apm_session/Memory/Testing"
move_if_exists "$CODE_BASE/functions/backend/testing/TEST_EXECUTION_SUMMARY_USERS_AUTH.md" "$DOCS_BASE/apm_session/Memory/Testing"

echo "💧 Water Bills docs..."
move_if_exists "$CODE_BASE/backend/testing/WATER_BILLS_FINAL_STATUS.md" "$DOCS_BASE/apm_session/Memory/Phase_03_Water_Bills"
move_if_exists "$CODE_BASE/backend/testing/WATER_BILLS_IMPLEMENTATION_LOG.md" "$DOCS_BASE/apm_session/Memory/Phase_03_Water_Bills"
move_if_exists "$CODE_BASE/backend/testing/WATER_METER_TEST_REPORT.md" "$DOCS_BASE/apm_session/Memory/Phase_03_Water_Bills"

move_if_exists "$CODE_BASE/functions/backend/testing/WATER_BILLS_FINAL_STATUS.md" "$DOCS_BASE/apm_session/Memory/Phase_03_Water_Bills"
move_if_exists "$CODE_BASE/functions/backend/testing/WATER_BILLS_IMPLEMENTATION_LOG.md" "$DOCS_BASE/apm_session/Memory/Phase_03_Water_Bills"
move_if_exists "$CODE_BASE/functions/backend/testing/WATER_METER_TEST_REPORT.md" "$DOCS_BASE/apm_session/Memory/Phase_03_Water_Bills"

echo ""
echo "✅ Remaining docs cleaned up!"
echo ""
echo "Note: backend/testing/README.md and functions/backend/testing/README.md"
echo "      were left in place as they are developer reference docs."
echo ""

