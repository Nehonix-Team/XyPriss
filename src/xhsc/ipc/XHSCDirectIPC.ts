import * as net from "node:net";

/**
 * **XHSC Direct IPC Client**
 *
 * Provides high-performance, direct Unix socket communication with the
 * XHSC background server, bypassing the overhead of process spawning.
 */
export class XHSCDirectIPC {
    private socket: net.Socket | null = null;

    constructor(private ipcPath: string) {}

    /**
     * **Connect to the IPC Server**
     */
    public async connect(): Promise<void> {
        if (this.socket && !this.socket.destroyed) return;

        return new Promise((resolve, reject) => {
            this.socket = net.connect(this.ipcPath, () => {
                resolve();
            });

            this.socket.on("error", (err) => {
                reject(err);
            });
        });
    }

    /**
     * **Send a Command and Wait for Response**
     */
    public async sendCommand(
        module: string,
        action: string,
        params: any = {},
    ): Promise<any> {
        await this.connect();

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error(`IPC Command Timeout: ${module}.${action}`));
            }, 5000);

            const message = {
                type: "CoreCommand",
                payload: {
                    module,
                    action,
                    params,
                },
            };

            const payload = Buffer.from(JSON.stringify(message));
            const size = Buffer.alloc(4);
            size.writeUInt32BE(payload.length, 0);

            let buffer = Buffer.alloc(0);

            const cleanup = () => {
                clearTimeout(timeout);
                this.socket?.removeListener("data", onData);
                this.socket?.removeListener("error", onError);
                this.socket?.removeListener("close", onClose);
            };

            const onData = (data: Buffer) => {
                buffer = Buffer.concat([buffer, data]);
                if (buffer.length >= 4) {
                    const resSize = buffer.readUInt32BE(0);
                    if (buffer.length >= 4 + resSize) {
                        const resPayload = buffer.subarray(4, 4 + resSize);
                        cleanup();

                        try {
                            const resMsg = JSON.parse(resPayload.toString());
                            if (resMsg.type === "Response") {
                                const res = resMsg.payload;
                                if (res.status === "error") {
                                    reject(new Error(res.error));
                                } else {
                                    resolve(res.data);
                                }
                            } else {
                                reject(
                                    new Error(
                                        "Unexpected message type: " +
                                            resMsg.type,
                                    ),
                                );
                            }
                        } catch (e) {
                            reject(e);
                        }
                    }
                }
            };

            const onError = (err: Error) => {
                cleanup();
                reject(err);
            };

            const onClose = () => {
                cleanup();
                reject(
                    new Error("IPC Connection closed during command execution"),
                );
            };

            this.socket!.on("data", onData);
            this.socket!.on("error", onError);
            this.socket!.on("close", onClose);
            this.socket!.write(size);
            this.socket!.write(payload);
        });
    }

    /**
     * **Close Connection**
     */
    public close(): void {
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }
    }
}


