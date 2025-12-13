import { AdvancedMemoryManager } from "../mods/security/src/utils/memory/memory-manager";

console.log("Attempting to create AdvancedMemoryManager instance...");
try {
    const manager = AdvancedMemoryManager.getInstance();
    console.log("Manager instance created successfully");
} catch (error) {
    console.error("Error creating manager:", error);
}

