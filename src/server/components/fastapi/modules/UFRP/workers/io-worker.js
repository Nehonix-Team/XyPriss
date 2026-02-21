/**
 * XyPrissJS - Robust I/O Worker
 * Handles I/O-intensive tasks in a separate thread
 */

const { parentPort, workerData } = require("worker_threads");
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const { EventEmitter } = require("events");

// Worker configuration with defaults
const WORKER_CONFIG = {
    enableLogging: true,
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 30000,
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedExtensions: [".json", ".txt", ".log", ".csv", ".yaml", ".yml"],
    cacheDir: path.join(process.cwd(), "cache"),
    logsDir: path.join(process.cwd(), "logs"),
    configDir: path.join(process.cwd(), "config"),
    ...workerData?.config,
};

// Enhanced logger fallback if external logger fails
// const logger = {
//     info: (context, message, ...args) =>
//         console.log(`[INFO][${context}]`, message, ...args),
//     warn: (context, message, ...args) =>
//         console.warn(`[WARN][${context}]`, message, ...args),
//     error: (context, message, ...args) =>
//         console.error(`[ERROR][${context}]`, message, ...args),
//     debug: (context, message, ...args) =>
//         WORKER_CONFIG.debug &&
//         console.debug(`[DEBUG][${context}]`, message, ...args),
// };

const externalLogger = require("./Logger");
const logger = externalLogger.logger;

// // Try to use external logger if available
// try {
//     const externalLogger = require("./Logger");
//     if (externalLogger.logger) {
//         Object.assign(logger, externalLogger.logger);
//     }
// } catch (error) {
//     logger.warn("io-worker", "External logger not available, using fallback");
// }

// Worker event emitter for internal communication
const workerEmitter = new EventEmitter();

// Task queue and processing state
const taskQueue = new Map();
let isShuttingDown = false;

function log(level, message, ...args) {
    if (!WORKER_CONFIG.enableLogging) return;
    logger[level]("io-worker", message, ...args);
}

// Enhanced error handling
class IOWorkerError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = "IOWorkerError";
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

// Worker initialization with robust setup
async function initializeWorker() {
    try {
        log("debug", "Initializing I/O Worker", workerData);
        log("info", "Initializing I/O Worker");

        // Create necessary directories
        await Promise.all([
            ensureDirectoryExists(WORKER_CONFIG.cacheDir),
            ensureDirectoryExists(WORKER_CONFIG.logsDir),
            ensureDirectoryExists(WORKER_CONFIG.configDir),
        ]);

        // Verify write permissions
        await verifyWritePermissions();

        log("info", "I/O Worker initialized successfully");
        return true;
    } catch (error) {
        log("error", "Failed to initialize I/O Worker", error);
        throw new IOWorkerError("Worker initialization failed", "INIT_FAILED", {
            originalError: error.message,
        });
    }
}

// Verify write permissions for required directories
async function verifyWritePermissions() {
    const testFile = path.join(WORKER_CONFIG.cacheDir, ".write_test");
    try {
        await fs.writeFile(testFile, "test");
        // await fs.unlink(testFile);
    } catch (error) {
        console.error(error);
        throw new IOWorkerError(
            "Insufficient write permissions",
            "PERMISSION_DENIED",
            { directory: WORKER_CONFIG.cacheDir }
        );
    }
}

// Enhanced task processing with timeout and retry logic
async function processTaskWithRetry(task) {
    let lastError;

    for (let attempt = 1; attempt <= WORKER_CONFIG.maxRetries; attempt++) {
        try {
            log("debug", `Processing task ${task.id}, attempt ${attempt}`);

            const result = await Promise.race([
                processTask(task),
                new Promise((_, reject) =>
                    setTimeout(
                        () =>
                            reject(
                                new IOWorkerError("Task timeout", "TIMEOUT")
                            ),
                        WORKER_CONFIG.timeout
                    )
                ),
            ]);

            log(
                "info",
                `Task ${task.id} completed successfully on attempt ${attempt}`
            );
            return result;
        } catch (error) {
            lastError = error;
            log(
                "warn",
                `Task ${task.id} failed on attempt ${attempt}:`,
                error.message
            );

            if (
                attempt < WORKER_CONFIG.maxRetries &&
                !isNonRetryableError(error)
            ) {
                await new Promise((resolve) =>
                    setTimeout(resolve, WORKER_CONFIG.retryDelay * attempt)
                );
                continue;
            }
            break;
        }
    }

    throw lastError;
}

// Determine if error should not be retried
function isNonRetryableError(error) {
    const nonRetryableCodes = [
        "INVALID_INPUT",
        "PERMISSION_DENIED",
        "FILE_TOO_LARGE",
        "UNSUPPORTED_TYPE",
    ];
    return nonRetryableCodes.includes(error.code);
}

