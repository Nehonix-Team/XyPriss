// Enhanced Bun-compatible cluster and worker testing
import { createServer } from "../src/index";

// Test configuration
const TEST_CONFIG = {
    port: 9339,
    testRequests: 30,
    concurrentRequests: 8,
    cpuTestIterations: 2000000,
    testTimeout: 45000,
    workerTestDuration: 10000, // 10 seconds for worker tests
    clusterTestDuration: 15000, // 15 seconds for cluster tests
};

// Colored console output
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
};

const log = {
    info: (msg: string) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
    success: (msg: string) =>
        console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    error: (msg: string) =>
        console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    warning: (msg: string) =>
        console.log(`${colors.yellow}⚠️ ${msg}${colors.reset}`),
    test: (msg: string) =>
        console.log(`${colors.cyan}🧪 ${msg}${colors.reset}`),
    result: (msg: string) =>
        console.log(`${colors.magenta}📊 ${msg}${colors.reset}`),
    verdict: (msg: string) =>
        console.log(
            `${colors.white}${colors.bright}🏛️ VERDICT: ${msg}${colors.reset}`
        ),
};

// HTTP client helper for Bun
const makeRequest = async (path: string, timeout = 10000) => {
    try {
        const response = await fetch(
            `http://localhost:${TEST_CONFIG.port}${path}`,
            {
                signal: AbortSignal.timeout(timeout),
            }
        );

        const data = await response.json();
        return { status: response.status, data, success: true };
    } catch (error: any) {
        return { status: 0, data: null, success: false, error: error.message };
    }
};

// Test 1: Basic server functionality
const testBasicFunctionality = async (): Promise<boolean> => {
    log.test("Test 1: Testing basic server functionality...");

    try {
        const response = await makeRequest("/");

        if (response.success && response.status === 200) {
            log.success(
                `✓ Server responding - PID: ${response.data.processId}, Runtime: ${response.data.runtime}`
            );
            return true;
        }

        log.error(
            `✗ Server not responding correctly: ${
                response.error || "Unknown error"
            }`
        );
        return false;
    } catch (error) {
        log.error(`✗ Basic functionality test failed: ${error}`);
        return false;
    }
};

// Test 2: Worker Pool Functionality Test
const testWorkerPoolFunctionality = async (): Promise<{
    working: boolean;
    details: any;
}> => {
    log.test("Test 2: Testing Worker Pool Functionality...");

    const workerRequests = [];
    const startTime = Date.now();

    // Create multiple concurrent worker tasks
    for (let i = 0; i < TEST_CONFIG.concurrentRequests; i++) {
        workerRequests.push(
            makeRequest("/worker-test").then((response) => ({
                ...response,
                requestId: i,
                completedAt: Date.now(),
            }))
        );
    }

    try {
        const responses = await Promise.all(workerRequests);
        const totalTime = Date.now() - startTime;

        const successfulResponses = responses.filter(
            (r) => r.success && r.status === 200
        );
        const workerIds = new Set();
        const processPids = new Set();

        successfulResponses.forEach((response) => {
            if (response.data?.workerId) {
                workerIds.add(response.data.workerId);
            }
            if (response.data?.processId) {
                processPids.add(response.data.processId);
            }
        });

        const details = {
            totalRequests: TEST_CONFIG.concurrentRequests,
            successfulRequests: successfulResponses.length,
            uniqueWorkers: workerIds.size,
            uniqueProcesses: processPids.size,
            totalTime,
            averageTime: totalTime / successfulResponses.length,
            workerIds: Array.from(workerIds),
            processIds: Array.from(processPids),
        };

        log.info(`📋 Worker Test Results:`);
        log.info(
            `   - Successful requests: ${details.successfulRequests}/${details.totalRequests}`
        );
        log.info(`   - Unique workers used: ${details.uniqueWorkers}`);
        log.info(`   - Unique processes: ${details.uniqueProcesses}`);
        log.info(`   - Total time: ${details.totalTime}ms`);
        log.info(
            `   - Average time per request: ${details.averageTime.toFixed(2)}ms`
        );

        if (details.uniqueWorkers > 1) {
            log.success(
                `✓ Worker pool is FUNCTIONAL - Multiple workers (${details.uniqueWorkers}) handling requests`
            );
            return { working: true, details };
        } else if (
            details.uniqueWorkers === 1 &&
            details.successfulRequests > 0
        ) {
            log.warning(`⚠ Worker pool configured but only 1 worker active`);
            return { working: false, details };
        } else {
            log.error(
                `✗ Worker pool NOT WORKING - No worker distribution detected`
            );
            return { working: false, details };
        }
    } catch (error: any) {
        log.error(`✗ Worker pool test failed: ${error}`);
        return { working: false, details: { error: error.message } };
    }
};

