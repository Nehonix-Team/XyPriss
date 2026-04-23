import { XyPrissApp } from "../../types/types";
import { ConsoleInterceptor } from "../components/fastapi/console/ConsoleInterceptor";

export class LogTracingMethods {
    constructor(
        private app: XyPrissApp,
        private consoleInterceptor: ConsoleInterceptor,
    ) {}

    public addConsoleInterceptionMethods(): void {
        this.app.getConsoleInterceptor = () => this.consoleInterceptor;
        this.app.enableConsoleInterception = async () =>
            await this.consoleInterceptor.start();
        this.app.disableConsoleInterception = async () =>
            await this.consoleInterceptor.stop();
        this.app.getConsoleStats = async () =>
            await this.consoleInterceptor.getStats();

        this.app.updateConsoleConfig = async (config: any) =>
            await this.consoleInterceptor.updateConfig(config);

        // Stub out legacy methods with warnings to help migration
        const warnLegacy = (method: string) => {
            (this.app as any).logger.warn(
                "console",
                `Method '${method}' is deprecated. Migration to native Go interception complete.`,
            );
        };

        this.app.enableConsoleEncryption = (key?: string) => {
            warnLegacy("enableConsoleEncryption");
            if (key)
                this.consoleInterceptor.updateConfig({
                    encryption: { enabled: true, key },
                });
        };
        this.app.disableConsoleEncryption = () => {
            warnLegacy("disableConsoleEncryption");
            this.consoleInterceptor.updateConfig({
                encryption: { enabled: false },
            });
        };
    }
}