// Handle messages from main thread with enhanced error handling
if (parentPort) {
    parentPort.on("message", async (task) => {
        if (isShuttingDown) {
            parentPort.postMessage({
                success: false,
                taskId: task.id,
                error: "Worker is shutting down",
                code: "SHUTTING_DOWN",
            });
            return;
        }

        const startTime = Date.now();
        taskQueue.set(task.id, { task, startTime });

        try {
            log("info", `Processing task ${task.id} of type ${task.type}`);

            // Validate task
            validateTask(task);

            const result = await processTaskWithRetry(task);

            parentPort.postMessage({
                success: true,
                taskId: task.id,
                result: result,
                executionTime: Date.now() - startTime,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            log("error", `Error processing task ${task.id}:`, error);

            parentPort.postMessage({
                success: false,
                taskId: task.id,
                error: error.message,
                code: error.code || "UNKNOWN_ERROR",
                details: error.details || {},
                executionTime: Date.now() - startTime,
                timestamp: new Date().toISOString(),
            });
        } finally {
            taskQueue.delete(task.id);
        }
    });

    parentPort.on("error", (error) => {
        log("error", "Worker parent port error:", error);
    });
}

// Enhanced task validation
function validateTask(task) {
    if (!task || typeof task !== "object") {
        throw new IOWorkerError("Invalid task object", "INVALID_INPUT");
    }

    if (!task.id) {
        throw new IOWorkerError("Task ID is required", "INVALID_INPUT");
    }

    if (!task.type) {
        throw new IOWorkerError("Task type is required", "INVALID_INPUT");
    }

    const validTypes = [
        "read",
        "write",
        "validate",
        "delete",
        "process",
        "batch",
    ];
    if (!validTypes.includes(task.type)) {
        throw new IOWorkerError(
            `Invalid task type: ${task.type}`,
            "INVALID_INPUT",
            { validTypes }
        );
    }

    if (!task.data) {
        throw new IOWorkerError("Task data is required", "INVALID_INPUT");
    }
}

/**
 * Enhanced task processing with proper error handling
 */
async function processTask(task) {
    const { type, data } = task;

    switch (type) {
        case "read":
            return await processReadTask(data);
        case "write":
            return await processWriteTask(data);
        case "validate":
            return await processValidateTask(data);
        case "delete":
            return await processDeleteTask(data);
        case "process":
            return await processGenericTask(data);
        case "batch":
            return await processBatchTask(data);
        default:
            throw new IOWorkerError(
                `Unknown task type: ${type}`,
                "INVALID_TASK_TYPE"
            );
    }
}

/**
 * Enhanced read task processing
 */
async function processReadTask(data) {
    const startTime = Date.now();

    try {
        validateReadData(data);

        const operations = [];

        // Read from cache if requested
        if (data.includeCache !== false) {
            operations.push(
                readFromCache(data).catch((error) => {
                    log("warn", "Cache read failed:", error.message);
                    return null;
                })
            );
        }

        // Read configuration if path provided
        if (data.path) {
            operations.push(
                readConfiguration(data.path).catch((error) => {
                    log("warn", "Config read failed:", error.message);
                    return null;
                })
            );
        }

        // Read logs if requested
        if (data.includeLogs) {
            operations.push(
                readRequestLogs(data).catch((error) => {
                    log("warn", "Log read failed:", error.message);
                    return [];
                })
            );
        }

        // Read custom files if specified
        if (data.files && Array.isArray(data.files)) {
            for (const filePath of data.files) {
                operations.push(readFile(filePath));
            }
        }

        const [cacheData, configData, logData, ...fileData] =
            await Promise.allSettled(operations);

        return {
            method: data.method,
            path: data.path,
            query: data.query,
            headers: sanitizeHeaders(data.headers),
            cacheData: getSettledValue(cacheData),
            configData: getSettledValue(configData),
            logData: getSettledValue(logData),
            fileData: fileData.map(getSettledValue),
            processingTime: Date.now() - startTime,
            timestamp: new Date().toISOString(),
        };
    } catch (error) {
        throw new IOWorkerError(
            `Read operation failed: ${error.message}`,
            "READ_FAILED",
            { originalError: error.message }
        );
    }
}

function validateReadData(data) {
    if (data.files && !Array.isArray(data.files)) {
        throw new IOWorkerError("Files must be an array", "INVALID_INPUT");
    }

    if (data.files) {
        for (const filePath of data.files) {
            if (typeof filePath !== "string") {
                throw new IOWorkerError(
                    "File path must be a string",
                    "INVALID_INPUT"
                );
            }
            validateFilePath(filePath);
        }
    }
}

/**
 * Enhanced write task processing
 */
async function processWriteTask(data) {
    const startTime = Date.now();

    try {
        validateWriteData(data);

        const operations = [];
        const results = {};

        // Write to cache if data provided
        if (data.cacheData) {
            operations.push(
                writeToCache({ ...data, data: data.cacheData })
                    .then((result) => ({ type: "cache", result }))
                    .catch((error) => ({ type: "cache", error: error.message }))
            );
        }

        // Write to logs
        if (data.logEntry !== false) {
            operations.push(
                writeToLogs(data)
                    .then((result) => ({ type: "logs", result }))
                    .catch((error) => ({ type: "logs", error: error.message }))
            );
        }

        // Update configuration
        if (data.updateConfig !== false) {
            operations.push(
                updateConfiguration(data)
                    .then((result) => ({ type: "config", result }))
                    .catch((error) => ({
                        type: "config",
                        error: error.message,
                    }))
            );
        }

        // Write custom files if specified
        if (data.files && Array.isArray(data.files)) {
            for (const fileData of data.files) {
                operations.push(
                    writeFile(fileData.path, fileData.content, fileData.options)
                        .then((result) => ({
                            type: "file",
                            path: fileData.path,
                            result,
                        }))
                        .catch((error) => ({
                            type: "file",
                            path: fileData.path,
                            error: error.message,
                        }))
                );
            }
        }

        const operationResults = await Promise.allSettled(operations);

        // Process results
        for (const settledResult of operationResults) {
            const operation =
                settledResult.status === "fulfilled"
                    ? settledResult.value
                    : settledResult.reason;
            results[operation.type] = operation.result || {
                error: operation.error,
            };
        }

        return {
            ...sanitizeData(data),
            results,
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - startTime,
        };
    } catch (error) {
        throw new IOWorkerError(
            `Write operation failed: ${error.message}`,
            "WRITE_FAILED",
            { originalError: error.message }
        );
    }
}

function validateWriteData(data) {
    if (data.files && !Array.isArray(data.files)) {
        throw new IOWorkerError("Files must be an array", "INVALID_INPUT");
    }

    if (data.files) {
        for (const file of data.files) {
            if (!file.path || !file.content) {
                throw new IOWorkerError(
                    "File must have path and content",
                    "INVALID_INPUT"
                );
            }
            validateFilePath(file.path);
        }
    }
}

/**
 * Enhanced validation task processing
 */
async function processValidateTask(data) {
    const startTime = Date.now();

    try {
        const validationResults = {
            fileStructure: await validateFileStructure(data.path),
            permissions: await validatePermissions(data.path),
            content: data.content
                ? await validateContent(data.content, data.schema)
                : null,
            configuration: data.validateConfig
                ? await validateConfiguration()
                : null,
        };

        const isValid = Object.values(validationResults).every(
            (result) => result === null || result.valid === true
        );

        return {
            valid: isValid,
            validationResults,
            data: sanitizeData(data),
            processingTime: Date.now() - startTime,
            timestamp: new Date().toISOString(),
        };
    } catch (error) {
        throw new IOWorkerError(
            `Validation failed: ${error.message}`,
            "VALIDATION_FAILED",
            { originalError: error.message }
        );
    }
}

/**
 * Enhanced delete task processing
 */
async function processDeleteTask(data) {
    const startTime = Date.now();

    try {
        validateDeleteData(data);

        const deleteResults = {
            files: [],
            cache: null,
            logs: null,
        };

        // Delete specified files
        if (data.files && Array.isArray(data.files)) {
            for (const filePath of data.files) {
                try {
                    await deleteFile(filePath);
                    deleteResults.files.push({ path: filePath, deleted: true });
                } catch (error) {
                    deleteResults.files.push({
                        path: filePath,
                        deleted: false,
                        error: error.message,
                    });
                }
            }
        }

        // Clear cache if requested
        if (data.clearCache) {
            try {
                deleteResults.cache = await clearCache(data.cachePattern);
            } catch (error) {
                deleteResults.cache = { cleared: false, error: error.message };
            }
        }

        // Clean logs if requested
        if (data.cleanLogs) {
            try {
                deleteResults.logs = await cleanLogs(
                    data.logRetentionDays || 30
                );
            } catch (error) {
                deleteResults.logs = { cleaned: false, error: error.message };
            }
        }

        return {
            deleteResults,
            data: sanitizeData(data),
            processingTime: Date.now() - startTime,
            timestamp: new Date().toISOString(),
        };
    } catch (error) {
        throw new IOWorkerError(
            `Delete operation failed: ${error.message}`,
            "DELETE_FAILED",
            { originalError: error.message }
        );
    }
}

function validateDeleteData(data) {
    if (data.files && !Array.isArray(data.files)) {
        throw new IOWorkerError("Files must be an array", "INVALID_INPUT");
    }

    if (data.files) {
        for (const filePath of data.files) {
            validateFilePath(filePath);
        }
    }
}

/**
 * Enhanced generic task processing
 */
async function processGenericTask(data) {
    const startTime = Date.now();

    try {
        const operations = [];

        // Custom processing based on operation type
        if (data.operation) {
            switch (data.operation) {
                case "compress":
                    operations.push(compressFiles(data.files));
                    break;
                case "backup":
                    operations.push(
                        createBackup(data.source, data.destination)
                    );
                    break;
                case "sync":
                    operations.push(syncDirectories(data.source, data.target));
                    break;
                case "analyze":
                    operations.push(analyzeFiles(data.files));
                    break;
                default:
                    throw new IOWorkerError(
                        `Unknown operation: ${data.operation}`,
                        "INVALID_OPERATION"
                    );
            }
        }

        const results = await Promise.allSettled(operations);

        return {
            operation: data.operation,
            results: results.map(getSettledValue),
            data: sanitizeData(data),
            processingTime: Date.now() - startTime,
            timestamp: new Date().toISOString(),
        };
    } catch (error) {
        throw new IOWorkerError(
            `Generic operation failed: ${error.message}`,
            "GENERIC_FAILED",
            { originalError: error.message }
        );
    }
}

/**
 * New batch task processing
 */
async function processBatchTask(data) {
    const startTime = Date.now();

    try {
        if (!Array.isArray(data.tasks)) {
            throw new IOWorkerError(
                "Batch tasks must be an array",
                "INVALID_INPUT"
            );
        }

        const batchResults = [];
        const concurrency = data.concurrency || 3;

        // Process tasks in batches
        for (let i = 0; i < data.tasks.length; i += concurrency) {
            const batch = data.tasks.slice(i, i + concurrency);
            const batchPromises = batch.map(async (task, index) => {
                try {
                    const result = await processTask({
                        id: `${data.batchId || "batch"}_${i + index}`,
                        ...task,
                    });
                    return { success: true, result, taskIndex: i + index };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message,
                        code: error.code,
                        taskIndex: i + index,
                    };
                }
            });

            const batchResult = await Promise.allSettled(batchPromises);
            batchResults.push(...batchResult.map(getSettledValue));
        }

        const successful = batchResults.filter((r) => r.success).length;
        const failed = batchResults.length - successful;

        return {
            batchId: data.batchId,
            totalTasks: data.tasks.length,
            successful,
            failed,
            results: batchResults,
            processingTime: Date.now() - startTime,
            timestamp: new Date().toISOString(),
        };
    } catch (error) {
        throw new IOWorkerError(
            `Batch operation failed: ${error.message}`,
            "BATCH_FAILED",
            { originalError: error.message }
        );
    }
}

// ===== ENHANCED I/O UTILITY FUNCTIONS =====

/**
 * Enhanced cache operations with better error handling
 */
async function readFromCache(data) {
    try {
        const cacheKey = generateCacheKey(data);
        const cachePath = path.join(WORKER_CONFIG.cacheDir, `${cacheKey}.json`);

        if (!(await fileExists(cachePath))) {
            return null;
        }

        const stats = await fs.stat(cachePath);

        // Check if cache is expired
        if (data.cacheMaxAge) {
            const ageMs = Date.now() - stats.mtime.getTime();
            if (ageMs > data.cacheMaxAge * 1000) {
                log("debug", "Cache expired for key:", cacheKey);
                return null;
            }
        }

        const cacheContent = await fs.readFile(cachePath, "utf8");
        const parsed = JSON.parse(cacheContent);

        return {
            ...parsed,
            cached: true,
            cacheAge: Date.now() - stats.mtime.getTime(),
            cacheKey,
        };
    } catch (error) {
        log("warn", "Cache read failed:", error.message);
        return null;
    }
}

async function writeToCache(data) {
    try {
        const cacheKey = generateCacheKey(data);
        const cachePath = path.join(WORKER_CONFIG.cacheDir, `${cacheKey}.json`);

        const cacheData = {
            ...data,
            cachedAt: new Date().toISOString(),
            cacheKey,
        };

        await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2));

        const stats = await fs.stat(cachePath);

        return {
            success: true,
            path: cachePath,
            size: stats.size,
            cacheKey,
        };
    } catch (error) {
        log("error", "Cache write failed:", error.message);
        throw new IOWorkerError("Cache write failed", "CACHE_WRITE_FAILED", {
            originalError: error.message,
        });
    }
}

