import crypto from "node:crypto";

export const MAGIC_HEADER = Buffer.from([0x53, 0x4e, 0x50, 0x58]); // "SNPX"
export const CURRENT_VERSION = 0x0100;
export const NONCE_SIZE = 12;
export const TAG_SIZE = 16;
export const HEADER_SIZE = 8;

/**
 * Derives a 32-byte AES key using HKDF-SHA256 from session token and hardware binding.
 */
export function deriveKey(sessionToken: string, hardwareBinding: string): Buffer {
    const ikm = Buffer.concat([Buffer.from(sessionToken), Buffer.from(hardwareBinding)]);
    const salt = Buffer.from("nehonix.synapx.schema.v1");
    const info = Buffer.from("synapx-config-encryption");

    return Buffer.from(
        crypto.hkdfSync("sha256", ikm, salt, info, 32)
    );
}

/**
 * Encrypts full ServerOptions JSON object into a binary .synapx envelope.
 */
export function pack(payload: any, key: Buffer, flags: number = 0): Buffer {
    const jsonStr = typeof payload === "string" 
        ? payload 
        : JSON.stringify(payload, (_key, val) => (val instanceof RegExp ? val.toString() : val));
    const plaintext = Buffer.from(jsonStr, "utf8");

    const nonce = crypto.randomBytes(NONCE_SIZE);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(MAGIC_HEADER);

    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    const header = Buffer.allocUnsafe(HEADER_SIZE);
    MAGIC_HEADER.copy(header, 0);
    header.writeUInt16BE(CURRENT_VERSION, 4);
    header.writeUInt16BE(flags, 6);

    return Buffer.concat([header, nonce, ciphertext, tag]);
}
