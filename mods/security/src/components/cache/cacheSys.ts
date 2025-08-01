import { existsSync, mkdirSync, statSync, readdirSync } from "fs";
import path from "path";
import { generateFilePath } from ".";
import {
    CachedData,
    FileCacheMetadata,
    FileCacheOptions,
    FileCacheStats,
    FileCacheCleanupOptions,
} from "./types/cache.type";
import {
    compressFileData,
    encryptFileData,
    decryptFileData,
    decompressFileData,
    ensureDirectoryExists,
} from "./cacheSys.utils";
import { Hash } from "../../core";
import fs from "fs/promises";
import * as crypto from "crypto";
import { promisify } from "util";
import zlib from "zlib";
import { DEFAULT_FILE_CACHE_CONFIG } from "./config/cache.config";
// Import check-disk-space with proper error handling
let checkDiskSpace: any;
try {
    checkDiskSpace = require("check-disk-space");
} catch (error) {
    console.warn(
        "check-disk-space package not available, using fallback disk monitoring"
    );
    checkDiskSpace = null;
}

/**
 * Comprehensive File Cache System
 */
export class FileCache {
    private config: Required<FileCacheOptions>;
    private stats: FileCacheStats = {
        fileCount: 0,
        totalSize: 0,
        hits: 0,
        misses: 0,
        cleanups: 0, 
        averageFileSize: 0,
        hitRate: 0,
        diskUsage: {
            used: 0,
            available: 0,
            percentage: 0,
        },
        ageDistribution: {
            fresh: 0,
            recent: 0,
            old: 0,
        },
        reads: 0,
        writes: 0,
        deletes: 0,
        errors: 0,
        totalFiles: 0,
        avgResponseTime: 0,
        lastCleanup: 0,
    };

    constructor(options: Partial<FileCacheOptions> = {}) {
        this.config = { ...DEFAULT_FILE_CACHE_CONFIG, ...options };
        this.ensureBaseDirectory();
        this.initializeStats();
    }

    /**
     * Initialize cache statistics by scanning existing files
     */
    private async initializeStats(): Promise<void> {
        try {
            const files = await this.getAllCacheFiles();
            let totalSize = 0;
            let validFiles = 0;
            const now = Date.now();
            const oneHour = 60 * 60 * 1000;
            const oneDay = 24 * oneHour;

            let fresh = 0;
            let recent = 0;
            let old = 0;

            for (const filePath of files) {
                try {
                    const fileStats = statSync(filePath);
                    const fileContent = await fs.readFile(filePath, "utf8");
                    const parsedContent = JSON.parse(fileContent);
                    const { metadata } = parsedContent;

                    // Skip expired files
                    if (now > metadata.expiresAt) {
                        continue;
                    }

                    validFiles++;
                    totalSize += fileStats.size;

                    // Calculate age distribution
                    const age = now - metadata.createdAt;
                    if (age < oneHour) {
                        fresh++;
                    } else if (age < oneDay) {
                        recent++;
                    } else {
                        old++;
                    }
                } catch (error) {
                    // Skip corrupted files
                    continue;
                }
            }

            this.stats.fileCount = validFiles;
            this.stats.totalFiles = validFiles;
            this.stats.totalSize = totalSize;
            this.stats.averageFileSize =
                validFiles > 0 ? totalSize / validFiles : 0;
            this.stats.ageDistribution = { fresh, recent, old };

            await this.updateDiskUsage();
        } catch (error) {
            console.error("Error initializing stats:", error);
        }
    }

    /**
     * Ensure base cache directory exists
     */
    private ensureBaseDirectory(): void {
        if (!existsSync(this.config.directory)) {
            mkdirSync(this.config.directory, { recursive: true });
        }
    }

    /**
     * Update cache statistics
     */
    private updateStats(): void {
        const totalRequests = this.stats.hits + this.stats.misses;
        this.stats.hitRate =
            totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
        this.stats.fileCount = this.stats.totalFiles;
        this.stats.averageFileSize =
            this.stats.totalFiles > 0
                ? this.stats.totalSize / this.stats.totalFiles
                : 0;
    }

