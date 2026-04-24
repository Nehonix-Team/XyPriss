import { __sys__ } from "../src/index";
import fs from "node:fs";
import path from "node:path";

async function verify() {
    console.log("🔍 Verifying Advanced System APIs...");

    // 1. Home Directory
    const home = __sys__.os.homeDir();
    console.log(`🏠 Home Directory: ${home}`);
    if (!home || !path.isAbsolute(home)) {
        throw new Error("Invalid Home Directory returned");
    }

    // 2. Hardware-Linked Encryption
    const testFile = path.resolve(process.cwd(), "test-hardware.txt");
    const testKey = "ultra-secret-key-123";
    const originalContent = "This is a hardware-bound secret message.";

    console.log("🔐 Testing Hardware-Linked Encryption...");
    fs.writeFileSync(testFile, originalContent);

    try {
        await __sys__.fs.hardwareEncryptFile(testFile, testKey);
        const encryptedContent = fs.readFileSync(testFile, "utf8");

        if (encryptedContent === originalContent) {
            throw new Error("File content was not encrypted");
        }
        console.log("✅ Encryption successful (content changed)");

        await __sys__.fs.hardwareDecryptFile(testFile, testKey);
        const decryptedContent = fs.readFileSync(testFile, "utf8");

        if (decryptedContent !== originalContent) {
            throw new Error(
                `Decryption failed. Expected "${originalContent}", got "${decryptedContent}"`,
            );
        }
        console.log("✅ Decryption successful (content restored)");
    } finally {
        if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
    }

    console.log("🎉 All Advanced System APIs verified successfully!");
}

verify().catch((err) => {
    console.error("❌ Verification failed:", err);
    process.exit(1);
});

