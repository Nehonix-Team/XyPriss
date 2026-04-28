import { Cipher, XStringify } from "xypriss-security";
import { FSWatch } from "./FSWatch";

/**
 * **Advanced & Security Filesystem Operations**
 */
export class FSExtended extends FSWatch {
    /**
     * **Atomic Write (Asynchronous)**
     *
     * Writes data to a temporary file first and renames it to the target path
     * to ensure file system atomicity. This prevents partial writes or file
     * corruption during system crashes.
     *
     * @param {string} p - Destination path.
     * @param {any} data - Data to write.
     * @param {Object} [options] - Options.
     * @param {boolean} [options.ensureFile=true] - Create parent directories if missing.
     * @returns {Promise<void>}
     *
     * @example
     * await __sys__.fs.atomicWrite("database.json", largeObject);
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
     * **Atomic Write (Synchronous)**
     *
     * Synchronously performs an atomic write operation. Blocks until the
     * operation is confirmed by the OS.
     *
     * @param {string} p - Destination path.
     * @param {any} data - Data to write.
     * @param {Object} [options] - Options.
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
     * **Secure File Erasure (Shred)**
     *
     * Overwrites file content multiple times with random data before deletion
     * to prevent recovery via forensic tools.
     *
     * @param {string} p - Path to the file to destroy.
     * @param {number} [passes=3] - Number of overwrite iterations.
     *
     * @example
     * __sys__.fs.shred("passwords.txt", 7);
     */
    public shred = (p: string, passes: number = 3): void => {
        this.runner.runSync("fs", "shred", [p], { passes });
    };

    /**
     * **Retrieve End of File (Tail)**
     *
     * Reads the last N lines of a file. Optimized for large log files.
     *
     * @param {string} p - Path to the file.
     * @param {number} [lines=10] - Number of lines to retrieve.
     * @returns {string[]} Array of lines.
     *
     * @example
     * const lastLogs = __sys__.fs.tail("server.log", 50);
     */
    public tail = (p: string, lines: number = 10): string[] => {
        return this.runner.runSync("fs", "tail", [p], { lines }) as string[];
    };

    /**
     * **In-Place File Patching**
     *
     * Replaces content within a file without rewriting the entire file.
     *
     * @param {string} p - Path to the file.
     * @param {string | RegExp} searchValue - Pattern to search for.
     * @param {string} replaceValue - New content.
     * @returns {boolean} True if any replacement occurred.
     *
     * @example
     * __sys__.fs.patch("setup.cfg", "VERSION=1.0", "VERSION=1.1");
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
     * **File Fragmentation (Split)**
     *
     * Splits a large file into multiple smaller chunks.
     *
     * @param {string} p - Path to the source file.
     * @param {number} bytesPerChunk - Maximum size of each chunk.
     * @param {string} [outDir] - Directory where chunks will be saved.
     * @returns {string[]} Paths to the generated chunks.
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
     * **File Reconstruction (Merge)**
     *
     * Reassembles multiple file chunks into a single destination file.
     *
     * @param {string[]} sourceFiles - Ordered array of chunk paths.
     * @param {string} destFile - Target destination for the merged file.
     */
    public merge = (sourceFiles: string[], destFile: string): void => {
        this.runner.runSync("fs", "merge", [destFile, ...sourceFiles]);
    };

    /**
     * **Advisory File Locking**
     *
     * Attempts to acquire an exclusive lock on a file to prevent concurrent access.
     *
     * @param {string} p - Path to the file.
     * @returns {boolean} True if the lock was successfully acquired.
     */
    public lock = (p: string): boolean => {
        const res = this.runner.runSync("fs", "lock", [p]);
        return res?.locked || false;
    };

    /**
     * **Release File Lock**
     *
     * Unlocks a previously locked file.
     *
     * @param {string} p - Path to the file.
     *
     * @example
     * __sys__.fs.unlock("exclusive.data");
     */
    public unlock = (p: string): void => {
        this.runner.runSync("fs", "unlock", [p]);
    };

    /**
     * **Secure Permission Write (Asynchronous)**
     *
     * Writes data to a file and immediately applies a restricted permission mode.
     *
     * @param {string} p - Destination path.
     * @param {any} data - Data to write.
     * @param {string} mode - Octal mode (e.g., '600').
     * @returns {Promise<void>}
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
     * **Secure Permission Write (Synchronous)**
     *
     * Synchronously writes data and applies a restricted mode.
     *
     * @param {string} p - Destination path.
     * @param {any} data - Data to write.
     * @param {string} mode - Octal mode.
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
     * **Transparent File Encryption (AES-256-GCM)**
     *
     * Encrypts the contents of a file in-place using a symmetric key.
     *
     * @param {string} p - Path to the file.
     * @param {string} key - Secret encryption key.
     * @returns {Promise<void>}
     */
    public encryptFile = async (p: string, key: string): Promise<void> => {
        await Cipher.crypto.encryptFile(p, p, key, "AES-256-GCM");
    };

    /**
     * **Transparent File Decryption**
     *
     * Decrypts a file previously encrypted with `encryptFile()`.
     *
     * @param {string} p - Path to the file.
     * @param {string} key - Secret decryption key.
     * @returns {Promise<void>}
     *
     * @example
     * await __sys__.fs.decryptFile("vault.bin", "passphrase");
     */
    public decryptFile = async (p: string, key: string): Promise<void> => {
        await Cipher.crypto.decryptFile(p, p, key);
    };

    /**
     * **Hardware-Bound Encryption**
     *
     * Encrypts a file using a key derived from the system's unique hardware ID.
     * This file can ONLY be decrypted on this specific machine.
     *
     * @param {string} p - Path to the file.
     * @param {string} key - User-provided part of the secret.
     * @returns {Promise<void>}
     */
    public hardwareEncryptFile = async (
        p: string,
        key: string,
    ): Promise<void> => {
        await this.runner.runAsync("fs", "hardware-encrypt", [p], { key });
    };

    /**
     * **Hardware-Bound Decryption**
     *
     * Decrypts a file using the system's hardware ID.
     *
     * @param {string} p - Path to the file.
     * @param {string} key - User-provided part of the secret.
     * @returns {Promise<void>}
     */
    public hardwareDecryptFile = async (
        p: string,
        key: string,
    ): Promise<void> => {
        await this.runner.runAsync("fs", "hardware-decrypt", [p], { key });
    };

    /**
     * **Deep File Diff**
     *
     * Performs a line-by-line comparison between two files and returns
     * all differences.
     *
     * @param {string} fileA - First file.
     * @param {string} fileB - Second file.
     * @returns {Array<Object>} List of differences with line numbers.
     */
    public diffFiles = (
        fileA: string,
        fileB: string,
    ): Array<{ line: number; file_a: string; file_b: string }> => {
        return this.runner.runSync("fs", "diff-files", [fileA, fileB]) as any[];
    };

    /**
     * **Storage Analysis**
     *
     * Scans a directory and returns a list of the largest files found.
     *
     * @param {string} dir - Directory to scan.
     * @param {number} [limit=50] - Number of top files to return.
     * @returns {Array<Object>} List of paths and sizes.
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

