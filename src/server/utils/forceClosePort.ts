/**
 * forceClosePort - Consolidated into PortManager.
 * Re-exports Port and PortManager for full backward compatibility.
 */
export { Port, PortManager } from "./PortManager";
export type { PortSwitchResult, AutoPortSwitchConfig } from "./PortManager";
