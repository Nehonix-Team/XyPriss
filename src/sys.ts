import { XyPrissFS } from "./sys/System";

/**
 * XyPriss System Variables Class
 *
 * Provides centralized access to system variables, configuration management,
 * and environment utilities for XyPriss applications. This class now inherits
 * directly from XyPrissFS, granting immediate access to all filesystem,
 * system, and path operations ($ls, $cpu, $resolve) without prefixes.
 *
 * @class XyPrissSys
 * @extends XyPrissFS
 */
export class XyPrissSys extends XyPrissFS {
    /** Specialized workspace filesystem instance. */
    public $plug?: XyPrissFS;
    /**
     * alias for {@link $plug}
     */
    public $plg?: XyPrissFS;

    /** System metadata properties. */
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

    /** Environment variables manager. */
    public __ENV__ = {
        set: (key: string, value: string) => {
            process.env[key] = value;
        },
        get: (key: string, defaultValue?: string) => {
            return process.env[key] || defaultValue;
        },
        has: (key: string) => {
            return process.env[key] !== undefined;
        },
        delete: (key: string) => {
            delete process.env[key];
        },
        all: () => {
            return process.env;
        },
    };

    /** Index signature for dynamic variables. */
    [key: string]: any;

    /**
     * Creates a new XyPrissSys instance.
     * Inherits from XyPrissFS to flatten the API.
     */
    constructor(data: Record<string, any> = {}) {
        const root = data.__root__ || data.__root__ || process.cwd();
        super({ __root__: root });
        this.__root__ = root;
        this.$update(data);
    }

    /** Updates system variables and synchronizes ports. */
    public $update(data: Record<string, any>): void {
        Object.assign(this, data);
        if (data.__port__ !== undefined) this.__PORT__ = data.__port__;
        if (data.__PORT__ !== undefined) this.__port__ = data.__PORT__;
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
                key !== "__ENV__" &&
                !["fs", "sys", "path"].includes(key)
            ) {
                json[key] = this[key];
            }
        }
        return json;
    }

    public $isProduction = () => this.__env__ === "production";
    public $isDevelopment = () => this.__env__ === "development";
    public $isStaging = () => this.__env__ === "staging";
    public $isTest = () => this.__env__ === "test";
    public $isEnvironment = (envName: string) => this.__env__ === envName;

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
                key !== "__ENV__" &&
                !["fs", "sys", "path"].includes(key)
        );
    }

    public $reset(): void {
        const envManager = this.__ENV__;
        Object.keys(this).forEach((key) => {
            if (
                key !== "__ENV__" &&
                !key.startsWith("$") &&
                !["fs", "sys", "path"].includes(key)
            ) {
                delete this[key];
            }
        });

        this.__version__ = "0.0.0";
        this.__author__ = "unknown";
        this.__app_urls__ = {};
        this.__name__ = "xypriss-app";
        this.__description__ = "A XyPriss application";
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

// Global Registration
if (typeof globalThis !== "undefined") {
    const defaultPort = parseInt(process.env["PORT"] || "3000");
    (globalThis as any).__sys__ =
        (globalThis as any).__sys__ ||
        new XyPrissSys({
            __port__: defaultPort,
            __PORT__: defaultPort,
            __env__: process.env["NODE_ENV"] || "development",
        });
}

export const __sys__ = (globalThis as any).__sys__ as XyPrissSys;


 