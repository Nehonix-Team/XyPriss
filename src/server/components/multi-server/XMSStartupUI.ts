/**
 * XMSStartupUI.ts
 * High-performance, aesthetic sequential startup UI for XyPriss Multi-Server (XMS).
 *
 * Provides:
 * - Animated interactive spinner for TTY environments
 * - Clean, non-destructive line-by-line output for non-TTY / CI / log redirection
 * - Log and console suppression/capture during server initialization
 * - Immediate diagnostic dump on boot failure
 * - Precise duration metrics per server and for the entire cluster
 */

import { MultiServerConfig } from "../../../types/types";
import { Logger } from "../../../shared/logger/Logger";
import type { LogEntry } from "../../../shared/types";
import { getSysApi } from "../../../plugins/const/getSysApi";

export interface XMSStartupUIOptions {
    /**
     * Whether to suppress/capture noisy logs during server startup.
     * Default: true
     */
    quiet?: boolean;

    /**
     * Completely silent mode (no stdout output at all).
     * Default: false
     */
    silent?: boolean;
}

export class XMSStartupUI {
    private configs: MultiServerConfig[];
    private total: number;
    private options: XMSStartupUIOptions;
    private isTTY: boolean;
    private colorsEnabled: boolean;
    private maxIdLength: number;
    private padWidth: number;

    // Spinner state
    private spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    private spinnerIndex = 0;
    private spinnerTimer?: NodeJS.Timeout;
    private currentServer?: {
        index: number;
        id: string;
        host: string;
        port: number | string;
        startTime: number;
    };

    // Console interception state
    private originalConsole: Record<string, any> = {};
    private consoleBuffer: string[] = [];
    private isInterceptingConsole = false;

    constructor(
        configs: MultiServerConfig[],
        options: XMSStartupUIOptions = {},
    ) {
        this.configs = configs;
        this.total = configs.length;
        this.options = {
            quiet: options.quiet !== false,
            silent: options.silent === true,
        };

        const sysEnv = getSysApi()?.__env__;
        const isCI = sysEnv ? sysEnv.get("CI") : (typeof process !== "undefined" && (process.env as any)?.CI);
        const noColor = sysEnv ? sysEnv.get("NO_COLOR") : (typeof process !== "undefined" && (process.env as any)?.NO_COLOR);
        const disableColors = sysEnv ? sysEnv.get("NODE_DISABLE_COLORS") : (typeof process !== "undefined" && (process.env as any)?.NODE_DISABLE_COLORS);

        this.isTTY =
            typeof process !== "undefined" &&
            Boolean(process.stdout?.isTTY) &&
            !isCI;

        this.colorsEnabled = !noColor && disableColors !== "1";

        this.maxIdLength = Math.max(
            12,
            ...configs.map((c) => (c.id ? String(c.id).length : 8)),
        );
        this.padWidth = String(this.total).length;
    }

    private get c() {
        if (!this.colorsEnabled) {
            return {
                reset: "",
                bold: "",
                dim: "",
                cyan: "",
                blue: "",
                green: "",
                red: "",
                yellow: "",
                white: "",
                gray: "",
                accent: "",
            };
        }
        return {
            reset: "\x1b[0m",
            bold: "\x1b[1m",
            dim: "\x1b[2m",
            cyan: "\x1b[36m",
            blue: "\x1b[38;2;0;160;255m",
            green: "\x1b[38;2;80;230;140m",
            red: "\x1b[38;2;255;85;85m",
            yellow: "\x1b[38;5;214m",
            white: "\x1b[38;2;220;230;245m",
            gray: "\x1b[38;2;130;150;175m",
            accent: "\x1b[38;2;80;240;255m",
        };
    }

    /**
     * Start the multi-server startup sequence by printing the header banner.
     */
    public startCluster(): void {
        if (this.options.silent) return;

        const { reset, bold, dim, blue, white, gray } = this.c;
        const countStr = `${this.total} server${this.total > 1 ? "s" : ""}`;
        const header = `\n  ${blue}${bold}◆${reset} ${white}${bold}XMS Multi-Server Engine${reset} ${dim}${gray}›${reset} ${gray}${countStr} configured${reset}\n\n`;
        process.stdout.write(header);
    }