/**
 * Enhanced configuration operations
 */
async function readConfiguration(requestPath) {
    try {
        const configPath = path.join(WORKER_CONFIG.configDir, "routes.json");

        if (!(await fileExists(configPath))) {
            return null;
        }

        const configContent = await fs.readFile(configPath, "utf8");
        const config = JSON.parse(configContent);

        return config[requestPath] || null;
    } catch (error) {
        log("warn", "Config read failed:", error.message);
        return null;
    }
}

async function updateConfiguration(data) {
    try {
        const configPath = path.join(WORKER_CONFIG.configDir, "routes.json");
        let config = {};

        if (await fileExists(configPath)) {
            const configContent = await fs.readFile(configPath, "utf8");
            config = JSON.parse(configContent);
        }

        // Update configuration with enhanced metadata
        config[data.path] = {
            lastAccessed: new Date().toISOString(),
            method: data.method,
            headers: sanitizeHeaders(data.headers),
            accessCount: (config[data.path]?.accessCount || 0) + 1,
            userAgent: data.headers?.["user-agent"]?.substring(0, 100), // Truncate for security
        };

        await fs.writeFile(configPath, JSON.stringify(config, null, 2));

        const stats = await fs.stat(configPath);

        return {
            success: true,
            path: configPath,
            size: stats.size,
            updatedPath: data.path,
        };
    } catch (error) {
        log("error", "Config update failed:", error.message);
        throw new IOWorkerError(
            "Config update failed",
            "CONFIG_UPDATE_FAILED",
            { originalError: error.message }
        );
    }
}

