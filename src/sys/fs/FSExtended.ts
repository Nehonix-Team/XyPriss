import { Cipher, XStringify } from "xypriss-security";
import { FSWatch } from "./FSWatch";

/**
 * **Advanced & Security Filesystem Operations**
 */
export class FSExtended extends FSWatch {
    /**
     * **Atomic Write ($atomicWrite)**
     */
    public $atomicWrite = async (
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
     * **Secure Shred ($shred)**
     */
    public $shred = (p: string, passes: number = 3): void => {
        this.runner.runSync("fs", "shred", [p], { passes });
    };

    /**
     * **Tail File ($tail)**
     */
    public $tail = (p: string, lines: number = 10): string[] => {
        return this.runner.runSync("fs", "tail", [p], { lines }) as string[];
    };

    /**
     * **Inline Patch ($patch)**
     */
    public $patch = (
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
     * **Split File ($split)**
     */
    public $split = (
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
     * **Merge Files ($merge)**
     */
    public $merge = (sourceFiles: string[], destFile: string): void => {
        this.runner.runSync("fs", "merge", [destFile, ...sourceFiles]);
    };

    /**
     * **Lock File ($lock)**
     */
    public $lock = (p: string): boolean => {
        const res = this.runner.runSync("fs", "lock", [p]);
        return res?.locked || false;
    };

    /**
     * **Unlock File ($unlock)**
     */
    public $unlock = (p: string): void => {
        this.runner.runSync("fs", "unlock", [p]);
    };

    /**
     * **Write Secure ($writeSecure)**
     */
    public $writeSecure = async (
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
     * **Encrypt File ($encryptFile)**
     */
    public $encryptFile = async (p: string, key: string): Promise<void> => {
        await Cipher.crypto.encryptFile(p, p, key, "AES-256-GCM");
    };

    /**
     * **Decrypt File ($decryptFile)**
     */
    public $decryptFile = async (p: string, key: string): Promise<void> => {
        await Cipher.crypto.decryptFile(p, p, key);
    };

    /**
     * **Diff Files ($diffFiles)**
     */
    public $diffFiles = (
        fileA: string,
        fileB: string,
    ): Array<{ line: number; file_a: string; file_b: string }> => {
        return this.runner.runSync("fs", "diff-files", [fileA, fileB]) as any[];
    };

    /**
     * **Top Big Files ($topBigFiles)**
     */
    public $topBigFiles = (
        dir: string,
        limit: number = 50,
    ): Array<{ path: string; size: number }> => {
        return this.runner.runSync("fs", "top-big-files", [dir], {
            limit,
        }) as any[];
    };
}