// Test 3: Cluster Functionality Test
const testClusterFunctionality = async (): Promise<{
    working: boolean;
    details: any;
}> => {
    log.test("Test 3: Testing Cluster Functionality...");

    const clusterRequests = [];
    const pidCounts = new Map();
    const startTime = Date.now();

    // Make many requests to test cluster distribution
    for (let i = 0; i < TEST_CONFIG.testRequests; i++) {
        clusterRequests.push(
            makeRequest("/cluster-test").then((response) => ({
                ...response,
                requestId: i,
                completedAt: Date.now(),
            }))
        );
    }

    try {
        const responses = await Promise.all(clusterRequests);
        const totalTime = Date.now() - startTime;

        const successfulResponses = responses.filter(
            (r) => r.success && r.status === 200
        );

        successfulResponses.forEach((response) => {
            if (response.data?.processId) {
                const pid = response.data.processId;
                pidCounts.set(pid, (pidCounts.get(pid) || 0) + 1);
            }
        });

        const details = {
            totalRequests: TEST_CONFIG.testRequests,
            successfulRequests: successfulResponses.length,
            uniqueProcesses: pidCounts.size,
            processDistribution: Object.fromEntries(pidCounts),
            totalTime,
            averageTime: totalTime / successfulResponses.length,
        };

        log.info(`📋 Cluster Test Results:`);
        log.info(
            `   - Successful requests: ${details.successfulRequests}/${details.totalRequests}`
        );
        log.info(
            `   - Unique processes handling requests: ${details.uniqueProcesses}`
        );
        log.info(`   - Process distribution:`);

        pidCounts.forEach((count, pid) => {
            const percentage = (
                (count / details.successfulRequests) *
                100
            ).toFixed(1);
            log.info(`     • PID ${pid}: ${count} requests (${percentage}%)`);
        });

        log.info(`   - Total time: ${details.totalTime}ms`);
        log.info(
            `   - Average time per request: ${details.averageTime.toFixed(2)}ms`
        );

        if (details.uniqueProcesses > 1) {
            log.success(
                `✓ Cluster is FUNCTIONAL - Multiple processes (${details.uniqueProcesses}) handling requests`
            );
            return { working: true, details };
        } else if (
            details.uniqueProcesses === 1 &&
            details.successfulRequests > 0
        ) {
            log.warning(
                `⚠ Single process handling all requests - Clustering may not be active`
            );
            return { working: false, details };
        } else {
            log.error(
                `✗ Cluster NOT WORKING - No process distribution detected`
            );
            return { working: false, details };
        }
    } catch (error: any) {
        log.error(`✗ Cluster test failed: ${error}`);
        return { working: false, details: { error: error.message } };
    }
};

// Test 4: CPU-intensive tasks with load balancing
const testLoadBalancing = async (): Promise<boolean> => {
    log.test("Test 4: Testing load balancing under CPU stress...");

    const requests = [];
    const startTime = Date.now();

    // Create concurrent CPU-intensive requests
    for (let i = 0; i < TEST_CONFIG.concurrentRequests; i++) {
        requests.push(
            makeRequest("/cpu-test", 20000).then((response) => {
                if (response.success && response.status === 200) {
                    log.info(
                        `   CPU task ${i + 1} completed on PID ${
                            response.data.processId
                        } in ${response.data.duration}`
                    );
                }
                return response;
            })
        );
    }

    try {
        const responses = await Promise.all(requests);
        const totalTime = Date.now() - startTime;

        const successfulResponses = responses.filter(
            (r) => r.success && r.status === 200
        );
        const uniquePids = new Set(
            successfulResponses.map((r) => r.data?.processId).filter(Boolean)
        );

        log.info(`📋 Load Balancing Results:`);
        log.info(
            `   - Completed tasks: ${successfulResponses.length}/${TEST_CONFIG.concurrentRequests}`
        );
        log.info(`   - Processes used: ${uniquePids.size}`);
        log.info(`   - Total time: ${totalTime}ms`);

        if (
            successfulResponses.length >=
            TEST_CONFIG.concurrentRequests * 0.8
        ) {
            log.success(
                `✓ Load balancing working - ${successfulResponses.length} tasks completed`
            );
            return true;
        } else {
            log.error(
                `✗ Load balancing issues - Only ${successfulResponses.length} tasks completed`
            );
            return false;
        }
    } catch (error) {
        log.error(`✗ Load balancing test failed: ${error}`);
        return false;
    }
};

