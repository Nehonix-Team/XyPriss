import { Plugin, type XyPrissSys } from "../src";

export function testPlugin() {
    /**
     * Standard Project Root Access:
     * Accesses the main project directory as defined by the process working directory
     * or the detected project foundation.
     */
    console.log("dir (root): ", (__sys__ as XyPrissSys).$lsDirs("."));

    /**
     * Specialized Plugin Workspace ($plug):
     * Demonstrates access to a scoped filesystem, restricted to the plugin's
     * own directory context as configured in `xypriss.config.json` via `$internal`.
     *
     * This ensures that plugin contributors can interact with their own workspace
     * without accidental cross-pollution with the core project root.
     *
     * @example
     * // Configure in xypriss.config.json:
     * // { "$internal": { "$plug": { "__xfs__": { "path": "#$/.private" } } } }
     */
    console.log(
        "dir (plugin - $plg alias): ",
        (__sys__ as XyPrissSys).$plg?.$lsDirs(".")
    );
    console.log("cwd: ", process.cwd());

    return Plugin.create({
        name: "test-plugin",
        version: "1.0.0",
        onServerStart(server) {
            console.log("Server started");
        },
    });
}

