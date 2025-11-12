import { Hash } from "./hash";
import { XyPrissSecurity } from "./crypto";
import { SecureRandom } from "./random";

class Cryptog {
    public readonly hash: typeof Hash = Hash;
    public readonly crypto: typeof XyPrissSecurity = XyPrissSecurity;
    public readonly random: typeof SecureRandom = SecureRandom;

    private static instance: Cryptog;

    private constructor() {}

    public static getInstance(): Cryptog {
        if (!Cryptog.instance) {
            Cryptog.instance = new Cryptog();
        }
        return Cryptog.instance;
    }
}

/**
 * ### Cryptographic Core
 *
 * Primary cryptographic classes and utilities for secure random generation,
 * key management, validation, and buffer operations.
 *
 * @example
 * ```typescript
 * import { Cipher } from "xypriss-security";
 *
 * // Generate secure random bytes
 * const randomBytes = Cipher.random.getRandomBytes(32);
 *
 * // Generate secure UUID
 * const uuid = Cipher.random.generateSecureUUID();
 *
 * // Generate random integers (using short alias)
 * const randomInt = Cipher.random.Int(1, 100);
 *
 * // Generate secure password
 * const password = Cipher.random.Password(16);
 * ```
 * @author Seth Eleazar <https://github.com/iDevo-ll>
 * @version 1.1.6
 * @license MIT
 * @see {@link https://lab.nehonix.space/nehonix_viewer/_doc/Nehonix%20XyPrissSecurity} Official Documentation
 *
 */
export const Cipher = Cryptog.getInstance();

// Cipher.random.Int

