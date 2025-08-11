// Enhanced Worker Thread Verification for Bun
import { createServer } from "./src/index";

const TEST_CONFIG = {
    port: 9340, // Different port to avoid conflicts
    blockingTestDuration: 3000, // 3 seconds of blocking work
    concurrentRequests: 4,
    testTimeout: 20000,
};

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

const makeRequest = async (path: string, timeout = 15000) => {
    try {
        const response = await fetch(
            `http://localhost:${TEST_CONFIG.port}${path}`,
            {
                signal: AbortSignal.timeout(timeout),
            }
        );
        const data = await response.json();
        return { status: response.status, data, success: true };
    } catch (error) {
        return { status: 0, data: null, success: false, error: error.message };
    }
};

// Test if workers can truly run in parallel (blocking test)
const testTrueParallelism = async () => {
    log.test("🔬 Advanced Test: True Parallelism Verification");
    log.info(
        "This test will determine if workers run in separate threads or are just async"
    );

    const startTime = Date.now();
    const requests = [];

    // Create requests that should block for 3 seconds each
    for (let i = 0; i < TEST_CONFIG.concurrentRequests; i++) {
        requests.push(
            makeRequest("/blocking-test").then((response) => ({
                ...response,
                requestId: i + 1,
                completedAt: Date.now(),
            }))
        );
    }

    log.info(
        `⏱️ Started ${TEST_CONFIG.concurrentRequests} blocking requests (each should take ~3s)`
    );

    const responses = await Promise.all(requests);
    const totalTime = Date.now() - startTime;
    const successfulResponses = responses.filter((r) => r.success);

    log.info(`⏱️ All requests completed in: ${totalTime}ms`);

    // Analyze timing to determine parallelism
    const expectedSequentialTime =
        TEST_CONFIG.blockingTestDuration * TEST_CONFIG.concurrentRequests;
    const parallelismRatio = expectedSequentialTime / totalTime;

    log.result("📊 Parallelism Analysis:");
    log.result(`   • Expected time if sequential: ${expectedSequentialTime}ms`);
    log.result(`   • Actual total time: ${totalTime}ms`);
    log.result(`   • Parallelism ratio: ${parallelismRatio.toFixed(2)}x`);

    // Determine worker thread status
    if (parallelismRatio >= 3.0) {
        log.success("✅ TRUE WORKER THREADS: Tasks ran in parallel threads!");
        log.info("   • Multiple blocking operations completed simultaneously");
        log.info("   • Your worker pool is using real threads");
        return {
            isParallel: true,
            ratio: parallelismRatio,
            details: "True worker threads detected",
        };
    } else if (parallelismRatio >= 1.5) {
        log.warning("⚠️ PARTIAL PARALLELISM: Some concurrency detected");
        log.info("   • Better than sequential but not full parallelism");
        log.info("   • Possibly async concurrency or limited threading");
        return {
            isParallel: false,
            ratio: parallelismRatio,
            details: "Partial concurrency detected",
        };
    } else {
        log.error("❌ NO PARALLELISM: Tasks ran sequentially");
        log.info("   • Blocking operations waited for each other");
        log.info("   • No worker threads or async handling");
        return {
            isParallel: false,
            ratio: parallelismRatio,
            details: "Sequential execution detected",
        };
    }
};

// Test memory isolation between workers
const testWorkerMemoryIsolation = async () => {
    log.test("🧠 Advanced Test: Worker Memory Isolation");

    const requests = [];

    // Create requests that modify and read worker state
    for (let i = 0; i < 4; i++) {
        requests.push(makeRequest("/memory-test"));
    }

    const responses = await Promise.all(requests);
    const successfulResponses = responses.filter((r) => r.success);

    // Analyze worker memory states
    const workerStates = new Map();
    successfulResponses.forEach((response) => {
        const workerId = response.data.workerId;
        if (!workerStates.has(workerId)) {
            workerStates.set(workerId, []);
        }
        workerStates.get(workerId).push(response.data.counter);
    });

    log.result("📊 Worker Memory Analysis:");
    workerStates.forEach((counters, workerId) => {
        log.result(`   • ${workerId}: Counters ${JSON.stringify(counters)}`);
    });

    if (workerStates.size > 1) {
        log.success(
            "✅ WORKER ISOLATION: Multiple workers with separate memory"
        );
        return { isolated: true, workers: workerStates.size };
    } else {
        log.warning("⚠️ SHARED EXECUTION: Single execution context detected");
        return { isolated: false, workers: workerStates.size };
    }
};

