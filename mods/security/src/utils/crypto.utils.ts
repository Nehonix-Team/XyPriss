import crypto from "crypto";
import { Interface, Mod } from "reliant-type";

// Encryption configuration
// const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY as string; // Must be 32 characters
// const ALGORITHM = "aes-256-cbc";
// const IV_LENGTH = 16;
const schm = Interface({
    text: "string",
    ENCRYPTION_KEY: "string(32,)",
    ALGORITHM: "string",
    IV_LENGTH: "number(16, )",
});
function isValideInput(inp: {
    d: typeof schm.types | Omit<typeof schm.types, "IV_LENGTH">;
    t: "encrypt" | "decrypt";
}) {
    if (inp.t === "encrypt") {
        const vld = schm.safeParse(inp.d as typeof schm.types);
        if (!vld.success) {
            throw new Error(
                vld.errors[0].code +
                    ":" +
                    vld.errors[0].message +
                    "::" +
                    vld.errors[0].path
            );
        }
        return true;
    }
    const sc2 = Mod.omit(schm, ["IV_LENGTH"]);
    const vld = sc2.safeParse(inp.d);
    if (!vld.success) {
        throw new Error(
            vld.errors[0].code +
                ":" +
                vld.errors[0].message +
                "::" +
                vld.errors[0].path
        );
    }
    return true;
}

/**
 * Encrypt data using AES-256-CBC
 */
export function encrypt(
    text: string,
    ENCRYPTION_KEY = process.env.ENC_SECRET_KEY as string,
    ALGORITHM = "aes-256-cbc",
    IV_LENGTH = 16
): string {
    isValideInput({
        d: { ALGORITHM, ENCRYPTION_KEY, IV_LENGTH, text },
        t: "encrypt",
    });

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
        ALGORITHM,
        Buffer.from(ENCRYPTION_KEY!),
        iv
    );

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Return IV + encrypted data
    return iv.toString("hex") + ":" + encrypted;
}

/**
 * Decrypt data using AES-256-CBC
 */
export function decrypt(
    encryptedText: string,
    ENCRYPTION_KEY = process.env.ENCRYPTION_KEY as string,
    ALGORITHM = "aes-256-cbc"
): string {
    isValideInput({
        d: { text: encryptedText, ENCRYPTION_KEY, ALGORITHM },
        t: "decrypt",
    });

    const parts = encryptedText.split(":");
    if (parts.length !== 2) {
        throw new Error("Invalid encrypted data format");
    }

    const iv = Buffer.from(parts[0]!, "hex");
    const encrypted = parts[1]!;

    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        Buffer.from(ENCRYPTION_KEY),
        iv
    );

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
}

