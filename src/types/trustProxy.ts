/**
 * Trust Proxy Type Definitions for XyPriss
 * 
 * Comprehensive type definitions for the advanced trust proxy functionality
 */

/**
 * Predefined network range identifiers
 */
export type PredefinedRange = 'loopback' | 'linklocal' | 'uniquelocal';

/**
 * Trust proxy configuration value
 * 
 * Supports all Express.js trust proxy configurations plus XyPriss enhancements:
 * 
 * @example
 * ```typescript
 * // Boolean - trust all proxies or none
 * trustProxy: true
 * trustProxy: false
 * 
 * // Predefined ranges
 * trustProxy: 'loopback'     // Trust localhost/127.0.0.1 and ::1
 * trustProxy: 'linklocal'    // Trust link-local addresses (169.254.0.0/16, fe80::/10)
 * trustProxy: 'uniquelocal'  // Trust private networks (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, fc00::/7)
 * 
 * // CIDR notation
 * trustProxy: '192.168.0.0/16'
 * trustProxy: '10.0.0.0/8'
 * trustProxy: 'fc00::/7'  // IPv6 CIDR
 * 
 * // Exact IP addresses
 * trustProxy: '127.0.0.1'
 * trustProxy: '::1'
 * 
 * // Array of rules (mixed types supported)
 * trustProxy: ['loopback', 'linklocal', '10.0.0.0/8']
 * trustProxy: ['127.0.0.1', '192.168.1.100', 'uniquelocal']
 * 
 * // Number - trust first N hops
 * trustProxy: 1  // Trust first proxy
 * trustProxy: 2  // Trust first 2 proxies in chain
 * 
 * // Custom function
 * trustProxy: (ip, hopIndex) => {
 *   return ip.startsWith('192.168.') || ip === '127.0.0.1';
 * }
 * ```
 */
export type TrustProxyValue = 
    | boolean 
    | PredefinedRange
    | string 
    | (PredefinedRange | string)[]
    | number
    | ((ip: string, hopIndex: number) => boolean);

/**
 * Trust proxy configuration interface with detailed documentation
 */
export interface TrustProxyConfig {
    /**
     * Trust proxy configuration
     * 
     * Controls how XyPriss handles X-Forwarded-* headers from reverse proxies.
     * This is crucial for correctly identifying client IPs, protocols, and hostnames
     * when your application is behind a reverse proxy like Nginx, Apache, or a load balancer.
     * 
     * **Security Note**: Only trust proxies you control. Trusting untrusted proxies
     * can allow IP spoofing and other security vulnerabilities.
     * 
     * **Predefined Ranges**:
     * - `'loopback'`: Trusts localhost (127.0.0.0/8, ::1/128)
     * - `'linklocal'`: Trusts link-local addresses (169.254.0.0/16, fe80::/10)
     * - `'uniquelocal'`: Trusts private networks (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, fc00::/7)
     * 
     * **Production Examples**:
     * ```typescript
     * // Development - trust local proxies
     * trustProxy: ['loopback', 'uniquelocal']
     * 
     * // Production - trust specific proxy servers
     * trustProxy: ['203.0.113.10', '203.0.113.11']
     * 
     * // Cloud deployment - trust load balancer subnet
     * trustProxy: ['10.0.0.0/8', 'loopback']
     * 
     * // Kubernetes/Docker - trust cluster networks
     * trustProxy: ['10.244.0.0/16', '172.17.0.0/16']
     * ```
     * 
     * @default false
     */
    trustProxy?: TrustProxyValue;
}

/**
 * Trust proxy validation result
 */
export interface TrustProxyValidationResult {
    isValid: boolean;
    error?: string;
    warnings?: string[];
}

/**
 * Trust proxy statistics for monitoring
 */
export interface TrustProxyStats {
    totalRequests: number;
    trustedRequests: number;
    untrustedRequests: number;
    uniqueClientIPs: number;
    topClientIPs: Array<{ ip: string; count: number }>;
    protocolDistribution: {
        http: number;
        https: number;
    };
}

/**
 * Extended trust proxy configuration with monitoring
 */
export interface AdvancedTrustProxyConfig extends TrustProxyConfig {
    /**
     * Enable trust proxy statistics collection
     * @default false
     */
    enableStats?: boolean;
    
    /**
     * Maximum number of client IPs to track in statistics
     * @default 1000
     */
    maxTrackedIPs?: number;
    
    /**
     * Custom validation function for additional security checks
     */
    customValidator?: (ip: string, headers: Record<string, string | string[] | undefined>) => boolean;
    
    /**
     * Log trust proxy decisions for debugging
     * @default false
     */
    enableLogging?: boolean;
}
