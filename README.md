<div align="center">
  <img src="https://dll.nehonix.com/assets/xypriss/file_0000000083bc71f4998cbc2f4f0c9629.png" alt="XyPriss Logo" width="200" height="200">

**Enterprise-Grade Node.js Web Framework**

[![npm version](https://badge.fury.io/js/xypriss.svg)](https://badge.fury.io/js/xypriss)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: NOSL](https://img.shields.io/badge/License-NOSL-blue.svg)](https://dll.nehonix.com/licenses/NOSL)
[![Powered by Nehonix](https://img.shields.io/badge/Powered%20by-Nehonix-blue?style=flat&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K)](https://nehonix.com)

[Quick Start](https://xypriss.nehonix.com/docs/QUICK_START) • [Documentation](https://xypriss.nehonix.com/docs/) • [Examples](https://xypriss.nehonix.com/docs/EXAMPLES) • [API Reference](https://xypriss.nehonix.com/docs/api-reference)

</div>

---

> Beta Version

## Overview

XyPriss is a **Hybrid Enterprise-Grade Web Framework** that bridges the power of **Rust** with the flexibility of **TypeScript**.

### Cross-Platform Foundation

At its core, XyPriss is engineered for universal high-performance. We provide native Rust binaries (XFPM & XHSC) for:

| OS          | Architecture            | Status           |
| ----------- | ----------------------- | ---------------- |
| **Linux**   | x86_64 (AMD64)          | ✅ Supported     |
| **Linux**   | aarch64 (ARM64)         | ✅ Supported     |
| **Windows** | x86_64 (AMD64)          | ✅ Supported     |
| **Windows** | aarch64 (ARM64)         | ✅ Supported     |
| **macOS**   | x86_64 (Intel)          | 🛠️ Source-only\* |
| **macOS**   | aarch64 (Apple Silicon) | 🛠️ Source-only\* |

_We are committed to future-proofing our engine for emerging architectures like RISC-V._

At its heart lies **XHSC (XyPriss Hybrid Server Core)**, a high-performance Rust engine that handles low-level networking, advanced routing, and system telemetry. This unique hybrid architecture allows developers to build secure, scalable applications using TypeScript while benefiting from Rust's raw performance and multi-core efficiency.

### Architecture & Tools

XyPriss operates on a unified strategy:

1.  **XHSC (Rust Engine):** Manages the HTTP/S stack, ultra-fast radix routing, and real-time hardware monitoring. It acts as the high-speed gateway for all incoming traffic.
2.  **Node.js Runtime:** Provides the enterprise-ready application layer where developers manage business logic, security middlewares, and data processing using TypeScript.
3.  **XFPM (XyPriss Fast Package Manager):** Our ultra-fast, Rust-powered developer tool. **We highly recommend using `xfpm` for all operations.** It provides optimized resolution, ultra-fast extraction, and caching tailored for the XyPriss ecosystem. [Learn more about XFPM](https://xypriss.nehonix.com/docs/xfpm?kw=XFPM%20is%20the%20high-performance).

### Core Features

- **High Performance XHSC Engine** - Independent Rust server core implementation with multi-core clustering support and high-precision system telemetry.
- **Security-First Architecture** - 12+ built-in security middleware modules including CSRF protection, XSS prevention, and intelligent rate limiting.
- **Advanced Radix Routing** - Ultra-fast routing system powered by Rust, capable of handling complex path matching with microsecond latency.
- **File Upload Management** - Production-ready multipart/form-data handling with automatic validation and error handling.
- **Extensible Plugin System** - Permission-based plugin architecture with lifecycle hooks and security controls.
- **Native Production Integration** - Built for automated deployments and SSL management via [XyNginC](https://github.com/Nehonix-Team/xynginc).
- **Multi-Server Support** - Run multiple server instances with isolated configurations and security policies.

---

We strongly recommend using the **XyPriss CLI (`xyp`)** for the fastest and most reliable developer experience.

Refer to the [**Installation Guide**](./docs/INSTALLATION.md) for detailed platform-specific instructions.

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

### Core Guides

- [Routing](https://xypriss.nehonix.com/docs/ROUTING) - Route configuration and middleware
- [Security](https://xypriss.nehonix.com/docs/SECURITY) - Security features and best practices
- [File Upload](./docs/FILE_UPLOAD_GUIDE.md) - File upload handling
- [Configuration](https://xypriss.nehonix.com/docs/CONFIGURATION) - Complete configuration reference
- [Multi-Server](https://xypriss.nehonix.com/docs/MULTI_SERVER) - Multi-server deployment

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

XyPriss is licensed under the [NOSL License](https://dll.nehonix.com/licenses/NOSL).

---

## Acknowledgments

<div align="center">

### Developed by Nehonix Team

XyPriss is maintained by [Nehonix](https://github.com/Nehonix-Team) and its [contributors](https://github.com/Nehonix-Team/XyPriss/graphs/contributors).

[![Website](https://img.shields.io/badge/Website-nehonix.com-blue?style=for-the-badge&logo=globe)](https://nehonix.com)
[![GitHub](https://img.shields.io/badge/GitHub-Nehonix--Team-black?style=for-the-badge&logo=github)](https://github.com/Nehonix-Team)

</div>

