import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import dts from "rollup-plugin-dts";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
 
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

export default [
    // ESM build - Modular output
    {
        input: "./src/index.ts",
        output: {
            dir: "./dist/esm",
            format: "es",
            sourcemap: true,
            exports: "named",
            preserveModules: true, // Keep modular structure
            preserveModulesRoot: "src", // Preserve src structure
        },
        plugins: [
            resolve({
                preferBuiltins: true, // Prefer Node.js built-ins
                browser: false, // Target Node.js
                exportConditions: ["node"], // Use Node.js exports
            }),
            commonjs({
                // Handle CommonJS modules that use require() in ESM context
                transformMixedEsModules: true,
                // Ensure require() calls are properly handled
                dynamicRequireTargets: [
                    'node_modules/libsodium-wrappers/**/*',
                    'node_modules/@noble/**/*',
                    'node_modules/crypto-js/**/*',
                    'node_modules/elliptic/**/*',
                    'node_modules/node-forge/**/*',
                    'node_modules/tweetnacl/**/*',
                    'node_modules/crystals-kyber/**/*',
                    'node_modules/entropy-string/**/*',
                ],
            }),
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
            copyPackageJson("module", "./dist/esm"),
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
        input: "./src/index.ts",
        output: {
            dir: "./dist/cjs",
            format: "cjs",
            sourcemap: true,
            exports: "auto",
            esModule: false,
            preserveModules: true, // Keep modular structure
            preserveModulesRoot: "src", // Preserve src structure
        },
        plugins: [
            resolve({
                preferBuiltins: true, // Prefer Node.js built-ins
                browser: false, // Target Node.js
                exportConditions: ["node"], // Use Node.js exports
            }),
            commonjs({
                // Handle CommonJS modules that use require() in ESM context
                transformMixedEsModules: true,
                // Ensure require() calls are properly handled
                dynamicRequireTargets: [
                    'node_modules/libsodium-wrappers/**/*',
                    'node_modules/@noble/**/*',
                    'node_modules/crypto-js/**/*',
                    'node_modules/elliptic/**/*',
                    'node_modules/node-forge/**/*',
                    'node_modules/tweetnacl/**/*',
                    'node_modules/crystals-kyber/**/*',
                    'node_modules/entropy-string/**/*',
                ],
            }),
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
            copyPackageJson("commonjs", "./dist/cjs"),
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
        input: "./src/index.ts",
        output: {
            file: "./dist/index.d.ts",
            format: "es",
        },
        plugins: [dts()],
        external: ["nehonix-uri-processor"],
    },
];
