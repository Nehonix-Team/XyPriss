/**
 * Plugin Hook Identifiers
 *
 * Defines the unique identifiers for all plugin hooks used in the permission system.
 * These IDs are used in the server configuration to allow/deny specific hooks.
 */

export const PluginHookIds = {
    // Lifecycle Hooks
    ON_REGISTER: "PLG.LIFECYCLE.REGISTER",
    ON_SERVER_START: "PLG.LIFECYCLE.SERVER_START",
    ON_SERVER_READY: "PLG.LIFECYCLE.SERVER_READY",
    ON_SERVER_STOP: "PLG.LIFECYCLE.SERVER_STOP",

    // HTTP Request/Response Hooks
    ON_REQUEST: "PLG.HTTP.ON_REQUEST",
    ON_RESPONSE: "PLG.HTTP.ON_RESPONSE",
    ON_ERROR: "PLG.HTTP.ON_ERROR",

    // Security Hooks
    ON_SECURITY_ATTACK: "PLG.SECURITY.ATTACK_DETECTED",
    ON_RATE_LIMIT: "PLG.SECURITY.RATE_LIMIT",

    // Metrics & Monitoring Hooks
    ON_RESPONSE_TIME: "PLG.METRICS.RESPONSE_TIME",
    ON_ROUTE_ERROR: "PLG.METRICS.ROUTE_ERROR",

    // Routing & Middleware
    REGISTER_ROUTES: "PLG.ROUTING.REGISTER_ROUTES",
    MIDDLEWARE: "PLG.HTTP.MIDDLEWARE",
} as const;

/**
 * Mapping from internal hook method names to public PluginHookIds
 */
export const HOOK_ID_MAP: Record<string, string> = {
    // Lifecycle
    onRegister: PluginHookIds.ON_REGISTER,
    onServerStart: PluginHookIds.ON_SERVER_START,
    onServerReady: PluginHookIds.ON_SERVER_READY,
    onServerStop: PluginHookIds.ON_SERVER_STOP,

    // HTTP
    onRequest: PluginHookIds.ON_REQUEST,
    onResponse: PluginHookIds.ON_RESPONSE,
    onError: PluginHookIds.ON_ERROR,

    // Security
    onSecurityAttack: PluginHookIds.ON_SECURITY_ATTACK,
    onRateLimit: PluginHookIds.ON_RATE_LIMIT,

    // Metrics
    onResponseTime: PluginHookIds.ON_RESPONSE_TIME,
    onRouteError: PluginHookIds.ON_ROUTE_ERROR,

    // Routing
    registerRoutes: PluginHookIds.REGISTER_ROUTES,

    // Middleware property (special case)
    middleware: PluginHookIds.MIDDLEWARE,
};

export type PluginHookId = (typeof PluginHookIds)[keyof typeof PluginHookIds];

