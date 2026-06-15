import { getSysApi } from "../../plugins/const/getSysApi";
import { Logger } from "../../shared/logger/Logger";
import { SendFileOptions, XyPrisResponse } from "../../types/httpServer.type";
import { MIME_MAP } from "../const/MIME_MAP";



// ─────────────────────────────────────────────────────────────────────────────
// Resolve MIME type from file extension.
// ─────────────────────────────────────────────────────────────────────────────
function resolveMime(ext: string): string {
    return MIME_MAP[ext.toLowerCase()] ?? "application/octet-stream";
}

const __sys__ = getSysApi()


export class SendFileHandler {
    private res: XyPrisResponse;
    private logger?: Logger;

    constructor(res: XyPrisResponse, logger?: Logger) {
        this.res = res;
        this.logger = logger;
    }

    public async handle(
        filePath: string,
        options: SendFileOptions = {},
    ): Promise<void> {
        try {
            const finalPath = options.root
                ? __sys__.path.join(options.root, filePath)
                : filePath;

            // Resolve absolute path to ensure Go can access it
            const absolutePath = __sys__.path.isAbsolute(finalPath)
                ? finalPath
                : __sys__.path.resolve(process.cwd(), finalPath);

            const req = (this.res as any).req;
            const requestId = req?.id;
            const worker = req?.app?._xhscWorker;

            if (requestId && worker) {
                if (this.logger) {
                    this.logger.debug(
                        "server",
                        `[SendFileHandler] Delegating "${absolutePath}" to XHSC Core (Req: ${requestId})`,
                    );
                }

                /**
                 * @performance XHSC Zero-Copy Static File Delegation
                 *
                 * By delegating immediately to the XHSC (Go) engine *before* performing
                 * `fs.stat()` in Node.js, we eliminate a major performance bottleneck.
                 * Node.js relies on a limited thread pool (default 4) for async file system
                 * operations. Under heavy concurrent load, synchronous-like `stat` calls
                 * exhaust this pool and queue up, causing multi-second latency spikes.
                 *
                 * Delegating to Go offloads file existence checking, MIME resolution,
                 * ETags, Range headers, and the actual native `sendfile` zero-copy stream
                 * completely to the core engine. If the file does not exist, Go will
                 * natively return an HTTP 404 response.
                 */
                // Embed options natively into headers so they serialize via XBP
                this.res.setHeader("x-xhsc-static-delegate", absolutePath);
                
                if (options.headers) {
                    for (const [k, v] of Object.entries(options.headers)) {
                        this.res.setHeader(k, v as string | string[]);
                    }
                }
                
                if (options.maxAge) {
                    this.res.setHeader("Cache-Control", `public, max-age=${Math.floor(options.maxAge / 1000)}`);
                }
                
                if (options.disposition) {
                    if (options.disposition === "inline") {
                        this.res.setHeader("Content-Disposition", "inline");
                    } else if (options.disposition === "attachment") {
                        this.res.setHeader("Content-Disposition", `attachment; filename="${__sys__.path.basename(absolutePath)}"`);
                    } else {
                        this.res.setHeader("Content-Disposition", `attachment; filename="${options.disposition}"`);
                    }
                }

                if (options.mimeOverrides) {
                    const ext = __sys__.path.extname(absolutePath);
                    if (options.mimeOverrides[ext]) {
                        this.res.setHeader("Content-Type", options.mimeOverrides[ext]);
                    }
                }

                // Mark as delegated by setting status 0. 
                // XHSCBridge/index.ts and XHSCWorker.ts handle this state.
                this.res.statusCode = 0;
                this.res.end();
                return;
            }

            if (!__sys__.path.isFile(absolutePath)) {
                throw { code: "ENOENT", message: "File not found" };
            }

            // Fallback if not running under XHSC Bridge (should not happen in production)
            this.logger?.warn("server", "[SendFileHandler] XHSC Bridge not found, falling back to manual stream");
            this._streamFile(absolutePath);

        } catch (err: any) {
            const isNotFound =
                err.code === "ENOENT" ||
                err.code === "ENOTFOUND" ||
                err.message?.includes("not found") ||
                err.message?.includes("ENOENT") ||
                err.message?.includes("No such file or directory");

            if (this.logger) {
                this.logger.error(
                    "server",
                    `[SendFileHandler] Failed to send "${filePath}": ${err.message}`,
                );
            }

            if (!this.res.headersSent) {
                this.res.statusCode = isNotFound ? 404 : 500;
                this.res.setHeader("Content-Type", "text/plain; charset=utf-8");
                this.res.end(
                    isNotFound ? "File Not Found" : "Internal Server Error",
                );
            }
        }
    }

    private _streamFile(filePath: string, start?: number, end?: number): void {
        const stream = __sys__.fs.createReadStream(filePath, { start, end });
        stream.pipe(this.res as any);
    }

    public static registerMimeTypes(types: Record<string, string>): void {
        Object.assign(MIME_MAP, types);
    }

    public static getMimeType(ext: string): string {
        return resolveMime(ext);
    }
}



