export interface SwaggerConfig {
    /**
     * The path where the UI will be served.
     * @default "/docs"
     */
    path?: string;

    title?: string;
    version?: string;
    description?: string;
    /**
     * Port to launch the isolated documentation server on.
     * @default 7070
     */
    port?: number;
}

