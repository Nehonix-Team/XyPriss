export interface RequestSignature {
    method: string;
    pathPattern: string;
    flags: number;
    complexity: number;
}

export interface RequestPattern {
    signature: RequestSignature;
    frequency: number;
    avgResponseTime: number;
    cacheHitRate: number;
    lastSeen: number;
    classification: number; // Using number instead of string for speed
    confidence: number;
}

export interface ClassificationResult {
    type: "ultra-fast" | "fast" | "standard";
    confidence: number;
    executionPath: string;
    cacheStrategy: "direct" | "optimized" | "standard";
    skipMiddleware: string[];
    reason: string;
    overhead: number;
}
