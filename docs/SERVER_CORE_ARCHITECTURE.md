# Server Core Architecture

XyPriss features a highly modular and extensible core architecture. The request and response handling logic is decoupled into specialized components to ensure high performance, maintainability, and a robust developer experience.

## Overview

The core server logic is centered around the `HttpServer` class, which delegates specific tasks to specialized "Enhancers" and "Wrappers". This modularity allows for easier testing and independent scaling of features.

## Request and Response Enhancement

When a new HTTP request arrives, XyPriss immediately "enhances" the raw Node.js `IncomingMessage` and `ServerResponse` objects. This process is handled by two primary modules:

### 1. RequestEnhancer

The `RequestEnhancer` is responsible for transforming the raw request into a feature-rich `XyPrisRequest`.

-   **URL Parsing**: Implements a dual-layer parsing strategy. It prioritizes the modern WHATWG `URL` API for performance and falls back to the legacy `url` module for malformed inputs.
-   **Trust Proxy Integration**: Utilizes the `TrustProxy` utility to accurately determine the client's real IP, protocol (HTTP/HTTPS), and hostname, even behind multiple layers of proxies.
-   **Cookie Parsing**: Efficiently parses the `Cookie` header into a structured object.
-   **Express Compatibility**: Injects standard properties like `query`, `params`, `body`, `path`, and `xhr`.

### 2. ResponseEnhancer

The `ResponseEnhancer` decorates the response object with utility methods that simplify common tasks.

-   **Polymorphic `res.send()`**: Automatically handles strings, buffers, and objects (converting them to JSON).
-   **Robust `res.cookie()`**: Provides a full-featured cookie implementation supporting `maxAge`, `expires`, `httpOnly`, `secure`, `path`, `domain`, and `sameSite` (Lax/Strict/None).
-   **Safe `res.json()`**: Includes a specialized JSON serializer that handles `BigInt`, `Error` objects, and prevents crashes on circular references.
-   **Chainable Methods**: Methods like `res.status()` and `res.set()` return the response object to allow for fluent API usage.

## The `req.app` Proxy

In XyPriss, the `req.app` property is not a simple reference but a robust wrapper implemented via the `XyPrisRequestApp` class.

### Transparent Access

`XyPrisRequestApp` uses a JavaScript `Proxy` to provide transparent access to the main application instance (`XyprissApp`). This means that any property or method available on the main app is also accessible via `req.app`.

### Optimized Configuration Management

The wrapper provides specialized `get()` and `set()` methods that are fully compatible with Express. These methods prioritize the application's internal settings storage while maintaining a fallback to direct property access.

### Plugin Integration

The `req.app.pluginManager` property provides a secure way for middlewares and route handlers to interact with the plugin system if needed.

## Trust Proxy System

The `TrustProxy` module is a high-performance utility for handling IP-based security and identification.

-   **Pre-compiled Rules**: Rules (IPs, CIDR ranges, or predefined keywords like `loopback`) are pre-compiled during initialization to minimize runtime overhead.
-   **Multi-level Caching**: Employs internal LRU (Least Recently Used) caches for IP normalization, CIDR matching, and numeric conversions.
-   **CIDR Support**: Full support for both IPv4 and IPv6 CIDR notation using optimized bitwise operations and `BigInt` arithmetic.

## Performance Considerations

-   **Zero-Allocation Parsing**: The enhancers are designed to minimize object allocations during the request lifecycle.
-   **Lazy Initialization**: Many properties are only calculated or parsed when first accessed.
-   **Internal Caching**: Frequently used regex patterns and parsing results are cached at the class level.

