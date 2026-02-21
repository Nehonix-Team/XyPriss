# Features Overview

This document provides a high-level summary of the latest features and architectural improvements implemented in XyPriss to enhance stability, security, and developer experience.

## 0. XHSC Hybrid Engine (Go + Node.js)

XyPriss now operates on a cutting-edge hybrid architecture, leveraging the strengths of both Go and Node.js.

-   **Go-Powered Routing**: Ultra-fast Radix Tree matching for microsecond latency.
-   **Lock-Free Performance**: Concurrent request handling with native thread efficiency.
-   **Native Telemetry**: High-precision system monitoring directly from the server core.
-   **IPC Bridge**: High-speed communication between the Go gateway and Node.js application layer.
-   **Detailed Documentation**: [XHSC Core Intelligence](./XHSC_CORE.md)

## 1. Plugin Stability and Resilience

XyPriss now includes advanced protection against faulty plugin logic.

-   **Error Isolation**: Plugin hooks are wrapped in a safety layer that catches and logs errors without crashing the server.
-   **Logic Conflict Detection**: Proactively detects and reports invalid patterns, such as calling `next()` after sending a response.
-   **Write Protection**: Intercepts "write after end" attempts and provides clear diagnostic logs.
-   **Detailed Documentation**: [Plugin Stability Guide](./PLUGIN_STABILITY.md)

## 2. Advanced Plugin Permissions

The permission model has been strengthened for better control and auditability.

-   **Sticky Denials**: Explicitly block hooks using `deniedHooks`, which override any allow rules.
-   **Detailed Documentation**: [Plugin Permission System](./PLUGIN_PERMISSIONS.md)

## 3. Modular Server Architecture

The core server logic has been refactored into specialized, high-performance components.

-   **Request & Response Enhancers**: Decoupled logic for decorating HTTP objects with Express-like features.
-   **Robust `req.app` Proxy**: A transparent proxy that provides full access to the main application instance while maintaining Express compatibility.
-   **Optimized Trust Proxy**: Improved IP and protocol detection with pre-compiled rules and multi-level caching.
-   **Detailed Documentation**: [Server Core Architecture](./SERVER_CORE_ARCHITECTURE.md)

## 4. Proactive Data Masking

Enhanced security for user data within the plugin ecosystem.

-   **Automatic Masking**: Sensitive fields (`body`, `query`, `cookies`, `params`) are automatically masked in plugin hooks.
-   **Principle of Least Privilege**: Ensures plugins only access the data they truly need.
-   **Detailed Documentation**: [Plugin Data Masking](./PLUGIN_DATA_MASKING.md)

## 5. Enhanced Response API

The response object now provides a more robust and feature-complete API.

-   **Safe JSON Serialization**: Handles complex types like `BigInt` and `Error` objects, and prevents circular reference crashes.
-   **Full Cookie Support**: A comprehensive implementation of the cookie API with support for all modern security attributes.
-   **Polymorphic `send()`**: Intelligent data handling for various content types.

---

For a complete list of all available features and configurations, please refer to the [API Reference](./api-reference.md).

