import { Interface } from "reliant-type";

const OFFICIAL_PLUGINS = ["@xypriss/swagger"];

const schm = Interface({
    name: "string", // We will manually validate the strict regex or whitelist
    version: "semver",
});

export function validatePlgInput(d: typeof schm.types) {
    try {
        // First check if it's an official whitelisted plugin
        const isOfficial = OFFICIAL_PLUGINS.includes(d.name);

        // If not official, enforce strict alphanumeric/hyphen rules
        if (!isOfficial) {
            if (!/^[a-zA-Z0-9-]+$/.test(d.name)) {
                return `Invalid plugin name: "${d.name}". Only alphanumeric characters and hyphens are allowed. The official '@xypriss/' prefix is strictly reserved for verified internal modules.`;
            }
        }

        const vldt = schm.safeParse(d);
        if (!vldt.success) {
            const firstError = vldt.errors[0];
            const field = firstError.path[0];

            if (field === "version" && firstError.code === "SEMVER_INVALID") {
                return `Invalid plugin version: "${d.version}". Version must be a valid semver (e.g., 1.0.0).`;
            }

            return firstError.message;
        }
        return vldt.data;
    } catch (error) {
        throw error;
    }
}

/**
 * // const schm = Interface({
//     name: "string(/^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*$/)",
//     version: "semver",
// });

ça c'est un bug qu'il faudrait réporter au créateur de reliant-type
 */

