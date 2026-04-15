import { XHSCDirectIPC } from "../ipc/XHSCDirectIPC";
import { FileStats } from "../types";

/**
 * **High-Performance File Toolbox**
 * Exposed via __sys__.fs.open(path, callback)
 */
export class FileHandle {
    private ipc: XHSCDirectIPC | null = null;

    constructor(
        private id: number,
        private runner: any,
    ) {
        if (process.env.XYPRISS_IPC_PATH) {
            this.ipc = new XHSCDirectIPC(process.env.XYPRISS_IPC_PATH);
        }
    }

    /**
     * **Get Native Handle ID**
     */
    public get nativeId(): number {
        return this.id;
    }

    /**
     * **Read from File**
     * @param length - Max bytes to read
     */
    public async read(length: number): Promise<Buffer> {
        if (this.ipc) {
            const res = await this.ipc.sendCommand("fs", "handle-read", {
                handle: this.id,
                length,
                encoding: "base64",
            });
            return Buffer.from(res.content, "base64");
        }

        const res = (await this.runner.runAsync("fs", "handle-read", [], {
            handle: this.id,
            length,
        })) as any;
        return Buffer.from(res.content, "hex");
    }

    /**
     * **Write to File**
     * @param data - Buffer or String
     */
    public async write(data: Buffer | string): Promise<number> {
        const raw = typeof data === "string" ? Buffer.from(data) : data;

        if (this.ipc) {
            const res = await this.ipc.sendCommand("fs", "handle-write", {
                handle: this.id,
                data: raw.toString("base64"),
                encoding: "base64",
            });
            return res.n;
        }

        const res = (await this.runner.runAsync("fs", "handle-write", [], {
            handle: this.id,
            data: raw.toString("hex"),
        })) as any;
        return res.n;
    }

    /**
     * **Seek within File**
     * @param offset - Position
     * @param whence - 0: Start, 1: Current, 2: End
     */
    public async seek(offset: number, whence: number = 0): Promise<number> {
        if (this.ipc) {
            const res = await this.ipc.sendCommand("fs", "handle-seek", {
                handle: this.id,
                offset,
                whence,
            });
            return res.pos;
        }

        const res = (await this.runner.runAsync("fs", "handle-seek", [], {
            handle: this.id,
            offset,
            whence,
        })) as any;
        return res.pos;
    }

    /**
     * **Get File Statistics**
     */
    public async stat(): Promise<FileStats> {
        if (this.ipc) {
            return (await this.ipc.sendCommand("fs", "handle-stat", {
                handle: this.id,
            })) as FileStats;
        }

        return (await this.runner.runAsync("fs", "handle-stat", [], {
            handle: this.id,
        })) as FileStats;
    }

    /**
     * **Close Handle**
     */
    public async close(): Promise<void> {
        if (this.ipc) {
            await this.ipc.sendCommand("fs", "close", { handle: this.id });
            this.ipc.close();
        } else {
            await this.runner.runAsync("fs", "close", [], { handle: this.id });
        }
    }
}