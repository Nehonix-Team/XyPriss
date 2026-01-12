import {
    createServer,
    NetworkStats,
    ProcessInfo,
    XyPrissSys,
} from "../src/index";

const app = createServer({
    server: {
        port: 8085,
    },
});

const __sys__ = global.__sys__ as XyPrissSys;

// ============================================================================
// WATCHING API EXAMPLES
// ============================================================================

console.log("\n=== File Watching API Demo ===\n");

// Example 1: Watch a configuration file for changes
console.log("1. Watching config directory for 10 seconds...");
// Uncomment to test:
// __sys__.$watch("config", { duration: 10 });

// Example 2: Watch and auto-process
console.log("\n2. Watch and process example:");
// Uncomment to test:
// __sys__.$watchAndProcess(".", () => {
//     console.log("Change detected! Files in current dir:", __sys__.$ls(".").length);
// }, { duration: 10 });

// ============================================================================
// STREAMING API EXAMPLES
// ============================================================================

console.log("\n=== File Streaming API Demo ===\n");

// Example 3: Stream a text file
console.log("3. Streaming package.json:");
const packageContent = __sys__.$stream("package.json");
console.log("First 200 chars:", packageContent.substring(0, 200) + "...");

// Example 4: Stream with custom chunk size
console.log("\n4. Streaming with custom chunk size:");
const largeFile = __sys__.$stream("package.json", { chunkSize: 1024 });
console.log("Content length:", largeFile.length, "bytes");

// ============================================================================
// PRACTICAL USE CASE: Log File Monitoring
// ============================================================================

console.log("\n=== Practical Example: Log Monitoring ===\n");

// Create a test log file
const logFile = "test-app.log";
__sys__.$write(logFile, "Application started\n");
__sys__.$appendLine(logFile, "User logged in");
__sys__.$appendLine(logFile, "Processing request...");

// Stream the log file
console.log("Log file contents:");
const logContent = __sys__.$stream(logFile);
console.log(logContent);

// Clean up
__sys__.$rm(logFile);

console.log("\n=== Demo Complete ===\n");

app.get("/", (req, res) => {
    console.log("Request received on /");
    res.xJson({ message: "Hello World" });
});

app.start();

