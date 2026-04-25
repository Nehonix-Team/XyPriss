import fs from "fs";
import path from "path";

const MAPPING: Record<string, string> = {
    // Lifecycle
    "PLG.LIFECYCLE.": "XHS.HOOK.LIFECYCLE.",

    // HTTP Hooks
    "PLG.HTTP.ON_REQUEST": "XHS.HOOK.HTTP.REQUEST",
    "PLG.HTTP.ON_RESPONSE": "XHS.HOOK.HTTP.RESPONSE",
    "PLG.HTTP.ON_ERROR": "XHS.HOOK.HTTP.ERROR",

    // HTTP/Routing Permissions
    "PLG.HTTP.MIDDLEWARE": "XHS.PERM.HTTP.MIDDLEWARE",
    "PLG.HTTP.GLOBAL_MIDDLEWARE": "XHS.PERM.HTTP.GLOBAL_MIDDLEWARE",
    "PLG.ROUTING.REGISTER_ROUTES": "XHS.PERM.ROUTING.REGISTER_ROUTES",
    "PLG.ROUTING.BYPASS_NAMESPACE": "XHS.PERM.ROUTING.BYPASS_NAMESPACE",
    "PLG.ROUTING.OVERWRITE_PROTECTED": "XHS.PERM.ROUTING.OVERWRITE_PROTECTED",

    // Security
    "PLG.SECURITY.ACCESS_CONFIGS": "XHS.PERM.SECURITY.CONFIGS",
    "PLG.SECURITY.ACCESS_SENSITIVE_DATA": "XHS.PERM.SECURITY.SENSITIVE_DATA",
    "PLG.SECURITY.ATTACK_DETECTED": "XHS.HOOK.SECURITY.ATTACK",
    "PLG.SECURITY.RATE_LIMIT": "XHS.HOOK.SECURITY.RATE_LIMIT",

    // Metrics
    "PLG.METRICS.RESPONSE_TIME": "XHS.HOOK.METRICS.RESPONSE_TIME",
    "PLG.METRICS.ROUTE_ERROR": "XHS.HOOK.METRICS.ROUTE_ERROR",

    // Ops & Logging
    "PLG.OPS.AUXILIARY_SERVER": "XHS.PERM.OPS.AUXILIARY_SERVER",
    "PLG.LOGGING.CONSOLE_INTERCEPT": "XHS.PERM.LOGGING.CONSOLE_INTERCEPT",
};

const DIRS_TO_SCAN = ["src", "docs", "mods", "simulations", "tests"];
const FILES_TO_SCAN = ["README.md", "package.json"];

function migrateFile(filePath: string) {
    let content = fs.readFileSync(filePath, "utf-8");
    let changed = false;

    for (const [oldId, newId] of Object.entries(MAPPING)) {
        if (content.includes(oldId)) {
            // Use regex for global replacement
            const regex = new RegExp(oldId.replace(/\./g, "\\."), "g");
            content = content.replace(regex, newId);
            changed = true;
        }
    }

    if (changed) {
        fs.writeFileSync(filePath, content, "utf-8");
        console.log(`[MIGRATED] ${filePath}`);
    }
}

function walk(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file === "node_modules" || file === ".git" || file === "dist")
                continue;
            walk(fullPath);
        } else {
            const ext = path.extname(file);
            if ([".ts", ".js", ".md", ".json", ".jsonc"].includes(ext)) {
                migrateFile(fullPath);
            }
        }
    }
}

console.log("Starting XHS Migration...");

for (const dir of DIRS_TO_SCAN) {
    const absolutePath = path.resolve(process.cwd(), dir);
    if (fs.existsSync(absolutePath)) {
        walk(absolutePath);
    }
}

for (const file of FILES_TO_SCAN) {
    const absolutePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(absolutePath)) {
        migrateFile(absolutePath);
    }
}

console.log("Migration Complete!");

