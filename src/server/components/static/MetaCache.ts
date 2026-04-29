/**
 * Lightweight LRU Cache for negative path lookups (anti-DDoS).
 */
export class XStaticMetaCache {
    private cache: Map<string, { exists: boolean; expires: number }> =
        new Map();
    private keys: string[] = [];

    constructor(private maxSize: number) {}

    public get(path: string): { exists: boolean } | null {
        const item = this.cache.get(path);
        if (!item) return null;
        if (Date.now() > item.expires) {
            this.delete(path);
            return null;
        }
        return { exists: item.exists };
    }

    public set(path: string, exists: boolean, ttlMs: number = 30000): void {
        if (this.cache.has(path)) {
            this.delete(path);
        } else if (this.keys.length >= this.maxSize) {
            const oldest = this.keys.shift();
            if (oldest) this.cache.delete(oldest);
        }

        this.cache.set(path, { exists, expires: Date.now() + ttlMs });
        this.keys.push(path);
    }

    private delete(path: string): void {
        this.cache.delete(path);
        const idx = this.keys.indexOf(path);
        if (idx > -1) this.keys.splice(idx, 1);
    }
}