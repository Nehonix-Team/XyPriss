import { createServer } from "xypriss";
import * as fs from "fs";

console.log("Starting security test server...");

const server = createServer({
    server: {
        port: 9999,
    },
});

server.get("/test-security", (req, res) => {
    try {
        console.log("Attempting direct fs access...");
        const data = fs.readFileSync("package.json", "utf-8");
        console.log("SECURITY FAILURE: Direct fs access allowed!");
        res.send("FAIL: Native API not blocked");
    } catch (e: any) {
        console.log("SECURITY SUCCESS: Native API blocked:", e.message);
        res.send("SUCCESS: Native API blocked");
    }
});

// Test immediate access
try {
    console.log("Attempting immediate direct fs access...");
    fs.readFileSync("package.json");
    console.log("SECURITY FAILURE (Immediate): Direct fs access allowed!");
} catch (e: any) {
    console.log("SECURITY SUCCESS (Immediate): Native API blocked");
}

server.start();

