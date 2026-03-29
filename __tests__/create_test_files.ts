import fs from "fs";
import path from "path";

const ASSETS_DIR = "./assets";

// Create assets directory if it doesn't exist
if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

// Create some test files
const testFiles = [
    {
        name: "test1.txt",
        content: "This is test file 1 for XyPriss file upload testing.",
    },
    {
        name: "test2.json",
        content: JSON.stringify(
            { message: "Test JSON file", number: 42 },
            null,
            2
        ),
    },
    {
        name: "test3.txt",
        content:
            "Another test file to verify array upload functionality works correctly with multiple files.",
    },
];

console.log("Creating test files in assets directory...\n");

testFiles.forEach((file) => {
    const filePath = path.join(ASSETS_DIR, file.name);
    fs.writeFileSync(filePath, file.content);
    const stats = fs.statSync(filePath);
    console.log(`✅ Created: ${file.name} (${stats.size} bytes)`);
});

console.log("\n🎉 Test files created successfully!");
console.log(`\nYou can now run: bun test_upload.ts`);