/**
 * Enhanced logging operations
 */
async function writeToLogs(data) {
    try {
        const logPath = path.join(WORKER_CONFIG.logsDir, "requests.log");

        const logEntry = {
            timestamp: new Date().toISOString(),
            method: data.method,
            path: data.path,
            statusCode: data.statusCode,
            responseTime: data.responseTime,
            userAgent: data.headers?.["user-agent"]?.substring(0, 100),
            ip: data.ip || "unknown",
        };

        const logLine = JSON.stringify(logEntry) + "\n";

        await fs.appendFile(logPath, logLine);

        // Rotate log if it gets too large
        const stats = await fs.stat(logPath);
        if (stats.size > 10 * 1024 * 1024) {
            // 10MB
            await rotateLog(logPath);
        }

        return {
            success: true,
            path: logPath,
            size: stats.size,
        };
    } catch (error) {
        log("error", "Log write failed:", error.message);
        throw new IOWorkerError("Log write failed", "LOG_WRITE_FAILED", {
            originalError: error.message,
        });
    }
}

async function readRequestLogs(data) {
    try {
        const logPath = path.join(WORKER_CONFIG.logsDir, "requests.log");

        if (!(await fileExists(logPath))) {
            return [];
        }

        const logContent = await fs.readFile(logPath, "utf8");
        const lines = logContent
            .split("\n")
            .filter((line) => line.trim())
            .filter((line) => {
                try {
                    const entry = JSON.parse(line);
                    return data.path ? entry.path?.includes(data.path) : true;
                } catch {
                    return line.includes(data.path || "");
                }
            })
            .slice(-(data.limit || 10))
            .map((line) => {
                try {
                    return JSON.parse(line);
                } catch {
                    return line;
                }
            });

        return lines;
    } catch (error) {
        log("warn", "Log read failed:", error.message);
        return [];
    }
}

