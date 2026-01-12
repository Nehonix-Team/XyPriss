import { XyPrissFS } from "../src/sys/System";

async function testBridge() {
    console.log("🚀 Testing XyPrissFS Rust Bridge...");

    const root = process.cwd();
    const xfs = new XyPrissFS({ __root__: root });

    try {
        // 1. Test Path Operations (JS)
        console.log("\n--- Path Operations (JS) ---");
        const resolved = xfs.$resolve("src", "index.ts");
        console.log(`Resolved path: ${resolved}`);

        // 2. Test Filesystem Operations (Rust)
        console.log("\n--- Filesystem Operations (Rust) ---");
        const items = xfs.$ls(".");
        console.log(`Found ${items.length} items in root.`);
        console.log(`First 5 items: ${items.slice(0, 5).join(", ")}`);

        // 3. Test System Operations (Rust)
        console.log("\n--- System Operations (Rust) ---");
        const cpuCores = xfs.$cpu(true);
        if (cpuCores && cpuCores.length > 0) {
            console.log(`CPU: ${cpuCores[0].brand}`);
            console.log(`Cores: ${cpuCores[0].core_count} detected`);
        }

        const memInfo = xfs.$memory();
        console.log(
            `Memory: ${(memInfo.total / 1024 / 1024 / 1024).toFixed(2)} GB`
        );

        // 4. Test Search Operations (Rust)
        console.log("\n--- Search Operations (Rust) ---");
        const tsFiles = xfs.$find("src", "\\.ts$");
        console.log(`Found ${tsFiles.length} TypeScript files in src.`);

        console.log("\n✅ All bridge tests passed!");
    } catch (error) {
        console.error("\n--- OUTPUT DEBUG ---");
        console.error(error);
        process.exit(1);
    }
}

testBridge();

