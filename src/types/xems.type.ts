export interface XemsTypes {
    enable?: boolean;
    sandbox?: string;
    ttl?: string;
    cookieName?: string;
    headerName?: string;
    autoRotation?: boolean;
    attachTo?: string;
    persistence?: {
        enabled: boolean;
        path?: string;
        /**
         * Mandatory 32-byte (256-bit) encryption secret.
         * Used in combination with hardware ID for vault encryption.
         */
        secret: string;
        resources?: {
            cacheSize?: number; // Cache size in MB
        };
    };

    cookieOptions?: {
        httpOnly: boolean;
        secure: boolean;
        sameSite: string;
    };
}

