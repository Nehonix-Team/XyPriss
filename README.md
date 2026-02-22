<div align="center">
  <img src="https://dll.nehonix.com/assets/xypriss/file_0000000083bc71f4998cbc2f4f0c9629.png" alt="XyPriss Logo" width="200" height="200">

**Enterprise-Grade Node.js Web Framework**

[![npm version](https://badge.fury.io/js/xypriss.svg)](https://badge.fury.io/js/xypriss)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: Nehonix OSL (NOSL)](https://img.shields.io/badge/License-Nehonix OSL (NOSL)-blue.svg)](https://dll.nehonix.com/licenses/NOSL)
[![Powered by Nehonix](https://img.shields.io/badge/Powered%20by-Nehonix-blue?style=flat&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K)](https://nehonix.com)

[Quick Start](https://xypriss.nehonix.com/docs/QUICK_START) • [Documentation](https://xypriss.nehonix.com/docs/) • [Examples](https://xypriss.nehonix.com/docs/EXAMPLES) • [API Reference](https://xypriss.nehonix.com/docs/api-reference)

</div>

---

> Beta Version

## Overview

XyPriss is an **Enterprise-Grade Hybrid Web Framework** that combines the raw performance of compiled native binaries with the productivity and flexibility of **TypeScript**. It is designed for teams that require both operational speed and developer velocity, without compromise.

> 🛡️ **Security Briefing:** XyPriss enforces "Secure by Default" architecture. Core variables are protected by a native **[Environment Security Shield](./docs/ENVIRONMENT_SHIELD.md)** that blocks direct `process.env` access to prevent leakage, alongside a built-in, zero-dependency storage system (**XEMS**) and high-speed Go-powered networking (**XHSC**).

### Cross-Platform Foundation

XyPriss ships pre-compiled native binaries for all major platforms. No additional toolchains, compilers, or runtime dependencies are required.

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
3. **XFPM (XyPriss Fast Package Manager):** A high-performance, Rust-powered package manager optimized for the XyPriss ecosystem. Provides ultra-fast dependency resolution, extraction, and caching. [Learn more about XFPM](https://xypriss.nehonix.com/docs/xfpm?kw=XFPM%20is%20the%20high-performance).

This separation allows each layer to operate in its optimal domain: compiled native code for performance-critical paths, TypeScript for rapid application development.

### Core Features

- **XHSC Native Engine** — Statically-linked system core with multi-core clustering, IPC bridge, and high-precision hardware telemetry across all supported platforms.
- **XEMS Session Security** — AES-256-GCM encrypted in-memory session store powered by a dedicated native Golang sidecar. Provides opaque tokens, per-request atomic rotation, sandboxed namespaces, and optional hardware-bound persistence — with zero external dependencies.
- **Security-First Architecture** — 12+ built-in security middleware modules including CSRF protection, XSS prevention, and intelligent rate limiting.
- **Advanced Radix Routing** — Ultra-fast routing system capable of complex path matching with microsecond latency.
- **Real-Time System Intelligence** — Native access to CPU, memory, disk, network, battery, and process metrics directly from the application layer.
- **Filesystem Engine** — High-performance file operations including recursive copy, directory sync, content hashing, duplicate detection, and real-time file watching.
- **File Upload Management** — Production-ready multipart/form-data handling with automatic validation and error handling.
- **Environment Security Shield** — Military-grade protection for sensitive variables. Direct `process.env` access is masked via a native Proxy to prevent accidental leakage, forcing the use of secure, typed APIs.
- **Built-in DotEnv Loader** — Zero-dependency, ultra-fast `.env` parser with automatic support for `.env`, `.env.local`, and `.private/.env`.
- **Extensible Plugin System** — Permission-based plugin architecture with lifecycle hooks and security controls.
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
xyp install xypriss
```

Alternatively, using standard package managers:

```bash
xfpm i xypriss
# or
yarn add xypriss
```

For additional security features:

```bash
xfpm install xypriss-security
```

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
    res.json({ message: "Hello from XyPriss" });
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

### Security

- [Security Overview](./docs/security/SECURITY.md) - Security features and best practices
- [**XEMS — Secure Sessions & Temporary Storage**](./docs/XEMS_TUTORIAL.md) - AES-256-GCM encrypted sessions, OTP flows, token rotation
- [Route-Based Security](./docs/security/ROUTE_BASED_SECURITY.md) - Per-route security policies
- [Request Signature Auth](./docs/security/request-signature-auth.md) - API key authentication
- [CORS Configuration](./docs/security/advanced-cors-regexp.md) - Advanced CORS with RegExp patterns

### Plugin System

- [Plugin Development](https://xypriss.nehonix.com/docs/PLUGIN_DEVELOPMENT_GUIDE) - Creating plugins
- [Plugin Hooks](https://xypriss.nehonix.com/docs/PLUGIN_CORE_HOOKS) - Available lifecycle hooks
- [Plugin Permissions](https://xypriss.nehonix.com/docs/PLUGIN_PERMISSIONS) - Security and permissions
- [Console Intercept Hook](https://xypriss.nehonix.com/docs/CONSOLE_INTERCEPT_HOOK) - Console monitoring

### Advanced Topics

- [XJson API](./docs/XJSON_API.md) - Advanced JSON serialization
- [Clustering](./docs/bun-clustering.md) - Multi-worker scaling
- [Performance Tuning](./docs/cluster-performance-tuning.md) - Optimization strategies

**[View All Documentation](./docs/)**

---

## Security

XyPriss is built with security as a fundamental design principle. The framework implements multiple layers of protection and follows industry best practices for secure web application development.

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

**[Full XEMS Guide →](./docs/XEMS_TUTORIAL.md)**

### Environment Security Shield

XyPriss implements a **Strict Environment Shield** to protect your secrets and enforce coding best practices. By default, XyPriss masks direct access to `process.env` for non-essential variables to prevent accidental exposure by third-party libraries or logging debugging artifacts.

#### 1. Zero-Dependency Loader

No need for `dotenv` or other external packages. XyPriss automatically loads variables from:

1. `.env`
2. `.env.local`
3. `.private/.env` (Priority)

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

