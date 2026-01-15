# XyPriss Global Runtime APIs

This document provides a technical specification and usage guide for the global runtime APIs integrated into the XyPriss framework. These APIs are designed to provide centralized, type-safe, and secure access to system variables, configurations, and immutable constants across the entire application lifecycle.

## Table of Contents

1. [Overview](#overview)
2. [**sys**: System Runtime Environment](#__sys__-system-runtime-environment)
3. [**cfg**: Centralized Configuration Management](#__cfg__-centralized-configuration-management)
4. [**const**: Immutability Engine](#__const__-immutability-engine)
5. [Deep Immutability Mechanics](#deep-immutability-mechanics)
6. [Initialization and Availability](#initialization-and-availability)

---

## Overview

XyPriss introduces three primary global namespaces to the execution environment. These namespaces are injected into the `globalThis` context, making them accessible from any module without requiring explicit local imports, provided the framework has been initialized.

-   `__sys__`: Manages system-level metadata, environment variables, hardware telemetry, and high-performance filesystem operations via a native Rust bridge.
-   `__cfg__`: Acts as the single source of truth for server and plugin configurations.
-   `__const__`: Enforces strict data integrity through a global constants registry and deep immutability proxies.

---

## **sys**: System Runtime Environment

The `__sys__` object provides structured access to the application's runtime metadata and environment-specific utilities.

### Core Properties

-   `__version__`: The current semantic version of the application.
-   `__name__`: The unique identifier for the application instance.
-   `__env__`: The current execution environment (e.g., "development", "production").
-   `__port__` / `__PORT__`: Synchronized access to the primary server port.

### Environment Management

The `__sys__.__ENV__` utility provides a type-safe wrapper around `process.env`:

```typescript
// Retrieval with fallback
const apiKey = __sys__.__ENV__.get("API_KEY", "default_value");

// Existence verification
if (__sys__.__ENV__.has("DATABASE_URL")) {
    // Logic for database initialization
}
```

### Advanced System Capabilities

The `__sys__` namespace is significantly extended by a high-performance Rust core, providing deep system access:

-   **[System Intelligence](./SYSTEM_INTELLIGENCE.md)**: Real-time monitoring, hardware telemetry (Temp, Battery), and process control.
-   **[FileSystem API](./filesystem-api.md)**: Optimized directory operations, archiving (TAR/GZIP), and advanced searching (Grep/Diff).

---

## **cfg**: Centralized Configuration Management

The `__cfg__` API is a singleton manager for the XyPriss Server Configuration (XPSC). It ensures that configuration updates are propagated correctly and that components always access the most recent state.

### Key Methods

-   `get(section)`: Retrieves a specific configuration segment.
-   `update(section, partialValue)`: Performs a deep merge of the provided values into the existing configuration.
-   `getAll()`: Returns a snapshot of the entire configuration state.

### Integration with Immutability

When the server is initialized via `createServer`, the configuration managed by `__cfg__` is automatically transitioned into an immutable state using the `__const__` engine. Subsequent attempts to modify the configuration via `__cfg__.update()` will result in a runtime exception.

---

## **const**: Immutability Engine

The `__const__` API is the primary mechanism for enforcing data integrity within XyPriss. It serves two distinct purposes: managing a registry of named constants and creating deeply immutable object structures.

### Named Constants Registry

Use `$set` to register a value that must remain unchanged for the duration of the process.

```typescript
__const__.$set("MAX_RETRIES", 5);

// Attempting to redefine will throw an error
__const__.$set("MAX_RETRIES", 10); // Error: Cannot redefine constant "MAX_RETRIES"
```

### Deep Immutability with $make

The `$make` method transforms an object, array, Map, or Set into a deeply immutable structure using recursive Proxies and `Object.freeze`.

```typescript
const secureConfig = __const__.$make({
    security: {
        level: "high",
        roles: ["admin", "user"],
    },
});

// Any attempt to modify nested properties will fail
secureConfig.security.level = "low"; // Error: Cannot modify immutable property
secureConfig.security.roles.push("guest"); // Error: Cannot modify immutable array
```

---

## Deep Immutability Mechanics

It is critical to distinguish between **variable reassignment** and **object property modification** when working with the Immutability Engine.

### Variable Reassignment (Not Protected)

The `__const__.$make()` method returns an immutable Proxy. However, it cannot prevent the JavaScript engine from reassigning a variable declared with `let`.

```typescript
let x = __const__.$make({ value: 10 });
x = 20; // This is a variable reassignment. It is valid JavaScript and not intercepted by the Proxy.
```

To prevent reassignment, always use the `const` keyword for variable declarations.

### Object Property Modification (Protected)

The Immutability Engine intercepts operations that attempt to mutate the state of the object itself.

```typescript
const x = __const__.$make({ value: 10 });
x.value = 20; // Intercepted by Proxy. Throws a runtime Error.
```

The engine protects:

-   Property assignments and deletions.
-   Array mutations (push, pop, splice, etc.).
-   Map and Set mutations (set, add, delete, clear).
-   Prototype modifications.

---

## Initialization and Availability

The global APIs are initialized automatically when any part of the XyPriss framework is imported.

### In Application Code

```typescript
import { createServer } from "xypriss";

// Globals are now available
console.log(__sys__.__version__);
```

### In Independent Scripts

For scripts that do not initialize a full server instance, ensure the framework is loaded to register the globals:

```typescript
import "xypriss"; // Side-effect import to initialize globals

const immutableData = __const__.$make({ key: "value" });
```

### Runtime Verification

To verify if the globals are correctly registered in a specific environment, you can check their existence on the `globalThis` object:

```typescript
if (typeof __const__ !== "undefined") {
    // Framework is initialized
}
```

## Bun Integration

For projects using the Bun runtime, the global APIs can be made available across all scripts without explicit imports by using the preload feature.

### Configuration via bunfig.toml

Create or update a `bunfig.toml` file in the project root:

```toml
[run]
preload = ["./src/index.ts"]
```

This configuration ensures that the XyPriss runtime is initialized before any script execution, making `__sys__`, `__cfg__`, and `__const__` available globally, similar to native APIs like `process` or `console`.

