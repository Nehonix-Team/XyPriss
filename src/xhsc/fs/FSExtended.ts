import { Cipher, XStringify } from "xypriss-security";
import { FSWatch } from "./FSWatch";

/**
 * **Advanced & Security Filesystem Operations**
 */
export class FSExtended extends FSWatch {
    /**
     * **Atomic Write**
     * Writes data to a temporary file first and renames it to target to ensure atomicity.
     *
     * @example
     * ```typescript
     * await __sys__.fs.atomicWrite("config.json", { key: "value" });
     * ```
     */
    public atomicWrite = async (
        p: string,
        data: any,
        options: { ensureFile?: boolean } = {},
    ): Promise<void> => {
        let writeData: any = "";
        if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
            writeData = data;
        } else if (typeof data === "object" && data !== null) {
            writeData = XStringify(data);
        } else {
            writeData = String(data);
        }
        await this.runner.runAsync("fs", "atomic-write", [p], {
            ...options,
            input: writeData,
        });
    };

    /**
     * **Atomic Write Synchronously**
     */
    public atomicWriteSync = (
        p: string,
        data: any,
        options: { ensureFile?: boolean } = {},
    ): void => {
        let writeData: any = "";
        if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
            writeData = data;
        } else if (typeof data === "object" && data !== null) {
            writeData = XStringify(data);
        } else {
            writeData = String(data);
        }
        this.runner.runSync("fs", "atomic-write", [p], {
            ...options,
            input: writeData,
        });
    };

    /**
     * **Secure Shred**
     * Overwrites file content multiple times with random data before deletion.
     *
     * @example
     * ```typescript
     * __sys__.fs.shred("sensitive_data.txt", 5);
     * ```
     */
    public shred = (p: string, passes: number = 3): void => {
        this.runner.runSync("fs", "shred", [p], { passes });
    };

    /**
     * **Tail File**
     *
     * @example
     * ```typescript
     * const lastLines = __sys__.fs.tail("app.log", 20);
     * ```
     */
    public tail = (p: string, lines: number = 10): string[] => {
        return this.runner.runSync("fs", "tail", [p], { lines }) as string[];
    };

    /**
     * **Inline Patch**
     * Replaces content within a file.
     *
     * @example
     * ```typescript
     * __sys__.fs.patch("config.ts", "oldValue", "newValue");
     * ```
     */
    public patch = (
        p: string,
        searchValue: string | RegExp,
        replaceValue: string,
    ): boolean => {
        const searchStr =
            searchValue instanceof RegExp ? searchValue.source : searchValue;
        const res = this.runner.runSync("fs", "patch", [
            p,
            searchStr,
            replaceValue,
        ]);
        return res?.changed || false;
    };

    /**
     * **Split File**
     */
    public split = (
        p: string,
        bytesPerChunk: number,
        outDir?: string,
    ): string[] => {
        return this.runner.runSync("fs", "split", [p], {
            bytes: bytesPerChunk,
            out: outDir || "",
        }) as string[];
    };

    /**
     * **Merge Files**
     */
    public merge = (sourceFiles: string[], destFile: string): void => {
        this.runner.runSync("fs", "merge", [destFile, ...sourceFiles]);
    };

    /**
     * **Lock File**
     */
    public lock = (p: string): boolean => {
        const res = this.runner.runSync("fs", "lock", [p]);
        return res?.locked || false;
    };

    /**
     * **Unlock File**
     *
     * @example
     * ```typescript
     * __sys__.fs.unlock("db.sqlite");
     * ```
     */
    public unlock = (p: string): void => {
        this.runner.runSync("fs", "unlock", [p]);
    };

    /**
     * **Write Secure**
     */
    public writeSecure = async (
        p: string,
        data: any,
        mode: string,
    ): Promise<void> => {
        let writeData: any = "";
        if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
            writeData = data;
        } else if (typeof data === "object" && data !== null) {
            writeData = XStringify(data);
        } else {
            writeData = String(data);
        }
        await this.runner.runAsync("fs", "write-secure", [p], {
            mode,
            input: writeData,
        });
    };

    /**
     * **Write Secure Synchronously**
     */
    public writeSecureSync = (p: string, data: any, mode: string): void => {
        let writeData: any = "";
        if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
            writeData = data;
        } else if (typeof data === "object" && data !== null) {
            writeData = XStringify(data);
        } else {
            writeData = String(data);
        }
        this.runner.runSync("fs", "write-secure", [p], {
            mode,
            input: writeData,
        });
    };

    /**
     * **Encrypt File**
     */
    public encryptFile = async (p: string, key: string): Promise<void> => {
        await Cipher.crypto.encryptFile(p, p, key, "AES-256-GCM");
    };

    /**
     * **Decrypt File**
     *
     * @example
     * ```typescript
     * await __sys__.fs.decryptFile("secret.enc", "my-secret-key");
     * ```
     */
    public decryptFile = async (p: string, key: string): Promise<void> => {
        await Cipher.crypto.decryptFile(p, p, key);
    };

    /**
     * **Hardware-Linked Encryption**
     * Ties encryption to this specific machine's hardware ID.
     */
    public hardwareEncryptFile = async (
        p: string,
        key: string,
    ): Promise<void> => {
        await this.runner.runAsync("fs", "hardware-encrypt", [p], { key });
    };

    /**
     * **Hardware-Linked Decryption**
     */
    public hardwareDecryptFile = async (
        p: string,
        key: string,
    ): Promise<void> => {
        await this.runner.runAsync("fs", "hardware-decrypt", [p], { key });
    };

    /**
     * **Diff Files**
     */
    public diffFiles = (
        fileA: string,
        fileB: string,
    ): Array<{ line: number; file_a: string; file_b: string }> => {
        return this.runner.runSync("fs", "diff-files", [fileA, fileB]) as any[];
    };

    /**
     * **Top Big Files**
     */
    public topBigFiles = (
        dir: string,
        limit: number = 50,
    ): Array<{ path: string; size: number }> => {
        return this.runner.runSync("fs", "top-big-files", [dir], {
            limit,
        }) as any[];
    };
}

