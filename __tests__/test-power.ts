import { XyPrissFS } from "../src/sys/System";

async function testPowerApis() {
    const xfs = new XyPrissFS({ __root__: process.cwd() });

    console.log("--- 🚀 Testing Ultra-Powerful APIs ---");

    // 1. DU (Parallel Size)
    console.log("\n[DU] Calculating size of 'src'...");
    const du = xfs.$du("src");
    console.log(`Size: ${(du.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Files: ${du.file_count}, Dirs: ${du.dir_count}`);

    // 2. Ports
    console.log("\n[PORTS] Listening ports:");
    const ports = xfs.$ports();
    ports
        .filter((p: any) => p.state === "LISTEN")
        .slice(0, 5)
        .forEach((p: any) => {
            console.log(
                `- ${p.protocol}: ${p.local_address}:${p.local_port} (${p.state})`
            );
        });

    // 3. Battery
    console.log("\n[BATTERY] Status:");
    const bat = xfs.$battery();
    if (bat.is_present) {
        console.log(`- State: ${bat.state}, Charge: ${bat.percentage}%`);
    } else {
        console.log("- No battery detected.");
    }

    // 4. Dedupe (Warning: might be slow if many files)
    console.log(
        "\n[DEDUPE] Searching for duplicates in 'tools/xypriss-sys/src'..."
    );
    const dupes = xfs.$dedupe("tools/xypriss-sys/src");
    if (dupes.length === 0) {
        console.log("- No duplicates found.");
    } else {
        dupes.forEach((group) => {
            console.log(
                `- Hash ${group.hash.slice(0, 8)}: ${group.paths.length} files`
            );
        });
    }

    console.log("\n✅ All powerful tests completed!");
}

testPowerApis().catch(console.error);

