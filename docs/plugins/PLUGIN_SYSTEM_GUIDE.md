# XyPriss Plugin System Guide

The XyPriss Plugin System is a modular, high-performance architecture designed to extend the framework's capabilities while maintaining strict security boundaries. It uses a **Capability-Based Security Model** where each plugin operates within a restricted, sandboxed context.

## Core Architecture

Unlike monolithic plugin systems, XyPriss decomposes management into specialized sub-modules:

1.  **Plugin Loader**: Handles the discovery, dynamic loading, and initialization of plugins from both configuration and files.
2.  **Plugin Registry**: Manages the global registration state, ensuring unique naming and correct execution order based on dependencies.
3.  **Plugin Security**: Enforces contract verification and creates the **Restricted Server Proxy** for each plugin.
4.  **Plugin Hook Runner**: Orchestrates the execution of lifecycle and functional hooks across all registered plugins.
5.  **Plugin Interceptor**: Powers the custom middleware and request/response interception logic.

## Security Model: The Restricted Server

To prevent plugins from accidentally or maliciously compromising the core framework, XyPriss does not provide direct access to the `app` instance. Instead, each plugin receives a `PluginServer` proxy.

### Restricted Access

- **`app` Protection**: The `app` object in the plugin context only exposes a subset of methods (`get`, `post`, `put`, `delete`, `use`, etc.).
- **Immutability**: Plugins cannot add or modify properties on the global application instance.
- **Config Isolation**: Access to `server.app.configs` is blocked by default and returns `undefined` unless the `XHS.PERM.SECURITY.CONFIGS` permission is granted.

## Plugin Lifecycle

Plugins follow a strict sequence of events managed by the `PluginHookRunner`:

1.  **Registration (`onRegister`)**: Initial discovery and metadata validation.
2.  **Initialization (`onServerStart`)**: Execution starts once the basic server structure is ready.
3.  **Ready State (`onServerReady`)**: Triggered when the server is fully listening and active.
4.  **Shutdown (`onServerStop`)**: Graceful cleanup before the process terminates.

## Zero-Trust Security & Integrity

In the G3 architecture generation, the security model is extended with a mandatory Zero-Trust integrity layer:

1.  **Identity Attribution**: Every plugin must be signed by an authorized Developer ID (Ed25519).
2.  **Portable Integrity**: A cryptographic manifest (`xypriss.plugin.xsig`) ensures that the plugin's content (SHA-256) matches the author's original publication exactly.
3.  **Deep Audit**: The XHSC core performs an automated security audit at startup, verifying all signatures against the project's configuration.
4.  **Author Key Pinning**: Prevents unauthorized plugin execution or "Evil Upgrades" by strictly enforcing trusted author keys.
5.  **Whitelist Enforcement**: Enforces a strict "Deny-by-Default" policy for all functional capabilities (Routing, HTTP, Security, Ops). Only lifecycle hooks are permitted without an explicit whitelist.

## Contract Verification

Every plugin is subject to **Contract Security Verification**. XyPriss automatically detects the origin of a plugin loading request. Unauthorized or hidden loading attempts from untrusted locations will trigger a security violation, ensuring that only approved core or user-defined modules are active.

## Performance Optimization

The plugin system is optimized for zero-overhead execution:

- **Phase-Based Execution**: Plugins are categorized by `PluginType` (e.g., `SECURITY`, `NETWORK`, `CACHE`) to minimize latency in the request path.
- **Priority Control**: Developers can define execution priority (`CRITICAL` to `BACKGROUND`) to ensure performance-critical hooks run first.

---

**Next Steps**:

- [Plugin API Reference](./plugins.md) - Detailed hook signatures and interfaces.
- [Plugin Permission System](./PLUGIN_PERMISSIONS.md) - Configuring security capabilities.
- [Built-in Plugins Guide](./BUILTIN_PLUGINS.md) - Official framework extensions.