    /**
     * Notify that a server has begun its startup sequence.
     * Starts animated spinner and begins capturing child server noise.
     */
    public startServer(
        index: number,
        id: string,
        host: string,
        port: number | string,
    ): void {
        this.currentServer = {
            index,
            id,
            host,
            port,
            startTime: Date.now(),
        };

        if (this.options.quiet) {
            Logger.getInstance().startCapture((entry) => {
                this.handleCapturedLog(entry);
            });
            this.hookConsole();
        }

        if (this.options.silent) return;

        if (this.isTTY) {
            if (this.options.quiet) {
                this.spinnerIndex = 0;
                this.renderSpinnerLine();
                this.spinnerTimer = setInterval(() => {
                    this.spinnerIndex =
                        (this.spinnerIndex + 1) % this.spinnerFrames.length;
                    this.renderSpinnerLine();
                }, 80);
            } else {
                const { reset, bold, dim, accent, white, gray, cyan } = this.c;
                const indexStr = String(index).padStart(this.padWidth, " ");
                const step = `${dim}${gray}[${indexStr}/${this.total}]${reset}`;
                const target = `${cyan}http://${host}:${port}${reset}`;
                process.stdout.write(`  ${step}  ${accent}•${reset}  ${white}Starting ${bold}${id}${reset} ${dim}${gray}on${reset} ${target}${dim}${gray}...${reset}\n`);
            }
        }
    }

    private renderSpinnerLine(): void {
        if (!this.currentServer || !this.isTTY || this.options.silent) return;
        const { reset, bold, dim, accent, white, gray, cyan } = this.c;
        const { index, id, host, port } = this.currentServer;
        const frame = this.spinnerFrames[this.spinnerIndex];

        const indexStr = String(index).padStart(this.padWidth, " ");
        const step = `${dim}${gray}[${indexStr}/${this.total}]${reset}`;
        const spinner = `${accent}${bold}${frame}${reset}`;
        const target = `${cyan}http://${host}:${port}${reset}`;

        const line = `  ${step}  ${spinner}  ${white}Starting ${bold}${id}${reset} ${dim}${gray}on${reset} ${target}${dim}${gray}...${reset}`;

        process.stdout.write(`\r\x1b[K${line}`);
    }

    /**
     * Mark a server as successfully started and active.
     */
    public finishServer(
        index: number,
        id: string,
        host: string,
        port: number | string,
        durationMs?: number,
    ): void {
        if (this.spinnerTimer) {
            clearInterval(this.spinnerTimer);
            this.spinnerTimer = undefined;
        }

        if (this.options.quiet) {
            this.unhookConsole();
            Logger.getInstance().stopCapture();
            this.consoleBuffer = [];
        }

        if (this.options.silent) return;

        const { reset, bold, dim, green, blue, white, gray, cyan } = this.c;
        const indexStr = String(index).padStart(this.padWidth, " ");
        const step = `${dim}${gray}[${indexStr}/${this.total}]${reset}`;
        const check = `${green}${bold}✔${reset}`;
        const paddedId = id.padEnd(this.maxIdLength, " ");
        const target = `${cyan}http://${host}:${port}${reset}`;
        const duration =
            durationMs !== undefined
                ? `  ${dim}${gray}[${durationMs}ms]${reset}`
                : "";

        const line = `  ${step}  ${check}  ${white}${bold}${paddedId}${reset}  ${blue}➜${reset}  ${target}${duration}`;

        if (this.isTTY) {
            process.stdout.write(`\r\x1b[K${line}\n`);
        } else {
            process.stdout.write(`${line}\n`);
        }

        this.currentServer = undefined;
    }

    /**
     * Mark a server as failed during startup and dump diagnostic logs.
     */
    public failServer(index: number, id: string, error: any): void {
        if (this.spinnerTimer) {
            clearInterval(this.spinnerTimer);
            this.spinnerTimer = undefined;
        }

        const capturedConsole = [...this.consoleBuffer];
        let capturedLogs: LogEntry[] = [];

        if (this.options.quiet) {
            this.unhookConsole();
            capturedLogs = Logger.getInstance().stopCapture();
            this.consoleBuffer = [];
        }

        if (this.options.silent) return;

        const { reset, bold, dim, red, white, gray } = this.c;
        const indexStr = String(index).padStart(this.padWidth, " ");
        const step = `${dim}${gray}[${indexStr}/${this.total}]${reset}`;
        const cross = `${red}${bold}✖${reset}`;
        const paddedId = id.padEnd(this.maxIdLength, " ");
        const errorMsg = error?.message || String(error);

        const line = `  ${step}  ${cross}  ${red}${bold}${paddedId}${reset}  ${red}➜  FAILED: ${errorMsg}${reset}`;

        if (this.isTTY) {
            process.stdout.write(`\r\x1b[K${line}\n`);
        } else {
            process.stdout.write(`${line}\n`);
        }

        // Print diagnostic block if any logs were captured
        const allDiagnostics: string[] = [];
        for (const entry of capturedLogs) {
            allDiagnostics.push(Logger.getInstance().formatEntry(entry));
        }
        for (const raw of capturedConsole) {
            allDiagnostics.push(raw);
        }

        if (allDiagnostics.length > 0) {
            const sep = `${red}${"─".repeat(50)}${reset}`;
            process.stdout.write(
                `\n  ${red}${bold}┌── Startup Diagnostics: "${id}" ${sep}${reset}\n`,
            );
            for (const diag of allDiagnostics.slice(-20)) {
                process.stdout.write(`  ${red}│${reset}  ${diag}\n`);
            }
            process.stdout.write(
                `  ${red}${bold}└──${"─".repeat(60)}${reset}\n\n`,
            );
        }

        this.currentServer = undefined;
    }

