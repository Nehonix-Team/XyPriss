import vm from "node:vm";

let _vmHardened = false;

/**
 * Hardens `node:vm` to prevent asynchronous stack decoupling and script origin spoofing.
 *
 * Any script compiled through `node:vm` APIs (such as `runInThisContext`, `createScript`, or `new vm.Script`)
 * has its filename/script origin deterministically tagged with `[vm]`.
 * This enables the zero-trust stack inspector (`getVerifiedCallerInfo`) to detect synthetic VM frames
 * even after event loop timers have cleared the origin caller frames.
 *
 * @internal
 * @see XSA-XESS-025
 */
export function installVmHardening(): void {
    if (_vmHardened) return;
    _vmHardened = true;

    try {
        const wrapOptions = (opts: any) => {
            if (typeof opts === "string") {
                return "[vm] " + opts;
            }
            if (opts && typeof opts === "object") {
                const fname = opts.filename || opts.name;
                if (fname) {
                    return { ...opts, filename: `[vm] ${fname}` };
                }
                return { ...opts, filename: "[vm] <vm-script>" };
            }
            return { filename: "[vm] <vm-script>" };
        };

        const origRunInThisContext = vm.runInThisContext;
        if (typeof origRunInThisContext === "function") {
            vm.runInThisContext = function (code: string, options?: any) {
                return origRunInThisContext.call(this, code, wrapOptions(options));
            };
        }

        const origRunInContext = vm.runInContext;
        if (typeof origRunInContext === "function") {
            vm.runInContext = function (code: string, contextifiedObject: any, options?: any) {
                return origRunInContext.call(this, code, contextifiedObject, wrapOptions(options));
            };
        }

        const origRunInNewContext = vm.runInNewContext;
        if (typeof origRunInNewContext === "function") {
            vm.runInNewContext = function (code: string, contextObject?: any, options?: any) {
                return origRunInNewContext.call(this, code, contextObject, wrapOptions(options));
            };
        }

        const origCreateScript = (vm as any).createScript;
        if (typeof origCreateScript === "function") {
            (vm as any).createScript = function (code: string, options?: any) {
                return origCreateScript.call(this, code, wrapOptions(options));
            };
        }

        const origScript = vm.Script;
        if (typeof origScript === "function") {
            const PatchedScript = function (this: any, code: string, options?: any) {
                return new origScript(code, wrapOptions(options));
            } as any;
            PatchedScript.prototype = origScript.prototype;
            vm.Script = PatchedScript;
        }
    } catch {
        // ignore if vm is not available in environment
    }
}
