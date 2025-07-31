/**
 * Executable Builder for TypeScript Executor
 * Creates standalone executables for different platforms
 */

import { execSync, spawn } from "child_process";
import {
    existsSync,
    readFileSync,
    writeFileSync,
    mkdirSync,
    copyFileSync,
} from "fs";
import { join, dirname, basename } from "path";

export interface BuildConfig {
    outputDir?: string;
    platforms?: ("win32" | "linux" | "darwin")[];
    verbose?: boolean;
    includeNodeModules?: boolean;
    minify?: boolean;
    bundler?: "pkg" | "nexe" | "webpack" | "esbuild";
}

export class ExecutableBuilder {
    private config: BuildConfig;
    private projectRoot: string;

    constructor(config: BuildConfig = {}) {
        this.config = {
            outputDir: join(process.cwd(), "dist", "executables"),
            platforms: ["win32", "linux", "darwin"],
            verbose: false,
            includeNodeModules: true,
            minify: true,
            bundler: "esbuild",
            ...config,
        };

        this.projectRoot = process.cwd();
    }

    /**
     * Build executables for all specified platforms
     */
    public async buildAll(): Promise<void> {
        if (this.config.verbose) {
            console.log("🔨 Starting executable build process...");
        }

        // Ensure output directory exists
        this.ensureOutputDir();

        // Create the main executable script
        await this.createMainScript();

        // Build for each platform
        for (const platform of this.config.platforms!) {
            await this.buildForPlatform(platform);
        }

        if (this.config.verbose) {
            console.log("✔ All executables built successfully!");
        }
    }

    /**
     * Build executable for specific platform
     */
    public async buildForPlatform(
        platform: "win32" | "linux" | "darwin"
    ): Promise<void> {
        if (this.config.verbose) {
            console.log(`🔨 Building for ${platform}...`);
        }

        const outputName = this.getExecutableName(platform);
        const outputPath = join(this.config.outputDir!, outputName);

        try {
            switch (this.config.bundler) {
                case "esbuild":
                    await this.buildWithEsbuild(platform, outputPath);
                    break;
                case "pkg":
                    await this.buildWithPkg(platform, outputPath);
                    break;
                case "nexe":
                    await this.buildWithNexe(platform, outputPath);
                    break;
                case "webpack":
                    await this.buildWithWebpack(platform, outputPath);
                    break;
                default:
                    throw new Error(
                        `Unsupported bundler: ${this.config.bundler}`
                    );
            }

            if (this.config.verbose) {
                console.log(`✔ Built ${outputName} successfully`);
            }
        } catch (error: any) {
            console.error(
                `Failed to build for ${platform}: ${error.message}`
            );
            throw error;
        }
    }

    /**
     * Create main executable script
     */
    private async createMainScript(): Promise<void> {
        const mainScript = `#!/usr/bin/env node
/**
 * Standalone TypeScript Executor
 * Self-contained executable for TypeScript file execution
 */

const { TypeScriptExecutor } = require('./TypeScriptExecutor');
const path = require('path');
const process = require('process');

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.error('Usage: ts-executor <script.ts> [args...]');
        process.exit(1);
    }

    const scriptPath = path.resolve(args[0]);
    const scriptArgs = args.slice(1);

    const executor = new TypeScriptExecutor({
        verbose: process.env.TS_EXECUTOR_VERBOSE === 'true',
        fallbackToNode: true,
    });

    try {
        const result = await executor.executeTypeScript(scriptPath, scriptArgs);
        
        if (!result.success) {
            console.error('Execution failed:', result.error);
            process.exit(1);
        }

        // Spawn the process
        const childProcess = executor.spawnProcess(result, {
            stdio: 'inherit',
            detached: false,
        });

        childProcess.on('exit', (code, signal) => {
            executor.cleanup();
            process.exit(code || 0);
        });

        childProcess.on('error', (error) => {
            console.error('Process error:', error.message);
            executor.cleanup();
            process.exit(1);
        });

        // Handle process termination
        process.on('SIGINT', () => {
            childProcess.kill('SIGINT');
        });

        process.on('SIGTERM', () => {
            childProcess.kill('SIGTERM');
        });

    } catch (error) {
        console.error('Executor error:', error.message);
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Fatal error:', error.message);
    process.exit(1);
});
`;

        const mainScriptPath = join(
            this.config.outputDir!,
            "ts-executor-main.js"
        );
        writeFileSync(mainScriptPath, mainScript);

        if (this.config.verbose) {
            console.log(`Created main script: ${mainScriptPath}`);
        }
    }