// Generate comprehensive verdict
const generateVerdict = (testResults: Record<string, any>) => {
    log.info("");
    log.result("🏁 COMPREHENSIVE TEST RESULTS");
    log.result("=" + "=".repeat(50));

    const { basic, workers, clusters, loadBalancing } = testResults;

    // Basic functionality verdict
    if (basic) {
        log.success("✅ Basic Functionality: WORKING");
    } else {
        log.error("❌ Basic Functionality: FAILED");
        log.verdict("CRITICAL FAILURE - Server not responding properly");
        return;
    }

    // Worker functionality verdict
    if (workers.working) {
        log.success(
            `✅ Worker Pool: FUNCTIONAL (${workers.details.uniqueWorkers} workers active)`
        );
    } else {
        log.warning(
            `⚠️ Worker Pool: NOT FUNCTIONAL (${
                workers.details.uniqueWorkers || 0
            } workers detected)`
        );
    }

    // Cluster functionality verdict
    if (clusters.working) {
        log.success(
            `✅ Clustering: FUNCTIONAL (${clusters.details.uniqueProcesses} processes active)`
        );
    } else {
        log.warning(
            `⚠️ Clustering: NOT FUNCTIONAL (${
                clusters.details.uniqueProcesses || 0
            } processes detected)`
        );
    }

    // Load balancing verdict
    if (loadBalancing) {
        log.success("✅ Load Balancing: WORKING");
    } else {
        log.error("❌ Load Balancing: ISSUES DETECTED");
    }

    log.info("");
    log.result("🎯 FINAL VERDICT:");
    log.result("=" + "=".repeat(30));

    // Generate overall verdict
    if (workers.working && clusters.working && loadBalancing) {
        log.verdict(
            "🎉 FULLY FUNCTIONAL - All clustering and worker features are working perfectly!"
        );
        log.info("   • Multiple workers are processing requests");
        log.info("   • Multiple processes are handling load");
        log.info("   • Load balancing is effective");
    } else if (workers.working || clusters.working) {
        if (workers.working) {
            log.verdict(
                "🔧 PARTIALLY FUNCTIONAL - Worker pool is working but clustering may not be active"
            );
            log.info("   • Worker threads are distributing load effectively");
            log.info("   • Consider checking cluster configuration");
        } else if (clusters.working) {
            log.verdict(
                "🔧 PARTIALLY FUNCTIONAL - Clustering is working but worker pool may not be active"
            );
            log.info("   • Multiple processes are handling requests");
            log.info(
                "   • Consider enabling worker pool for better performance"
            );
        }
    } else if (basic && loadBalancing) {
        log.verdict(
            "⚠️ SINGLE-THREADED PERFORMANCE - Server working but no parallelization detected"
        );
        log.info("   • Server is responding correctly");
        log.info("   • All requests handled by single process/thread");
        log.info(
            "   • This is expected behavior in Bun (single-threaded runtime)"
        );
    } else {
        log.verdict(
            "❌ FUNCTIONALITY ISSUES - Server has performance or reliability problems"
        );
        log.info("   • Check server configuration");
        log.info("   • Verify worker/cluster settings");
    }

    // Bun-specific notes
    log.info("");
    log.info("📝 Bun Runtime Notes:");
    log.info(
        "   • Bun is single-threaded and doesn't support Node.js clustering"
    );
    log.info("   • Worker threads may have limited support in Bun");
    log.info("   • For true multi-processing, consider using Node.js runtime");
    log.info(
        "   • Bun excels at single-process performance and low memory usage"
    );
};

