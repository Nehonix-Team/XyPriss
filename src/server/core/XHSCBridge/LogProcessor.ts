import { Logger } from "../../../shared/logger/Logger";
import { ConsoleInterceptor } from "../../components/fastapi/console/ConsoleInterceptor";

export class LogProcessor {
    private readonly MAX_HISTORY_LINES = 10;
    private outputHistory: string[] = [];
    private stdoutBuffer: string = "";
    private stderrBuffer: string = "";

    constructor(
        private logger: Logger,
        private consoleInterceptor?: ConsoleInterceptor,
    ) {}

    public getHistory(): string[] {
        return this.outputHistory;
    }

    public handleData(
        data: any,
        isError: boolean,
        onStartupSuccess: () => void,
    ): void {
        let buffer = isError ? this.stderrBuffer : this.stdoutBuffer;
        buffer += data.toString();

        const lines = buffer.split("\n");
        // Keep the last incomplete line in the buffer
        const lastLine = lines.pop() || "";

        if (isError) this.stderrBuffer = lastLine;
        else this.stdoutBuffer = lastLine;

        lines.forEach((line) =>
            this.processLog(line, isError, onStartupSuccess),
        );
    }

    /**
     * Final flush of buffers on process exit.
     */
    public flush(onStartupSuccess: () => void): void {
        if (this.stdoutBuffer)
            this.processLog(this.stdoutBuffer, false, onStartupSuccess);
        if (this.stderrBuffer)
            this.processLog(this.stderrBuffer, true, onStartupSuccess);
    }

    public processLog(
        line: string,
        isError: boolean,
        onStartupSuccess: () => void,
    ): void {
        if (!line.trim()) return;

        // Strip ALL ANSI escape codes (more robust regex)
        const cleanLine = line
            .replace(
                /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
                "",
            )
            .trim();

        // Regex for Go tracing logs: handles optional ThreadId and source info
        const rustLogRegex =
            /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(INFO|WARN|ERROR)\s+(?:ThreadId\(\d+\)\s+)?(?:[\w\d_.-]+:\s+)?(?:[\/\w\d_.-]+:\d+:\s+)?(.*)$/;

        const match = cleanLine.match(rustLogRegex);
        let message = cleanLine;
        let level = isError ? "ERROR" : "INFO";

        if (match) {
            level = match[2];
            message = match[3];
        }

        // Internal Level Detection for Workers
        if (message.includes("[Worker ")) {
            const upperMsg = message.toUpperCase();
            // Detect custom levels in worker logs
            if (upperMsg.includes("[ERROR]") || upperMsg.includes("ERROR:")) {
                level = "ERROR";
            } else if (
                upperMsg.includes("[WARN]") ||
                upperMsg.includes("WARNING:") ||
                upperMsg.includes("[SECURITY]")
            ) {
                level = "WARN";
            }
        }

        // Check for startup success
        if (message.includes("XHSC Edition listening on")) {
            onStartupSuccess();
        }

        const prefix = "[XHSC]";
        let formattedMsg = message.startsWith("[")
            ? message
            : `${prefix} ${message}`;

        // Highlight URLs in logs
        if (
            formattedMsg.includes("http://") ||
            formattedMsg.includes("https://")
        ) {
            formattedMsg = formattedMsg.replace(
                /(https?:\/\/[^\s]+)/g,
                "\u001b[36m$1\u001b[0m",
            );
        }

        if (level === "ERROR") {
            (this.logger as any)._internal_error?.("server", formattedMsg) ||
                this.logger.error("server", formattedMsg);
        } else if (level === "WARN") {
            (this.logger as any)._internal_warn?.("server", formattedMsg) ||
                this.logger.warn("server", formattedMsg);
        } else {
            if (
                message.includes("listening on") ||
                message.includes("Worker ") ||
                message.includes("worker_id=") ||
                !match
            ) {
                (this.logger as any)._internal_info?.("server", formattedMsg) ||
                    this.logger.info("server", formattedMsg);
            } else {
                (this.logger as any)._internal_debug?.(
                    "server",
                    formattedMsg,
                ) || this.logger.debug("server", formattedMsg);
            }
        }

        // Keep history for error reporting on exit
        this.outputHistory.push(formattedMsg);
        if (this.outputHistory.length > this.MAX_HISTORY_LINES) {
            this.outputHistory.shift();
        }

        // Trigger console interception hooks for native logs
        if (this.consoleInterceptor) {
            this.consoleInterceptor.handleNativeLog({
                level,
                message: formattedMsg,
                timestamp: new Date(),
                component: "native",
                args: [],
            });
        }
    }

    public getCombinedOutput(): string {
        return this.stdoutBuffer + this.stderrBuffer;
    }
}

