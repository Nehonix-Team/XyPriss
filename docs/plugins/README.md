<div align="center">
  <h1>XyPriss Plugin Ecosystem</h1>
  <p><strong>Secure, Modular, and Ultra-Fast Extensions for XyPriss</strong></p>
</div>

---

## Welcome to the XyPriss Plugin Ecosystem

Plugins in XyPriss are more than just middleware—they are fully integrated, secure modules that hook deep into the framework's lifecycle. Built with a **Capability-Based Security Model**, the plugin ecosystem allows developers to extend the server's functionality while guaranteeing system-wide stability and security.

### Why Use XyPriss Plugins?

If you are wondering _"Why should I build a plugin instead of just writing middleware?"_, here is why:

1. **Complete Lifecycle Integration**: Plugins can initialize database connections on server start, monitor traffic in real-time, and gracefully shut down resources when the server stops.
2. **Zero-Trust Security**: Each plugin runs in a sandboxed `PluginServer` proxy. They cannot maliciously alter your global application instance, and they cannot read sensitive server configurations without explicit permission.
3. **High Performance**: Plugins are executed based on targeted phases (`NETWORK`, `SECURITY`, `CACHE`), ensuring that XyPriss maintains its ultra-fast throughput without overhead.
4. **Reusability & Ecosystem**: Legitimate XyPriss plugins can be published to the community (npm/XFPM) and instantly integrated by thousands of developers.

---

## Documentation Hub

Whether you are looking to integrate third-party plugins securely or build your own to publish, explore our structured guides below:

### Step-by-Step Tutorials

Start here if you want answers to **"How"** and **"Why"**:

- **[Tutorial: How to Use and Secure Plugins](./TUTORIAL_USAGE.md)**
  _Learn how to install, configure, and safely grant permissions to third-party plugins in your XyPriss server._
- **[Tutorial: How to Create and Publish a Plugin from A-Z](./TUTORIAL_AUTHORING.md)**
  _A complete guide for developers on building a legitimate XyPriss plugin, testing it, and publishing it to npm for the XFPM ecosystem._

### Technical Architecture & API Reference

Dive deep into the precise mechanics of the plugin engine:

- **[Plugin System Guide](./PLUGIN_SYSTEM_GUIDE.md)**: Explore the modular core (Registries, Interceptors, Restricted Proxies).
- **[Plugin API Reference](./plugins.md)**: Complete details on the `XyPrissPlugin` interface, hook signatures, and performance prioritization.
- **[Plugin Permissions Guide](./PLUGIN_PERMISSIONS.md)**: Comprehensive reference of `PluginHookIds` and Capability-Based sticky denials.
- **[Built-in Plugins](./BUILTIN_PLUGINS.md)**: Documentation for official plugins included out-of-the-box (XEMS, Route Optimization, Maintenance).

---

## Core Philosophy: Secure by Default

The XyPriss philosophy insists that extending your application should never mean compromising it.

When you add a plugin to your XyPriss app, you do it knowing that:

- It **cannot** overwrite your core server properties.
- It **cannot** read your sensitive environment variables or configs quietly.
- It **must** declare its intentions, and you hold the final keys to its permissions.

Welcome to a safer, faster, and more modular web.

