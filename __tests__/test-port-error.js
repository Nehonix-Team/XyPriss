// Simple test to verify port error handling
import { createServer } from "./src/index.ts";

console.log("🧪 Testing port error handling...");

// Create a server without autoPortSwitch
const app = createServer({
    logging: {
        enabled: true,
        level: "info",
    },
    // No autoPortSwitch configuration - should be disabled by default
});

app.get("/", (req, res) => {
    res.json({ message: "Hello World" });
});

// Try to start on a commonly used port that might be in use
app.start(3000)
    .then(() => {
        console.log("✅ Server started successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.log("❌ Server failed to start (expected if port is in use):");
        console.log("Error message:", error.message);

        // Check if the error message is what we expect
        if (
            error.message.includes("Port 3000 is already in use") &&
            error.message.includes("Enable autoPortSwitch")
        ) {
            console.log("✅ Port error handling works correctly!");
            process.exit(0);
        } else {
            console.log("❌ Unexpected error message");
            process.exit(1);
        }
    });

