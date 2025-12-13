import { AdvancedMemoryManager } from "../dist/esm/mods/security/src/utils/memory/memory-manager.js";

console.log("Attempting to create AdvancedMemoryManager instance from DIST...");
try {
    const manager = AdvancedMemoryManager.getInstance();
    console.log("Manager instance created successfully");
} catch (error) {
    console.error("Error creating manager:", error);
}

