/**
 * TypeScript Type Checker
 * Provides real-time TypeScript error detection and reporting
 */

import ts from "typescript";
import * as fs from "fs";
import * as path from "path";
import { logger } from "../../../../../shared/logger/Logger";

export interface TypeScriptError {
    file: string;
    line: number;
    column: number;
    message: string;
    code: number;
    severity: "error" | "warning" | "info";
    category: string;
    source: string;
}

export interface TypeCheckResult {
    success: boolean;
    errors: TypeScriptError[];
    warnings: TypeScriptError[];
    totalFiles: number;
    checkedFiles: string[];
    duration: number;
    timestamp: Date;
}

export interface TypeScriptCheckerConfig {
    enabled: boolean;
    configFile?: string; // Path to tsconfig.json
    watchMode: boolean;
    checkOnSave: boolean;
    showWarnings: boolean;
    showInfos: boolean;
    maxErrors: number;
    excludePatterns: string[];
    includePatterns: string[];
    verbose: boolean;
}

export class TypeScriptChecker {
    private config: TypeScriptCheckerConfig;
    private program: ts.Program | null = null;
    private compilerOptions: ts.CompilerOptions = {};
    private configPath: string;
    private lastCheckTime: Date = new Date();
    private isChecking: boolean = false;

    constructor(config: TypeScriptCheckerConfig) {
        this.config = {
            ...config,
            enabled: config.enabled ?? true,
            watchMode: config.watchMode ?? false,
            checkOnSave: config.checkOnSave ?? true,
            showWarnings: config.showWarnings ?? true,
            showInfos: config.showInfos ?? false,
            maxErrors: config.maxErrors ?? 50,
            excludePatterns: config.excludePatterns ?? [
                "node_modules",
                "dist",
                "build",
                ".git",
            ],
            includePatterns: config.includePatterns ?? ["**/*.ts", "**/*.tsx"],
            verbose: config.verbose ?? false,
        };

        this.configPath = this.findTsConfig();
        this.loadCompilerOptions();
    }

    /**
     * Find tsconfig.json file
     */
    private findTsConfig(): string {
        if (this.config.configFile && fs.existsSync(this.config.configFile)) {
            return this.config.configFile;
        }

        // Search for tsconfig.json in current directory and parent directories
        let currentDir = process.cwd();
        while (currentDir !== path.dirname(currentDir)) {
            const configPath = path.join(currentDir, "tsconfig.json");
            if (fs.existsSync(configPath)) {
                return configPath;
            }
            currentDir = path.dirname(currentDir);
        }

        // Default fallback
        return path.join(process.cwd(), "tsconfig.json");
    }

    /**
     * Load TypeScript compiler options
     */
    private loadCompilerOptions(): void {
        try {
            if (fs.existsSync(this.configPath)) {
                const configFile = ts.readConfigFile(
                    this.configPath,
                    ts.sys.readFile
                );
                if (configFile.error) {
                    logger.warn(
                        "typescript",
                        `Error reading tsconfig.json: ${configFile.error.messageText}`
                    );
                    this.compilerOptions = this.getDefaultCompilerOptions();
                    return;
                }

                const parsedConfig = ts.parseJsonConfigFileContent(
                    configFile.config,
                    ts.sys,
                    path.dirname(this.configPath)
                );

                if (parsedConfig.errors.length > 0) {
                    logger.warn("typescript", "TypeScript config errors found");
                    parsedConfig.errors.forEach((error) => {
                        logger.warn(
                            "typescript",
                            `Config error: ${error.messageText}`
                        );
                    });
                }

                this.compilerOptions = parsedConfig.options;
                if (this.config.verbose) {
                    logger.debug(
                        "typescript",
                        `Loaded TypeScript config from: ${this.configPath}`
                    );
                }
            } else {
                logger.warn(
                    "typescript",
                    `tsconfig.json not found at: ${this.configPath}`
                );
                this.compilerOptions = this.getDefaultCompilerOptions();
            }
        } catch (error: any) {
            logger.error(
                "typescript",
                `Failed to load TypeScript config: ${error.message}`
            );
            this.compilerOptions = this.getDefaultCompilerOptions();
        }
    }

