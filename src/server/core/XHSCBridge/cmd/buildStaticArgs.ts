/**
 * Build static file serving arguments for XHSC engine.
 */
export function buildStaticArgs(staticConf: any): string[] {
    if (!staticConf) return [];

    const args: string[] = [];

    if (staticConf.zeroCopy !== undefined) {
        args.push(`--static-zero-copy=${staticConf.zeroCopy}`);
    } else {
        args.push("--static-zero-copy=true"); // Default
    }

    if (staticConf.concurrencyPool !== undefined) {
        args.push("--static-concurrency", staticConf.concurrencyPool.toString());
    } else {
        args.push("--static-concurrency", "1024"); // Default
    }

    if (staticConf.lruCacheSize !== undefined) {
        args.push("--static-lru-size", staticConf.lruCacheSize.toString());
    } else {
        args.push("--static-lru-size", "5000"); // Default
    }

    if (staticConf.dotfiles !== undefined) {
        args.push("--static-dotfiles", staticConf.dotfiles);
    } else {
        args.push("--static-dotfiles", "deny"); // Default
    }

    if (staticConf.maxAge !== undefined) {
        args.push("--static-max-age", staticConf.maxAge.toString());
    }

    return args;
}