    /**
     * Build with esbuild (fastest, recommended)
     */
    private async buildWithEsbuild(
        platform: string,
        outputPath: string
    ): Promise<void> {
        try {
            // Check if esbuild is available
            execSync("npx esbuild --version", { stdio: "pipe" });
        } catch {
            throw new Error(
                "esbuild not found. Install with: npm install -D esbuild"
            );
        }

        const entryPoint = join(__dirname, "TypeScriptExecutor.ts");
        const bundlePath = join(this.config.outputDir!, "bundle.js");

        // Bundle the TypeScript code
        const buildCommand = [
            "npx esbuild",
            entryPoint,
            "--bundle",
            "--platform=node",
            "--target=node18",
            "--format=cjs",
            `--outfile=${bundlePath}`,
            "--external:typescript", // Keep TypeScript as external for runtime loading
            this.config.minify ? "--minify" : "",
        ]
            .filter(Boolean)
            .join(" ");

        execSync(buildCommand, {
            stdio: this.config.verbose ? "inherit" : "pipe",
        });

        // Create the final executable script
        const executableScript = `#!/usr/bin/env node
${readFileSync(bundlePath, "utf8")}
${readFileSync(join(this.config.outputDir!, "ts-executor-main.js"), "utf8")}
`;

        writeFileSync(outputPath, executableScript);

        // Make executable on Unix systems
        if (platform !== "win32") {
            execSync(`chmod +x "${outputPath}"`);
        }
    }

    /**
     * Build with pkg
     */
    private async buildWithPkg(
        platform: string,
        outputPath: string
    ): Promise<void> {
        try {
            execSync("npx pkg --version", { stdio: "pipe" });
        } catch {
            throw new Error("pkg not found. Install with: npm install -D pkg");
        }

        const target = this.getPkgTarget(platform);
        const entryPoint = join(this.config.outputDir!, "ts-executor-main.js");

        const pkgCommand = [
            "npx pkg",
            entryPoint,
            `--target=${target}`,
            `--output=${outputPath}`,
            "--compress=GZip",
        ].join(" ");

        execSync(pkgCommand, {
            stdio: this.config.verbose ? "inherit" : "pipe",
        });
    }

    /**
     * Build with nexe
     */
    private async buildWithNexe(
        platform: string,
        outputPath: string
    ): Promise<void> {
        try {
            execSync("npx nexe --version", { stdio: "pipe" });
        } catch {
            throw new Error(
                "nexe not found. Install with: npm install -D nexe"
            );
        }

        const target = this.getNexeTarget(platform);
        const entryPoint = join(this.config.outputDir!, "ts-executor-main.js");

        const nexeCommand = [
            "npx nexe",
            entryPoint,
            `--target=${target}`,
            `--output=${outputPath}`,
            "--build",
        ].join(" ");

        execSync(nexeCommand, {
            stdio: this.config.verbose ? "inherit" : "pipe",
        });
    }

    /**
     * Build with webpack
     */
    private async buildWithWebpack(
        platform: string,
        outputPath: string
    ): Promise<void> {
        // Create webpack config and build
        const webpackConfig = this.createWebpackConfig(platform, outputPath);
        const configPath = join(this.config.outputDir!, "webpack.config.js");

        writeFileSync(
            configPath,
            `module.exports = ${JSON.stringify(webpackConfig, null, 2)};`
        );

        try {
            execSync(`npx webpack --config ${configPath}`, {
                stdio: this.config.verbose ? "inherit" : "pipe",
            });
        } catch {
            throw new Error(
                "webpack not found. Install with: npm install -D webpack webpack-cli"
            );
        }
    }

    /**
     * Get executable name for platform
     */
    private getExecutableName(platform: string): string {
        const baseName = "ts-executor";
        return platform === "win32" ? `${baseName}.exe` : baseName;
    }

    /**
     * Get pkg target for platform
     */
    private getPkgTarget(platform: string): string {
        const nodeVersion = "node18";
        switch (platform) {
            case "win32":
                return `${nodeVersion}-win-x64`;
            case "linux":
                return `${nodeVersion}-linux-x64`;
            case "darwin":
                return `${nodeVersion}-macos-x64`;
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
    }

    /**
     * Get nexe target for platform
     */
    private getNexeTarget(platform: string): string {
        switch (platform) {
            case "win32":
                return "windows-x64-18.0.0";
            case "linux":
                return "linux-x64-18.0.0";
            case "darwin":
                return "mac-x64-18.0.0";
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
    }

    /**
     * Create webpack configuration
     */
    private createWebpackConfig(platform: string, outputPath: string): any {
        return {
            mode: this.config.minify ? "production" : "development",
            target: "node",
            entry: join(this.config.outputDir!, "ts-executor-main.js"),
            output: {
                path: dirname(outputPath),
                filename: basename(outputPath),
            },
            externals: {
                typescript: "commonjs typescript",
            },
            resolve: {
                extensions: [".js", ".ts"],
            },
            module: {
                rules: [
                    {
                        test: /\.ts$/,
                        use: "ts-loader",
                        exclude: /node_modules/,
                    },
                ],
            },
        };
    }

    /**
     * Ensure output directory exists
     */
    private ensureOutputDir(): void {
        if (!existsSync(this.config.outputDir!)) {
            mkdirSync(this.config.outputDir!, { recursive: true });
        }
    }
}

export default ExecutableBuilder;

