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
                const value = Reflect.get(target, prop, receiver);

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
