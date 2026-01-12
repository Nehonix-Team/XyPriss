import { createServer, NetworkStats, XyPrissSys } from "../src/index";

const app = createServer({
    server: {
        port: 8085,
    },
});

const __sys__ = global.__sys__ as XyPrissSys;

// ==========================================
// NEW FS API TESTS
// ==========================================
console.log("\n--- STARTING FS API TESTS ---");

const testDir = "temp_fs_test";
const testFile = `${testDir}/sample.txt`;

// 1. Directory Management
__sys__.$rmIfExists(testDir); // Cleanup from previous runs
__sys__.$ensureDir(testDir);
console.log(`[1] Dir created: ${__sys__.$isDir(testDir)}`);

// 2. File Writing & Existence
__sys__.$writeIfNotExists(testFile, "Hello World\n");
console.log(`[2] File exists: ${__sys__.$exists(testFile)}`);
console.log(
    `[2] Write again (should fail): ${!__sys__.$writeIfNotExists(
        testFile,
        "New Content"
    )}`
);

// 3. Appending & Reading
__sys__.$appendLine(testFile, "Second Line");
const lines = __sys__.$readLines(testFile);
console.log(
    `[3] Line count: ${lines.length} (Expected 3 including empty last line from appendLine)`
);
console.log(
    `[3] Non-empty lines: ${__sys__.$readNonEmptyLines(testFile).length}`
);

// 4. Metadata
console.log(`[4] Human Size: ${__sys__.$sizeHuman(testFile)}`);
console.log(`[4] Created At: ${__sys__.$createdAt(testFile)}`);
console.log(`[4] Modified At: ${__sys__.$modifiedAt(testFile)}`);

// 5. Manipulation
const copyFile = "sample_copy.txt";
__sys__.$duplicate(testFile, copyFile);
console.log(
    `[5] Duplicate exists: ${__sys__.$exists(`${testDir}/${copyFile}`)}`
);

const renamedFile = "sample_renamed.txt";
__sys__.$rename(`${testDir}/${copyFile}`, `${testDir}/${renamedFile}`);
console.log(
    `[5] Renamed exists: ${__sys__.$exists(`${testDir}/${renamedFile}`)}`
);

// 6. Search
const txtFiles = __sys__.$findByExt(testDir, "txt");
console.log(`[6] Found .txt files: ${txtFiles.join(", ")}`);

// 7. Cleanup
__sys__.$rmIfExists(testDir);
console.log(`[7] Cleanup done: ${!__sys__.$exists(testDir)}`);

console.log("--- FS API TESTS COMPLETED ---\n");
// ==========================================

app.get("/", (req, res) => {
    console.log("Request received on /");
    res.xJson({ message: "Hello World" });
});

app.start();

