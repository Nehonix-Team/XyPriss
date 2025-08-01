
/**
 * Connection information interface
 */
export interface ConnectionInfo {
    id: string;
    remoteAddress: string;
    protocol: string;
    encrypted: boolean;
    created: number;
    lastUsed: number;
    requestCount: number;
    keepAlive: boolean;
    http2: boolean;
    maxRequests: number;
    timeout: number;
}
