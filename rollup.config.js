import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import dts from "rollup-plugin-dts";
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from "fs";
import { dirname, join } from "path";

const pkg = JSON.parse(
    readFileSync(new URL("./package.json", import.meta.url), "utf8")
);

// Plugin to copy package.json files for proper module resolution
function copyPackageJson(type, dir) {
    return {
        name: "copy-package-json",
        generateBundle() {
            const packageJsonContent = JSON.stringify({ type }, null, 2);
            const outputPath = `${dir}/package.json`;

            try {
                mkdirSync(dirname(outputPath), { recursive: true });
                writeFileSync(outputPath, packageJsonContent);
                console.log(`✅ Created ${outputPath} with type: ${type}`);
            } catch (error) {
                console.warn(
                    `⚠️ Failed to create ${outputPath}:`,
                    error.message
                );
            }
        },
    };
}

// Plugin to create index files for proper module resolution
function createIndexFiles(format, dir) {
    return {
        name: "create-index-files",
        generateBundle() {
            const indexPath = `${dir}/index.js`;
            let indexContent;

            if (format === "es") {
                indexContent =
                    "// ESM re-export from src directory\nexport * from './src/index.js';\n";
            } else {
                indexContent =
                    "// CommonJS re-export from src directory\nmodule.exports = require('./src/index.js');\n";
            }

            try {
                mkdirSync(dirname(indexPath), { recursive: true });
                writeFileSync(indexPath, indexContent);
                console.log(`✅ Created ${indexPath} for ${format} format`);
            } catch (error) {
                console.warn(
                    `⚠️ Failed to create ${indexPath}:`,
                    error.message
                );
            }
        },
    };
}

// Plugin to copy worker JS files
function copyWorkerFiles(dir) {
    return {
        name: "copy-worker-files",
        generateBundle() {
            const workerSourceDir =
                "src/server/components/fastapi/modules/UFRP/workers";

            const workerDestDir = join(dir, workerSourceDir);

            try {
                if (existsSync(workerSourceDir)) {
                    mkdirSync(workerDestDir, { recursive: true });
                    cpSync(workerSourceDir, workerDestDir, { recursive: true });
                    console.log(`✅ Copied worker files to ${workerDestDir}`);
                }
            } catch (error) {
                console.warn(`⚠️ Failed to copy worker files:`, error.message);
            }
        },
    };
}

export default [
    // ESM build - Modular output
    {
        input: "src/index.ts",
        output: {
            dir: "dist/esm",
            format: "es",
            sourcemap: true,
            exports: "named",
            preserveModules: true, // Keep modular structure
            preserveModulesRoot: ".", // Preserve entire project structure including shared
        },
        plugins: [
            resolve({
                preferBuiltins: true, // Prefer Node.js built-ins
                browser: false, // Target Node.js
                exportConditions: ["node"], // Use Node.js exports
            }),
            commonjs(),
            json(),
            typescript({
                tsconfig: "./tsconfig.json",
                declaration: false, // We'll generate declarations separately
                declarationMap: false, // Disable declaration maps
                outDir: undefined, // Let Rollup handle output directory
                exclude: [
                    "/private/**",
                    "**/private/*",
                    "src/integrations/react/**/*",
                    "**/private/**/*",
                    "**/node_modules/**/*",
                    "**/*.test.ts",
                    "**/*.spec.ts",
                ],
            }),
            copyPackageJson("module", "dist/esm"),
            createIndexFiles("es", "dist/esm"),
            copyWorkerFiles("dist/esm"),
        ],
        external: (id) => {
            // Make ALL dependencies external (don't bundle them)
            if (id.includes("node_modules")) return true;
            if (
                Object.keys(pkg.dependencies || {}).some(
                    (dep) => id === dep || id.startsWith(dep + "/")
                )
            )
                return true;
            if (
                Object.keys(pkg.peerDependencies || {}).some(
                    (dep) => id === dep || id.startsWith(dep + "/")
                )
            )
                return true;

            // Node.js built-ins
            const builtins = [
                "crypto",
                "fs",
                "path",
                "os",
                "http",
                "https",
                "events",
                "stream",
                "buffer",
                "util",
                "url",
                "querystring",
                "zlib",
                "child_process",
                "cluster",
                "dgram",
                "dns",
                "net",
                "tls",
                "readline",
                "repl",
                "vm",
                "worker_threads",
                "perf_hooks",
            ];
            if (builtins.includes(id)) return true;

            return false;
        },
    },
    // CommonJS build - Modular output
    {
        input: "src/index.ts",
        output: {
            dir: "dist/cjs",
            format: "cjs",
            sourcemap: true,
            exports: "auto",
            esModule: false,
            preserveModules: true, // Keep modular structure
            preserveModulesRoot: ".", // Preserve entire project structure including shared
        },
        plugins: [
            resolve({
                preferBuiltins: true, // Prefer Node.js built-ins
                browser: false, // Target Node.js
                exportConditions: ["node"], // Use Node.js exports
            }),
            commonjs(),
            json(),
            typescript({
                tsconfig: "./tsconfig.json",
                declaration: false, // Prevent duplicate declarations
                declarationMap: false, // Disable declaration maps
                outDir: undefined, // Let Rollup handle output directory
                exclude: [
                    "/private/**",
                    "**/private/*",
                    "src/integrations/react/**/*",
                    "**/private/**/*",
                    "**/node_modules/**/*",
                    "**/*.test.ts",
                    "**/*.spec.ts",
                ],
            }),
            copyPackageJson("commonjs", "dist/cjs"),
            createIndexFiles("cjs", "dist/cjs"),
            copyWorkerFiles("dist/cjs"),
        ],
        external: (id) => {
            // Make ALL dependencies external (don't bundle them)
            if (id.includes("node_modules")) return true;
            if (
                Object.keys(pkg.dependencies || {}).some(
                    (dep) => id === dep || id.startsWith(dep + "/")
                )
            )
                return true;
            if (
                Object.keys(pkg.peerDependencies || {}).some(
                    (dep) => id === dep || id.startsWith(dep + "/")
                )
            )
                return true;

            // Node.js built-ins
            const builtins = [
                "crypto",
                "fs",
                "path",
                "os",
                "http",
                "https",
                "events",
                "stream",
                "buffer",
                "util",
                "url",
                "querystring",
                "zlib",
                "child_process",
                "cluster",
                "dgram",
                "dns",
                "net",
                "tls",
                "readline",
                "repl",
                "vm",
                "worker_threads",
                "perf_hooks",
            ];
            if (builtins.includes(id)) return true;

            return false;
        },
    },
    // TypeScript declarations
    {
        input: "src/index.ts",
        output: {
            file: "dist/index.d.ts",
            format: "es",
        },
        plugins: [dts()],
        external: ["nehonix-uri-processor"],
    },
];