    /**
     * Update disk usage statistics
     */
    private async updateDiskUsage(): Promise<void> {
        try {
            // Calculate cache directory size
            const directorySize = await this.getDirectorySize(
                this.config.directory
            );

            // Get real disk space information using check-disk-space
            if (checkDiskSpace && typeof checkDiskSpace === "function") {
                try {
                    const diskSpace = await checkDiskSpace(
                        this.config.directory
                    );

                    // Update disk usage with real values
                    this.stats.diskUsage.used = directorySize; // Cache directory size
                    this.stats.diskUsage.available = diskSpace.free; // Available disk space
                    this.stats.diskUsage.percentage =
                        diskSpace.size > 0
                            ? ((diskSpace.size - diskSpace.free) /
                                  diskSpace.size) *
                              100
                            : 0; // Percentage of total disk used
                } catch (diskSpaceError) {
                    console.warn(
                        "Could not get disk space, falling back to cache size limits!",
                        // diskSpaceError
                    );

                    // Fallback to cache size limits if disk space check fails
                    this.stats.diskUsage.used = directorySize;
                    this.stats.diskUsage.available = Math.max(
                        0,
                        this.config.maxCacheSize - directorySize
                    );
                    this.stats.diskUsage.percentage =
                        this.config.maxCacheSize > 0
                            ? (directorySize / this.config.maxCacheSize) * 100
                            : 0;
                }
            } else {
                // Package not available, use fallback
                this.stats.diskUsage.used = directorySize;
                this.stats.diskUsage.available = Math.max(
                    0,
                    this.config.maxCacheSize - directorySize
                );
                this.stats.diskUsage.percentage =
                    this.config.maxCacheSize > 0
                        ? (directorySize / this.config.maxCacheSize) * 100
                        : 0;
            }
        } catch (error) {
            console.error("Error updating disk usage:", error);

            // Set safe defaults on complete failure
            this.stats.diskUsage.used = 0;
            this.stats.diskUsage.available = this.config.maxCacheSize;
            this.stats.diskUsage.percentage = 0;
        }
    }

    /**
     * Calculate directory size recursively
     */
    private async getDirectorySize(dirPath: string): Promise<number> {
        let totalSize = 0;

        try {
            if (!existsSync(dirPath)) return 0;

            const entries = readdirSync(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    totalSize += await this.getDirectorySize(fullPath);
                } else {
                    const stats = statSync(fullPath);
                    totalSize += stats.size;
                }
            }
        } catch (error) {
            console.error("Error calculating directory size:", error);
        }