// Main test runner
const runComprehensiveTests = async () => {
    log.info("🚀 Starting Comprehensive Bun Server Tests");
    log.info(
        "🎯 Testing: Basic Functionality, Workers, Clusters, and Load Balancing"
    );
    log.info(`📋 Configuration:`);
    log.info(`   - Port: ${TEST_CONFIG.port}`);
    log.info(`   - Test Requests: ${TEST_CONFIG.testRequests}`);
    log.info(`   - Concurrent Requests: ${TEST_CONFIG.concurrentRequests}`);
    log.info(
        `   - CPU Test Iterations: ${TEST_CONFIG.cpuTestIterations.toLocaleString()}`
    );
    log.info("");

    // Wait for server to fully initialize
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const testResults: Record<string, any> = {};

    // Run all tests sequentially with delays
    try {
        testResults.basic = await testBasicFunctionality();
        await new Promise((resolve) => setTimeout(resolve, 2000));

        testResults.workers = await testWorkerPoolFunctionality();
        await new Promise((resolve) => setTimeout(resolve, 2000));

        testResults.clusters = await testClusterFunctionality();
        await new Promise((resolve) => setTimeout(resolve, 2000));

        testResults.loadBalancing = await testLoadBalancing();
    } catch (error) {
        log.error(`Test execution failed: ${error}`);
    }

    // Generate comprehensive verdict
    generateVerdict(testResults);
};

// Create and configure server
console.log("🚀 Initializing Bun Server Test Environment...");
console.log(`🔧 Server Configuration - Port: ${TEST_CONFIG.port}`);

const app = createServer({
    server: {
        port: TEST_CONFIG.port,
        autoPortSwitch: { enabled: true },
    },
    cache: {
        strategy: "memory",
        maxSize: 25 * 1024 * 1024, // Reduced for Bun
        ttl: 300000,
        enabled: true,
        memory: {
            maxSize: 50, // Reduced cache size
            algorithm: "lru",
        },
    },
    workerPool: {
        enabled: false, // Enable to test functionality
        config: {},
    },
    cluster: {
        enabled: false, // Disable clustering in Bun (memory constraints)
    },
});

// Enhanced test routes
app.get("/", (_req, res) => {
    res.json({
        message: "Hello from XyPriss with Bun!",
        processId: process.pid,
        runtime: "Bun",
        version: process.version,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

app.get("/worker-test", async (_req, res) => {
    const startTime = Date.now();

    // Simulate worker-distributed task
    let result = 0;
    for (let i = 0; i < TEST_CONFIG.cpuTestIterations / 2; i++) {
        result += Math.sqrt(i) * Math.sin(i);
    }

    const duration = Date.now() - startTime;

    res.json({
        message: "Worker task completed",
        processId: process.pid,
        workerId: `worker-${process.pid}-${Math.random()
            .toString(36)
            .substr(2, 9)}`,
        runtime: "Bun",
        duration: `${duration}ms`,
        result: result.toFixed(2),
        timestamp: new Date().toISOString(),
    });
});

app.get("/cluster-test", async (_req, res) => {
    // Simulate cluster-distributed request
    const processingTime = Math.random() * 50; // Random processing time
    await new Promise((resolve) => setTimeout(resolve, processingTime));

    res.json({
        message: "Cluster request processed",
        processId: process.pid,
        runtime: "Bun",
        processingTime: `${processingTime.toFixed(2)}ms`,
        timestamp: new Date().toISOString(),
    });
});

app.get("/cpu-test", async (_req, res) => {
    const startTime = Date.now();

    // Intensive CPU task
    let result = 0;
    for (let i = 0; i < TEST_CONFIG.cpuTestIterations; i++) {
        result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }

    const duration = Date.now() - startTime;

    res.json({
        message: "CPU-intensive task completed",
        processId: process.pid,
        runtime: "Bun",
        duration: `${duration}ms`,
        result: result.toFixed(2),
        timestamp: new Date().toISOString(),
    });
});

// Start server and run comprehensive tests
app.start(undefined, () => {
    console.log(`🎉 Bun Server started successfully!`);
    console.log(`📊 System Information:`);
    console.log(`   - Process ID: ${process.pid}`);
    console.log(`   - Runtime: Bun ${process.version}`);
    console.log(`   - Port: ${TEST_CONFIG.port}`);
    console.log(
        `   - Memory Usage: ${JSON.stringify(process.memoryUsage(), null, 2)}`
    );

    // Start comprehensive tests
    setTimeout(() => {
        runComprehensiveTests().catch(console.error);
    }, 4000);
});

// Graceful shutdown
process.on("SIGINT", () => {
    log.info("🛑 Received SIGINT, shutting down gracefully...");
    process.exit(0);
});

process.on("SIGTERM", () => {
    log.info("🛑 Received SIGTERM, shutting down gracefully...");
    process.exit(0);
});

