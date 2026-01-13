import { EventEmitter } from "events";

/**
 * XyprissVirtualServer (XVS) mimics the Node.js http.Server interface
 * but delegates actual network operations to the Rust core.
 */
export class XVS extends EventEmitter {
    private _address: { port: number; family: string; address: string } | null =
        null;

    constructor() {
        super();
    }

    public address() {
        return this._address;
    }

    public listen(port: number, host: string, callback?: () => void) {
        this._address = { port, family: "IPv4", address: host };
        // The actual listening is handled by the Bridge, which will emit 'listening' on this instance
        if (callback) this.on("listening", callback);
        return this;
    }

    public close(callback?: (err?: Error) => void) {
        if (callback) callback();
        this.emit("close");
        return this;
    }
}

