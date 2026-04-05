import { XyPrissApp } from "../../types/types";
import { ConsoleInterceptor } from "../components/fastapi/console/ConsoleInterceptor";

export class LogTracingMethods {
    constructor(
        private app: XyPrissApp,
        private consoleInterceptor: ConsoleInterceptor,
    ) {}

    public addConsoleInterceptionMethods(): void {
        this.app.getConsoleInterceptor = () => this.consoleInterceptor;
        this.app.enableConsoleInterception = () =>
            this.consoleInterceptor.start();
        this.app.disableConsoleInterception = () =>
            this.consoleInterceptor.stop();
        this.app.getConsoleStats = () => this.consoleInterceptor.getStats();
        this.app.resetConsoleStats = () => this.consoleInterceptor.resetStats();

        this.app.enableConsoleEncryption = (key?: string) =>
            this.consoleInterceptor.enableEncryption(key);
        this.app.disableConsoleEncryption = () =>
            this.consoleInterceptor.disableEncryption();
        this.app.encrypt = (key: string) =>
            this.consoleInterceptor.encrypt(key);
        this.app.setConsoleEncryptionKey = (key: string) =>
            this.consoleInterceptor.setEncryptionKey(key);
        this.app.setConsoleEncryptionDisplayMode = (
            displayMode: "readable" | "encrypted" | "both",
            showEncryptionStatus?: boolean,
        ) =>
            this.consoleInterceptor.setEncryptionDisplayMode(
                displayMode,
                showEncryptionStatus,
            );

        this.app.getEncryptedLogs = () =>
            this.consoleInterceptor.getEncryptedLogs();
        this.app.restoreConsoleFromEncrypted = async (
            encryptedData: string[],
            key: string,
        ) =>
            await this.consoleInterceptor.restoreFromEncrypted(
                encryptedData,
                key,
            );

        this.app.isConsoleEncryptionEnabled = () =>
            this.consoleInterceptor.isEncryptionEnabled();
        this.app.getConsoleEncryptionStatus = () =>
            this.consoleInterceptor.getEncryptionStatus();

        this.app.enableConsoleTracing = (maxBufferSize?: number) =>
            this.consoleInterceptor.enableTracing(maxBufferSize);
        this.app.disableConsoleTracing = () =>
            this.consoleInterceptor.disableTracing();
        this.app.onConsoleTrace = (hook: (log: any) => void) =>
            this.consoleInterceptor.onTrace(hook);
        this.app.getConsoleTraceBuffer = () =>
            this.consoleInterceptor.getTraceBuffer();
        this.app.clearConsoleTraceBuffer = () =>
            this.consoleInterceptor.clearTraceBuffer();
    }
}

