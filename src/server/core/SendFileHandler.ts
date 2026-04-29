import { Logger } from "../../shared/logger/Logger";
import { SendFileOptions, XyPrisResponse } from "../../types/httpServer.type";
import { MIME_MAP } from "../const/MIME_MAP";
import { __sys__ } from "../../xhsc";

// ─────────────────────────────────────────────────────────────────────────────
// Resolve MIME type from file extension.
// ─────────────────────────────────────────────────────────────────────────────
function resolveMime(ext: string): string {
    return MIME_MAP[ext.toLowerCase()] ?? "application/octet-stream";
}

function buildETag(size: number, mtimeMs: number): string {
    return `W/"${size.toString(16)}-${mtimeMs.toString(16)}"`;
}

function parseRange(
    rangeHeader: string | undefined,
    totalSize: number,
): { start: number; end: number } | null {
    if (!rangeHeader || !rangeHeader.startsWith("bytes=")) return null;

    const [rawStart, rawEnd] = rangeHeader.slice(6).split("-");
    let start = rawStart ? parseInt(rawStart, 10) : NaN;
    let end = rawEnd ? parseInt(rawEnd, 10) : NaN;

    if (isNaN(start) && !isNaN(end)) {
        start = Math.max(0, totalSize - end);
        end = totalSize - 1;
    } else {
        if (isNaN(start)) return null;
        if (isNaN(end)) end = totalSize - 1;
    }

    end = Math.min(end, totalSize - 1);

    if (start > end || start < 0) return null;
    return { start, end };
}

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

            if (!__sys__.fs.check(absolutePath).exists) {
                throw { code: "ENOENT", message: "File not found" };
            }

            const req = (this.res as any).req;
            const requestId = req?.id;
            const worker = req?.app?._xhscWorker;

            if (requestId && worker && typeof worker.delegateStatic === "function") {
                if (this.logger) {
                    this.logger.debug(
                        "server",
                        `[SendFileHandler] Delegating "${absolutePath}" to XHSC Core (Req: ${requestId})`,
                    );
                }

                // Delegate to Go. Go will handle ETags, Range, Mime, and Networking.
                worker.delegateStatic(requestId, absolutePath, options);

                // Mark as delegated by setting status 0. 
                // XHSCBridge/index.ts and XHSCWorker.ts handle this state.
                this.res.statusCode = 0;
                this.res.end();
                return;
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


