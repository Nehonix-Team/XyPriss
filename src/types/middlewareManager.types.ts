import { MiddlewareFunction } from "./httpServer.type";

/**
 * Middleware configuration
 */
export interface MiddlewareConfig {
    name: string;
    enabled: boolean;
    priority: number; // Lower numbers = higher priority
    description?: string;
}

/**
 * Middleware entry
 */
export interface MiddlewareEntry {
    config: MiddlewareConfig;
    handler: MiddlewareFunction;
}

