import { Logger } from "../../../shared/logger/Logger";

/**
 * XyPrisRequestApp - Express-compatible app object for requests
 * Provides a robust implementation of the req.app property
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
     * Get a setting value (Express compatibility)
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
     * Set a setting value (Express compatibility)
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
     * Access the plugin manager
     */
    public get pluginManager(): any {
        return this.appInstance?.pluginManager;
    }
}

