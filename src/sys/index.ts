import { XyPrissFS } from "./System";

// Re-export underlying APIs for type usage
export * from "./PathApi";
export * from "./FSApi";
export * from "./SysApi";
export * from "./System";
export * from "./XyPrissRunner";

/**
 * XyPriss System Variables Class
 *
 * Provides centralized access to system variables, configuration management,
 * and environment utilities for XyPriss applications.
 * Inherits all filesystem and system capabilities from XyPrissFS.
 */
export class XyPrissSys extends XyPrissFS {
    public __version__: string = "0.0.0";
    public __author__: string = "unknown";
    public __description__: string = "A XyPriss application";
    public __app_urls__: Record<string, string> = {};
    public __name__: string = "xypriss-app";
    public __alias__: string = "app";
    public __port__: number = 3000;
    public __PORT__: number = 3000;
    public __env__: string = "development";
    public __root__: string = process.cwd();

    public $plug?: XyPrissFS;
    public $plg?: XyPrissFS;

    /**
     * Environment variables manager.
     */
    public __ENV__ = {
        set: (key: string, value: string): void => {
            process.env[key] = value;
        },
        get: (key: string, defaultValue?: string): string | undefined =>
            process.env[key] || defaultValue,
        has: (key: string): boolean => process.env[key] !== undefined,
        delete: (key: string): void => {
            delete process.env[key];
        },
        all: (): NodeJS.ProcessEnv => process.env,
    };

    [key: string]: any;

    constructor(data: Record<string, any> = {}) {
        // Initialize XyPrissFS with the root directory (defaulting to cwd)
        super({ __root__: data.__root__ || process.cwd() });
        this.$update(data);
    }

    public $update(data: Record<string, any>): void {
        Object.assign(this, data);

        // Sync ports
        if (data.__port__ !== undefined) this.__PORT__ = data.__port__;
        if (data.__PORT__ !== undefined) this.__port__ = data.__PORT__;

        // Legacy support
        if (data.__port !== undefined) {
            this.__port__ = data.__port;
            this.__PORT__ = data.__port;
        }
        if (data.__PORT !== undefined) {
            this.__port__ = data.__PORT;
            this.__PORT__ = data.__PORT;
        }
        if (data.__env !== undefined) this.__env__ = data.__env;
    }

    public $add(key: string, value: any): void {
        this[key] = value;
    }

    public $remove(key: string): boolean {
        if (this.$has(key)) {
            delete this[key];
            return true;
        }
        return false;
    }

    public $toJSON(): Record<string, any> {
        const json: Record<string, any> = {};
        for (const key in this) {
            if (
                !key.startsWith("$") &&
                typeof this[key] !== "function" &&
                key !== "__ENV__"
            ) {
                json[key] = this[key];
            }
        }
        return json;
    }

    public $isProduction(): boolean {
        return this.__env__ === "production";
    }
    public $isDevelopment(): boolean {
        return this.__env__ === "development";
    }
    public $isStaging(): boolean {
        return this.__env__ === "staging";
    }
    public $isTest(): boolean {
        return this.__env__ === "test";
    }
    public $isEnvironment(envName: string): boolean {
        return this.__env__ === envName;
    }

    public $get<T = any>(key: string, defaultValue?: T): T {
        return (this[key] !== undefined ? this[key] : defaultValue) as T;
    }

    public $has(key: string): boolean {
        return this[key] !== undefined;
    }

    public $keys(): string[] {
        return Object.keys(this).filter(
            (key) =>
                !key.startsWith("$") &&
                typeof this[key] !== "function" &&
                key !== "__ENV__"
        );
    }

    public $reset(): void {
        const envManager = this.__ENV__;
        Object.keys(this).forEach((key) => {
            if (key !== "__ENV__" && !key.startsWith("$")) delete this[key];
        });

        this.__version__ = "0.0.0";
        this.__author__ = "unknown";
        this.__description__ = "A XyPriss application";
        this.__app_urls__ = {};
        this.__name__ = "xypriss-app";
        this.__alias__ = "app";
        this.__port__ = 3000;
        this.__PORT__ = 3000;
        this.__env__ = "development";
        this.__root__ = process.cwd();
        this.__ENV__ = envManager;
    }

    public $clone(): XyPrissSys {
        return new XyPrissSys(this.$toJSON());
    }
}

// Singleton instance
export const __sys__ = new XyPrissSys({
    __port__: parseInt(process.env["PORT"] || "3000"),
    __env__: process.env["NODE_ENV"] || "development",
});

// Global registration
if (typeof globalThis !== "undefined") {
    (globalThis as any).__sys__ = (globalThis as any).__sys__ || __sys__;
}

