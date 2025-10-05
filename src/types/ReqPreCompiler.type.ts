import { Request } from "./types";

export interface RequestPattern {
    id: string;
    route: string;
    method: string;
    frequency: number; 
    avgResponseTime: number;
    cacheHitRate: number;
    complexity: number;
    lastSeen: Date;
    optimizationLevel: "none" | "basic" | "advanced" | "ultra";
}

export interface CompiledRoute {
    pattern: RequestPattern;
    compiledHandler: Function;
    optimizedMiddleware: Function[];
    cacheStrategy: "memory" | "redis" | "hybrid" | "skip";
    executionPath: "fast" | "standard" | "complex";
    precomputedData?: any;
}

export interface DynamicResponseGenerator {
    pattern: string | RegExp;
    generator: (req: Request, pattern: RequestPattern) => Promise<any> | any;
    priority?: number;
}

export interface ResponseTemplate {
    route: string;
    method: string;
    template: any;
    cacheTTL?: number;
}

export interface PreCompilerConfig {
    enabled: boolean;
    learningPeriod: number; // ms
    optimizationThreshold: number; // requests per minute
    maxCompiledRoutes: number;
    aggressiveOptimization: boolean;
    predictivePreloading: boolean;

    // Library-agnostic configuration
    customResponseGenerators?: DynamicResponseGenerator[];
    responseTemplates?: ResponseTemplate[];
    systemInfo?: {
        serviceName?: string;
        version?: string;
        environment?: string;
        customHealthData?: () => any;
        customStatusData?: () => any;
    };
}
