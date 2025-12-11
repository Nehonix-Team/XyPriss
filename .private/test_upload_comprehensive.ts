import fs from "fs";
import path from "path";

const SERVER_URL = "http://localhost:8085";
const ASSETS_DIR = "./assets";

/**
 * Test file upload using Bun's native FormData API (RECOMMENDED)
 * This is the most reliable method for file uploads in Bun
 */
async function testNativeFormData(filePath: string, fileName: string) {
    console.log("\n📤 Testing with Native FormData API...");

    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], {
        type: getContentType(fileName),
    });

    const form = new FormData();
    form.append("file", blob, fileName);

    const response = await fetch(`${SERVER_URL}/upload`, {
        method: "POST",
        body: form,
    });

    return response;
}

/**
 * Test file upload using form-data package with node-fetch
 * NOTE: This approach has compatibility issues with Bun's fetch implementation
 */
async function testFormDataPackage(filePath: string, fileName: string) {
    console.log("\n📤 Testing with form-data package...");

    try {
        // Dynamic import to avoid errors if not installed
        const FormData = (await import("form-data")).default;

        const form = new FormData();
        form.append("file", fs.createReadStream(filePath), {
            filename: fileName,
            contentType: getContentType(fileName),
        });

        // Note: This requires node-fetch, not Bun's native fetch
        const nodeFetch = (await import("node-fetch")).default;

        const response = await nodeFetch(`${SERVER_URL}/upload`, {
            method: "POST",
            body: form as any,
            headers: form.getHeaders(),
        });

        return response;
    } catch (error: any) {
        console.error("❌ form-data package test failed:", error.message);
        return null;
    }
}

/**
 * Test file upload using File API (Browser-compatible approach)
 */
async function testFileAPI(filePath: string, fileName: string) {
    console.log("\n📤 Testing with File API...");

    const fileBuffer = fs.readFileSync(filePath);
    const file = new File([fileBuffer], fileName, {
        type: getContentType(fileName),
    });

    const form = new FormData();
    form.append("file", file);

    const response = await fetch(`${SERVER_URL}/upload`, {
        method: "POST",
        body: form,
    });

    return response;
}

async function runTests() {
    try {
        // Check if assets directory exists
        if (!fs.existsSync(ASSETS_DIR)) {
            console.error(`Assets directory ${ASSETS_DIR} does not exist`);
            return;
        }

        // Get first file from assets directory
        const files = fs
            .readdirSync(ASSETS_DIR)
            .filter((file) =>
                fs.statSync(path.join(ASSETS_DIR, file)).isFile()
            );

        if (files.length === 0) {
            console.error("No files found in assets directory");
            return;
        }

        const fileName = files[0];
        const filePath = path.join(ASSETS_DIR, fileName);
        const fileStats = fs.statSync(filePath);

        console.log(`\n${"=".repeat(60)}`);
        console.log(`Testing file upload with: ${fileName}`);
        console.log(`File size: ${(fileStats.size / 1024).toFixed(2)} KB`);
        console.log(`${"=".repeat(60)}`);

        // Test 1: Native FormData (RECOMMENDED)
        try {
            const response1 = await testNativeFormData(filePath, fileName);
            const result1 = (await response1.json()) as any;
            if (response1.ok && result1.success) {
                console.log("✅ Native FormData: SUCCESS");
            } else {
                console.log("❌ Native FormData: FAILED", result1);
            }
        } catch (error: any) {
            console.log("❌ Native FormData: ERROR", error.message);
        }

        // Test 2: File API
        try {
            const response2 = await testFileAPI(filePath, fileName);
            const result2 = (await response2.json()) as any;
            if (response2.ok && result2.success) {
                console.log("✅ File API: SUCCESS");
            } else {
                console.log("❌ File API: FAILED", result2);
            }
        } catch (error: any) {
            console.log("❌ File API: ERROR", error.message);
        }

        // Test 3: form-data package (for comparison)
        try {
            const response3 = await testFormDataPackage(filePath, fileName);
            if (response3) {
                const result3 = (await response3.json()) as any;
                if (response3.ok && result3.success) {
                    console.log("✅ form-data package: SUCCESS");
                } else {
                    console.log("❌ form-data package: FAILED", result3);
                }
            }
        } catch (error: any) {
            console.log("❌ form-data package: ERROR", error.message);
        }

        console.log(`\n${"=".repeat(60)}`);
        console.log("📋 RECOMMENDATIONS:");
        console.log("1. ✅ Use Native FormData with Blob (most reliable)");
        console.log("2. ✅ Use File API (browser-compatible)");
        console.log("3. ⚠️  Avoid form-data package with Bun's fetch");
        console.log(`${"=".repeat(60)}\n`);
    } catch (error) {
        console.error("Test suite failed:", error);
    }
}

function getContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const types: { [key: string]: string } = {
        ".txt": "text/plain",
        ".json": "application/json",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".pdf": "application/pdf",
        ".zip": "application/zip",
        ".mp4": "video/mp4",
        ".mp3": "audio/mpeg",
    };
    return types[ext] || "application/octet-stream";
}

// Run the test suite
runTests();

