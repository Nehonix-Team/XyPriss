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
    ACCESS_CONFIGS: "PLG.SECURITY.ACCESS_CONFIGS",
    ACCESS_SENSITIVE_DATA: "PLG.SECURITY.ACCESS_SENSITIVE_DATA",

    // Metrics & Monitoring Hooks
    ON_RESPONSE_TIME: "PLG.METRICS.RESPONSE_TIME",
    ON_ROUTE_ERROR: "PLG.METRICS.ROUTE_ERROR",

    // Routing & Middleware
    REGISTER_ROUTES: "PLG.ROUTING.REGISTER_ROUTES",
    MIDDLEWARE: "PLG.HTTP.MIDDLEWARE",

    // Management Hooks
    MANAGE_PLUGINS: "PLG.MANAGEMENT.MANAGE_PLUGINS",

    // Ops Hooks
    ON_AUXILIARY_SERVER_DEPLOY: "PLG.OPS.AUXILIARY_SERVER",

    // Logging Hooks
    ON_CONSOLE_INTERCEPT: "PLG.LOGGING.CONSOLE_INTERCEPT",
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

    // Management
    managePlugins: PluginHookIds.MANAGE_PLUGINS,

    // Ops
    onAuxiliaryServerDeploy: PluginHookIds.ON_AUXILIARY_SERVER_DEPLOY,

    // Logging
    onConsoleIntercept: PluginHookIds.ON_CONSOLE_INTERCEPT,

    // Security (Permissions only)
    configs: PluginHookIds.ACCESS_CONFIGS,
    sensitiveData: PluginHookIds.ACCESS_SENSITIVE_DATA,
};

/**
 * Detailed metadata for each plugin hook.
 * Used for descriptive error messages and documentation.
 */
export const HOOK_METADATA: Record<
    string,
    { name: string; action: string; description: string }
> = {
    [PluginHookIds.ON_REGISTER]: {
        name: "Plugin Registration",
        action: "register itself with the system",
        description: "Executed when the plugin is first added to the server.",
    },
    [PluginHookIds.ON_SERVER_START]: {
        name: "Server Startup",
        action: "participate in server initialization",
        description: "Executed during the initial phase of server startup.",
    },
    [PluginHookIds.ON_SERVER_READY]: {
        name: "Server Ready Alert",
        action: "execute logic after the server is fully ready",
        description: "Executed once the server is listening for connections.",
    },
    [PluginHookIds.ON_SERVER_STOP]: {
        name: "Server Shutdown",
        action: "perform cleanup during shutdown",
        description: "Executed when the server is closing down.",
    },
    [PluginHookIds.ON_REQUEST]: {
        name: "Request Interception",
        action: "intercept and process incoming requests",
        description: "Executed for every incoming HTTP request.",
    },
    [PluginHookIds.ON_RESPONSE]: {
        name: "Response Interception",
        action: "intercept and process outgoing responses",
        description: "Executed just before the response is sent to the client.",
    },
    [PluginHookIds.ON_ERROR]: {
        name: "Error Handling",
        action: "capture and handle application errors",
        description:
            "Executed when an unhandled error occurs during a request.",
    },
    [PluginHookIds.ON_SECURITY_ATTACK]: {
        name: "Security Attack Monitoring",
        action: "monitor and respond to security threats",
        description: "Executed when a potential security attack is detected.",
    },
    [PluginHookIds.ON_RATE_LIMIT]: {
        name: "Rate Limit Tracking",
        action: "respond to rate-limiting events",
        description: "Executed when a client exceeds request rate limits.",
    },
    [PluginHookIds.ON_RESPONSE_TIME]: {
        name: "Performance Monitoring",
        action: "track request response times",
        description: "Provides performance data for every completed request.",
    },
    [PluginHookIds.ON_ROUTE_ERROR]: {
        name: "Route Error Tracking",
        action: "monitor specific route failures",
        description: "Executed when a specific route execution fails.",
    },
    [PluginHookIds.REGISTER_ROUTES]: {
        name: "API Route Registration",
        action: "register its own API endpoints",
        description: "Allows the plugin to add new routes to the application.",
    },
    [PluginHookIds.MIDDLEWARE]: {
        name: "Middleware Injection",
        action: "inject global middleware into the pipe",
        description: "Allows the plugin to add middleware to the request flow.",
    },
    [PluginHookIds.MANAGE_PLUGINS]: {
        name: "Plugin Orchestration",
        action: "manage or configure other plugins",
        description:
            "Privileged: Allows a plugin to influence other plugins in the system.",
    },
    [PluginHookIds.ON_AUXILIARY_SERVER_DEPLOY]: {
        name: "Auxiliary Server Deployment",
        action: "deploy an isolated server",
        description:
            "Privileged: Allows creating independent servers (e.g., Swagger, Admin Panel).",
    },
    [PluginHookIds.ON_CONSOLE_INTERCEPT]: {
        name: "Console Logging Interception",
        action: "intercept and process console output",
        description:
            "Privileged: Allows the plugin to capture all console activity.",
    },
    [PluginHookIds.ACCESS_CONFIGS]: {
        name: "Server Configuration Access",
        action: "read the full server configuration",
        description:
            "Privileged: Allows reading sensitive server settings and environmental data.",
    },
    [PluginHookIds.ACCESS_SENSITIVE_DATA]: {
        name: "Sensitive Request Data Access",
        action: "read sensitive request data like body, query, and cookies",
        description:
            "Privileged: Allows reading unmasked request data containing potentially sensitive information (PII, tokens, etc).",
    },
};

export type PluginHookId = (typeof PluginHookIds)[keyof typeof PluginHookIds];

