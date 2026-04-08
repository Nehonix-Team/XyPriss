/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * This License governs the use, modification, and distribution of software
 * provided by NEHONIX under its open source projects.
 * NEHONIX is committed to fostering collaborative innovation while strictly
 * protecting its intellectual property rights.
 * Violation of any term of this License will result in immediate termination of all granted rights
 * and may subject the violator to legal action.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
 * AND NON-INFRINGEMENT.
 * IN NO EVENT SHALL NEHONIX BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
 * OR CONSEQUENTIAL DAMAGES ARISING FROM THE USE OR INABILITY TO USE THE SOFTWARE,
 * EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
 *
 ***************************************************************************** */

import crypto from "crypto";
import { internalFlags } from "../const/internalFlags";

/**
 * A cryptographically random token generated once per process lifetime.
 *
 * This token is used to sign internal flag injections, ensuring that only
 * framework-level code (which has access to this module's closure) can
 * legitimately pass internal flags through `createServer`.
 *
 * The token is:
 * - Never exported or logged
 * - Regenerated on every process start (not predictable across restarts)
 * - Sealed via Object.defineProperty to prevent runtime tampering
 */
const _TOKEN_KEY = "__xy_internal_token__";
let _token: string;

// Seal the token against any external mutation attempt
Object.defineProperty(globalThis, "__xy_token_seal__", {
    get: () => _token,
    set: () => {
        // Silently reject any external write attempt
    },
    configurable: false,
    enumerable: false,
});

_token = crypto.randomBytes(32).toString("hex");

/**
 * Attaches an internal framework flag to a server options object,
 * along with a signed token that authorizes its use.
 *
 * This function is **strictly reserved for XyPriss framework internals**.
 * It must never be called or re-exported by plugin authors or end users.
 *
 * The signed token is automatically stripped by `rejectInternalFlag` before
 * any user-visible processing occurs, so it never leaks into the options
 * that reach `XyServerCreator.create()`.
 *
 * @param options - The base server options to extend
 * @param flag - The internal flag name to inject (must be in `internalFlags`)
 * @returns A new options object with the flag and authorization token attached
 *
 * @internal
 * @example
 * // Used internally in PluginLoader when spawning auxiliary servers:
 * createServer(withInternalFlag({ server: { port: 5628 } }, "isAuxiliary"));
 */
export function withInternalFlag(
    options: Record<string, any>,
    flag: (typeof internalFlags)[number],
): Record<string, any> {
    const signed = {
        ...options,
        [flag]: true,
        [_TOKEN_KEY]: _token,
    };

    // Seal the token field on this specific object to prevent proxy-based
    // interception or post-injection replacement
    Object.defineProperty(signed, _TOKEN_KEY, {
        value: _token,
        writable: false,
        configurable: false,
        enumerable: false, // Hidden from JSON.stringify, console.log, etc.
    });

    return signed;
}

/**
 * Validates that no internal-only flags are present in user-supplied options.
 *
 * This function acts as a **security gate** at the entry point of `createServer`.
 * It inspects the incoming options for any flag listed in `internalFlags` and
 * verifies that a valid framework-issued token accompanies it.
 *
 * Behavior:
 * - If an internal flag is found **with** a valid token → allowed (framework call),
 *   the token is stripped before further processing.
 * - If an internal flag is found **without** a valid token → the flag is deleted
 *   and a fatal `Error` is thrown, terminating server creation.
 * - If no internal flags are present → no-op, options pass through unchanged.
 *
 * After this function runs, the options object is guaranteed to contain no
 * authorization token, regardless of outcome.
 *
 * @param options - The raw server options passed to `createServer`
 * @throws {Error} If an internal flag is detected without a valid authorization token
 *
 * @example
 * // Called automatically at the top of createServer():
 * rejectInternalFlag(options); // throws if user injected isAuxiliary
 */
export function rejectInternalFlag(options: Record<string, any>): void {
    // Check token before stripping — order matters
    const hasValidToken = options[_TOKEN_KEY] === _token;

    // Always strip the token immediately, whether valid or not.
    // This ensures it never propagates further into the server bootstrap.
    try {
        delete options[_TOKEN_KEY];
    } catch {
        // Field may be non-configurable if someone attempted to freeze/proxy
        // the options object — safe to ignore, validation already happened above.
    }

    for (const flag of internalFlags) {
        if (options[flag] !== undefined && options[flag] !== false) {
            if (!hasValidToken) {
                // Unauthorized use: strip the flag and halt server creation
                delete options[flag];
                throw new Error(
                    `[XyPriss Security] Unauthorized use of internal flag '${flag}'. ` +
                        `This property is reserved for framework-internal use only and cannot be set by user code.`,
                );
            }
            // Authorized internal call: flag is retained for use in XyServerCreator
        }
    }
}

