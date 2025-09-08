#!/bin/bash

# Simple Fix Import Script Issues
# This script fixes the issues one by one

echo "🔧 Fixing import script issues..."

# Fix 1: Update paths in import scripts
echo "📁 Fixing data file paths..."
for file in import*.js; do
  if [ -f "$file" ]; then
    echo "  Fixing $file"
    # Replace ./MTCdata with ../MTCdata
    sed -i '' 's|./MTCdata/|../MTCdata/|g' "$file" 2>/dev/null || true
    # Replace just MTCdata/ with ../MTCdata/
    sed -i '' 's|"MTCdata/|"../MTCdata/|g' "$file" 2>/dev/null || true
  fi
done

# Fix 2: Check and add missing export to field-validator.js
echo "📦 Checking field-validator.js..."
if ! grep -q "export.*validateRequiredFields" utils/field-validator.js 2>/dev/null; then
  echo "  Adding validateRequiredFields export..."
  cat >> utils/field-validator.js << 'EOF'

// Add missing export
export function validateRequiredFields(data, requiredFields) {
  const errors = [];
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  return errors;
}
EOF
else
  echo "  validateRequiredFields already exported"
fi

# Fix 3: Fix syntax error in importHOADues.js
echo "🔨 Fixing syntax error in importHOADues.js..."
# Add missing comma on line 54 (after the closing brace)
if [ -f "importHOADues.js" ]; then
  echo "  Adding missing comma in importHOADues.js"
  # This is tricky with sed, let's use a different approach
  # We'll look for the pattern and fix it
  sed -i '' '/createdAt: getCurrentTimestamp()$/,/^[[:space:]]*}$/ {
    /^[[:space:]]*}$/ s/}$/},/
  }' importHOADues.js 2>/dev/null || true
fi

# Fix 4: Update wrong project IDs
echo "🔄 Updating project IDs..."
for file in *.js utils/*.js; do
  if [ -f "$file" ]; then
    if grep -q "sandyland-management-dev" "$file" 2>/dev/null; then
      echo "  Fixing project ID in $file"
      sed -i '' 's/sandyland-management-dev/sandyland-management-system/g' "$file" 2>/dev/null || true
    fi
  fi
done

echo "✅ Fixes applied!"
echo ""
echo "Now let's test each import individually:"
echo ""
echo "1. Test Users Import:"
echo "   node import-users.js"
echo ""
echo "2. Test Categories/Vendors Import:"
echo "   node import-categories-vendors.js"
echo ""
echo "3. Test Units Import:"
echo "   node import-units.js"
echo ""
echo "4. Test Transactions Import:"
echo "   node import-transactions.js"
echo ""
echo "5. Test HOA Dues Import:"
echo "   node importHOADues.js"