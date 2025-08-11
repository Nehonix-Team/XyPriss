export class Logger {
    constructor(config) {
        const defaultConfig = {
            enabled: true,
            level: "info",
            components: {
                server: true,
                cache: true,
                cluster: true,
                performance: true,
                fileWatcher: true,
                plugins: true,
                security: true,
                monitoring: true,
                routes: true,
                userApp: true,
                console: false, // Console interception system logs (can be verbose)
                ipc: true, // Inter-process communication logs
                memory: true, // Memory monitoring and detection logs
                lifecycle: true, // Server lifecycle management logs
                routing: true, // Fast routing system logs
            },
            types: {
                startup: true,
                warnings: true,
                errors: true,
                performance: true,
                debug: false,
                hotReload: true,
                portSwitching: true,
            },
            format: {
                timestamps: false,
                colors: true,
                prefix: true,
                compact: false,
            },
        };
        this.config = this.deepMerge(defaultConfig, config || {});
    }
    /**
     * Get or create singleton instance
     */
    static getInstance(config) {
        if (!Logger.instance) {
            Logger.instance = new Logger(config);
        }
        else if (config) {
            Logger.instance.updateConfig(config);
        }
        return Logger.instance;
    }
    /**
     * Deep merge two objects
     */
    deepMerge(target, source) {
        const result = { ...target };
        for (const key in source) {
            if (source[key] &&
                typeof source[key] === "object" &&
                !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            }
            else {
                result[key] = source[key];
            }
        }
        return result;
    }
    /**
     * Update logger configuration
     */
    updateConfig(config) {
        this.config = this.deepMerge(this.config, config || {});
    }
    /**
     * Get current logger configuration (for debugging)
     */
    getConfig() {
        return this.config;
    }
    /**
     * Check if logging is enabled for a specific component and type
     */
    shouldLog(level, component, type) {
        // Master switch
        if (!this.config?.enabled)
            return false;
        // Silent mode
        // if (this.config?.level === "silent") return false;
        // Always show errors unless silent
        if (level === "error" &&
            this.config?.level &&
            this.config?.level !== "silent")
            return true;
        // Check log level hierarchy
        const levels = [
            "error",
            "warn",
            "info",
            "debug",
            "verbose",
        ];
        const currentLevelIndex = levels.indexOf(this.config?.level);
        const messageLevelIndex = levels.indexOf(level);
        if (messageLevelIndex > currentLevelIndex)
            return false;
        // Check component-specific settings
        if (this.config?.components &&
            this.config?.components[component] === false)
            return false;
        // Check type-specific settings
        if (type && this.config?.types && this.config?.types[type] === false)
            return false;
        return true;
    }
    /**
     * Format log message
     */
    formatMessage(level, component, message) {
        const colors = {
            error: "\x1b[31m", // Red
            warn: "\x1b[33m", // Yellow
            info: "\x1b[36m", // Cyan
            debug: "\x1b[35m", // Magenta
            verbose: "\x1b[37m", // White
            reset: "\x1b[0m", // Reset
            sys: "\x1b[32m",
        };
        let formatted = message;
        if (this.config?.format?.prefix && !this.config?.format?.compact) {
            const prefix = `[${component === "server"
                ? "SYSTEM".toUpperCase()
                : component.toUpperCase()}]`;
            if (level === "silent") {
                formatted = `${prefix} ${message}`;
            }
            else {
                if (component === "server") {
                    const color = colors[level] || colors.info;
                    formatted = `${colors.sys}${prefix}${colors.reset} ${color}${message}${colors.reset}`;
                }
                else {
                    formatted = `${prefix} ${message}`;
                }
            }
        }
        if (this.config?.format?.timestamps) {
            const timestamp = new Date().toISOString();
            formatted = `${timestamp} ${formatted}`;
        }
        if (this.config?.format?.colors &&
            level !== "silent" &&
            typeof process !== "undefined" &&
            process.stdout?.isTTY) {
            const color = colors[level] || colors.info;
            formatted = `${color}${formatted}${colors.reset}`;
        }
        return formatted;
    }
    /**
     * Log a message
     */
    log(level, component, type, message, ...args) {
        if (!this.shouldLog(level, component, type))
            return;
        if (this.config?.customLogger) {
            this.config?.customLogger(level, component, message, ...args);
            return;
        }
        const formatted = this.formatMessage(level, component, message);
        switch (level) {
            case "error":
                console.error(formatted, ...args);
                break;
            case "warn":
                console.warn(formatted, ...args);
                break;
            default:
                console.log(formatted, ...args);
                break;
        }
    }
    // Public logging methods
    error(component, message, ...args) {
        this.log("error", component, "errors", message, ...args);
    }
    warn(component, message, ...args) {
        this.log("warn", component, "warnings", message, ...args);
    }
    info(component, message, ...args) {
        this.log("info", component, undefined, message, ...args);
    }
    debug(component, message, ...args) {
        this.log("debug", component, "debug", message, ...args);
    }
    startup(component, message, ...args) {
        this.log("info", component, "startup", message, ...args);
    }
    performance(component, message, ...args) {
        this.log("info", component, "performance", message, ...args);
    }
    hotReload(component, message, ...args) {
        this.log("info", component, "hotReload", message, ...args);
    }
    portSwitching(component, message, ...args) {
        this.log("info", component, "portSwitching", message, ...args);
    }
    securityWarning(message, ...args) {
        this.log("warn", "security", "warnings", message, ...args);
    }
    // Utility methods
    isEnabled() {
        return this.config?.enabled || false;
    }
    getLevel() {
        return this.config?.level || "info";
    }
    isComponentEnabled(component) {
        return this.config?.components?.[component] !== false;
    }
    isTypeEnabled(type) {
        return this.config?.types?.[type] !== false;
    }
}
/**
 * Global logger instance
 */
export const logger = Logger.getInstance();
/**
 * Initialize logger with configuration
 */
export function initializeLogger(config) {
    return Logger.getInstance(config);
}
//# sourceMappingURL=Logger.js.map