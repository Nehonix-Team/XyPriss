/**
 * Enhanced CPU Worker with Real Task Implementations
 * Replaces mock implementations with actual CPU-intensive operations
 */

const {
    Worker,
    isMainThread,
    parentPort,
    workerData,
} = require("worker_threads");
const os = require("os");
const crypto = require("crypto");

// Import real CPU-intensive task implementations
const {
    calculatePrimes,
    calculateFibonacci,
    multiplyMatrices,
    computeHashes,
    analyzeDataset,
    analyzeText,
    processImageData,
    performCryptographicOperations,
} = require("./cpu-tasks");

// Worker configuration
const WORKER_CONFIG = {
    maxExecutionTime: 30000,
    maxMemoryUsage: 512 * 1024 * 1024, // 512MB
    enableMetrics: true,
    retryAttempts: 3,
    retryDelay: 1000,
    enableLogging: true,
    debug: process.env.NODE_ENV === "development",
};

// Worker state
let isShuttingDown = false;
let activeTask = null;
const workerMetrics = {
    tasksProcessed: 0,
    tasksSucceeded: 0,
    tasksFailed: 0,
    totalExecutionTime: 0,
    averageExecutionTime: 0,
    memoryPeakUsage: 0,
    startTime: Date.now(),
};

// Enhanced logging
function log(level, message, ...args) {
    if (!WORKER_CONFIG.enableLogging) return;
    const logger = require("./Logger").logger;
    logger[level]("cpu-worker", message, ...args);
}

// System information
const systemInfo = {
    cpus: os.cpus().length,
    totalMemory: `${Math.round(os.totalmem() / 1024 / 1024)}MB`,
    freeMemory: `${Math.round(os.freemem() / 1024 / 1024)}MB`,
    platform: os.platform(),
    arch: os.arch(),
};

log("debug", "CPU Worker initialized");
log("debug", "System info:", systemInfo);

// Resource monitoring
function checkResourceUsage() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const usage = {
        memory: {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss,
        },
        cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system,
        },
        uptime: process.uptime(),
    };

    // Update peak memory usage
    if (usage.memory.heapUsed > workerMetrics.memoryPeakUsage) {
        workerMetrics.memoryPeakUsage = usage.memory.heapUsed;
    }

    return usage;
}

// Enhanced task processing with real implementations
async function processTask(task) {
    const { type, data } = task;

    log("info", `Processing ${type} task with real implementation`);

    switch (type) {
        case "calculate":
            return await processCalculationTask(data);
        case "analyze":
            return await processAnalysisTask(data);
        case "crypto":
            return await processCryptographicTask(data);
        case "process":
            return await processDataTask(data);
        case "transform":
            return await processTransformTask(data);
        default:
            throw new Error(`Unknown task type: ${type}`);
    }
}

/**
 * Real calculation tasks
 */
async function processCalculationTask(data) {
    const startTime = Date.now();

    if (!data.operation) {
        throw new Error("Calculation operation is required");
    }

    let result;

    switch (data.operation) {
        case "primes":
            const limit = data.limit || 10000;
            const primes = calculatePrimes(limit);
            result = {
                operation: "prime_calculation",
                limit,
                primesFound: primes.length,
                largestPrime: primes[primes.length - 1],
                samplePrimes: primes.slice(0, 10),
                executionTime: Date.now() - startTime,
            };
            break;

        case "fibonacci":
            const n = data.n || 1000;
            const sequence = calculateFibonacci(n);
            result = {
                operation: "fibonacci_sequence",
                length: n,
                lastValue: sequence[sequence.length - 1],
                sampleValues: sequence.slice(0, 10),
                executionTime: Date.now() - startTime,
            };
            break;

        case "matrix":
            if (!data.matrixA || !data.matrixB) {
                throw new Error("Two matrices required for multiplication");
            }
            const product = multiplyMatrices(data.matrixA, data.matrixB);
            result = {
                operation: "matrix_multiplication",
                resultDimensions: [product.length, product[0].length],
                result: product,
                executionTime: Date.now() - startTime,
            };
            break;

        default:
            throw new Error(`Unknown calculation operation: ${data.operation}`);
    }

    return result;
}

/**
 * Real analysis tasks
 */
async function processAnalysisTask(data) {
    const startTime = Date.now();

    if (!data.analysisType) {
        throw new Error("Analysis type is required");
    }

    let result;

    switch (data.analysisType) {
        case "dataset":
            const dataset = data.dataset || data.data?.dataset;
            if (!dataset) {
                throw new Error("Dataset is required for analysis");
            }
            const stats = analyzeDataset(dataset);
            result = {
                analysisType: "dataset_analysis",
                statistics: stats,
                executionTime: Date.now() - startTime,
            };
            break;

        case "text":
            const text = data.text || data.data?.text;
            if (!text) {
                throw new Error("Text is required for analysis");
            }
            const textStats = analyzeText(text);
            result = {
                analysisType: "text_analysis",
                analysis: textStats,
                executionTime: Date.now() - startTime,
            };
            break;

        case "image":
            if (!data.imageData) {
                throw new Error("Image data is required for analysis");
            }
            const imageResult = processImageData(data.imageData);
            result = {
                analysisType: "image_processing",
                processing: imageResult,
                executionTime: Date.now() - startTime,
            };
            break;

        default:
            throw new Error(`Unknown analysis type: ${data.analysisType}`);
    }

    return result;
}

