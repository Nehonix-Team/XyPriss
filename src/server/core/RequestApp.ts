import { Logger } from "../../../shared/logger/Logger";

/**
 * XyPrisRequestApp - An Express-compatible application object wrapper for requests.
 *
 * This class provides a robust implementation of the `req.app` property. It uses
 * a Proxy to allow transparent access to the main application instance while
 * providing specific methods for setting and getting application-level configurations.
 */
export class XyPrisRequestApp {
    private appInstance: any;
    private logger: Logger;

    constructor(appInstance: any, logger: Logger) {
        this.appInstance = appInstance;
        this.logger = logger;

        // Return a Proxy to allow transparent access to appInstance properties
        return new Proxy(this, {
            get: (target, prop, receiver) => {
                // If the property exists on this class, return it
                if (prop in target || prop === "constructor") {
                    return Reflect.get(target, prop, receiver);
                }

                // Otherwise, proxy to appInstance
                if (this.appInstance && prop in this.appInstance) {
                    const value = this.appInstance[prop];
                    if (typeof value === "function") {
                        return value.bind(this.appInstance);
                    }
                    return value;
                }

                return undefined;
            },
        });
    }

    /**
     * Retrieves a setting value from the application instance.
     *
     * This method first checks the `settings` object of the application,
     * and then falls back to checking direct properties on the application instance.
     * It ensures that functions are correctly bound to the application context.
     *
     * @param key - The setting key or property name to retrieve.
     * @returns The value associated with the key, or undefined if not found.
     */
    public get(key: string): any {
        if (!this.appInstance) return undefined;

        // Check settings first
        if (this.appInstance.settings && key in this.appInstance.settings) {
            return this.appInstance.settings[key];
        }

        // Check if it's a property on the app
        if (this.appInstance && key in this.appInstance) {
            const value = this.appInstance[key];
            if (typeof value === "function") {
                return value.bind(this.appInstance);
            }
            return value;
        }

        return undefined;
    }

    /**
     * Sets a configuration value on the application instance.
     *
     * This method attempts to use the application's `set` method if available.
     * Otherwise, it falls back to modifying the `settings` object or the
     * application instance directly. All changes are logged at the debug level.
     *
     * @param key - The configuration key to set.
     * @param value - The value to assign to the key.
     */
    public set(key: string, value: any): void {
        if (!this.appInstance) return;

        if (typeof this.appInstance.set === "function") {
            this.appInstance.set(key, value);
        } else if (this.appInstance.settings) {
            this.appInstance.settings[key] = value;
        } else {
            this.appInstance[key] = value;
        }

        this.logger.debug(
            "server",
            `[RequestApp] Set app setting: ${key} = ${value}`
        );
    }

    /**
     * Provides direct access to the application's Plugin Manager.
     *
     * @returns The PluginManager instance associated with the application.
     */
    public get pluginManager(): any {
        return this.appInstance?.pluginManager;
    }
}

