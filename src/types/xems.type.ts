/**
 * Interface representing XEMS (XyPriss Encrypted Memory Store) configurations.
 * XEMS is a high-security, hardware-bound encrypted persistent store (max 7 days retention).
 */
export type XemsTypes =
    | {
          /** Whether XEMS is enabled for this server instance. */
          enable: false;
          path?: string;
          secret?: string;
          sandbox?: string;
          ttl?: string;
          cookieName?: string;
          headerName?: string;
          autoRotation?: boolean | "request" | "sec" | "minute" | "hour" | "day" | string;
          attachTo?: string;
          resources?: { cacheSize?: number };
          cookieOptions?: CookieOptions;
          gracePeriod?: number;
      }
    | {
          /** Whether XEMS is enabled for this server instance. */
          enable?: true;
          /**
           * Path to the encrypted vault file (.xems).
           * The vault is cryptographically bound to both the hardware ID (HWID) and this specific absolute path.
           */
          path: string;
          /**
           * Mandatory 32-byte (256-bit) encryption secret.
           * Combined with HWID and absolute file path for AES-256-GCM vault encryption.
           */
          secret: string;
          sandbox?: string;
          ttl?: string;
          cookieName?: string;
          headerName?: string;
          autoRotation?: boolean | "request" | "sec" | "minute" | "hour" | "day" | string;
          attachTo?: string;
          resources?: { cacheSize?: number };
          cookieOptions?: CookieOptions;
          gracePeriod?: number;
      };

interface CookieOptions {
    httpOnly?: boolean; // Empêche l'accès JS (anti-XSS)
    secure?: boolean; // HTTPS uniquement
    sameSite?: "Strict" | "Lax" | "None"; // Protection CSRF
    path?: string; // Chemin du cookie (défaut: "/")
    domain?: string; // Domaine (ex: ".nehonix.com")
    maxAge?: number; // Durée en ms (alternative à expires)
    expires?: Date; // Date d'expiration absolue
    signed?: boolean; // Signé avec secret (anti-tampering)
}


