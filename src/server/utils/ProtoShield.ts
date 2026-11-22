/**
 * XyPriss ProtoShield — Anti-Prototype Pollution Protection Engine
 *
 * Fortifies the V8 / JavaScriptCore runtime environment against Prototype Pollution attacks:
 * 1. Blocks unauthorized additions and mutations to `Object.prototype`, `Array.prototype`, and `Function.prototype`.
 * 2. Neutralizes mutable `__proto__` accessors exploited by recursive merge/patch vectors.
 * 3. Enforces strict boot-time configuration schema validation for `xypriss.config.json(c)`.
 *
 * @module server/utils/ProtoShield
 * @see https://xypriss.nehonix.com/docs/security/protoshield
 */

export interface ProtoShieldConfig {
    /** Enable or disable ProtoShield protection. Default: true */
    enabled?: boolean;
    /** Enforcement mode: 'block' (default), 'warn', or 'freeze' */
    mode?: "block" | "warn" | "freeze";
    /** Neutralize mutable __proto__ setter on Object.prototype. Default: true */
    neutralizeProto?: boolean;
    /** Apply complete Object.freeze to Object.prototype and base intrinsics. Default: false */
    freezePrototypes?: boolean;
    /** Explicit whitelist of property names allowed to be added to prototypes (e.g. polyfills) */
    allowedProperties?: string[];
}

export class ProtoShield {
    private static isInitialized = false;
    private static activeConfig: Required<ProtoShieldConfig> | null = null;

    /**
     * Validates raw JSON configuration from `xypriss.config.json(c)` at boot time.
     * Throws an explicit, descriptive error if any property is invalid.
     */
    public static validateConfig(raw: any): Required<ProtoShieldConfig> {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            throw new Error(
                `[XyPriss Validation Error] 'protoShield' must be a valid JSON object in xypriss.config.json(c). Received: ${typeof raw}`,
            );
        }

        const allowedKeys = new Set([
            "enabled",
            "mode",
            "neutralizeProto",
            "freezePrototypes",
            "allowedProperties",
        ]);

        for (const key of Object.keys(raw)) {
            if (!allowedKeys.has(key)) {
                throw new Error(
                    `[XyPriss Validation Error] Unknown property 'protoShield.${key}' in xypriss.config.json(c). Allowed properties: ${[...allowedKeys].map((k) => `'${k}'`).join(", ")}`,
                );
            }
        }

        if (raw.enabled !== undefined && typeof raw.enabled !== "boolean") {
            throw new Error(
                `[XyPriss Validation Error] 'protoShield.enabled' must be a boolean. Received: ${typeof raw.enabled} (${JSON.stringify(raw.enabled)})`,
            );
        }

        if (raw.mode !== undefined) {
            const acceptedModes = ["block", "warn", "freeze"];
            if (!acceptedModes.includes(raw.mode)) {
                throw new Error(
                    `[XyPriss Validation Error] Invalid 'protoShield.mode': ${JSON.stringify(raw.mode)}. Accepted values are: 'block', 'warn', 'freeze'.`,
                );
            }
        }

        if (raw.neutralizeProto !== undefined && typeof raw.neutralizeProto !== "boolean") {
            throw new Error(
                `[XyPriss Validation Error] 'protoShield.neutralizeProto' must be a boolean. Received: ${typeof raw.neutralizeProto}`,
            );
        }

        if (raw.freezePrototypes !== undefined && typeof raw.freezePrototypes !== "boolean") {
            throw new Error(
                `[XyPriss Validation Error] 'protoShield.freezePrototypes' must be a boolean. Received: ${typeof raw.freezePrototypes}`,
            );
        }

        if (raw.allowedProperties !== undefined) {
            if (!Array.isArray(raw.allowedProperties)) {
                throw new Error(
                    `[XyPriss Validation Error] 'protoShield.allowedProperties' must be an array of strings. Received: ${typeof raw.allowedProperties}`,
                );
            }
            for (let i = 0; i < raw.allowedProperties.length; i++) {
                const item = raw.allowedProperties[i];
                if (typeof item !== "string" || !item.trim()) {
                    throw new Error(
                        `[XyPriss Validation Error] 'protoShield.allowedProperties[${i}]' must be a non-empty string. Received: ${JSON.stringify(item)}`,
                    );
                }
            }
        }

