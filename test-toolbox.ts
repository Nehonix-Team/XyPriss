import { __sys__ } from "./src/xhsc";

async function testToolbox() {
    console.log("--- Testing Hyper-Powerful FS Open API ---");
    const testFile = `${process.cwd()}/toolbox-test.bin`;

    // Setup test file
    __sys__.fs.writeFileSync(
        testFile,
        Buffer.from("Nehonix System XHSC Hyper-Engine Toolbox Test Content"),
    );

    try {
        await __sys__.fs.open(testFile, "r+", async (file) => {
            console.log("Handle opened, ID:", file.nativeId);

            // 1. Read first chunk
            const chunk1 = await file.read(7);
            console.log("Read 7 bytes:", chunk1.toString());

            // 2. Seek to "XHSC"
            const pos = await file.seek(15, 0); // O: Start
            console.log("Seeked to position:", pos);

            const chunk2 = await file.read(4);
            console.log("Read at pos 15:", chunk2.toString()); // Should be "XHSC"

            // 3. Stat handle
            const stats = await file.stat();
            console.log(
                "Handle Stats - Size:",
                stats.size,
                "IsDir:",
                stats.is_dir,
            );

            // 4. Write at current pos
            await file.seek(0, 2); // End
            const bytesWritten = await file.write(" [APPENDED DATA]");
            console.log("Appended bytes:", bytesWritten);
        });

        const finalContent = __sys__.fs.readFileSync(testFile).toString();
        console.log("Final file content:", finalContent);
    } catch (err) {
        console.error("Test failed:", err);
    } finally {
        __sys__.fs.rmIfExists(testFile);
    }
}

testToolbox();