/**
 * Real cryptographic tasks
 */
async function processCryptographicTask(data) {
    const startTime = Date.now();

    const operations = data.operations || 1000;
    const cryptoResult = performCryptographicOperations(
        data.payload || {},
        operations
    );

    return {
        taskType: "cryptographic_operations",
        operationsCompleted: operations,
        result: cryptoResult,
        executionTime: Date.now() - startTime,
    };
}

/**
 * Real data processing tasks
 */
async function processDataTask(data) {
    const startTime = Date.now();

    // Perform hash computation
    const iterations = data.hashIterations || 5000;
    const hash = computeHashes(data, iterations);

    return {
        taskType: "data_processing",
        originalData: JSON.stringify(data).substring(0, 100) + "...",
        hashIterations: iterations,
        finalHash: hash,
        executionTime: Date.now() - startTime,
    };
}

/**
 * Real transformation tasks
 */
async function processTransformTask(data) {
    const startTime = Date.now();

    // Perform multiple transformations
    const transformations = [];

    // Sort transformation
    if (data.array && Array.isArray(data.array)) {
        const sorted = [...data.array].sort((a, b) => a - b);
        transformations.push({
            type: "sort",
            original: data.array.slice(0, 10),
            result: sorted.slice(0, 10),
            count: sorted.length,
        });
    }

    // Hash transformation
    if (data.text) {
        const hash = crypto
            .createHash("sha256")
            .update(data.text)
            .digest("hex");
        transformations.push({
            type: "hash",
            original: data.text.substring(0, 50),
            result: hash,
        });
    }

    return {
        taskType: "data_transformation",
        transformations,
        executionTime: Date.now() - startTime,
    };
}

// Message handler with real task processing
if (parentPort) {
    parentPort.on("message", async (task) => {
        if (isShuttingDown) {
            parentPort.postMessage({
                success: false,
                taskId: task.id,
                error: "Worker is shutting down",
                timestamp: new Date().toISOString(),
            });
            return;
        }

        activeTask = task;
        const startTime = Date.now();

        try {
            log("info", `Processing task: ${task.id} (type: ${task.type})`);

            // Process task with real implementation
            const result = await processTask(task);
            const executionTime = Date.now() - startTime;

            // Update metrics
            workerMetrics.tasksProcessed++;
            workerMetrics.tasksSucceeded++;
            workerMetrics.totalExecutionTime += executionTime;
            workerMetrics.averageExecutionTime =
                workerMetrics.totalExecutionTime / workerMetrics.tasksProcessed;

            // Send successful result
            parentPort.postMessage({
                success: true,
                taskId: task.id,
                result: result,
                executionTime: executionTime,
                resourceUsage: checkResourceUsage(),
                timestamp: new Date().toISOString(),
                workerMetrics: { ...workerMetrics },
            });

            log(
                "info",
                `Task ${task.id} completed successfully in ${executionTime}ms`
            );
        } catch (error) {
            const executionTime = Date.now() - startTime;

            // Update metrics
            workerMetrics.tasksProcessed++;
            workerMetrics.tasksFailed++;

            log("error", `Task ${task.id} failed:`, error.message);

            // Send error result
            parentPort.postMessage({
                success: false,
                taskId: task.id,
                error: {
                    message: error.message,
                    stack: error.stack,
                    code: error.code || "TASK_EXECUTION_ERROR",
                },
                executionTime: executionTime,
                resourceUsage: checkResourceUsage(),
                timestamp: new Date().toISOString(),
                workerMetrics: { ...workerMetrics },
            });
        } finally {
            activeTask = null;
        }
    });
}

// Graceful shutdown
function gracefulShutdown(signal) {
    if (isShuttingDown) return;

    isShuttingDown = true;
    log("info", `Received ${signal}, initiating graceful shutdown...`);

    const shutdownTimeout = setTimeout(() => {
        log("warn", "Shutdown timeout reached, forcing exit");
        process.exit(1);
    }, 5000);

    // Wait for active task to complete
    const checkActiveTask = () => {
        if (!activeTask) {
            clearTimeout(shutdownTimeout);
            log("info", "Enhanced CPU Worker shutdown completed");
            process.exit(0);
        } else {
            log(
                "info",
                `Waiting for active task ${activeTask.id} to complete...`
            );
            setTimeout(checkActiveTask, 100);
        }
    };

    checkActiveTask();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGHUP", () => gracefulShutdown("SIGHUP"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
    log("error", "Uncaught exception:", error);
    gracefulShutdown("UNCAUGHT_EXCEPTION");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
    log("error", "Unhandled promise rejection:", reason);
    gracefulShutdown("UNHANDLED_REJECTION");
});