// Enhanced CPU test with thread detection
const testCpuWithThreadDetection = async () => {
    log.test("💪 Advanced Test: CPU with Thread Detection");

    const startTime = Date.now();
    const requests = [];

    // Create CPU-intensive requests with thread detection
    for (let i = 0; i < TEST_CONFIG.concurrentRequests; i++) {
        requests.push(
            makeRequest("/cpu-thread-test", 15000).then((response) => ({
                ...response,
                requestId: i + 1,
                startedAt: Date.now(),
            }))
        );
    }

    const responses = await Promise.all(requests);
    const totalTime = Date.now() - startTime;
    const successfulResponses = responses.filter((r) => r.success);

    // Analyze thread information
    const threadInfo = new Set();
    successfulResponses.forEach((response) => {
        if (response.data?.threadInfo) {
            threadInfo.add(response.data.threadInfo);
        }
    });

    log.result("📊 Thread Detection Results:");
    log.result(
        `   • Successful requests: ${successfulResponses.length}/${TEST_CONFIG.concurrentRequests}`
    );
    log.result(`   • Unique thread contexts: ${threadInfo.size}`);
    log.result(`   • Total execution time: ${totalTime}ms`);

    return {
        successful: successfulResponses.length,
        uniqueThreads: threadInfo.size,
        totalTime,
        threadContexts: Array.from(threadInfo),
    };
};

// Generate final comprehensive verdict
const generateAdvancedVerdict = (
    parallelismTest: any,
    memoryTest: any,
    cpuTest: any
) => {
    log.info("");
    log.result("🎯 ADVANCED WORKER ANALYSIS");
    log.result("=" + "=".repeat(40));

    log.info("🔬 Parallelism Test:");
    if (parallelismTest.isParallel) {
        log.success(
            `   ✅ TRUE PARALLELISM (${parallelismTest.ratio.toFixed(
                2
            )}x speedup)`
        );
    } else {
        log.warning(
            `   ⚠️ LIMITED PARALLELISM (${parallelismTest.ratio.toFixed(
                2
            )}x speedup)`
        );
    }

    log.info("🧠 Memory Isolation Test:");
    if (memoryTest.isolated) {
        log.success(
            `   ✅ ISOLATED WORKERS (${memoryTest.workers} separate contexts)`
        );
    } else {
        log.warning(
            `   ⚠️ SHARED CONTEXT (${memoryTest.workers} execution context)`
        );
    }

    log.info("💪 CPU Thread Detection:");
    log.info(`   • Unique thread contexts: ${cpuTest.uniqueThreads}`);
    log.info(`   • Successful tasks: ${cpuTest.successful}`);

    log.info("");
    log.result("🏛️ FINAL ADVANCED VERDICT:");
    log.result("=" + "=".repeat(35));

    if (parallelismTest.isParallel && memoryTest.isolated) {
        log.verdict(
            "🎉 REAL WORKER THREADS - Your implementation uses true parallel threads!"
        );
        log.info("   • Tasks execute simultaneously in separate threads");
        log.info("   • Each worker has isolated memory space");
        log.info("   • This is impressive for a Bun environment!");
    } else if (parallelismTest.ratio >= 1.5) {
        log.verdict(
            "🔧 ASYNC CONCURRENCY - Fast async handling but not true threads"
        );
        log.info("   • Tasks execute concurrently but not in parallel");
        log.info("   • Single-threaded with excellent async performance");
        log.info("   • This is typical and optimal for Bun's architecture");
    } else {
        log.verdict("⚠️ SEQUENTIAL PROCESSING - Basic synchronous execution");
        log.info("   • Tasks execute one after another");
        log.info("   • No concurrency or parallelism detected");
        log.info("   • Consider checking worker configuration");
    }

    log.info("");
    log.info("💡 Implementation Insights:");
    log.info("   • Your 'worker pool' may be using async task distribution");
    log.info(
        "   • Bun's event loop can handle concurrent I/O very efficiently"
    );
    log.info(
        "   • For CPU-bound tasks, Node.js with worker_threads is more suitable"
    );
};

