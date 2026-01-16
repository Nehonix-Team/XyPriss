# Meta Configuration System

The XyPriss Meta Configuration system provides a mechanism for executing arbitrary TypeScript or JavaScript code during the server initialization phase. This feature is designed for advanced setup tasks that require programmatic logic before the standard configuration is applied.

## Overview

The Meta Configuration system automatically detects and executes specific files located within the project structure. It is triggered by the `ConfigLoader` before the standard `xypriss.config.json` is processed, ensuring that any global state or environment adjustments are in place early in the lifecycle.

## File Discovery

The system searches for a single meta configuration file in the following locations (in order of priority):

1. `+xypriss.meta.ts` (Project Root)
2. `+xypriss.meta.js` (Project Root)
3. `.meta/+xypriss.meta.js`
4. `.meta/+xypriss.meta.ts`
5. `.xypriss/+xypriss.meta.ts`
6. `.xypriss/+xypriss.meta.js`

Only the first file found in this list will be executed.

## Execution Mechanism

The Meta Configuration file supports two methods of execution:

### 1. Immediate Execution (IIFE)

Any code placed at the top level of the file or within an Immediately Invoked Function Expression (IIFE) will execute as soon as the file is imported by the system.

### 2. The `run` Function

If the file exports a function named `run`, the system will automatically invoke it after the file has been imported. This is the recommended way to structure complex initialization logic.

## Usage Example

Below is an example of a `+xypriss.meta.ts` file demonstrating both execution methods:

```typescript
// This code executes immediately upon import
(() => {
    console.log("Initializing environment variables...");
    process.env.CUSTOM_VAR = "initialized";
})();

/**
 * The run function is called automatically by the ConfigLoader.
 * Use this for structured initialization logic.
 */
export function run() {
    console.log("Executing meta configuration logic...");

    // Example: Modifying global state or performing pre-flight checks
    if (globalThis.__sys__) {
        // Perform advanced system adjustments
    }
}
```

## Technical Details

-   **Execution Timing**: The meta configuration is executed during the call to `configLoader.loadAndApplySysConfig()`, which typically occurs at the very beginning of the server creation process.
-   **Singleton Execution**: The system includes an internal guard to ensure that the meta configuration is only executed once per process lifetime, preventing side effects during configuration reloads.
-   **Error Handling**: Errors occurring during the import or execution of the meta file are caught and logged as warnings to prevent the main application from crashing during startup.
-   **Environment Support**: The system supports both TypeScript (.ts) and JavaScript (.js) files, leveraging dynamic imports for execution.

