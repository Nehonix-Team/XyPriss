import {
    EnhancedRequest,
    EnhancedResponse,
    ResponseManipulationConfig,
} from "../../types/types";
import { MiddlewareFunction } from "../../types/mod/core";

/**
 * @deprecated Response Manipulation is now delegated to the XHSC (Go) core engine
 * for parallel processing and zero-state regex compilation.
 * 
 * This middleware no longer performs any action in the Node.js thread and is
 * kept only for backward compatibility in the API signature.
 *
 * @param config Configuration for response manipulation
 * @returns Middleware function
 */
export function createResponseManipulationMiddleware(
    config: ResponseManipulationConfig,
): MiddlewareFunction {
    return (req: EnhancedRequest, res: EnhancedResponse, next: any) => {
        // Logique déportée vers le cœur XHSC pour des raisons de performances
        // Le middleware JS est maintenant un simple "pass-through".
        next();
    };
}
