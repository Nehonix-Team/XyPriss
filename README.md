<div align="center">
  <img src="https://dll.nehonix.com/assets/xypriss/file_0000000083bc71f4998cbc2f4f0c9629.png" alt="XyPriss Logo" width="200" height="200">

**Enterprise-Grade Node.js Web Framework**

_Stop Coding Backends. Start Deploying Fortresses._

[![Version](https://badge.fury.io/js/xypriss.svg)](https://xypriss.nehonix.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: Nehonix OSL (NOSL)](https://img.shields.io/badge/License-Nehonix%20OSL%20%28NOSL%29-blue.svg)](https://dll.nehonix.com/licenses/NOSL)
[![Powered by Nehonix](https://img.shields.io/badge/Powered%20by-Nehonix-blue?style=flat&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K)](https://nehonix.com)

[Quick Start](https://xypriss.nehonix.com/docs/QUICK_START) • [Documentation](https://xypriss.nehonix.com/docs/) • [Examples](https://xypriss.nehonix.com/docs/EXAMPLES) • [API Reference](https://xypriss.nehonix.com/docs/api-reference)

</div>

---

> [!WARNING]
> **Beta Software** — This project is in active development. APIs, configurations, and behaviors may change at any time without notice. Use in production at your own risk.

## Overview

XyPriss is an **Enterprise-Grade Hybrid Web Framework** that combines the raw performance of compiled native binaries with the productivity and flexibility of **TypeScript**. It is designed for teams that require both operational speed and developer velocity, without compromise.

> [!NOTE]
> **Security Briefing:** XyPriss enforces a "Secure by Default" architecture. Core variables are protected by a native **[Environment Security Shield](./docs/ENVIRONMENT_SHIELD.md)** that blocks direct `process.env` access to prevent leakage. This is complemented by a built-in, zero-dependency storage system (**XEMS**), high-speed Go-powered networking (**XHSC**), and a **Zero-Trust Plugin Security** layer.

### Cross-Platform Foundation

XyPriss provides pre-compiled native binaries for all major platforms. No additional toolchains, compilers, or runtime dependencies are required.

| OS          | Architecture            | Status    |
| ----------- | ----------------------- | --------- |
| **Linux**   | x86_64 (AMD64)          | Supported |
| **Linux**   | aarch64 (ARM64)         | Supported |
| **Windows** | x86_64 (AMD64)          | Supported |
| **Windows** | aarch64 (ARM64)         | Supported |
| **macOS**   | x86_64 (Intel)          | Supported |
| **macOS**   | aarch64 (Apple Silicon) | Supported |

### Architecture

At the center of XyPriss lies **XHSC (XyPriss Hyper-System Core)** — the native engine responsible for low-level HTTP networking, high-speed radix routing, filesystem operations, real-time system telemetry, and inter-process communication. XHSC is written in Go for maximum portability and ships as a single statically-linked binary per platform with zero external dependencies.

The framework operates on a layered architecture:

1. **XHSC (Native Engine):** Handles the HTTP/S stack, advanced radix routing, filesystem I/O, process monitoring, and real-time hardware telemetry. It acts as the high-speed gateway for all incoming traffic and system operations.
2. **Node.js Runtime:** Provides the enterprise-ready application layer where developers define business logic, security middleware, and data processing pipelines using TypeScript.
3. **XFPM (XyPriss Fast Package Manager):** A high-performance, Go-powered package manager optimized for the XyPriss ecosystem. Provides ultra-fast dependency resolution, extraction, and caching. [Learn more about XFPM](https://github.com/Nehonix-Team/XFMP).

This separation allows each layer to operate in its optimal domain: compiled native code for performance-critical paths, TypeScript for rapid application development.

### Core Features

- **XHSC Native Engine** — Statically-linked system core with multi-core clustering, IPC bridge, and high-precision hardware telemetry across all supported platforms.
- **XEMS Session Security** — AES-256-GCM encrypted in-memory session store powered by a dedicated native Golang sidecar. Provides opaque tokens, per-request atomic rotation, sandboxed namespaces, and optional hardware-bound persistence — with zero external dependencies.
- **Security-First Architecture** — 12+ built-in security middleware modules including CSRF protection, XSS prevention, and intelligent rate limiting.
- **Advanced Radix Routing (V2)** — Ultra-fast, modular routing engine with support for typed path parameters, declarative guards, and native API versioning.
- **Real-Time System Intelligence** — Native access to CPU, memory, disk, network, battery, and process metrics directly from the application layer.
- **Filesystem Engine & Binary Streaming** — High-performance filesystem operations, duplicate detection, and robust **Zero-Copy Ranged Streaming** via `res.sendFile()`, optimized for media delivery and large assets.
- **File Upload Management** — Production-ready multipart/form-data handling with automatic validation, error handling, and the `getMimes()` helper for extension-to-mime mapping.
- **Environment Security Shield** — Military-grade protection for sensitive variables. Direct `process.env` access is masked via a native Proxy to prevent accidental leakage, forcing the use of secure, typed APIs.
- **Built-in DotEnv Loader** — Zero-dependency, ultra-fast `.env` parser with automatic support for `.env`, `.env.local`.
- **Extensible Plugin System** — Permission-based plugin architecture with lifecycle hooks and strict security controls (sandboxed restricted instances).
- **Application Immutability** — Global protection against runtime hijacking. The `App` instance is locked via Proxy after creation to prevent unauthorized property mutations or deletions.
- **Native Production Integration** — Built for automated deployments and SSL management via [XyNginC](https://github.com/Nehonix-Team/xynginc).
- **Multi-Server Support** — Run multiple server instances with isolated configurations and security policies.

---

We strongly recommend using the **XyPriss CLI (`xyp`)** for the fastest and most reliable developer experience.

Refer to the [**Installation Guide**](https://xypriss.nehonix.com/docs/installation?q=install%20xfpm&kw=This%20document%20provides%20step-by-step%20in) for detailed platform-specific instructions.

### Quick Install (Unix)

```bash
curl -sL https://xypriss.nehonix.com/install.js | node
```

Once installed, you can manage your project dependencies with ultra-high performance:

```bash
# Install XyPriss in your project
xfpm install xypriss
```

> [!IMPORTANT]
> **XFPM Exclusivity**: All XyPriss projects MUST use `xfpm` for dependency management. Other package managers are not supported and will break the security chain.

For additional security features:

```bash
xfpm install xypriss-security
```

---

## Requirements

Before running a XyPriss project, make sure the following two tools are installed on your system. They are **mandatory** — using another package manager (npm, yarn, pnpm, etc.) or JavaScript runtime will break the framework's security chain and native integration.

| Requirement | Purpose                                                                                  | Install                                                             |
| ----------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **XFPM**    | Package manager for the XyPriss ecosystem. Only manager supported for install/run/build. | [Installation Guide](https://xypriss.nehonix.com/docs/installation) |
| **Bun**     | JavaScript runtime used to execute XyPriss projects and scripts.                         | [bun.sh](https://bun.sh)                                            |

```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Install XFPM
curl -sL https://xypriss.nehonix.com/install.js | node
```

> [!CAUTION]
> Using `npm run`, `node`, or another runtime to start a XyPriss server is not supported and will produce undefined behavior. Always use `xfpm run` or `bun` to execute scripts and entry points.

---

## Quick Start

### Using CLI

```bash
xfpm init
cd my-app
xfpm dev # or xyp dev (both are the same)
```

### Manual Setup

```typescript
import { createServer } from "xypriss";

const app = createServer({
    server: { port: 3000 },
    security: { enabled: true },
});

app.get("/", (req, res) => {
    res.success("Hello from XyPriss V2");
});

// Typed parameters & Versioning
app.version("v1", (v1) => {
    v1.get("/user/:id<number>", (req, res) => {
        res.success(`User ${req.params.id} accessed via V1`);
    });
});

app.start();
```

**[Complete Quick Start Guide](https://xypriss.nehonix.com/docs/QUICK_START)**

---

## Documentation

### Getting Started

- [Quick Start Guide](https://xypriss.nehonix.com/docs/QUICK_START) - Installation and basic setup
- [XFPM Guide](https://xypriss.nehonix.com/docs/xfpm) - Using the XyPriss Fast Package Manager
- [Examples](https://xypriss.nehonix.com/docs/EXAMPLES) - Practical code examples
- [Features Overview](https://xypriss.nehonix.com/docs/FEATURES_OVERVIEW) - Comprehensive feature list
- [Router Engine V2](./docs/routing/README.md) - Rich modular routing
- [Advanced Routing & XyGuard API](./docs/routing/ADVANCED_ROUTING.md) - Declarative guards and modularity

### Security

- [Security Overview](./docs/security/SECURITY.md) - Security features and best practices
- [**XEMS — Modular Technical Suite**](./docs/security/xems/README.md) - Deep dive into sidecar architecture, encryption, and configuration
- [**XEMS — Basic Tutorial**](./docs/XEMS_TUTORIAL.md) - High-level introduction to sessions and OTP flows
- [Route-Based Security](./docs/security/ROUTE_BASED_SECURITY.md) - Per-route security policies
- [Request Signature Auth](./docs/security/request-signature-auth.md) - API key authentication
- [CORS Configuration](./docs/security/advanced-cors-regexp.md) - Advanced CORS with RegExp patterns

### Plugin System

- [Plugin Development Guide](./docs/plugins/PLUGIN_SYSTEM_GUIDE.md) - Recommended: Comprehensive guide to the modular architecture.
- [Plugin API Reference](./docs/plugins/plugins.md) - Detailed interface and hook reference.
- [Plugin Permissions](./docs/plugins/PLUGIN_PERMISSIONS.md) - Security and permissions (Capability-Based).
- [Built-in Plugins](./docs/plugins/BUILTIN_PLUGINS.md) - Official XEMS, Route Optimization, and Maintenance plugins.
- [Console Intercept Hook](./docs/CONSOLE_INTERCEPT_HOOK.md) - Console monitoring.

### Request Logging

> [!NOTE]
> **`morgan` is not recommended in XyPriss applications.**
> While morgan will not break your application, it is not the right fit for the XyPriss security model. To get the best out of the framework with accurate request tracing, IP anonymization, and full compliance with the Zero-Trust architecture, use **[Xyphra](https://github.com/Nehonix-Team/xyphra)** instead.

The official logging solution for XyPriss is **[Xyphra](https://github.com/Nehonix-Team/xyphra)** — a native plugin built for the XHSC engine. It integrates seamlessly into the plugin system, respects the Zero-Trust security model, and provides IP anonymization, header redaction, and structured output.

```typescript
import { createServer } from "xypriss";
import { XyphraPlugin } from "xyphra";

const app = createServer({
    plugins: {
        register: [
            XyphraPlugin({
                anonymizeIp: true,
                immediate: false,
            }),
        ],
    },
});
```

### Advanced Topics

- [XJson API](./docs/XJSON_API.md) - Advanced JSON serialization
- [Clustering](./docs/bun-clustering.md) - Multi-worker scaling
- [Performance Tuning](./docs/cluster-performance-tuning.md) - Optimization strategies

**[View All Documentation](./docs/)**

---

## Security

XyPriss is built with security as a fundamental design principle. The framework implements multiple layers of protection and follows industry best practices for secure web application development.

### Native URI Normalization & Anti-ReDoS Engine

XyPriss intercepts every request at the lowest level to enforce strict security normalizations before routing occurs:

- **Path Traversal Protection**: Eradicates directory climbing (`..`, `//`) and bypasses utilizing complex double-encodings (e.g., `%252E%252E`).
- **Input Sanitization**: Automatically normalizes Unicode segments (NFC), strips dangerous null bytes, and removes invisible control characters.
- **Anti-ReDoS Sandbox**: All internal Regex evaluations run securely inside an isolated Node.js `vm` context with an adaptive execution timeout. This guarantees that complex Regex attacks (ReDoS) are cleanly aborted and cannot freeze the main event loop.

### Dynamic Honeypot Tarpit

XyPriss features a built-in Honeypot Tarpit designed to instantly neutralize connections from malicious botnets, vulnerability scanners, and automated exploit frameworks. Operating at the earliest phase of the request handling lifecycle, it drops malicious probes before routing, regex matching, or session loading occur.

- **Logic**: Analyzes paths across 6 distinct normalization and signature stages.
- **Immediate Neutralization**: Drops connection softly via lightweight `403 Forbidden` response to avoid terminating Keep-Alive sockets on reverse proxies.
- **Configurable Control**: Enabled automatically, easily configurable from `ServerOptions`.

```typescript
import { createServer } from "xypriss";

const app = createServer({
    security: {
        honeypotTarpit: false, // Allows you to opt-out if needed
    },
});
```

**[Read the Honeypot Tarpit documentation for detailed internal logic and capabilities →](./docs/security/HONEYPOT_TARPIT.md)**

### XEMS — Encrypted Memory Store

[XEMS](https://github.com/Nehonix-Team/XyPriss-XEMS) is the built-in session security layer. Unlike cookie-based JWT, XEMS stores all session data **server-side inside a native Go sidecar process**, encrypted with AES-256-GCM. The client only ever holds a random opaque token.

```typescript
import { createServer, xems } from "xypriss";

const app = createServer({
    server: {
        xems: {
            enable: true, // Enable the XEMS middleware
            ttl: "15m", // Session lifetime
            autoRotation: true, // Rotate token on every request
            gracePeriod: 1000, // ms the old token stays valid (concurrent requests)
        },
    },
});

// Login — create an encrypted session
app.post("/auth/login", async (req, res) => {
    // ... verify credentials
    await res.xLink({ userId: user.id, role: user.role }); // session created
    res.json({ success: true });
});

// Protected route — session auto-decrypted
app.get("/profile", (req, res) => {
    if (!req.session) return res.status(401).json({ error: "Unauthorized" });
    res.json({ user: req.session }); // { userId, role }
});
```

**[Full XEMS Technical Guide →](./docs/security/xems/README.md)** | **[Tutorial →](./docs/XEMS_TUTORIAL.md)**

### Application Immutability

To prevent runtime hijacking and ensure system-wide stability, XyPriss implements **Strict Application Immutability**. Once the server instance is created via `createServer()`, the `App` object is locked using a deep Proxy.

- **Blocked Actions**: Any attempt to add, modify, or delete properties from the `app` instance will throw a fatal `[XyPriss Security]` error.
- **Reasoning**: This ensures that security middleware, core handlers, and framework configurations cannot be tampered with after initialization.

- **Zero-Trust Plugin Security**: XyPriss implements a Zero-Trust security model for its plugin ecosystem, ensuring decentralized identity and portable integrity verification.
- **Selective Signing**: Plugins must explicitly define which files are included in the security hash via the `files` field in `package.json`. XFPM refuses to sign any plugin without this field or if the signature file `xypriss.plugin.xsig` is not explicitly listed in it.
- **Portable Integrity**: Plugins are cryptographically signed. The signature MUST reside at the plugin root for XHSC to verify the package's immutable footprint.
- **Decentralized Identity**: Every plugin author generates a unique Ed25519 identity key. No centralized authority is required.
- **Portable Integrity**: Plugins are cryptographically signed (SHA-256 + Ed25519). The signature travels with the package, allowing offline verification.
- **Deep Audit Engine**: The XHSC core performs a mandatory, high-performance security audit upon engine startup, verifying every plugin against pinned author keys.
- **Author Key Pinning**: Trusted authors are pinned within the project configuration (`xypriss.config.jsonc`), preventing unauthorized plugin execution or "Evil Upgrades."

**[Read the Plugin Signature Specification for detailed security mechanics →](./docs/plugins/PLUGIN_SIGNATURE_SPEC.md)**

### Plugin Permissions

XyPriss uses a Capability-Based Security Model for plugins. Each plugin operates within its own restricted server instance.

- **Zero-Trust Configs**: By default, plugins cannot access `server.app.configs`. Accessing this property will return `undefined`.
- **Explicit Permissions**: Privileged access to the full server configuration must be explicitly granted via the `XHS.PERM.SECURITY.CONFIGS` permission.

**[Learn more about Plugin Permissions →](./docs/plugins/PLUGIN_PERMISSIONS.md)**

### Environment Security Shield

XyPriss implements a **Strict Environment Shield** to protect your secrets and enforce coding best practices. By default, XyPriss masks direct access to `process.env` for non-essential variables to prevent accidental exposure by third-party libraries or logging debugging artifacts.

#### 1. Zero-Dependency Loader

No need for `dotenv` or other external packages. XyPriss automatically loads variables from:

1. `.env`
2. `.env.local`

#### 2. The Shield in Action

Standard system variables (like `PATH`, `USER`, `NODE_ENV`) are whitelisted for system stability, but your custom application variables are protected.

```typescript
// ❌ Blocked & Masked (returns undefined + Security Warning)
const secret = process.env.DATABASE_PASSWORD;

// ✅ Official & Secure Way
const secret = __sys__.__env__.get("DATABASE_PASSWORD");
```

#### 3. Official Configuration

For project configuration, use the `XYPRISS_` prefix to bypass the shield for internal framework variables:

- `XYPRISS_PORT`
- `XYPRISS_HOST`
- `XYPRISS_REDIS_URL`

**[Learn more about Environment Security →](./docs/ENVIRONMENT_SHIELD.md)**

### Security Disclosure Policy

While we maintain rigorous security standards, we acknowledge that vulnerabilities may exist. We encourage responsible disclosure of security issues.

**If you discover a security vulnerability, please report it via email:**

**Email:** [support@team.nehonix.com](mailto:support@team.nehonix.com)

**Please do not open public GitHub issues for security vulnerabilities.**

We are committed to:

- Acknowledging receipt of your report within 48 hours
- Providing regular updates on our progress
- Crediting researchers who responsibly disclose vulnerabilities

Your assistance in maintaining the security of XyPriss is greatly appreciated.

### Multi-Server Security Isolation

In Multi-Server mode, XyPriss enforces strict process and memory isolation. Each server defined in your configuration runs its own dedicated XEMS sidecar. This prevents session leakage between services (e.g., your public API cannot access sessions from your admin dashboard).

To interact with the correct store in a distributed setup:

- **Web Auth:** Use `res.xLink()` (automatic).
- **Direct Access:** Use `req.app.xems` or `xems.forApp(req.app)`.

---

## Contributing

XyPriss is an open-source project that welcomes contributions from the community. We value all forms of contribution, from bug reports to documentation improvements.

### How to Contribute

1. **Star the Repository** - Show your support and help others discover XyPriss
2. **Report Issues** - [Submit bug reports](https://github.com/Nehonix-Team/XyPriss/issues) with detailed reproduction steps
3. **Suggest Features** - [Open discussions](https://github.com/Nehonix-Team/XyPriss/discussions) for feature proposals
4. **Submit Pull Requests** - Review our [Contributing Guide](./CONTRIBUTING.md) before submitting code
5. **Improve Documentation** - Help us maintain clear and accurate documentation

### Contribution Guidelines

- Follow the existing code style and conventions
- Include tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting
- Write clear commit messages

**[Read the Complete Contributing Guide](./CONTRIBUTING.md)**

---

## Community Support

### Resources

- **Documentation** - [Complete guides and API reference](https://xypriss.nehonix.com/docs/)
- **GitHub Discussions** - [Community Q&A and feature discussions](https://github.com/Nehonix-Team/XyPriss/discussions)
- **Issue Tracker** - [Bug reports and feature requests](https://github.com/Nehonix-Team/XyPriss/issues)
- **Security** - [Report vulnerabilities](mailto:support@team.nehonix.com)
- **Website** - [Learn more about Nehonix](https://nehonix.com)

### Support the Project

If XyPriss has been valuable for your projects, consider:

- Starring the repository on GitHub
- Sharing the project with your network
- Contributing to the codebase or documentation
- Providing feedback and suggestions
- Giving us a star on GitHub

---

## License

XyPriss is licensed under the [Nehonix OSL (Nehonix OSL (NOSL)) License](https://dll.nehonix.com/licenses/NOSL).

---

## Acknowledgments

<div align="center">

### Developed by Nehonix Team

XyPriss is maintained by [Nehonix](https://github.com/Nehonix-Team) and its [contributors](https://github.com/Nehonix-Team/XyPriss/graphs/contributors).

[![Website](https://img.shields.io/badge/Website-nehonix.com-blue?style=for-the-badge&logo=globe)](https://nehonix.com)
[![GitHub](https://img.shields.io/badge/GitHub-Nehonix--Team-black?style=for-the-badge&logo=github)](https://github.com/Nehonix-Team)

</div>

