# Useful Commands for new Date() Migration

## Find all instances in a specific file
```bash
grep -n "new Date()" path/to/file.js
```

## Count instances in a directory
```bash
grep -r "new Date()" directory/ --include="*.js" --include="*.jsx" | wc -l
```

## Find instances with context (3 lines before and after)
```bash
grep -n -C 3 "new Date()" path/to/file.js
```

## Find specific patterns

### Find convertToTimestamp(new Date())
```bash
grep -r "convertToTimestamp(new Date())" . --include="*.js"
```

### Find new Date().toISOString()
```bash
grep -r "new Date().*toISOString()" . --include="*.js"
```

### Find new Date().getTime()
```bash
grep -r "new Date().*getTime()" . --include="*.js"
```

## Check progress after migration
```bash
# Count remaining instances
grep -r "new Date()" . --include="*.js" --include="*.jsx" | grep -v node_modules | grep -v "_archive" | wc -l
```

## Verify getNow() usage
```bash
# Find all getNow() usage
grep -r "getNow()" . --include="*.js" --include="*.jsx"
```

## File-specific searches

### Backend controllers
```bash
grep -n "new Date()" backend/controllers/*.js
```

### Frontend components
```bash
grep -n "new Date()" frontend/sams-ui/src/components/*.jsx
```

### Services
```bash
grep -n "new Date()" backend/services/*.js
```

## Create a working list of files to migrate
```bash
grep -r "new Date()" . --include="*.js" --include="*.jsx" | grep -v node_modules | grep -v "_archive" | cut -d: -f1 | sort -u > files-to-migrate.txt
```