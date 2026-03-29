import fs from "fs";
import path from "path";

const SERVER_URL = "http://localhost:8085";
const ASSETS_DIR = "./assets";

async function testFileUpload() {
    try {
        // Check if assets directory exists
        if (!fs.existsSync(ASSETS_DIR)) {
            console.error(`Assets directory ${ASSETS_DIR} does not exist`);
            return;
        }

        // Get all files from assets directory
        const files = fs
            .readdirSync(ASSETS_DIR)
            .filter((file) => fs.statSync(path.join(ASSETS_DIR, file)).isFile())
            .slice(0, 2); // Test with first 2 files for array upload

        if (files.length === 0) {
            console.error("No files found in assets directory");
            return;
        }

        console.log(`Found ${files.length} files to test:`);
        files.forEach((file) => console.log(`  - ${file}`));

        console.log(`\n📤 Testing multiple file upload...`);

        try {
            // Create form data using native FormData
            const form = new FormData();

            // Add all files to the form
            for (const fileName of files) {
                const filePath = path.join(ASSETS_DIR, fileName);
                const fileStats = fs.statSync(filePath);
                const fileBuffer = fs.readFileSync(filePath);
                const blob = new Blob([fileBuffer], {
                    type: getContentType(fileName),
                });

                console.log(
                    `  Adding: ${fileName} (${(fileStats.size / 1024).toFixed(
                        2
                    )} KB)`
                );
                form.append("file", blob, fileName);
            }

            console.log("\nUploading with native FormData...");

            // Upload files
            const response = await fetch(`${SERVER_URL}/upload`, {
                method: "POST",
                body: form,
            });
            const result = (await response.json()) as any;

            if (response.ok && result.success) {
                console.log(`\n✅ Upload successful!`);
                console.log(`   Uploaded ${result.files.length} file(s):`);
                result.files.forEach((file: any, index: number) => {
                    console.log(
                        `   ${index + 1}. ${file.originalname} (${(
                            file.size / 1024
                        ).toFixed(2)} KB)`
                    );
                });
            } else {
                console.log(`\n❌ Upload failed:`, result);
            }
        } catch (error: any) {
            console.error(`❌ Error uploading files:`, error.message);
        }

        console.log("\n🎉 Upload testing completed!");
    } catch (error) {
        console.error("Test failed:", error);
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

// Run the test
testFileUpload();