// ===== ADDITIONAL UTILITY FUNCTIONS =====

/**
 * General file operations
 */
async function readFile(filePath) {
    validateFilePath(filePath);

    const stats = await fs.stat(filePath);

    if (stats.size > WORKER_CONFIG.maxFileSize) {
        throw new IOWorkerError("File too large", "FILE_TOO_LARGE", {
            size: stats.size,
            maxSize: WORKER_CONFIG.maxFileSize,
        });
    }

    const content = await fs.readFile(filePath, "utf8");

    return {
        path: filePath,
        content,
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime,
    };
}

async function writeFile(filePath, content, options = {}) {
    validateFilePath(filePath);

    if (Buffer.byteLength(content, "utf8") > WORKER_CONFIG.maxFileSize) {
        throw new IOWorkerError("Content too large", "CONTENT_TOO_LARGE");
    }

    await ensureDirectoryExists(path.dirname(filePath));
    await fs.writeFile(filePath, content, options.encoding || "utf8");

    const stats = await fs.stat(filePath);

    return {
        path: filePath,
        size: stats.size,
        written: true,
    };
}

async function deleteFile(filePath) {
    validateFilePath(filePath);

    if (!(await fileExists(filePath))) {
        return { deleted: false, reason: "File does not exist" };
    }

    await fs.unlink(filePath);
    return { deleted: true, path: filePath };
}

/**
 * Validation functions
 */
