import { XHSC_SIGNATURE } from "../../../const/XHSC_SIGNATURE";

export function buildCoreArgs(
    port: number,
    host: string,
    socketPath: string,
    rmconf: any,
): string[] {
    const engineHost = host === "localhost" ? "127.0.0.1" : host;

    const timeoutMs = rmconf?.timeout?.defaultTimeout || 30000;
    const maxBodySize = rmconf?.payload?.maxBodySize || 10485760;

    const routes = rmconf?.timeout?.routes || {};
    const routeTimeouts = Object.values(routes) as number[];
    const maxTimeoutMs = Math.max(timeoutMs, ...routeTimeouts, 0);
    const maxTimeoutSec = Math.ceil(maxTimeoutMs / 1000);

    const args = [
        "--signature",
        XHSC_SIGNATURE,
        "server",
        "start",
        "--port",
        port.toString(),
        "--host",
        engineHost,
        "--ipc",
        socketPath,
    ];

    if (rmconf?.timeout?.enabled !== false) {
        args.push("--timeout", (maxTimeoutSec + 2).toString());
    } else {
        args.push("--timeout", "0");
    }

    if (maxBodySize) {
        args.push("--max-body-size", maxBodySize.toString());
    }

    return args;
}
