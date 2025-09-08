#!/bin/bash

# Create a backup of the original file
cp TransactionsView.jsx TransactionsView.jsx.bak2

# Use sed to fix all instances of problematic JSX syntax where ")} appears as the only content on a line
# Adding a space between ) and } fixes the JSX syntax error
sed -i'.tmp' 's/^\([[:space:]]*\))}$/\1) }/' TransactionsView.jsx

# Check if the file was modified
if cmp -s TransactionsView.jsx TransactionsView.jsx.tmp; then
    echo "No changes were made."
else
    echo "Fixed JSX syntax errors in the file."
fi

# Remove the temporary file
rm TransactionsView.jsx.tmp