        return {
            enabled: raw.enabled !== undefined ? raw.enabled : true,
            mode: raw.mode || "block",
            neutralizeProto: raw.neutralizeProto !== undefined ? raw.neutralizeProto : true,
            freezePrototypes: raw.freezePrototypes !== undefined ? raw.freezePrototypes : false,
            allowedProperties: Array.isArray(raw.allowedProperties) ? [...raw.allowedProperties] : [],
        };
    }

    /**
     * Bootstraps the ProtoShield defense according to the validated configuration.
     */
    public static initialize(rawConfig: any): void {
        if (this.isInitialized) return;

        const config = this.validateConfig(rawConfig);
        this.activeConfig = config;

        if (!config.enabled) {
            this.isInitialized = true;
            return;
        }

        const allowedSet = new Set([...config.allowedProperties, "__proto__"]);

        // 1. Neutralize mutable __proto__ accessor if enabled (done before strict interception)
        if (config.neutralizeProto) {
            this.applyNeutralizeProto(config.mode);
        }

        // 2. Intercept explicit property definitions on core prototypes
        this.applyPropertyInterception(allowedSet, config.mode);

        // 3. Prevent dynamic property expansion or enforce total immutability
        if (config.mode === "freeze" || config.freezePrototypes) {
            try {
                Object.freeze(Object.prototype);
                Object.freeze(Array.prototype);
                Object.freeze(Function.prototype);
            } catch {}
        } else if (config.mode === "block") {
            try {
                Object.preventExtensions(Object.prototype);
            } catch {}
        }

        this.isInitialized = true;
    }

    /**
     * Intercepts `Object.defineProperty` on base prototypes to thwart unauthorized extension.
     */
    private static applyPropertyInterception(
        allowed: Set<string>,
        mode: "block" | "warn" | "freeze",
    ): void {
        const origDefineProperty = Object.defineProperty;
        const targetPrototypes = [Object.prototype, Array.prototype, Function.prototype];

        Object.defineProperty = function <T>(
            target: T,
            propertyKey: PropertyKey,
            attributes: PropertyDescriptor & ThisType<any>,
        ): T {
            if (targetPrototypes.includes(target as any)) {
                const propStr = String(propertyKey);
                if (!allowed.has(propStr)) {
                    const message = `[XyPriss ProtoShield] Blocked Prototype Pollution attempt! Unauthorized property '${propStr}' on ${target?.constructor?.name || "Object"}.prototype`;
                    if (mode === "warn") {
                        console.warn(
                            `\x1b[33m${message}\x1b[0m\n` + (new Error().stack || ""),
                        );
                    } else {
                        const err = new TypeError(message);
                        console.error(
                            `\x1b[31m${message}\x1b[0m\n` + (err.stack || ""),
                        );
                        throw err;
                    }
                }
            }
            return origDefineProperty.call(Object, target, propertyKey, attributes) as T;
        };
    }

    /**
     * Intercepts and neutralizes the mutable `__proto__` setter on `Object.prototype`.
     */
    private static applyNeutralizeProto(mode: "block" | "warn" | "freeze"): void {
        try {
            const origDesc = Object.getOwnPropertyDescriptor(
                Object.prototype,
                "__proto__",
            );
            if (origDesc && origDesc.set) {
                Object.defineProperty(Object.prototype, "__proto__", {
                    get() {
                        return Object.getPrototypeOf(this);
                    },
                    set(_newProto: any) {
                        const message = `[XyPriss ProtoShield] Blocked Prototype Mutation attempt via '__proto__'!`;
                        if (mode === "warn") {
                            console.warn(
                                `\x1b[33m${message}\x1b[0m\n` + (new Error().stack || ""),
                            );
                        } else {
                            const err = new TypeError(message);
                            console.error(
                                `\x1b[31m${message}\x1b[0m\n` + (err.stack || ""),
                            );
                            throw err;
                        }
                    },
                    configurable: false,
                    enumerable: false,
                });
            }
        } catch {}
    }

    public static getActiveConfig(): Required<ProtoShieldConfig> | null {
        return this.activeConfig;
    }
}
