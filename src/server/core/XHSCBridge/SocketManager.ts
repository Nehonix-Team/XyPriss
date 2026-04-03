import * as net from "node:net";
import * as fs from "node:fs";
import * as path from "node:path";
import os from "node:os";
import { ID } from "nehoid";
import { Logger } from "../../../shared/logger/Logger";
import { createXyprissTempDir } from "../../../plugins/const/XyprissTempDir";

export class SocketManager {
    constructor(private logger: Logger) {}

    private static readonly TEMP_DIR: string = ".xhsc";

    /**
     * Generate and configure the Unix Domain Socket path.
     */
    public configuredSocketPath(_socketPath?: string): string {
        const socketName = _socketPath || `xhsc-${ID.temporal()}.sock`;
        const normalisedPath = path.join(SocketManager.TEMP_DIR, socketName);
        return createXyprissTempDir(normalisedPath);
    }

    /**
     * Scan the temporary directory for orphaned XHSC sockets and remove them.
     * Considers a socket orphaned if it cannot be connected to.
     */
    public async cleanupStaleSockets(currentSocketPath: string): Promise<void> {
        try {
            const tmpDir = createXyprissTempDir(SocketManager.TEMP_DIR);
            const files = fs.readdirSync(tmpDir);
            const xhscSockets = files.filter(
                (f) => f.startsWith("xhsc-") && f.endsWith(".sock"),
            );

            if (xhscSockets.length === 0) return;

            let count = 0;
            for (const socketFile of xhscSockets) {
                const fullPath = path.join(tmpDir, socketFile);

                // Skip cleaning up our own socket if it was somehow pre-allocated
                if (fullPath === currentSocketPath) continue;

                const isAlive = await new Promise<boolean>((resolve) => {
                    const client = net.connect(fullPath, () => {
                        client.destroy();
                        resolve(true); // Active socket
                    });

                    client.on("error", () => {
                        resolve(false); // Refused or other error = stale
                    });

                    // Timeout after 100ms to avoid blocking startup
                    const timeout = setTimeout(() => {
                        client.destroy();
                        resolve(false);
                    }, 100);

                    client.unref(); // Don't keep the event loop alive
                });

                if (!isAlive) {
                    try {
                        fs.unlinkSync(fullPath);
                        count++;
                    } catch (e) {
                        // File might have been deleted by another process already
                    }
                }
            }

            if (count > 0) {
                this.logger.info(
                    "server",
                    `XHSC Bridge: Cleaned up ${count} orphaned IPC sockets from /tmp.`,
                );
            }
        } catch (error) {
            this.logger.debug(
                "server",
                "XHSC Bridge: Failed to complete socket cleanup routine.",
            );
        }
    }

    /**
     * Cleanup a specific socket file.
     */
    public cleanupSocket(socketPath: string): void {
        if (fs.existsSync(socketPath)) {
            try {
                fs.unlinkSync(socketPath);
            } catch (e) {
                // Ignore
            }
        }
    }
}