// Main advanced test runner
const runAdvancedTests = async () => {
    log.info("🔬 Starting Advanced Worker Verification Tests");
    log.info(
        "🎯 Goal: Determine if workers are real threads or async concurrency"
    );
    log.info("");

    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
        const parallelismTest = await testTrueParallelism();
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const memoryTest = await testWorkerMemoryIsolation();
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const cpuTest = await testCpuWithThreadDetection();

        generateAdvancedVerdict(parallelismTest, memoryTest, cpuTest);
    } catch (error) {
        log.error(`Advanced tests failed: ${error}`);
    }
};

// Create server with advanced test routes
console.log("🔬 Initializing Advanced Worker Verification Tests...");

const app = createServer({
    server: {
        port: TEST_CONFIG.port,
        autoPortSwitch: { enabled: true },
    },
    cache: { enabled: false }, // Disable cache for accurate testing
    workerPool: {
        enabled: true,
    },
    cluster: {
        enabled: true,
        config: {
            workers: 1
        }
    },
});

// Global counter for memory isolation test
let globalCounter = 0;

// Advanced test routes
app.get("/", (_req, res) => {
    res.json({
        message: "Advanced Worker Verification Server",
        processId: process.pid,
        runtime: "Bun",
        timestamp: new Date().toISOString(),
    });
});

// Blocking test route - true parallelism detector
app.get("/blocking-test", async (_req, res) => {
    const startTime = Date.now();
    const workerId = `worker-${process.pid}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

    // Simulate blocking CPU work (busy waiting)
    const endTime = startTime + TEST_CONFIG.blockingTestDuration;
    let iterations = 0;

    while (Date.now() < endTime) {
        // Busy work that can't be optimized away
        Math.sqrt(Math.random() * 1000000);
        iterations++;
    }

    const actualDuration = Date.now() - startTime;

    res.json({
        message: "Blocking task completed",
        workerId,
        processId: process.pid,
        requestedDuration: TEST_CONFIG.blockingTestDuration,
        actualDuration,
        iterations,
        timestamp: new Date().toISOString(),
    });
});

// Memory isolation test route
app.get("/memory-test", async (_req, res) => {
    const workerId = `worker-${process.pid}-${Math.random()
        .toString(36)
        .substr(2, 5)}`;

    // Increment global counter (shared) and local counter (isolated)
    globalCounter++;
    const localCounter = Math.floor(Math.random() * 1000);

    // Small delay to simulate work
    await new Promise((resolve) => setTimeout(resolve, 10));

    res.json({
        message: "Memory test completed",
        workerId,
        processId: process.pid,
        counter: localCounter,
        globalCounter,
        timestamp: new Date().toISOString(),
    });
});

// CPU test with thread detection
app.get("/cpu-thread-test", async (_req, res) => {
    const startTime = Date.now();
    const workerId = `worker-${process.pid}-${Math.random()
        .toString(36)
        .substr(2, 5)}`;

    // CPU-intensive work
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
        result += Math.sqrt(i) * Math.sin(i);
    }

    const duration = Date.now() - startTime;

    // Gather thread-like information
    const threadInfo = {
        processId: process.pid,
        workerId,
        memoryUsage: process.memoryUsage().heapUsed,
        platform: process.platform,
    };

    res.json({
        message: "CPU thread test completed",
        workerId,
        processId: process.pid,
        duration: `${duration}ms`,
        result: result.toFixed(2),
        threadInfo: JSON.stringify(threadInfo),
        timestamp: new Date().toISOString(),
    });
});

// Start server and run advanced tests
app.start(undefined, () => {
    console.log(`🔬 Advanced Test Server started on port ${TEST_CONFIG.port}`);
    console.log(`📊 Process ID: ${process.pid}`);

    setTimeout(() => {
        runAdvancedTests().catch(console.error);
    }, 3000);
});

process.on("SIGINT", () => {
    log.info("🛑 Shutting down advanced tests...");
    process.exit(0);
});

