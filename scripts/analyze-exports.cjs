#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to extract function declarations and exports from a file
function analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);
    
    // Find all function declarations (including async)
    const functionRegex = /(?:async\s+)?function\s+(\w+)\s*\(/g;
    const arrowFunctionRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/g;
    const arrowFunctionRegex2 = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\w+\s*)?=>/g;
    
    const functions = new Set();
    let match;
    
    // Find regular function declarations
    while ((match = functionRegex.exec(content)) !== null) {
        functions.add(match[1]);
    }
    
    // Find arrow function declarations
    while ((match = arrowFunctionRegex.exec(content)) !== null) {
        functions.add(match[1]);
    }
    
    while ((match = arrowFunctionRegex2.exec(content)) !== null) {
        functions.add(match[1]);
    }
    
    // Find exports
    const exportRegex = /export\s*{\s*([^}]+)\s*}/g;
    const namedExportRegex = /export\s+(?:async\s+)?(?:function|const|let|var)\s+(\w+)/g;
    const defaultExportRegex = /export\s+default\s+(\w+)/g;
    
    const exports = new Set();
    const exportMappings = new Map(); // Track 'as' mappings
    
    // Find export blocks
    while ((match = exportRegex.exec(content)) !== null) {
        const exportList = match[1];
        // Parse individual exports, handling 'as' syntax
        const items = exportList.split(',').map(item => item.trim());
        for (const item of items) {
            if (item.includes(' as ')) {
                const [original, alias] = item.split(' as ').map(s => s.trim());
                exports.add(alias);
                exportMappings.set(alias, original);
            } else {
                exports.add(item);
            }
        }
    }
    
    // Find named exports
    while ((match = namedExportRegex.exec(content)) !== null) {
        exports.add(match[1]);
    }
    
    // Find default exports
    while ((match = defaultExportRegex.exec(content)) !== null) {
        exports.add('default: ' + match[1]);
    }
    
    return {
        fileName,
        functions: Array.from(functions).sort(),
        exports: Array.from(exports).sort(),
        exportMappings
    };
}

// Analyze all files in a directory
function analyzeDirectory(dirPath, pattern = '*.js') {
    const results = [];
    
    function walkDir(dir) {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory() && !file.includes('test') && !file.includes('archive')) {
                walkDir(filePath);
            } else if (stat.isFile() && file.endsWith('.js') && !file.includes('test')) {
                try {
                    const analysis = analyzeFile(filePath);
                    if (analysis.functions.length > 0 || analysis.exports.length > 0) {
                        analysis.filePath = filePath;
                        results.push(analysis);
                    }
                } catch (err) {
                    console.error(`Error analyzing ${filePath}:`, err.message);
                }
            }
        }
    }
    
    walkDir(dirPath);
    return results;
}

// Check for mismatches
function findMismatches(analysis) {
    const mismatches = [];
    
    for (const item of analysis) {
        const issues = [];
        
        // Check each export
        for (const exportName of item.exports) {
            if (exportName.startsWith('default:')) continue;
            
            // Check if this export has a mapping
            const mappedFunction = item.exportMappings.get(exportName);
            if (mappedFunction) {
                // Check if the mapped function exists
                if (!item.functions.includes(mappedFunction)) {
                    issues.push(`Export '${exportName}' maps to non-existent function '${mappedFunction}'`);
                }
            } else {
                // Direct export - check if function exists
                if (!item.functions.includes(exportName)) {
                    issues.push(`Export '${exportName}' does not match any function declaration`);
                }
            }
        }
        
        if (issues.length > 0) {
            mismatches.push({
                file: item.fileName,
                path: item.filePath,
                issues
            });
        }
    }
    
    return mismatches;
}

// Main execution
console.log('# Export vs Function Name Analysis Report\n');
console.log('Generated:', new Date().toISOString(), '\n');

// Analyze controllers
console.log('## Backend Controllers\n');
const controllerResults = analyzeDirectory('backend/controllers');

for (const result of controllerResults) {
    console.log(`### ${result.fileName}\n`);
    console.log('**Functions:**');
    result.functions.forEach(fn => console.log(`- ${fn}`));
    console.log('\n**Exports:**');
    result.exports.forEach(exp => {
        const mapping = result.exportMappings.get(exp);
        if (mapping) {
            console.log(`- ${exp} (mapped from: ${mapping})`);
        } else {
            console.log(`- ${exp}`);
        }
    });
    console.log('');
}

// Find mismatches
console.log('\n## Mismatches Found\n');
const controllerMismatches = findMismatches(controllerResults);

if (controllerMismatches.length === 0) {
    console.log('✅ No export/function mismatches found in controllers!\n');
} else {
    console.log('⚠️  Found the following mismatches:\n');
    for (const mismatch of controllerMismatches) {
        console.log(`### ${mismatch.file}`);
        console.log(`Path: ${mismatch.path}`);
        mismatch.issues.forEach(issue => console.log(`- ❌ ${issue}`));
        console.log('');
    }
}

// Analyze routes
console.log('\n## Backend Routes\n');
const routeResults = analyzeDirectory('backend/routes');

for (const result of routeResults) {
    if (result.exports.length > 0) {
        console.log(`### ${result.fileName}\n`);
        console.log('**Exports:**');
        result.exports.forEach(exp => console.log(`- ${exp}`));
        console.log('');
    }
}

// Analyze utils
console.log('\n## Backend Utils\n');
const utilResults = analyzeDirectory('backend/utils');

for (const result of utilResults) {
    if (result.functions.length > 0 || result.exports.length > 0) {
        console.log(`### ${result.fileName}\n`);
        if (result.functions.length > 0) {
            console.log('**Functions:**');
            result.functions.forEach(fn => console.log(`- ${fn}`));
        }
        if (result.exports.length > 0) {
            console.log('\n**Exports:**');
            result.exports.forEach(exp => console.log(`- ${exp}`));
        }
        console.log('');
    }
}

// Find utils mismatches
const utilMismatches = findMismatches(utilResults);
if (utilMismatches.length > 0) {
    console.log('\n### Utils Mismatches\n');
    for (const mismatch of utilMismatches) {
        console.log(`#### ${mismatch.file}`);
        mismatch.issues.forEach(issue => console.log(`- ❌ ${issue}`));
        console.log('');
    }
}

// Summary
console.log('\n## Summary\n');
const totalMismatches = controllerMismatches.length + utilMismatches.length;
console.log(`Total files analyzed: ${controllerResults.length + routeResults.length + utilResults.length}`);
console.log(`Total mismatches found: ${totalMismatches}`);

if (totalMismatches > 0) {
    console.log('\n⚠️  Action Required: Fix the export/function name mismatches listed above.');
} else {
    console.log('\n✅ All exports match their function declarations!');
}