    /**
     * Get default compiler options
     */
    private getDefaultCompilerOptions(): ts.CompilerOptions {
        return {
            target: ts.ScriptTarget.ES2020,
            module: ts.ModuleKind.CommonJS,
            lib: ["ES2020", "DOM"],
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            moduleResolution: ts.ModuleResolutionKind.Node10,
            allowSyntheticDefaultImports: true,
            noEmit: true, // We only want type checking, not compilation
        };
    }

    /**
     * Get TypeScript files to check
     */
    private getFilesToCheck(specificFiles?: string[]): string[] {
        if (specificFiles && specificFiles.length > 0) {
            return specificFiles.filter(
                (file) => file.endsWith(".ts") || file.endsWith(".tsx")
            );
        }

        // Get all TypeScript files in the project
        const files: string[] = [];
        const searchPaths = ["src", "lib", "app", "."];

        for (const searchPath of searchPaths) {
            if (fs.existsSync(searchPath)) {
                this.findTypeScriptFiles(searchPath, files);
            }
        }

        return files;
    }

    /**
     * Recursively find TypeScript files
     */
    private findTypeScriptFiles(dir: string, files: string[]): void {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                // Skip excluded patterns
                if (
                    this.config.excludePatterns.some((pattern) =>
                        fullPath.includes(pattern)
                    )
                ) {
                    continue;
                }

                if (entry.isDirectory()) {
                    this.findTypeScriptFiles(fullPath, files);
                } else if (
                    entry.isFile() &&
                    (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))
                ) {
                    files.push(fullPath);
                }
            }
        } catch (error: any) {
            if (this.config.verbose) {
                logger.debug(
                    "typescript",
                    `Error reading directory ${dir}: ${error.message}`
                );
            }
        }
    }

    /**
     * Check TypeScript files for errors
     */
    public async checkFiles(
        specificFiles?: string[]
    ): Promise<TypeCheckResult> {
        if (!this.config.enabled) {
            return {
                success: true,
                errors: [],
                warnings: [],
                totalFiles: 0,
                checkedFiles: [],
                duration: 0,
                timestamp: new Date(),
            };
        }

        if (this.isChecking) {
            logger.debug(
                "typescript",
                "Type check already in progress, skipping"
            );
            return {
                success: false,
                errors: [],
                warnings: [],
                totalFiles: 0,
                checkedFiles: [],
                duration: 0,
                timestamp: new Date(),
            };
        }

        this.isChecking = true;
        const startTime = Date.now();

        try {
            const filesToCheck = this.getFilesToCheck(specificFiles);

            if (filesToCheck.length === 0) {
                logger.debug(
                    "typescript",
                    "No TypeScript files found to check"
                );
                return {
                    success: true,
                    errors: [],
                    warnings: [],
                    totalFiles: 0,
                    checkedFiles: [],
                    duration: Date.now() - startTime,
                    timestamp: new Date(),
                };
            }

            if (this.config.verbose) {
                logger.debug(
                    "typescript",
                    `Checking ${filesToCheck.length} TypeScript files`
                );
            }

            // Create TypeScript program
            this.program = ts.createProgram(filesToCheck, this.compilerOptions);

            // Get diagnostics
            const allDiagnostics = ts.getPreEmitDiagnostics(this.program);

            // Process diagnostics
            const errors: TypeScriptError[] = [];
            const warnings: TypeScriptError[] = [];

            for (const diagnostic of allDiagnostics) {
                const tsError = this.processDiagnostic(diagnostic);
                if (tsError) {
                    if (tsError.severity === "error") {
                        errors.push(tsError);
                    } else if (
                        tsError.severity === "warning" &&
                        this.config.showWarnings
                    ) {
                        warnings.push(tsError);
                    }
                }

                // Limit errors to prevent overwhelming output
                if (errors.length >= this.config.maxErrors) {
                    logger.warn(
                        "typescript",
                        `Reached maximum error limit (${this.config.maxErrors}), stopping check`
                    );
                    break;
                }
            }

            const duration = Date.now() - startTime;
            const success = errors.length === 0;

            // Log results
            if (errors.length > 0) {
                logger.error(
                    "typescript",
                    `❌ TypeScript check failed: ${errors.length} errors found`
                );
                errors.slice(0, 5).forEach((error) => {
                    logger.error(
                        "typescript",
                        `  ${error.file}:${error.line}:${error.column} - ${error.message}`
                    );
                });
                if (errors.length > 5) {
                    logger.error(
                        "typescript",
                        `  ... and ${errors.length - 5} more errors`
                    );
                }
            } else {
                logger.info(
                    "typescript",
                    `✅ TypeScript check passed (${filesToCheck.length} files, ${duration}ms)`
                );
            }

            if (warnings.length > 0 && this.config.showWarnings) {
                logger.warn(
                    "typescript",
                    `⚠️ ${warnings.length} TypeScript warnings found`
                );
            }

            this.lastCheckTime = new Date();

            return {
                success,
                errors,
                warnings,
                totalFiles: filesToCheck.length,
                checkedFiles: filesToCheck,
                duration,
                timestamp: this.lastCheckTime,
            };
        } catch (error: any) {
            logger.error(
                "typescript",
                `TypeScript check failed: ${error.message}`
            );
            return {
                success: false,
                errors: [
                    {
                        file: "system",
                        line: 0,
                        column: 0,
                        message: `TypeScript checker error: ${error.message}`,
                        code: 0,
                        severity: "error",
                        category: "system",
                        source: error.stack || "",
                    },
                ],
                warnings: [],
                totalFiles: 0,
                checkedFiles: [],
                duration: Date.now() - startTime,
                timestamp: new Date(),
            };
        } finally {
            this.isChecking = false;
        }
    }

    /**
     * Process TypeScript diagnostic
     */
    private processDiagnostic(
        diagnostic: ts.Diagnostic
    ): TypeScriptError | null {
        const message = ts.flattenDiagnosticMessageText(
            diagnostic.messageText,
            "\n"
        );

        let file = "unknown";
        let line = 0;
        let column = 0;

        if (diagnostic.file && diagnostic.start !== undefined) {
            file = diagnostic.file.fileName;
            const position = diagnostic.file.getLineAndCharacterOfPosition(
                diagnostic.start
            );
            line = position.line + 1; // Convert to 1-based
            column = position.character + 1; // Convert to 1-based
        }

        const severity = this.getDiagnosticSeverity(diagnostic.category);
        const category =
            ts.DiagnosticCategory[diagnostic.category].toLowerCase();

        return {
            file: path.relative(process.cwd(), file),
            line,
            column,
            message,
            code: diagnostic.code,
            severity,
            category,
            source: diagnostic.source || "typescript",
        };
    }

    /**
     * Get diagnostic severity
     */
    private getDiagnosticSeverity(
        category: ts.DiagnosticCategory
    ): "error" | "warning" | "info" {
        switch (category) {
            case ts.DiagnosticCategory.Error:
                return "error";
            case ts.DiagnosticCategory.Warning:
                return "warning";
            case ts.DiagnosticCategory.Suggestion:
            case ts.DiagnosticCategory.Message:
                return "info";
            default:
                return "error";
        }
    }

    /**
     * Get checker status
     */
    public getStatus() {
        return {
            enabled: this.config.enabled,
            isChecking: this.isChecking,
            lastCheckTime: this.lastCheckTime,
            configPath: this.configPath,
            compilerOptions: this.compilerOptions,
        };
    }

    /**
     * Update configuration
     */
    public updateConfig(newConfig: Partial<TypeScriptCheckerConfig>): void {
        this.config = { ...this.config, ...newConfig };

        if (newConfig.configFile) {
            this.configPath = newConfig.configFile;
            this.loadCompilerOptions();
        }
    }

    /**
     * Enable/disable type checking
     */
    public setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
        logger.info(
            "typescript",
            `TypeScript checking ${enabled ? "enabled" : "disabled"}`
        );
    }
}

