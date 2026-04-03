import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import dts from "rollup-plugin-dts";
import terser from "@rollup/plugin-terser";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

const pkg = JSON.parse(
    readFileSync(new URL("./package.json", import.meta.url), "utf8"),
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
                    error.message,
                );
            }
        },
    };
}

// Plugin to copy template files
function copyTemplates(dir) { // pas besoin du param
    return {
        name: "copy-templates",
        generateBundle() {
            const inputPath = "src/template/ui.html";
            const outputPath = `dist/template/ui.html`;

            try {
                mkdirSync(dirname(outputPath), { recursive: true });
                writeFileSync(outputPath, readFileSync(inputPath));
                console.log(`✅ Copied template to ${outputPath}`);
            } catch (error) {
                console.warn(`⚠️ Failed to copy ${outputPath}:`, error.message);
            }
        },
    };
}

export default [
    // ESM build
    {
        input: "src/index.ts",
        output: {
            dir: "dist/esm",
            format: "es",
            sourcemap: true,
            exports: "named",
            preserveModules: true,
            preserveModulesRoot: "src",
        },
        plugins: [
            resolve({
                preferBuiltins: true,
            }),
            commonjs(),
            json(),
            typescript({
                tsconfig: "./tsconfig.json",
                declaration: false,
                declarationMap: false,
                outDir: "dist/esm",
                module: "esnext",
            }),
            terser(),
            copyPackageJson("module", "dist/esm"),
            copyTemplates("dist/esm"),
        ],
        external: [
            ...Object.keys(pkg.dependencies || {}),
            ...Object.keys(pkg.peerDependencies || {}),
            "xypriss",
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
        ],
    },
    // CommonJS build
    {
        input: "src/index.ts",
        output: {
            dir: "dist/cjs",
            format: "cjs",
            sourcemap: true,
            exports: "named",
            preserveModules: true,
            preserveModulesRoot: "src",
        },
        plugins: [
            resolve({
                preferBuiltins: true,
            }),
            commonjs(),
            json(),
            typescript({
                tsconfig: "./tsconfig.json",
                declaration: false,
                declarationMap: false,
                outDir: "dist/cjs",
                module: "esnext",
            }),
            terser(),
            copyPackageJson("commonjs", "dist/cjs"),
            copyTemplates("dist/cjs"),
        ],
        external: [
            ...Object.keys(pkg.dependencies || {}),
            ...Object.keys(pkg.peerDependencies || {}),
            "xypriss",
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
        ],
    },
    // TypeScript declarations
    {
        input: "src/index.ts",
        output: {
            file: "dist/index.d.ts",
            format: "es",
        },
        plugins: [
            dts({
                compilerOptions: {
                    paths: {}, // ensure it doesn't try to use the tsconfig paths
                },
            }),
        ],
        external: [
            ...Object.keys(pkg.dependencies || {}),
            ...Object.keys(pkg.peerDependencies || {}),
            "xypriss",
        ],
    },
];

