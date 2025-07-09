const fs = require('fs');
const path = require('path');
const SEARCH_STRINGS = [
    "Tenant Table Update Household ID",
    "Tenant_Table_Update_Household_ID"
];
//const ROOT_DIR = process.cwd(); // Use for full project directory
const ROOT_DIR = path.join(process.cwd(), 'force-app'); // Use a specific directory for the Salesforce project
const SELF_FILE = path.basename(__filename);
const OUTPUT_CSV = 'References.csv';
let results = [];
// Improved CSV escaping: handles quotes, commas, and newlines
function escapeCSV(str) {
    return `"${String(str)
        .replace(/"/g, '""')      // Escape double quotes
        .replace(/[\r\n]+/g, ' ') // Replace newlines with space
        .trim()}"`;               // Trim whitespace
}
function searchInFile(filePath) {
    const fileName = path.basename(filePath);
    if (fileName === SELF_FILE) return; // Skip self file
    // Get relative path from ROOT_DIR and split into parts
    const relPath = path.relative(ROOT_DIR, filePath);
    const parts = relPath.split(path.sep);
    // Remove the file name
    parts.pop();
    // Default: immediate parent folder
    let componentType = parts.length > 0 ? parts[parts.length - 1] : '';
    // If any folder in the path is 'lwc' or 'aura', set as componentType
    if (parts.map(p => p.toLowerCase()).includes('lwc')) componentType = 'lwc';
    if (parts.map(p => p.toLowerCase()).includes('aura')) componentType = 'aura';
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    lines.forEach((line, idx) => {
        SEARCH_STRINGS.forEach(str => {
            let pos = line.indexOf(str);
            while (pos !== -1) {
                const before = pos > 0 ? line[pos - 1] : '';
                const after = pos + str.length < line.length ? line[pos + str.length] : '';
                // Skip if _ is before or after the matched string
                //if (before !== '_' && after !== '_') {
                    results.push([
                        componentType,      // Immediate parent folder or 'lwc'/'aura'
                        fileName,           // File name only
                        idx + 1,            // Line number
                        str,                // Matched string
                        line.trim()         // Line content
                    ]);
                //}
                pos = line.indexOf(str, pos + str.length);
            }
        });
    });
}
// Set of folder names to skip (case-insensitive)
const SKIP_FOLDERS = new Set();
// Set of folder names to include (case-insensitive). If empty, include all.
const INCLUDE_FOLDERS = new Set(); // add your desired folders
function walkDir(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            const folderName = path.basename(fullPath).toLowerCase();
            if (SKIP_FOLDERS.has(folderName)) return;
            walkDir(fullPath); // Always traverse subfolders
        } else {
            const folders = path.relative(ROOT_DIR, fullPath).split(path.sep).map(f => f.toLowerCase());
            const isIncluded = INCLUDE_FOLDERS.size === 0 || folders.some(f => INCLUDE_FOLDERS.has(f));
            if (
                isIncluded
            ) {
                searchInFile(fullPath);
            }
        }
    });
}
walkDir(ROOT_DIR);
const header = ['Component Type', 'Component Name', 'Line Number', 'Matched String', 'Line Content'];
const csvContent = [
    header.map(escapeCSV).join(','),
    ...results.map(row => row.map(escapeCSV).join(','))
].join('\n');
fs.writeFileSync(OUTPUT_CSV, csvContent, 'utf8');
console.log(`Results written to ${OUTPUT_CSV}`);