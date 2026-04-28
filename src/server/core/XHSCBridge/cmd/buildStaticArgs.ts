import { XServerOptions } from "../../../../types/ServerOptions";

/**
 * Builds CLI arguments for static file serving configuration.
 * 
 * @param config Static configuration from ServerOptions
 * @returns Array of CLI flags for XHSC
 */
export function buildStaticArgs(config: XServerOptions["static"]): string[] {
    if (!config) return [];

    const args: string[] = [];

    if (config.zeroCopy !== undefined) {
        args.push("--static-zero-copy", config.zeroCopy.toString());
    }

    if (config.ConcurrencyPool !== undefined) {
        args.push("--static-concurrency", config.ConcurrencyPool.toString());
    }

    if (config.lruCacheSize !== undefined) {
        args.push("--static-lru-size", config.lruCacheSize.toString());
    }

    if (config.dotfiles !== undefined) {
        args.push("--static-dotfiles", config.dotfiles);
    }

    if (config.maxAge !== undefined) {
        args.push("--static-max-age", config.maxAge);
    }

    return args;
}
