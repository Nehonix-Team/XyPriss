import { __strl__ } from "strulink";

/**
 * **ValidationUtils — XyPriss Validation Utilities**
 */
export class ValidationUtils {
    /**
     * **email**
     *
     * Performs semantic validation on an email address string.
     *
     * @param email The email string to validate.
     * @returns `true` if valid, `false` otherwise.
     */
    public email(email: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    /**
     * **url**
     *
     * Validates a URL string using the `strulink` RFC-compliant URI parser.
     *
     * @param url The URL string to validate.
     * @returns `true` if valid, `false` otherwise.
     */
    public url(url: string | URL): boolean {
        try {
            new URL(String(url));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * **nullish**
     *
     * A type guard that determines if a value is either `null` or `undefined`.
     *
     * @param value The value to check.
     * @returns `true` if null or undefined.
     */
    public nullish(value: unknown): value is null | undefined {
        return value === null || value === undefined;
    }
}

