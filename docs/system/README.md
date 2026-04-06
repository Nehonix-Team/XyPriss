# XyPriss Hyper-System API (`__xhsc__`)

The XyPriss Hyper-System API (`__xhsc__`) serves as the core logic aggregator for the global system interface within XyPriss applications. It provides a centralized, high-performance, and modular architecture, inheriting native capabilities to ensure optimal robustness and security.

This "Flat API" structure unifies all system operations under a single singleton, greatly enhancing code readability and maintainability.

## Modular Architecture

The API is globally accessible via the `__xhsc__` endpoint. It is divided into five specialized modules, each with a strict and well-defined scope:

- **[Environment (`__xhsc__.__env__`)](./env.md)**: Secure environment variable manager and restrictive Environment Security Shield.
- **[Filesystem (`__xhsc__.fs`)](./fs.md)**: High-performance I/O operations, stream handling, archives, and file security.
- **[Path (`__xhsc__.path`)](./path.md)**: Secure cross-platform path manipulation, resolution, and normalization.
- **[Operating System (`__xhsc__.os`)](./os.md)**: Hardware telemetry, system monitoring, and native process management.
- **[Dynamic Variables (`__xhsc__.vars`)](./vars.md)**: Standardized key-value store intended for application configuration and temporal metadata storage.

## Initialization

The XyPriss framework automatically initializes `__xhsc__` before the execution of the application code. Manual intervention to instantiate the root class (`XyPrissFS`) is neither required nor recommended.

### Context Example

```typescript
// Direct access without instantiation
const version = __xhsc__.vars.get("__version__");
const isProd = __xhsc__.__env__.isProduction();

if (!isProd) {
    __xhsc__.fs.writeFileSync("./debug.log", `Current version: ${version}`);
}
```

