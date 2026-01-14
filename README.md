<div align="center">
  <img src="https://dll.nehonix.com/assets/xypriss/file_0000000083bc71f4998cbc2f4f0c9629.png" alt="XyPriss Logo" width="200" height="200">

# XyPriss

**Enterprise-Grade Node.js Web Framework**

[![npm version](https://badge.fury.io/js/xypriss.svg)](https://badge.fury.io/js/xypriss)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: NOSL](https://img.shields.io/badge/License-NOSL-blue.svg)](https://dll.nehonix.com/licenses/NOSL)
[![Powered by Nehonix](https://img.shields.io/badge/Powered%20by-Nehonix-blue?style=flat&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K)](https://nehonix.com)

[Quick Start](./docs/QUICK_START.md) • [Documentation](./docs/) • [Examples](./docs/EXAMPLES.md) • [API Reference](./docs/api-reference.md)

</div>

---

## Overview

XyPriss is a TypeScript-first Node.js web framework designed for building secure, scalable, and high-performance web applications. Built with enterprise requirements in mind, XyPriss provides comprehensive security features, advanced clustering capabilities, and seamless integration with production infrastructure.

### Core Features

-   **Security-First Architecture** - 12+ built-in security middleware modules including CSRF protection, XSS prevention, and intelligent rate limiting
-   **High Performance** - Independent HTTP server implementation with multi-core clustering support
-   **File Upload Management** - Production-ready multipart/form-data handling with automatic validation and error handling
-   **Extensible Plugin System** - Permission-based plugin architecture with lifecycle hooks and security controls
-   **Multi-Server Support** - Run multiple server instances with isolated configurations and security policies
-   **Production Integration** - Native integration with [XyNginC](https://github.com/Nehonix-Team/xynginc) for automated Nginx configuration and SSL management

---

## Installation

```bash
npm install xypriss
# or
yarn add xypriss
```

For additional security features:

```bash
npm install xypriss-security
```

---

## Quick Start

### Using CLI

```bash
npx xypriss-cli init
cd my-app
npm run dev
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

**[Complete Quick Start Guide](./docs/QUICK_START.md)**

---

## Documentation

### Getting Started

-   [Quick Start Guide](./docs/QUICK_START.md) - Installation and basic setup
-   [Examples](./docs/EXAMPLES.md) - Practical code examples
-   [Features Overview](./docs/FEATURES_OVERVIEW.md) - Comprehensive feature list

### Core Guides

-   [Routing](./docs/ROUTING.md) - Route configuration and middleware
-   [Security](./docs/SECURITY.md) - Security features and best practices
-   [File Upload](./docs/FILE_UPLOAD_GUIDE.md) - File upload handling
-   [Configuration](./docs/CONFIGURATION.md) - Complete configuration reference
-   [Multi-Server](./docs/MULTI_SERVER.md) - Multi-server deployment

### Plugin System

-   [Plugin Development](./docs/PLUGIN_DEVELOPMENT_GUIDE.md) - Creating plugins
-   [Plugin Hooks](./docs/PLUGIN_CORE_HOOKS.md) - Available lifecycle hooks
-   [Plugin Permissions](./docs/PLUGIN_PERMISSIONS.md) - Security and permissions
-   [Console Intercept Hook](./docs/CONSOLE_INTERCEPT_HOOK.md) - Console monitoring

### Advanced Topics

-   [XJson API](./docs/XJSON_API.md) - Advanced JSON serialization
-   [Clustering](./docs/bun-clustering.md) - Multi-worker scaling
-   [Performance Tuning](./docs/cluster-performance-tuning.md) - Optimization strategies

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

-   Acknowledging receipt of your report within 48 hours
-   Providing regular updates on our progress
-   Crediting researchers who responsibly disclose vulnerabilities

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

-   Follow the existing code style and conventions
-   Include tests for new features
-   Update documentation as needed
-   Ensure all tests pass before submitting
-   Write clear commit messages

**[Read the Complete Contributing Guide](./CONTRIBUTING.md)**

---

## Community Support

### Resources

-   **Documentation** - [Complete guides and API reference](./docs/)
-   **GitHub Discussions** - [Community Q&A and feature discussions](https://github.com/Nehonix-Team/XyPriss/discussions)
-   **Issue Tracker** - [Bug reports and feature requests](https://github.com/Nehonix-Team/XyPriss/issues)
-   **Security** - [Report vulnerabilities](mailto:support@team.nehonix.com)
-   **Website** - [Learn more about Nehonix](https://nehonix.com)

### Support the Project

If XyPriss has been valuable for your projects, consider:

-   Starring the repository on GitHub
-   Sharing the project with your network
-   Contributing to the codebase or documentation
-   Providing feedback and suggestions

---

## License

XyPriss is licensed under the [NOSL License](./LICENSE).

---

## Acknowledgments

<div align="center">

### Developed by Nehonix Team

XyPriss is maintained by [Nehonix](https://github.com/Nehonix-Team) and its [contributors](https://github.com/Nehonix-Team/XyPriss/graphs/contributors).

[![Website](https://img.shields.io/badge/Website-nehonix.com-blue?style=for-the-badge&logo=globe)](https://nehonix.com)
[![GitHub](https://img.shields.io/badge/GitHub-Nehonix--Team-black?style=for-the-badge&logo=github)](https://github.com/Nehonix-Team)

</div>

