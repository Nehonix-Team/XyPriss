export * from "./constants";
export * from "./encoding";
export * from "./stats";
export * from "./testing";

// Export the new modular memory management system
export * from "./memory";

// For backward compatibility, also export the old memory manager
export { memoryManager } from "./memory";