    /**
     * Complete the cluster startup and display the summary footer.
     */
    public completeCluster(totalDurationMs: number): void {
        this.dispose();

        if (this.options.silent) return;

        const { reset, bold, dim, green, white, gray, accent } = this.c;
        const countStr = `${this.total} server${this.total > 1 ? "s" : ""}`;
        const footer = `\n  ${green}${bold}✓${reset} ${white}${bold}All ${countStr} active and ready${reset} ${dim}${gray}—${reset} ${accent}[${totalDurationMs}ms]${reset}\n\n`;
        process.stdout.write(footer);
    }

    /**
     * Clean up timers, console hooks, and logger capture.
     */
    public dispose(): void {
        if (this.spinnerTimer) {
            clearInterval(this.spinnerTimer);
            this.spinnerTimer = undefined;
        }
        this.unhookConsole();
        if (Logger.getInstance().isCapturing()) {
            Logger.getInstance().stopCapture();
        }
        this.consoleBuffer = [];
        this.currentServer = undefined;
    }

    private hookConsole(): void {
        if (this.isInterceptingConsole) return;
        this.isInterceptingConsole = true;

        const methods = ["log", "info", "warn", "error", "debug"];
        for (const m of methods) {
            if (typeof (console as any)[m] === "function") {
                this.originalConsole[m] = (console as any)[m];
                (console as any)[m] = (...args: any[]) => {
                    const str = args
                        .map((a) =>
                            typeof a === "object"
                                ? JSON.stringify(a)
                                : String(a),
                        )
                        .join(" ");
                    this.consoleBuffer.push(str);

                    if (this.isAllowedStartupLog(str)) {
                        this.printPassthroughLog(str);
                    }
                };
            }
        }
    }

    private unhookConsole(): void {
        if (!this.isInterceptingConsole) return;
        this.isInterceptingConsole = false;

        for (const [m, fn] of Object.entries(this.originalConsole)) {
            (console as any)[m] = fn;
        }
        this.originalConsole = {};
    }

    /**
     * Check if a log entry represents a critical startup milestone
     * that must remain visible even during quiet initialization.
     *
     * Allowed:
     * - "Initializing Version XHSC..." (XHSC binary version identification)
     * - "Initializing XRMS (XyPriss Request Management System)..." (XRMS stack initialization)
     */
    private isAllowedStartupLog(message: string): boolean {
        if (!message) return false;
        const clean = message.replace(/\x1b\[[0-9;]*m/g, "");
        return (
            /(?:i|n)?nitializing version xhsc/i.test(clean) ||
            /(?:i|n)?nitializing xrms/i.test(clean)
        );
    }

    private handleCapturedLog(entry: LogEntry): void {
        const fullMsg = [
            entry.message,
            ...(entry.args || []).map((a) =>
                typeof a === "object" ? JSON.stringify(a) : String(a),
            ),
        ].join(" ");

        if (this.isAllowedStartupLog(fullMsg)) {
            const formatted = Logger.getInstance().formatEntry(entry);
            const extraArgs =
                entry.args && entry.args.length > 0
                    ? ` ${entry.args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")}`
                    : "";
            this.printPassthroughLog(`${formatted}${extraArgs}`);
        }
    }

    private printPassthroughLog(line: string): void {
        if (this.options.silent) return;

        if (this.isTTY) {
            process.stdout.write(`\r\x1b[K${line}\n`);
            if (this.currentServer) {
                this.renderSpinnerLine();
            }
        } else {
            process.stdout.write(`${line}\n`);
        }
    }
}
