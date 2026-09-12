/**
 * **XyPriss Security Shield (Recursive Read-Only Proxy)**
 *
 * Protects the system API from any mutation attempts at runtime.
 * This is a core component of the XyPriss Zero-Trust architecture.
 *
 * @param target The object to protect.
 * @param label The name of the object for error messages.
 */
export function createSecurityShield<T extends object>(
    target: T,
    label: string = "__sys__",
): T {
    const proxyCache = new WeakMap<object, any>();

    function createProxy(obj: any, path: string): any {
        if (
            obj === null ||
            (typeof obj !== "object" && typeof obj !== "function")
        ) {
            return obj;
        }

        if (proxyCache.has(obj)) return proxyCache.get(obj);

        const handler: ProxyHandler<any> = {
            get(target, prop, receiver) {
                // 🛡️ Zero-Trust Hardening: Prevent reflective access to private/internal state.
                // Prevents malicious plugins from reading host coordinates (e.g., _primaryRoot, _internalRoot)
                // or inspecting internal registries (_pluginMap). Dunder properties (__root__, __env__) remain
                // intentionally accessible as public system contracts.
                if (
                    typeof prop === "string" &&
                    prop.startsWith("_") &&
                    !prop.startsWith("__")
                ) {
                    const desc = Object.getOwnPropertyDescriptor(target, prop);
                    if (!desc || desc.configurable !== false || desc.writable !== false) {
                        return undefined;
                    }
                }

                const value = Reflect.get(target, prop, receiver);

                // Prevent Proxy invariant violation
                const desc = Object.getOwnPropertyDescriptor(target, prop);
                if (desc && desc.configurable === false && desc.writable === false) {
                    return value;
                }

                // If it's a function, we must bind it to the target to preserve 'this'
                // context for internal protected state/properties.
                if (typeof value === "function") {
                    return value.bind(target);
                }

                if (value !== null && typeof value === "object") {
                    const propName =
                        typeof prop === "symbol" ? prop.toString() : String(prop);
                    return createProxy(value, `${path}.${propName}`);
                }
                return value;
            },
            has(target, prop) {
                if (
                    typeof prop === "string" &&
                    prop.startsWith("_") &&
                    !prop.startsWith("__")
                ) {
                    return false;
                }
                return Reflect.has(target, prop);
            },
            ownKeys(target) {
                return Reflect.ownKeys(target).filter((key) => {
                    if (
                        typeof key === "string" &&
                        key.startsWith("_") &&
                        !key.startsWith("__")
                    ) {
                        const desc = Object.getOwnPropertyDescriptor(target, key);
                        if (!desc || desc.configurable !== false) {
                            return false;
                        }
                    }
                    return true;
                });
            },
            set(target, prop) {
                const propName =
                    typeof prop === "symbol" ? prop.toString() : String(prop);
                throw new Error(
                    `[XyPriss Security] Illegal Mutation: Property '${propName}' on '${path}' is protected and cannot be modified.`,
                );
            },
            defineProperty(target, prop) {
                const propName =
                    typeof prop === "symbol" ? prop.toString() : String(prop);
                throw new Error(
                    `[XyPriss Security] Illegal Redefinition: Cannot redefine '${propName}' on '${path}'.`,
                );
            },
            deleteProperty(target, prop) {
                const propName =
                    typeof prop === "symbol" ? prop.toString() : String(prop);
                throw new Error(
                    `[XyPriss Security] Illegal Deletion: Cannot delete '${propName}' from '${path}'.`,
                );
            },
        };

        const proxy = new Proxy(obj, handler);
        proxyCache.set(obj, proxy);
        return proxy;
    }

    return createProxy(target, label);
}
