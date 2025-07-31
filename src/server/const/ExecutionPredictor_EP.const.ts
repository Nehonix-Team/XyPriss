// Bitwise flags for ultra-fast classification
const CLASSIFICATION_FLAGS = {
    ULTRA_FAST: 1,
    FAST: 2,
    STANDARD: 4,
    HAS_PARAMS: 8,
    HAS_QUERY: 16,
    HAS_BODY: 32,
    IS_GET: 64,
    IS_POST: 128,
    IS_STATIC: 256,
    IS_HEALTH: 512,
} as const;

// Pre-compiled regexes for static content (compiled once)
const STATIC_FILE_REGEX = /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$/;
const PING_REGEX = /ping/;
const STATUS_REGEX = /status/;
const CONFIG_REGEX = /config/;

// Static lookup tables for O(1) access
const HEALTH_ROUTES = new Set([
    "/health",
    "/XyPriss/health",
    "/status",
    "/ping",
]);

const STATIC_ROUTES = new Set([
    "/",
    "/favicon.ico",
    "/static/config",
    "/api/config",
]);

const SIMPLE_API_ROUTES = new Set([
    "/api/users/:id",
    "/api/user/:id",
    "/api/products",
    "/api/status",
    "/api/config",
]);

// Reusable result objects to avoid allocation
const ULTRA_FAST_RESULT = {
    type: "ultra-fast" as const,
    confidence: 0.95,
    executionPath: "direct-cache",
    cacheStrategy: "direct" as const,
    skipMiddleware: ["security", "validation", "logging"],
    reason: "Static rule match",
    overhead: 0,
};

const FAST_RESULT = {
    type: "fast" as const,
    confidence: 0.85,
    executionPath: "optimized-cache",
    cacheStrategy: "optimized" as const,
    skipMiddleware: ["heavy-validation"],
    reason: "Fast rule match",
    overhead: 0,
};

const STANDARD_RESULT = {
    type: "standard" as const,
    confidence: 0.5,
    executionPath: "full-pipeline",
    cacheStrategy: "standard" as const,
    skipMiddleware: [],
    reason: "Default classification",
    overhead: 0,
};

export {
    CLASSIFICATION_FLAGS,
    STATIC_FILE_REGEX,
    PING_REGEX,
    STATUS_REGEX,
    CONFIG_REGEX,
    HEALTH_ROUTES,
    STATIC_ROUTES,
    SIMPLE_API_ROUTES,
    ULTRA_FAST_RESULT,
    FAST_RESULT,
    STANDARD_RESULT,
};

