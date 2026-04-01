import fs from "fs";
import path from "path";

/**
 * Checks if a directory is a "Real Project" root based on hierarchical criteria.
 * Criteria:
 * 1. (package.json + node_modules) -> Strong baseline
 * 2. (package.json + src + tsconfig.json) -> High priority
 */
export function isProjectRoot(dir: string): boolean {
    const hasPkg = fs.existsSync(path.join(dir, "package.json"));
    const hasNodeModules = fs.existsSync(path.join(dir, "node_modules"));
    const hasTsConfig = fs.existsSync(path.join(dir, "tsconfig.json"));
    const hasSrc = fs.existsSync(path.join(dir, "src"));

    // Minimum baseline: package.json + node_modules
    if (hasPkg && hasNodeModules) return true;

    // High priority modules check
    if (hasPkg && hasSrc && hasTsConfig) return true;

    return false;
}

/**
 * Identifies the project root for a given caller path by traversing up the filesystem.
 */
export function identifyProjectRoot(filePath: string): string | undefined {
    let current = path.dirname(filePath);
    const systemRootDir = path.parse(current).root;

    while (current !== systemRootDir) {
        if (isProjectRoot(current)) {
            return current;
        }
        current = path.dirname(current);
    }

    return undefined;
}

/**
 * Retrieves the project root of the code currently executing by analyzing the stack trace.
 */
export function getCallerProjectRoot(): string | undefined {
    const stack = new Error().stack;
    if (!stack) return undefined;

    const lines = stack.split("\n");
    let callerLine = "";
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // Filter out framework files to find user/plugin code
        if (
            line &&
            !line.includes("EnvApi.ts") &&
            !line.includes("System.ts") &&
            !line.includes("sys.ts") &&
            !line.includes("ProjectDiscovery.ts") &&
            !line.includes("at get ") &&
            !line.includes("at getStrict ") &&
            !line.includes("at all ")
        ) {
            callerLine = line;
            break;
        }
    }

    if (!callerLine) return undefined;

    const match =
        callerLine.match(/\((.*):\d+:\d+\)$/) ||
        callerLine.match(/at (.*):\d+:\d+$/);
    if (!match) return undefined;

    return identifyProjectRoot(match[1]);
}

