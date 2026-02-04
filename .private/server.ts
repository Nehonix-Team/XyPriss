import { createServer } from "../src/index";
import { xems } from "../src/plugins/modules/xems";

const app = createServer({
    server: {
        port: 3000,
    },
});

app.start().then(async () => {
    console.log("🚀 Server started!");

    // Test XEMS
    try {
        console.log("🔌 Testing XEMS connection...");
        const ping = await xems.ping();
        console.log(`✅ PING: ${ping}`);

        console.log("📝 Testing SET...");
        const setOk = await xems.set("test-box", "hello", "world");
        console.log(`✅ SET: ${setOk}`);

        console.log("📖 Testing GET...");
        const val = await xems.get("test-box", "hello");
        console.log(`✅ GET: ${val}`);
    } catch (err) {
        console.error("❌ XEMS Error:", err);
    }
});

