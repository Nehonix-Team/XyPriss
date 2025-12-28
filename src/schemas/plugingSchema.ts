import { Interface } from "reliant-type";

const schm = Interface({
    name: "string(/^[a-zA-Z0-9-]+$/)",
    version: "semver",
});

export function validatePlgInput(d: typeof schm.types) {
    try {
        const vldt = schm.safeParse(d);
        if (!vldt.success) {
            const firstError = vldt.errors[0];
            const field = firstError.path[0];

            if (
                field === "name" &&
                firstError.code === "STRING_PATTERN_MISMATCH"
            ) {
                return `Invalid plugin name: "${d.name}". Only alphanumeric characters (a-z, A-Z, 0-9) and hyphens (-) are allowed. No spaces or special characters like @ _ . etc.`;
            }

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

