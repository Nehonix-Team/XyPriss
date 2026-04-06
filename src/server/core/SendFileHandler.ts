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

            // Use native XyPriss FS API to get file size and modification time
            const fileSize = __sys__.fs.size(finalPath) as number;
            const stats = __sys__.fs.stats(finalPath);
            const mtimeMs = stats.modified * 1000;

            const ext = __sys__.path.extname(finalPath).toLowerCase();
            const mergedMimeMap = options.mimeOverrides
                ? { ...MIME_MAP, ...options.mimeOverrides }
                : MIME_MAP;
            const mimeType = mergedMimeMap[ext] ?? "application/octet-stream";

            if (options.headers) {
                for (const [key, value] of Object.entries(options.headers)) {
                    this.res.setHeader(key, value);
                }
            }

            const getHeader = (key: string): string | undefined => {
                if (this.res.getHeader)
                    return this.res.getHeader(key) as string;
                if (this.res.hasHeader)
                    return this.res.hasHeader(key) ? key : undefined;
                return undefined;
            };

            const etag = buildETag(fileSize, mtimeMs);
            if (!getHeader("ETag")) {
                this.res.setHeader("ETag", etag);
            }

            if (!getHeader("Last-Modified")) {
                this.res.setHeader(
                    "Last-Modified",
                    new Date(mtimeMs).toUTCString(),
                );
            }

            const reqHeaders: Record<string, string | string[] | undefined> =
                (this.res as any).req?.headers ?? {};

            const ifNoneMatch = reqHeaders["if-none-match"] as
                | string
                | undefined;
            if (ifNoneMatch && ifNoneMatch === etag) {
                this.res.statusCode = 304;
                this.res.end();
                return;
            }

            const ifModifiedSince = reqHeaders["if-modified-since"] as
                | string
                | undefined;
            if (ifModifiedSince) {
                const sinceMs = new Date(ifModifiedSince).getTime();
                if (!isNaN(sinceMs) && mtimeMs <= sinceMs) {
                    this.res.statusCode = 304;
                    this.res.end();
                    return;
                }
            }

            if (options.maxAge !== undefined && !getHeader("Cache-Control")) {
                const maxAgeSeconds = Math.floor(options.maxAge / 1000);
                this.res.setHeader(
                    "Cache-Control",
                    `public, max-age=${maxAgeSeconds}`,
                );
            }

            if (!getHeader("Content-Type")) {
                const customCT =
                    options.headers?.["Content-Type"] ??
                    options.headers?.["content-type"];
                if (!customCT) {
                    this.res.setHeader("Content-Type", mimeType);
                }
            }

            if (options.disposition && !getHeader("Content-Disposition")) {
                const isInline = options.disposition === "inline";
                const isAttachment = options.disposition === "attachment";

                if (isInline) {
                    this.res.setHeader("Content-Disposition", "inline");
                } else {
                    const filename = isAttachment
                        ? __sys__.path.basename(finalPath)
                        : options.disposition;
                    const encoded = encodeURIComponent(filename);
                    this.res.setHeader(
                        "Content-Disposition",
                        `attachment; filename="${filename}"; filename*=UTF-8''${encoded}`,
                    );
                }
            }

            if (!getHeader("Accept-Ranges")) {
                this.res.setHeader("Accept-Ranges", "bytes");
            }

            const rangeHeader = reqHeaders["range"] as string | undefined;
            const range = parseRange(rangeHeader, fileSize);

            if (range) {
                const chunkSize = range.end - range.start + 1;
                this.res.statusCode = 206;
                this.res.setHeader(
                    "Content-Range",
                    `bytes ${range.start}-${range.end}/${fileSize}`,
                );
                this.res.setHeader("Content-Length", chunkSize);

                this._streamFile(finalPath, range.start, range.end);
                return;
            }

            this.res.setHeader("Content-Length", fileSize);
            this._streamFile(finalPath);
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
        // Native highly-optimized streaming direct to response
        const stream = __sys__.fs.createReadStream(filePath, { start, end });

        stream.on("error", (err: Error) => {
            if (!this.res.headersSent) {
                this.res.statusCode = 500;
                this.res.end("Stream error");
            }
        });

        // Use native piping if response object supports it
        if (
            (this.res as any).pipe &&
            typeof (this.res as any).pipe === "function"
        ) {
            stream.pipe(this.res);
        } else if ((this.res as any).socket || (this.res as any).writable) {
            stream.pipe(this.res);
        } else {
            // Buffer-based fallback for non-streamable response containers
            const chunks: Buffer[] = [];
            stream.on("data", (chunk: Buffer) => chunks.push(chunk));
            stream.on("end", () => {
                if (!this.res.writableEnded) {
                    this.res.end(Buffer.concat(chunks));
                }
            });
        }
    }

    public static registerMimeTypes(types: Record<string, string>): void {
        Object.assign(MIME_MAP, types);
    }

    public static getMimeType(ext: string): string {
        return resolveMime(ext);
    }
}


