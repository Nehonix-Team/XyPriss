import {
    loadXyConfig,
    verifyPluginContract,
    isProjectRoot,
} from "./src/utils/ProjectDiscovery";
import path from "path";

const pluginRoot = path.resolve("mods/swagger");
console.log("Checking plugin root:", pluginRoot);
console.log("isProjectRoot:", isProjectRoot(pluginRoot));

const config = loadXyConfig(pluginRoot);
console.log("Config loaded:", !!config);
if (config) {
    console.log("Config content:", JSON.stringify(config, null, 2));
}

const contractOk = verifyPluginContract(pluginRoot, "xypriss-swagger");
console.log("Contract Verification:", contractOk);

