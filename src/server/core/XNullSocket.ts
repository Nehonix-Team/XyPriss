
/**
 * A no-op socket substitute for XHSCResponse.
 *
 * `ServerResponse` requires a socket-like object to be passed at construction
 * time. Previously, the real Unix Domain Socket (the IPC connection to the Go
 * engine) was passed here. That caused a critical correctness bug: when
 * `super.end()` was called, Node.js wrote raw HTTP response headers and body
 * directly into the XBP binary IPC stream, corrupting the protocol framing and
 * blocking every in-flight request until the 30-second Go-side timeout fired.
 *
 * This class replaces the real socket with a no-op object. Node.js internal
 * stream machinery writes into it freely, but all bytes are silently discarded.
 * Actual response delivery is handled exclusively by `_onFinalize`, which
 * encodes and sends a correct XBP frame back to the Go engine.
 */
export class XNullSocket {
    writable = true;
    readable = false;
    destroyed = false;
    encrypted = false;
    remoteAddress = "127.0.0.1";
    remotePort = 0;
    localAddress = "127.0.0.1";
    localPort = 0;

    write(_data: any, _enc?: any, cb?: any): boolean {
        if (typeof _enc === "function") _enc();
        else if (typeof cb === "function") cb();
        return true;
    }
    end(_data?: any, _enc?: any, cb?: any): this {
        if (typeof _enc === "function") _enc();
        else if (typeof cb === "function") cb();
        return this;
    }
    destroy(): this {
        return this;
    }
    cork(): void {}
    uncork(): void {}
    setTimeout(_ms: number, _cb?: () => void): this {
        return this;
    }
    on(_event: string, _listener: (...args: any[]) => void): this {
        return this;
    }
    once(_event: string, _listener: (...args: any[]) => void): this {
        return this;
    }
    emit(_event: string, ..._args: any[]): boolean {
        return false;
    }
    removeListener(_event: string, _listener: (...args: any[]) => void): this {
        return this;
    }
    removeAllListeners(_event?: string): this {
        return this;
    }
    setMaxListeners(_n: number): this {
        return this;
    }
    getMaxListeners(): number {
        return 0;
    }
    listeners(_event: string): any[] {
        return [];
    }
    rawListeners(_event: string): any[] {
        return [];
    }
    listenerCount(_event: string): number {
        return 0;
    }
    eventNames(): string[] {
        return [];
    }
    prependListener(_event: string, _listener: (...args: any[]) => void): this {
        return this;
    }
    prependOnceListener(
        _event: string,
        _listener: (...args: any[]) => void,
    ): this {
        return this;
    }
    pipe<T>(_dest: T): T {
        return _dest;
    }
    unshift(_chunk: any): void {}
    pause(): this {
        return this;
    }
    resume(): this {
        return this;
    }
    isPaused(): boolean {
        return false;
    }
    setEncoding(_enc: string): this {
        return this;
    }
    read(_size?: number): any {
        return null;
    }
    ref(): this {
        return this;
    }
    unref(): this {
        return this;
    }
}
