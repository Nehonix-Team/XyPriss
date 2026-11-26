/**
 * XyPriss Precision Performance Tracer
 *
 * Captures nanosecond-level timestamps (process.hrtime.bigint()) across every
 * architectural boundary (IPC, Normalization, Security Middlewares, Routing, 404/Handler, Serialization).
 *
 * Prints a high-contrast waterfall diagram per request.
 *
 * @internal
 */
export class PerfTracer {
    public static isEnabled: boolean =
        process.env.XYPRISS_PERF_TRACE === "1" ||
        process.env.XYPRISS_PERF_TRACE === "true";

    public id: string;
    public method: string;
    public url: string;
    private marks: Array<{ name: string; time: bigint }> = [];
    private t0: bigint;
    private ended = false;

    constructor(id: string, method: string, url: string) {
        this.id = id;
        this.method = method;
        this.url = url;
        this.t0 = process.hrtime.bigint();
        this.marks.push({ name: "IPC Receive & Init", time: this.t0 });
    }

    public mark(name: string): void {
        this.marks.push({ name, time: process.hrtime.bigint() });
    }

    public end(statusCode: number): void {
        if (this.ended) return;
        this.ended = true;

        const tEnd = process.hrtime.bigint();
        this.marks.push({ name: "Response Sent to IPC", time: tEnd });
        const totalMs = Number(tEnd - this.t0) / 1e6;

        let out = `\n┌────────────────────────────────────────────────────────────────────────┐\n`;
        out += `│ ⚡ [XYPRISS PERF WATERFALL] ${this.method.padEnd(5)} ${this.url.slice(0, 30).padEnd(30)} Status: ${statusCode}  │\n`;
        out += `├────────────────────────────────────┬──────────────┬────────────────────┤\n`;
        out += `│ Layer / Phase                      │ Duration     │ Cumulative         │\n`;
        out += `├────────────────────────────────────┼──────────────┼────────────────────┤\n`;

        for (let i = 1; i < this.marks.length; i++) {
            const prev = this.marks[i - 1];
            const curr = this.marks[i];
            const stepMs = Number(curr.time - prev.time) / 1e6;
            const cumMs = Number(curr.time - this.t0) / 1e6;
            const stepStr = `${stepMs.toFixed(3)} ms`.padStart(12);
            const cumStr = `${cumMs.toFixed(3)} ms`.padStart(12);
            out += `│ ${curr.name.padEnd(34)} │ ${stepStr} │ ${cumStr}       │\n`;
        }

        out += `├────────────────────────────────────┴──────────────┴────────────────────┤\n`;
        out += `│ Total JS Pipeline Latency: ${totalMs.toFixed(3).padStart(10)} ms                         │\n`;
        out += `└────────────────────────────────────────────────────────────────────────┘\n`;

        console.log(out);
    }
}
