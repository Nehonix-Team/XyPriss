import { Interface, Mod } from "reliant-type";

export const IXStaticSchem = Mod.deepPartial(
    Interface({
        /**
         * Size of the negative-lookup LRU cache.
         * Stores non-existent paths to prevent DDoS via disk hits.
         * @default 5000
         */
        lruCacheSize: "number?",

        /**
         * Default Cache-Control max-age for all static routes.
         * Can be a number (seconds) or string (e.g., "1d").
         */
        defaultMaxAge: "number?|string?",

        /**
         * Enable/Disable zero-copy file transfer via sendfile(2).
         * @default true
         */
        zeroCopy: "boolean?",

        /**
         * Maximum number of concurrent goroutines for static I/O in Go engine.
         * @default 1024
         */
        concurrencyPool: "number?",
    }),
);


