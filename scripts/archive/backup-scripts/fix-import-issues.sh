#!/bin/bash

# Fix Import Script Issues
# This script fixes the path and syntax issues in the import scripts

echo "🔧 Fixing import script issues..."

# Fix 1: Update paths in all import scripts to use ../MTCdata
echo "📁 Fixing data file paths..."
find . -name "import*.js" -type f -exec sed -i '' 's|./MTCdata/|../MTCdata/|g' {} \;
find . -name "import*.js" -type f -exec sed -i '' 's|MTCdata/|../MTCdata/|g' {} \;

# Fix 2: Add missing export to field-validator.js
echo "📦 Adding missing export to field-validator.js..."
if ! grep -q "export { validateRequiredFields" utils/field-validator.js; then
    echo "

// Add missing export
export function validateRequiredFields(data, requiredFields) {
  const errors = [];
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null) {
      errors.push(\`Missing required field: \${field}\`);
    }
  }
  return errors;
}" >> utils/field-validator.js
fi

# Fix 3: Fix syntax error in importHOADues.js (missing comma)
echo "🔨 Fixing syntax error in importHOADues.js..."
sed -i '' '54s/}$/},/' importHOADues.js

# Fix 4: Update wrong project IDs
echo "🔄 Updating project IDs..."
find . -name "*.js" -type f -exec sed -i '' 's/sandyland-management-dev/sandyland-management-system/g' {} \;

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