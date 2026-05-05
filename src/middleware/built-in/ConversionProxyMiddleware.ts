import { XyPrisRequest, XyPrisResponse, NextFunction } from "../../types/httpServer.type";

/**
 * ConversionProxyMiddleware - Provides a "Virtual Body" for converted XML requests.
 * It allows developers to access attributes (e.g., "@id") via standard property access (e.g., "id").
 */
export const ConversionProxyMiddleware = (
    attributePrefix: string = "@",
    textContentKey: string = "#text"
) => {
    return (req: XyPrisRequest, res: XyPrisResponse, next: NextFunction) => {
        // Only apply if the request was converted from XML by XHSC
        if (req.headers["x-xhsc-origin-format"] === "xml" && req.body && typeof req.body === "object") {
            req.body = createProxy(req.body, attributePrefix, textContentKey);
        }
        next?.();
    };
};

/**
 * Recursive proxy creator for converted objects.
 */
function createProxy(target: any, prefix: string, textKey: string): any {
    if (target === null || typeof target !== "object") {
        return target;
    }

    // If it's an array, wrap each element
    if (Array.isArray(target)) {
        return target.map(item => createProxy(item, prefix, textKey));
    }

    return new Proxy(target, {
        get(obj, prop) {
            if (typeof prop !== "string") return obj[prop];

            // 1. Direct access
            if (prop in obj) {
                const val = obj[prop];
                // If the value is a text-only object, return the text directly
                if (val && typeof val === "object" && textKey in val && Object.keys(val).length === 1) {
                    return val[textKey];
                }
                return typeof val === "object" ? createProxy(val, prefix, textKey) : val;
            }

            // 2. Attribute access (e.g. body.id -> body["@id"])
            const attrKey = `${prefix}${prop}`;
            if (attrKey in obj) {
                return obj[attrKey];
            }

            // 3. Smart unwrapping (e.g. body.user -> body.user["#text"] if it's the only meaningful value)
            return undefined;
        }
    });
}
