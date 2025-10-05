
import { Request, Response } from "./types";

// Route pattern types
export type RoutePattern = string | RegExp;
 
export interface OptimizedRoute {
    pattern: RoutePattern;
    methods?: string[]; // ['GET', 'POST'] or ['*'] for all methods
    handler?: (req: Request, res: Response) => any | Promise<any>;
    schema?: any; // JSON schema for fast stringification
    cacheTTL?: number; // Cache time-to-live in milliseconds
    priority?: number; // Higher number = higher priority
    enableCache?: boolean; // Enable/disable caching for this route
    precompile?: boolean; // Precompile responses when possible
}

export interface CacheEntry {
    data: Buffer;
    expires: number;
    hits: number;
    lastAccessed: number;
}

export interface OptimizerConfig {
    // Cache settings
    cache?: {
        enabled?: boolean;
        defaultTTL?: number;
        maxSize?: number;
        cleanupInterval?: number;
        maxMemoryMB?: number;
    };

    // Performance settings
    performance?: {
        enablePrecompilation?: boolean;
        asyncTimeout?: number;
        maxConcurrentRequests?: number;
    };

    // Monitoring
    monitoring?: {
        enabled?: boolean;
        logInterval?: number;
        onStats?: (stats: any) => void;
    };
}

