import { ID } from "nehoid";

/**
 * **IdUtils — Identity Primitives**
 */
export class IdUtils {
    /**
     * **uuid**
     *
     * Generates a RFC-compliant UUID v4 using the `nehoid` engine.
     *
     * @returns A random UUID string.
     */
    public uuid(): string {
        return ID.uuid();
    }
}

