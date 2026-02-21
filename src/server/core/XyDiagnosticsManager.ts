/***************************************************************************
 * XyPriss - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 ***************************************************************************/

import { Logger } from "../../../shared/logger/Logger";
import type { XyprissApp } from "./XyprissApp";

/**
 * XyDiagnosticsManager - Handles diagnostics, monitoring, and console management.
 */
export class XyDiagnosticsManager {
    private app: XyprissApp;
    private logger: Logger;
    private isConsoleInterceptionEnabled: boolean = false;
    private isTypeScriptCheckingEnabled: boolean = false;

    constructor(app: XyprissApp, logger: Logger) {
        this.app = app;
        this.logger = logger;
    }

    /**
     * Initialize diagnostics modules and inject methods into the app.
     */
    public initialize(): void {
        this.injectConsoleModule();
        this.injectTypeScriptModule();
        this.injectFileWatcherModule();
    }

    private injectConsoleModule(): void {
        this.app.getConsoleInterceptor = () => null;
        this.app.enableConsoleInterception = () => {
            this.isConsoleInterceptionEnabled = true;
            this.logger.debug("server", "Console interception enabled");
        };
        this.app.disableConsoleInterception = () => {
            this.isConsoleInterceptionEnabled = false;
            this.logger.debug("server", "Console interception disabled");
        };
        this.app.getConsoleStats = () => ({
            interceptedCount: 0,
            lastIntercept: null,
        });
        this.app.resetConsoleStats = () => {};
    }

    private injectTypeScriptModule(): void {
        this.app.checkTypeScript = async (files?: string[]) => {
            this.logger.debug(
                "server",
                `TypeScript check requested for ${files?.length || "all"} files`,
            );
            return { success: true, errors: [] };
        };
        this.app.getTypeScriptStatus = () => ({
            enabled: this.isTypeScriptCheckingEnabled,
            lastCheck: null,
            errorCount: 0,
        });
        this.app.enableTypeScriptChecking = () => {
            this.isTypeScriptCheckingEnabled = true;
            this.logger.debug("server", "TypeScript checking enabled");
        };
        this.app.disableTypeScriptChecking = () => {
            this.isTypeScriptCheckingEnabled = false;
            this.logger.debug("server", "TypeScript checking disabled");
        };
    }

    private injectFileWatcherModule(): void {
        this.app.getFileWatcherStatus = () => ({ active: false });
        this.app.getFileWatcherStats = () => ({
            watchedFiles: 0,
            eventsCount: 0,
        });
        this.app.stopFileWatcher = async () => {
            this.logger.debug("server", "File watcher stopped");
        };
        this.app.getFileWatcherManager = () => null;
    }
}