async function validateFileStructure(basePath) {
    if (!basePath) return { valid: true };

    try {
        const stats = await fs.stat(basePath);
        return {
            valid: true,
            isDirectory: stats.isDirectory(),
            isFile: stats.isFile(),
            size: stats.size,
            permissions: (stats.mode & parseInt("777", 8)).toString(8),
        };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

async function validatePermissions(filePath) {
    if (!filePath) return { valid: true };

    try {
        await fs.access(filePath, fs.constants.R_OK | fs.constants.W_OK);
        return { valid: true, readable: true, writable: true };
    } catch (error) {
        try {
            await fs.access(filePath, fs.constants.R_OK);
            return { valid: true, readable: true, writable: false };
        } catch {
            return { valid: false, readable: false, writable: false };
        }
    }
}

async function validateContent(content, schema) {
    if (!schema) return { valid: true };

    try {
        // Basic JSON validation
        if (schema.type === "json") {
            JSON.parse(content);
            return { valid: true, type: "json" };
        }

        // Add more content validation as needed
        return { valid: true, type: "unknown" };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

async function validateConfiguration() {
    const configPath = path.join(WORKER_CONFIG.configDir, "routes.json");

    try {
        if (!(await fileExists(configPath))) {
            return { valid: false, error: "Configuration file not found" };
        }

        const content = await fs.readFile(configPath, "utf8");
        JSON.parse(content); // Validate JSON

        return { valid: true };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

/**
 * Advanced operations
 */
async function clearCache(pattern = "*") {
    const cacheDir = WORKER_CONFIG.cacheDir;
    const files = await fs.readdir(cacheDir);

    let cleared = 0;
    const errors = [];

    for (const file of files) {
        if (pattern === "*" || file.includes(pattern)) {
            try {
                await fs.unlink(path.join(cacheDir, file));
                cleared++;
            } catch (error) {
                errors.push({ file, error: error.message });
            }
        }
    }

    return { cleared, errors, totalFiles: files.length };
}

async function cleanLogs(retentionDays = 30) {
    const logsDir = WORKER_CONFIG.logsDir;
    const cutoffDate = new Date(
        Date.now() - retentionDays * 24 * 60 * 60 * 1000
    );

    try {
        const files = await fs.readdir(logsDir);
        let cleaned = 0;
        const errors = [];

        for (const file of files) {
            if (file.endsWith(".log")) {
                const filePath = path.join(logsDir, file);
                try {
                    const stats = await fs.stat(filePath);
                    if (stats.mtime < cutoffDate) {
                        await fs.unlink(filePath);
                        cleaned++;
                    }
                } catch (error) {
                    errors.push({ file, error: error.message });
                }
            }
        }

        return { cleaned, errors, retentionDays };
    } catch (error) {
        throw new IOWorkerError("Log cleanup failed", "LOG_CLEANUP_FAILED", {
            originalError: error.message,
        });
    }
}

async function rotateLog(logPath) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const rotatedPath = `${logPath}.${timestamp}`;

        await fs.rename(logPath, rotatedPath);
        log("info", `Log rotated: ${rotatedPath}`);

        return { rotated: true, newPath: rotatedPath };
    } catch (error) {
        log("error", "Log rotation failed:", error.message);
        throw new IOWorkerError("Log rotation failed", "LOG_ROTATION_FAILED", {
            originalError: error.message,
        });
    }
}

async function compressFiles(files) {
    // TODO: Implementation for file compression would go here
    // This is a placeholder for actual compression logic
    // @iDevo, if you can, do that plse.
    throw new IOWorkerError(
        "Compression not yet implemented",
        "NOT_IMPLEMENTED"
    );
}

async function createBackup(source, destination) {
    try {
        validateFilePath(source);
        validateFilePath(destination);

        await ensureDirectoryExists(path.dirname(destination));

        const sourceStats = await fs.stat(source);
        if (sourceStats.isDirectory()) {
            await copyDirectory(source, destination);
        } else {
            await fs.copyFile(source, destination);
        }

        const destStats = await fs.stat(destination);

        return {
            success: true,
            source,
            destination,
            size: destStats.size,
            created: new Date().toISOString(),
        };
    } catch (error) {
        throw new IOWorkerError("Backup creation failed", "BACKUP_FAILED", {
            source,
            destination,
            originalError: error.message,
        });
    }
}

async function copyDirectory(source, destination) {
    await ensureDirectoryExists(destination);

    const entries = await fs.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(source, entry.name);
        const destPath = path.join(destination, entry.name);

        if (entry.isDirectory()) {
            await copyDirectory(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}

async function syncDirectories(source, target) {
    try {
        validateFilePath(source);
        validateFilePath(target);

        await ensureDirectoryExists(target);

        const sourceFiles = await getDirectoryFiles(source);
        const targetFiles = await getDirectoryFiles(target);

        const operations = {
            copied: 0,
            updated: 0,
            deleted: 0,
            errors: [],
        };

        // Copy new and updated files
        for (const file of sourceFiles) {
            const sourcePath = path.join(source, file);
            const targetPath = path.join(target, file);

            try {
                const sourceStats = await fs.stat(sourcePath);
                let shouldCopy = true;

                if (targetFiles.includes(file)) {
                    const targetStats = await fs.stat(targetPath);
                    shouldCopy = sourceStats.mtime > targetStats.mtime;
                }

                if (shouldCopy) {
                    await ensureDirectoryExists(path.dirname(targetPath));
                    await fs.copyFile(sourcePath, targetPath);

                    if (targetFiles.includes(file)) {
                        operations.updated++;
                    } else {
                        operations.copied++;
                    }
                }
            } catch (error) {
                operations.errors.push({
                    file,
                    operation: "copy",
                    error: error.message,
                });
            }
        }

        // Remove files that don't exist in source
        for (const file of targetFiles) {
            if (!sourceFiles.includes(file)) {
                try {
                    await fs.unlink(path.join(target, file));
                    operations.deleted++;
                } catch (error) {
                    operations.errors.push({
                        file,
                        operation: "delete",
                        error: error.message,
                    });
                }
            }
        }

        return {
            success: true,
            source,
            target,
            operations,
            timestamp: new Date().toISOString(),
        };
    } catch (error) {
        throw new IOWorkerError("Directory sync failed", "SYNC_FAILED", {
            source,
            target,
            originalError: error.message,
        });
    }
}

async function getDirectoryFiles(dirPath) {
    const files = [];

    async function traverse(currentPath, relativePath = "") {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            const relativeFilePath = path.join(relativePath, entry.name);

            if (entry.isDirectory()) {
                await traverse(fullPath, relativeFilePath);
            } else {
                files.push(relativeFilePath);
            }
        }
    }

    await traverse(dirPath);
    return files;
}

async function analyzeFiles(files) {
    try {
        const analysis = {
            totalFiles: 0,
            totalSize: 0,
            fileTypes: {},
            largestFile: null,
            oldestFile: null,
            newestFile: null,
            errors: [],
        };

        for (const filePath of files) {
            try {
                validateFilePath(filePath);

                const stats = await fs.stat(filePath);
                const ext =
                    path.extname(filePath).toLowerCase() || "no-extension";

                analysis.totalFiles++;
                analysis.totalSize += stats.size;

                // Track file types
                analysis.fileTypes[ext] = (analysis.fileTypes[ext] || 0) + 1;

                // Track largest file
                if (
                    !analysis.largestFile ||
                    stats.size > analysis.largestFile.size
                ) {
                    analysis.largestFile = { path: filePath, size: stats.size };
                }

                // Track oldest file
                if (
                    !analysis.oldestFile ||
                    stats.mtime < analysis.oldestFile.mtime
                ) {
                    analysis.oldestFile = {
                        path: filePath,
                        mtime: stats.mtime,
                    };
                }

                // Track newest file
                if (
                    !analysis.newestFile ||
                    stats.mtime > analysis.newestFile.mtime
                ) {
                    analysis.newestFile = {
                        path: filePath,
                        mtime: stats.mtime,
                    };
                }
            } catch (error) {
                analysis.errors.push({ file: filePath, error: error.message });
            }
        }

        return {
            success: true,
            analysis,
            timestamp: new Date().toISOString(),
        };
    } catch (error) {
        throw new IOWorkerError("File analysis failed", "ANALYSIS_FAILED", {
            originalError: error.message,
        });
    }
}

// ===== UTILITY HELPER FUNCTIONS =====

/**
 * Enhanced cache key generation with better security
 */
function generateCacheKey(data) {
    const keyParts = [
        data.method || "GET",
        data.path || "/",
        JSON.stringify(data.query || {}),
        data.headers?.["authorization"] ? "auth" : "noauth",
        data.userId || "anonymous",
    ];

    const rawKey = keyParts.join("_");

    // Create a hash for security and length consistency
    return crypto
        .createHash("sha256")
        .update(rawKey)
        .digest("hex")
        .substring(0, 32);
}

/**
 * Enhanced file existence check with proper error handling
 */
async function fileExists(filePath) {
    try {
        await fs.access(filePath, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

/**
 * Enhanced directory creation with proper permissions
 */
async function ensureDirectoryExists(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true, mode: 0o755 });
    } catch (error) {
        if (error.code !== "EEXIST") {
            throw new IOWorkerError(
                `Failed to create directory: ${dirPath}`,
                "DIR_CREATE_FAILED",
                {
                    originalError: error.message,
                }
            );
        }
    }
}

/**
 * File path validation for security
 */
function validateFilePath(filePath) {
    if (!filePath || typeof filePath !== "string") {
        throw new IOWorkerError("Invalid file path", "INVALID_PATH");
    }

    // Prevent directory traversal attacks
    if (filePath.includes("..") || filePath.includes("~")) {
        throw new IOWorkerError("Path traversal not allowed", "INVALID_PATH");
    }

    // Check file extension if restrictions are enabled
    if (WORKER_CONFIG.allowedExtensions.length > 0) {
        const ext = path.extname(filePath).toLowerCase();
        if (!WORKER_CONFIG.allowedExtensions.includes(ext)) {
            throw new IOWorkerError(
                `File extension not allowed: ${ext}`,
                "UNSUPPORTED_TYPE",
                {
                    allowedExtensions: WORKER_CONFIG.allowedExtensions,
                }
            );
        }
    }

    // Ensure path is within allowed boundaries
    const resolvedPath = path.resolve(filePath);
    const workingDir = process.cwd();

    if (!resolvedPath.startsWith(workingDir)) {
        throw new IOWorkerError(
            "Path outside working directory not allowed",
            "INVALID_PATH"
        );
    }
}

/**
 * Sanitize sensitive data before logging or returning
 */
function sanitizeData(data) {
    if (!data || typeof data !== "object") return data;

    const sanitized = { ...data };

    // Remove sensitive fields
    const sensitiveFields = ["password", "token", "apiKey", "secret", "auth"];

    for (const field of sensitiveFields) {
        if (sanitized[field]) {
            sanitized[field] = "[REDACTED]";
        }
    }

    return sanitized;
}

/**
 * Sanitize HTTP headers
 */
function sanitizeHeaders(headers) {
    if (!headers || typeof headers !== "object") return headers;

    const sanitized = { ...headers };

    // Sanitize sensitive headers
    if (sanitized.authorization) {
        sanitized.authorization = "[REDACTED]";
    }

    if (sanitized.cookie) {
        sanitized.cookie = "[REDACTED]";
    }

    return sanitized;
}

/**
 * Get value from settled promise result
 */
function getSettledValue(settledResult) {
    if (settledResult.status === "fulfilled") {
        return settledResult.value;
    } else {
        return { error: settledResult.reason?.message || "Unknown error" };
    }
}

// ===== WORKER LIFECYCLE MANAGEMENT =====

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal) {
    log("info", `Received ${signal}, initiating graceful shutdown`);
    isShuttingDown = true;

    // Wait for current tasks to complete
    const maxWaitTime = 10000; // 10 seconds
    const startTime = Date.now();

    while (taskQueue.size > 0 && Date.now() - startTime < maxWaitTime) {
        log("info", `Waiting for ${taskQueue.size} tasks to complete`);
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (taskQueue.size > 0) {
        log(
            "warn",
            `Forcefully shutting down with ${taskQueue.size} tasks remaining`
        );
    }

    log("info", "I/O Worker shutdown complete");
    process.exit(0);
}

// Enhanced signal handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
    log("error", "Uncaught exception in I/O Worker:", error);

    if (parentPort) {
        parentPort.postMessage({
            type: "error",
            error: "Worker uncaught exception",
            details: error.message,
        });
    }

    gracefulShutdown("UNCAUGHT_EXCEPTION");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
    log("error", "Unhandled promise rejection in I/O Worker:", reason);

    if (parentPort) {
        parentPort.postMessage({
            type: "error",
            error: "Worker unhandled rejection",
            details: reason?.message || "Unknown rejection",
        });
    }
});

// ===== WORKER INITIALIZATION AND READY SIGNAL =====

// Initialize worker and signal readiness
(async () => {
    try {
        await initializeWorker();

        if (parentPort) {
            parentPort.postMessage({
                type: "ready",
                workerType: "io",
                config: {
                    maxFileSize: WORKER_CONFIG.maxFileSize,
                    allowedExtensions: WORKER_CONFIG.allowedExtensions,
                    timeout: WORKER_CONFIG.timeout,
                    maxRetries: WORKER_CONFIG.maxRetries,
                },
                timestamp: new Date().toISOString(),
            });
        }
    } catch (error) {
        log("error", "Worker initialization failed:", error);

        if (parentPort) {
            parentPort.postMessage({
                type: "error",
                error: "Worker initialization failed",
                details: error.message,
            });
        }

        process.exit(1);
    }
})();

// Export for testing purposes (if running in test environment)
if (process.env.NODE_ENV === "test") {
    module.exports = {
        processTask,
        validateTask,
        generateCacheKey,
        sanitizeData,
        sanitizeHeaders,
        IOWorkerError,
    };
}