        return totalSize;
    }

    /**
     * Update age distribution statistics
     */
    private async updateAgeDistribution(): Promise<void> {
        try {
            const files = await this.getAllCacheFiles();
            const now = Date.now();
            const oneHour = 60 * 60 * 1000;
            const oneDay = 24 * oneHour;

            let fresh = 0;
            let recent = 0;
            let old = 0;

            for (const filePath of files) {
                try {
                    const fileContent = await fs.readFile(filePath, "utf8");
                    const parsedContent = JSON.parse(fileContent);
                    const { metadata } = parsedContent;

                    // Skip expired files
                    if (now > metadata.expiresAt) {
                        continue;
                    }

                    const age = now - metadata.createdAt;
                    if (age < oneHour) {
                        fresh++;
                    } else if (age < oneDay) {
                        recent++;
                    } else {
                        old++;
                    }
                } catch (error) {
                    // Skip corrupted files
                    continue;
                }
            }

            this.stats.ageDistribution = { fresh, recent, old };
        } catch (error) {
            console.error("Error updating age distribution:", error);
        }
    }

    /**
     * Write data to file cache
     */
    public async set(
        key: string,
        value: CachedData,
        options: Partial<FileCacheOptions> = {}
    ): Promise<boolean> {
        const startTime = Date.now();

        try {
            const config = { ...this.config, ...options };
            const filePath = generateFilePath(key, config);

            await ensureDirectoryExists(filePath);

            // Prepare data
            const serialized = JSON.stringify(value);

            // Check file size limit
            if (serialized.length > config.maxFileSize) {
                throw new Error(
                    `Data too large (max ${config.maxFileSize} bytes)`
                );
            }

            let processedData = serialized;
            let compressed = false;

            // Compress if enabled
            if (config.compress) {
                const result = await compressFileData(serialized);
                processedData = result.data;
                compressed = result.compressed;
            }

            // Create metadata
            const now = Date.now();
            const metadata: FileCacheMetadata = {
                key,
                createdAt: now,
                lastAccessed: now,
                expiresAt: now + config.ttl,
                size: processedData.length,
                accessCount: 0,
                compressed,
                encrypted: config.encrypt,
                dataType: typeof value,
                version: 1,
            };

            let finalData = processedData;
            let encryptionData: any = null;

            // Encrypt if enabled
            if (config.encrypt) {
                const result = encryptFileData(processedData);
                finalData = result.encrypted;
                encryptionData = {
                    iv: result.iv,
                    authTag: result.authTag,
                    key: result.key,
                };
            }

            // Prepare file content
            const fileContent = {
                metadata,
                data: finalData,
                encryption: encryptionData,
            };

            const fileContentString = JSON.stringify(fileContent, null, 2);
            const isNewFile = !existsSync(filePath);

            // Write file (atomic if enabled)
            if (config.atomic) {
                const tempPath = `${filePath}.tmp`;
                await fs.writeFile(tempPath, fileContentString, "utf8");
                await fs.rename(tempPath, filePath);
            } else {
                await fs.writeFile(filePath, fileContentString, "utf8");
            }

            // Update statistics
            this.stats.writes++;

            if (isNewFile) {
                this.stats.totalFiles++;
                this.stats.fileCount++;
            }

            this.stats.totalSize += fileContentString.length;

            // Update average response time
            const responseTime = Date.now() - startTime;
            this.stats.avgResponseTime =
                this.stats.writes === 1
                    ? responseTime
                    : (this.stats.avgResponseTime * (this.stats.writes - 1) +
                          responseTime) /
                      this.stats.writes;

            this.updateStats();
            await this.updateDiskUsage();

            return true;
        } catch (error) {
            console.error("File cache write error:", error);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Read data from file cache
     */
    public async get(
        key: string,
        updatedContent: boolean = false
    ): Promise<CachedData | null> {
        const startTime = Date.now();

        try {
            const filePath = generateFilePath(key, this.config);

            // Check if file exists
            if (!existsSync(filePath)) {
                this.stats.misses++;
                this.updateStats();
                return null;
            }

            // Read file
            const fileContent = await fs.readFile(filePath, "utf8");
            const parsedContent = JSON.parse(fileContent);

            const { metadata, data, encryption } = parsedContent;

            // Check expiration
            if (Date.now() > metadata.expiresAt) {
                await this.delete(key);
                this.stats.misses++;
                this.updateStats();
                return null;
            }

            let processedData = data;

            // Decrypt if needed
            if (metadata.encrypted && encryption) {
                processedData = decryptFileData(
                    data,
                    encryption.iv,
                    encryption.authTag,
                    encryption.key
                );
            }

            // Decompress if needed
            if (metadata.compressed) {
                processedData = await decompressFileData(processedData, true);
            }

            // Update metadata access info
            metadata.lastAccessed = Date.now();
            metadata.accessCount = (metadata.accessCount || 0) + 1;

            // Update the file with new access info (optional - might impact performance)
            if (updatedContent) {
                const updatedContent = {
                    metadata,
                    data,
                    encryption,
                };
                await fs.writeFile(
                    filePath,
                    JSON.stringify(updatedContent, null, 2),
                    "utf8"
                );
            }

            // Update statistics
            this.stats.reads++;
            this.stats.hits++;

            const responseTime = Date.now() - startTime;
            this.stats.avgResponseTime =
                this.stats.reads === 1
                    ? responseTime
                    : (this.stats.avgResponseTime * (this.stats.reads - 1) +
                          responseTime) /
                      this.stats.reads;

            this.updateStats();

            return JSON.parse(processedData);
        } catch (error) {
            console.error("File cache read error:", error);
            this.stats.errors++;
            this.stats.misses++;
            this.updateStats();
            return null;
        }
    }

    /**
     * Delete cache entry
     */
    public async delete(key: string): Promise<boolean> {
        try {
            const filePath = generateFilePath(key, this.config);

            if (existsSync(filePath)) {
                const fileStats = statSync(filePath);
                await fs.unlink(filePath);

                this.stats.deletes++;
                this.stats.totalFiles = Math.max(0, this.stats.totalFiles - 1);
                this.stats.fileCount = Math.max(0, this.stats.fileCount - 1);
                this.stats.totalSize = Math.max(
                    0,
                    this.stats.totalSize - fileStats.size
                );

                this.updateStats();
                await this.updateDiskUsage();

                return true;
            }

            return false;
        } catch (error) {
            console.error("File cache delete error:", error);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Check if key exists and is not expired
     */
    public async has(key: string): Promise<boolean> {
        try {
            const filePath = generateFilePath(key, this.config);

            if (!existsSync(filePath)) {
                return false;
            }

            const fileContent = await fs.readFile(filePath, "utf8");
            const parsedContent = JSON.parse(fileContent);
            const { metadata } = parsedContent;

            if (Date.now() > metadata.expiresAt) {
                await this.delete(key);
                return false;
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Clear all cache files
     */
    public async clear(): Promise<void> {
        try {
            if (existsSync(this.config.directory)) {
                await this.deleteDirectory(this.config.directory);
                mkdirSync(this.config.directory, { recursive: true });
            }

            this.stats = {
                fileCount: 0,
                totalSize: 0,
                hits: 0,
                misses: 0,
                cleanups: 0,
                averageFileSize: 0,
                hitRate: 0,
                diskUsage: {
                    used: 0,
                    available: 0,
                    percentage: 0,
                },
                ageDistribution: {
                    fresh: 0,
                    recent: 0,
                    old: 0,
                },
                reads: 0,
                writes: 0,
                deletes: 0,
                errors: 0,
                totalFiles: 0,
                avgResponseTime: 0,
                lastCleanup: Date.now(),
            };
        } catch (error) {
            console.error("File cache clear error:", error);
        }
    }

    /**
     * Recursively delete directory
     */
    private async deleteDirectory(dir: string): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        await Promise.all(
            entries.map(async (entry) => {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await this.deleteDirectory(fullPath);
                } else {
                    await fs.unlink(fullPath);
                }
            })
        );

        await fs.rmdir(dir);
    }

    /**
     * Cleanup expired entries
     */
    public async cleanup(
        _options: Partial<FileCacheCleanupOptions> = {}
    ): Promise<{
        cleaned: number;
        errors: number;
        totalSize: number;
    }> {
        let cleaned = 0;
        let errors = 0;
        let totalSize = 0;

        try {
            const files = await this.getAllCacheFiles();

            for (const filePath of files) {
                try {
                    const fileContent = await fs.readFile(filePath, "utf8");
                    const parsedContent = JSON.parse(fileContent);
                    const { metadata } = parsedContent;

                    // Check if expired
                    if (Date.now() > metadata.expiresAt) {
                        const fileStats = statSync(filePath);
                        await fs.unlink(filePath);

                        cleaned++;
                        totalSize += fileStats.size;
                    }
                } catch (error) {
                    errors++;
                    console.error(
                        `Error processing cache file ${filePath}:`,
                        error
                    );
                }
            }

            this.stats.lastCleanup = Date.now();
            this.stats.cleanups++;
            this.stats.totalFiles = Math.max(
                0,
                this.stats.totalFiles - cleaned
            );
            this.stats.fileCount = Math.max(0, this.stats.fileCount - cleaned);
            this.stats.totalSize = Math.max(
                0,
                this.stats.totalSize - totalSize
            );

            this.updateStats();
            await this.updateDiskUsage();
            await this.updateAgeDistribution();
        } catch (error) {
            console.error("File cache cleanup error:", error);
            errors++;
            this.stats.errors++;
        }

        return { cleaned, errors, totalSize };
    }

    /**
     * Get all cache files recursively
     */
    private async getAllCacheFiles(): Promise<string[]> {
        const files: string[] = [];

        const scanDirectory = async (dir: string) => {
            if (!existsSync(dir)) return;

            const entries = readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    await scanDirectory(fullPath);
                } else if (entry.name.endsWith(this.config.extension)) {
                    files.push(fullPath);
                }
            }
        };

        await scanDirectory(this.config.directory);
        return files;
    }

    /**
     * Get cache statistics with real-time updates
     */
    public async getStats(): Promise<FileCacheStats> {
        await this.updateDiskUsage();
        await this.updateAgeDistribution();
        this.updateStats();
        return { ...this.stats };
    }

    /**
     * Get cache size information
     */
    public get size(): { files: number; bytes: number } {
        return {
            files: this.stats.totalFiles,
            bytes: this.stats.totalSize,
        };
    }

    /**
     * Get detailed cache information
     */
    public async getCacheInfo(): Promise<{
        config: Required<FileCacheOptions>;
        stats: FileCacheStats;
        health: {
            healthy: boolean;
            issues: string[];
            recommendations: string[];
        };
    }> {
        const stats = await this.getStats();
        const issues: string[] = [];
        const recommendations: string[] = [];

        // Health checks
        if (stats.hitRate < 50) {
            issues.push("Low cache hit rate");
            recommendations.push(
                "Consider increasing TTL or reviewing cache keys"
            );
        }

        if (stats.diskUsage.percentage > 90) {
            issues.push("High disk usage");
            recommendations.push("Run cleanup or increase cache size limit");
        }

        if (stats.errors > stats.reads * 0.1) {
            issues.push("High error rate");
            recommendations.push(
                "Check file system permissions and disk space"
            );
        }

        return {
            config: this.config,
            stats,
            health: {
                healthy: issues.length === 0,
                issues,
                recommendations,
            },
        };
    }
}
