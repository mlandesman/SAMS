#!/bin/bash

# Script to count and categorize all new Date() instances in the SAMS codebase

BASE_DIR="/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS"

# Function to count instances in a directory
count_in_dir() {
    local dir="$1"
    local label="$2"
    local count=$(grep -r "new Date()" "$dir" --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v "/_archive/" | wc -l)
    echo "$label: $count"
    return $count
}

# Function to list files with line numbers in a directory
list_in_dir() {
    local dir="$1"
    local label="$2"
    echo -e "\n### $label ###"
    grep -rn "new Date()" "$dir" --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v "/_archive/" | sort
}

echo "=== SAMS Codebase: new Date() Instance Report ==="
echo "Generated on: $(date)"
echo "================================================"

# Count total instances
echo -e "\n## TOTAL COUNT ##"
total=$(grep -r "new Date()" "$BASE_DIR" --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v "/_archive/" | wc -l)
echo "Total new Date() instances: $total"

# Count by major directories
echo -e "\n## COUNT BY MODULE ##"
count_in_dir "$BASE_DIR/backend/controllers" "Backend Controllers"
count_in_dir "$BASE_DIR/backend/services" "Backend Services"
count_in_dir "$BASE_DIR/backend/utils" "Backend Utils"
count_in_dir "$BASE_DIR/backend/middleware" "Backend Middleware"
count_in_dir "$BASE_DIR/backend/routes" "Backend Routes"
count_in_dir "$BASE_DIR/backend/scripts" "Backend Scripts"
count_in_dir "$BASE_DIR/backend/testing" "Backend Testing"
count_in_dir "$BASE_DIR/backend/validation" "Backend Validation"
count_in_dir "$BASE_DIR/backend/templates" "Backend Templates"

echo ""
count_in_dir "$BASE_DIR/frontend/sams-ui/src/components" "Frontend Components"
count_in_dir "$BASE_DIR/frontend/sams-ui/src/views" "Frontend Views"
count_in_dir "$BASE_DIR/frontend/sams-ui/src/utils" "Frontend Utils"
count_in_dir "$BASE_DIR/frontend/sams-ui/src/context" "Frontend Context"
count_in_dir "$BASE_DIR/frontend/sams-ui/src/hooks" "Frontend Hooks"
count_in_dir "$BASE_DIR/frontend/sams-ui/src/api" "Frontend API"
count_in_dir "$BASE_DIR/frontend/sams-ui/src/layout" "Frontend Layout"

echo ""
count_in_dir "$BASE_DIR/frontend/mobile-app/src" "Mobile App"
count_in_dir "$BASE_DIR/frontend/shared-components/src" "Shared Components"

echo ""
count_in_dir "$BASE_DIR/functions" "Cloud Functions"
count_in_dir "$BASE_DIR/scripts" "Scripts"
count_in_dir "$BASE_DIR/Memory" "Memory/Archive"

# List all instances with line numbers
echo -e "\n\n## DETAILED FILE LISTING ##"
echo "================================================"

list_in_dir "$BASE_DIR/backend/controllers" "Backend Controllers"
list_in_dir "$BASE_DIR/backend/services" "Backend Services"
list_in_dir "$BASE_DIR/backend/utils" "Backend Utils"
list_in_dir "$BASE_DIR/backend/middleware" "Backend Middleware"
list_in_dir "$BASE_DIR/backend/routes" "Backend Routes"
list_in_dir "$BASE_DIR/backend/scripts" "Backend Scripts"
list_in_dir "$BASE_DIR/backend/testing" "Backend Testing"
list_in_dir "$BASE_DIR/backend/validation" "Backend Validation"
list_in_dir "$BASE_DIR/backend/templates" "Backend Templates"

list_in_dir "$BASE_DIR/frontend/sams-ui/src/components" "Frontend Components"
list_in_dir "$BASE_DIR/frontend/sams-ui/src/views" "Frontend Views"
list_in_dir "$BASE_DIR/frontend/sams-ui/src/utils" "Frontend Utils"
list_in_dir "$BASE_DIR/frontend/sams-ui/src/context" "Frontend Context"
list_in_dir "$BASE_DIR/frontend/sams-ui/src/hooks" "Frontend Hooks"
list_in_dir "$BASE_DIR/frontend/sams-ui/src/api" "Frontend API"
list_in_dir "$BASE_DIR/frontend/sams-ui/src/layout" "Frontend Layout"

list_in_dir "$BASE_DIR/frontend/mobile-app/src" "Mobile App"
list_in_dir "$BASE_DIR/frontend/shared-components/src" "Shared Components"

list_in_dir "$BASE_DIR/functions" "Cloud Functions"
list_in_dir "$BASE_DIR/scripts" "Scripts"
list_in_dir "$BASE_DIR/Memory" "Memory/Archive"

# Patterns analysis
echo -e "\n\n## PATTERN ANALYSIS ##"
echo "================================================"
echo -e "\n### Used with convertToTimestamp() ###"
grep -r "convertToTimestamp(new Date())" "$BASE_DIR" --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v "/_archive/" | wc -l | xargs echo "Count:"

echo -e "\n### Used with .toISOString() ###"
grep -r "new Date().*toISOString()" "$BASE_DIR" --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v "/_archive/" | wc -l | xargs echo "Count:"

echo -e "\n### Used with .getTime() ###"
grep -r "new Date().*getTime()" "$BASE_DIR" --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v "/_archive/" | wc -l | xargs echo "Count:"

echo -e "\n### Standalone new Date() ###"
grep -r "new Date()[ ]*[;,)]" "$BASE_DIR" --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v "/_archive/" | wc -l | xargs echo "Count:"