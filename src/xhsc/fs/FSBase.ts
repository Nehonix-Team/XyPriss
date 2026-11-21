import nodePath from "node:path";
import { Logger } from "../../shared/logger";
import { PathApi } from "../PathApi";
import { XyPrissRunner } from "../XyPrissRunner";
import {
    getCallerProjectRoot,
    getVerifiedCallerInfo,
    isEngineCorePath,
    isImmediateInternalEngineCall,
    _StringReplace,
} from "../../utils/ProjectDiscovery";
import { _PathPosixNormalize } from "../../utils/CorePathCheck";
import { generateXUserTmpDir } from "../../plugins/const/XyprissTempDir";

/**
 * **Base Filesystem API**
 *
 * Provides the foundation for all filesystem operations, including
 * logger initialization, runner access, and strict sandbox enforcement.
 */
export class FSBase extends PathApi {
    protected logger: Logger;

    constructor(runner: XyPrissRunner) {
        super(runner);
        this.logger = new Logger();
    }

    /**
     * Resolves and verifies that a target path resides strictly within the authorized sandbox.
     * Denies access and logs a security violation if the path attempts to escape outside the sandbox boundary.
     *
     * @param targetPath The raw requested path (relative or absolute)
     * @param operation The filesystem operation being attempted
     * @returns The resolved canonical path within the sandbox, or null if access is denied
     */
    protected resolvePathInSandbox(
        targetPath: string,
        operation: string = "fs",
    ): string | null {
        if (!targetPath || typeof targetPath !== "string") {
            return null;
        }

        const runnerRoot = this.runner ? this.runner.getRoot() : "";
        const baseRoot = runnerRoot || this.assignedRoot;
        const caller = getVerifiedCallerInfo();

        // If the verified application caller is genuine engine core, allow direct access
        if (caller.callerFile && isEngineCorePath(caller.callerFile)) {
            if (nodePath.isAbsolute(targetPath)) {
                return nodePath.resolve(targetPath);
            }
            return baseRoot ? nodePath.resolve(baseRoot, targetPath) : null;
        }

        // If there are no external application frames in the call stack, this is engine bootstrap
        if (!caller.callerFile && isImmediateInternalEngineCall()) {
            if (nodePath.isAbsolute(targetPath)) {
                return nodePath.resolve(targetPath);
            }
            return baseRoot ? nodePath.resolve(baseRoot, targetPath) : null;
        }

        const callerRoot = caller.root || getCallerProjectRoot() || baseRoot;
        const effectiveSandbox = callerRoot || baseRoot;
        if (!effectiveSandbox) {
            console.error(
                `\x1b[31m[XyPriss Security] Sandbox Violation: No valid sandbox root resolved for caller during '${operation}' on '${targetPath}'. Access denied.\x1b[0m`,
            );
            return null;
        }

        let normSandbox = _PathPosixNormalize(
            _StringReplace(effectiveSandbox, /\\/g, "/"),
        );
        while (normSandbox.length > 1 && normSandbox.endsWith("/")) {
            normSandbox = normSandbox.slice(0, -1);
        }
        const resolved = nodePath.isAbsolute(targetPath)
            ? nodePath.resolve(targetPath)
            : nodePath.resolve(normSandbox, targetPath);
        const normResolved = _PathPosixNormalize(
            _StringReplace(resolved, /\\/g, "/"),
        );

        // Allow temporary files inside the session user temp directory
        const userTmp = generateXUserTmpDir();
        const normUserTmp = userTmp
            ? _PathPosixNormalize(_StringReplace(userTmp, /\\/g, "/"))
            : "";
        if (
            normUserTmp &&
            (normResolved === normUserTmp ||
                normResolved.startsWith(normUserTmp + "/"))
        ) {
            return resolved;
        }

        // Check if resolved path is strictly within the effective sandbox
        if (
            normResolved === normSandbox ||
            normResolved.startsWith(normSandbox + "/")
        ) {
            return resolved;
        }

        console.error(
            `\x1b[31m[XyPriss Security] Sandbox Violation: Access denied during '${operation}'. Path '${targetPath}' is outside the assigned sandbox root '${normSandbox}'.\x1b[0m`,
        );
        return null;
    }
}


