import { __sys__ } from "../src/index";
import { testPlugin } from "./test.pluging";

console.log("--- Starting Repro Script ---");

// Trigger the plugin logic
const plugin = testPlugin();

console.log("--- Repro Script Finished ---");

