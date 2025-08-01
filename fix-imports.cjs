#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Function to recursively find all TypeScript files
function findTsFiles(dir, files = []) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (
            stat.isDirectory() &&
            !item.includes("node_modules") &&
            !item.includes(".git")
        ) {
            findTsFiles(fullPath, files);
        } else if (item.endsWith(".ts") && !item.endsWith(".d.ts")) {
            files.push(fullPath);
        }
    }

    return files;
}

// Function to fix imports in a file
function fixImports(filePath) {
    let content = fs.readFileSync(filePath, "utf8");
    let changed = false;

    // Fix imports that are missing /src and fix toolkits -> toolkit
    const patterns = [
        {
            from: /from\s+["']\.\.\/mods\/toolkits\/components\//g,
            to: 'from "../mods/security/src/components/',
        },
        {
            from: /from\s+["']\.\.\/mods\/toolkits\/core\//g,
            to: 'from "../mods/security/src/core/',
        },
        {
            from: /from\s+["']\.\.\/mods\/toolkits\/utils\//g,
            to: 'from "../mods/security/src/utils/',
        },
        {
            from: /from\s+["']\.\.\/\.\.\/mods\/toolkits\/components\//g,
            to: 'from "../../mods/security/src/components/',
        },
        {
            from: /from\s+["']\.\.\/\.\.\/mods\/toolkits\/core\//g,
            to: 'from "../../mods/security/src/core/',
        },
        {
            from: /from\s+["']\.\.\/\.\.\/mods\/toolkits\/utils\//g,
            to: 'from "../../mods/security/src/utils/',
        },
        {
            from: /from\s+["']\.\.\/\.\.\/\.\.\/mods\/toolkits\/components\//g,
            to: 'from "../../../mods/security/src/components/',
        },
        {
            from: /from\s+["']\.\.\/\.\.\/\.\.\/mods\/toolkits\/core\//g,
            to: 'from "../../../mods/security/src/core/',
        },
        {
            from: /from\s+["']\.\.\/\.\.\/\.\.\/mods\/toolkits\/utils\//g,
            to: 'from "../../../mods/security/src/utils/',
        },
        {
            from: /from\s+["']\.\.\/\.\.\/\.\.\/\.\.\/mods\/toolkits\/components\//g,
            to: 'from "../../../../mods/security/src/components/',
        },
        {
            from: /from\s+["']\.\.\/\.\.\/\.\.\/\.\.\/mods\/toolkits\/core\//g,
            to: 'from "../../../../mods/security/src/core/',
        },
        {
            from: /from\s+["']\.\.\/\.\.\/\.\.\/\.\.\/mods\/toolkits\/utils\//g,
            to: 'from "../../../../mods/security/src/utils/',
        },
    ];

    for (const pattern of patterns) {
        if (pattern.from.test(content)) {
            content = content.replace(pattern.from, pattern.to);
            changed = true;
        }
    }

    if (changed) {
        fs.writeFileSync(filePath, content, "utf8");
        console.log(`Fixed imports in: ${filePath}`);
    }
}

// Main execution
const srcDir = path.join(__dirname, "src");
const tsFiles = findTsFiles(srcDir);

console.log(`Found ${tsFiles.length} TypeScript files`);

for (const file of tsFiles) {
    fixImports(file);
}

console.log("Import fixing complete!");

