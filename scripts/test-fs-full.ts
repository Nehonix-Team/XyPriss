import { XyPrissSys } from "../src/sys";
import { XyPrissRunner } from "../src/sys/XyPrissRunner";

// Mock the global object structure if needed or just instantiate verify
// Since we are running with bun, we can probably just use the classes directly if we export them or setup the environment.
// But easier: invoke the existing API logic.

// We need to instantiate the system similar to how index.ts does it
const runner = new XyPrissRunner(process.cwd());
const sys = new XyPrissSys(runner);

// Monkey patch global if needed by some internals, but FSApi mainly uses `this.runner`
// casting to any to access the dynamically mixed-in methods if typescript complains,
// though we instantiated SysApi which extends FSApi.

console.log("\n--- STARTING DEDICATED FS API VERIFICATION ---");

const testDir = "temp_fs_verification";
const testFile = `${testDir}/verify.txt`;

try {
    // 1. Directory Management
    sys.$rmIfExists(testDir);
    sys.$ensureDir(testDir);
    if (!sys.$isDir(testDir)) throw new Error("Dir creation failed");
    console.log("[PASS] Directory creation");

    // 2. File Writing & Existence
    // @ts-ignore
    sys.$writeIfNotExists(testFile, "Line 1\n");
    if (!sys.$exists(testFile)) throw new Error("File creation failed");
    // @ts-ignore
    const wroteAgain = sys.$writeIfNotExists(testFile, "New Content");
    if (wroteAgain)
        throw new Error(
            "writeIfNotExists should return false for existing file"
        );
    console.log("[PASS] File writing and existence check");

    // 3. Appending & Reading
    // @ts-ignore
    sys.$appendLine(testFile, "Line 2");
    // @ts-ignore
    const lines = sys.$readLines(testFile);
    if (lines.length !== 3)
        throw new Error(`Expected 3 lines (incl empty), got ${lines.length}`);
    // @ts-ignore
    const nonEmpty = sys.$readNonEmptyLines(testFile);
    if (nonEmpty.length !== 2)
        throw new Error(`Expected 2 non-empty lines, got ${nonEmpty.length}`);
    console.log("[PASS] Append and Read Lines");

    // 4. Metadata
    // @ts-ignore
    const sizeHuman = sys.$sizeHuman(testFile);
    if (!sizeHuman.includes("B")) throw new Error("Invalid human size format");
    // @ts-ignore
    const createdAt = sys.$createdAt(testFile);
    if (!(createdAt instanceof Date) || isNaN(createdAt.getTime()))
        throw new Error("Invalid creation date");
    console.log("[PASS] Metadata (Size & Dates)");

    // 5. Manipulation
    const copyFile = "verify_copy.txt";
    // @ts-ignore
    sys.$duplicate(testFile, copyFile);
    if (!sys.$exists(`${testDir}/${copyFile}`))
        throw new Error("Duplication failed");

    const renamedFile = "verify_renamed.txt";
    // @ts-ignore
    sys.$rename(`${testDir}/${copyFile}`, `${testDir}/${renamedFile}`);
    if (sys.$exists(`${testDir}/${copyFile}`))
        throw new Error("Old file still exists after rename");
    if (!sys.$exists(`${testDir}/${renamedFile}`))
        throw new Error("Renamed file missing");
    console.log("[PASS] Duplication and Renaming");

    // 6. Search
    // @ts-ignore
    const txtFiles = sys.$findByExt(testDir, "txt");
    if (txtFiles.length < 2) throw new Error("Failed to find .txt files");
    console.log("[PASS] Extension search");

    // 7. Cleanup
    // @ts-ignore
    sys.$rmIfExists(testDir);
    if (sys.$exists(testDir)) throw new Error("Cleanup failed");
    console.log("[PASS] Cleanup");

    console.log("\n✅ ALL FS API TESTS PASSED SUCCESSFULLY");
} catch (error) {
    console.error("\n❌ TEST FAILED:", error);
    process.exit(1);
}

