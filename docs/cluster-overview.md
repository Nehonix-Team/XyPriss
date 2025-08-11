# XyPriss Clustering System Overview

XyPriss provides a powerful and flexible clustering system that enables your application to take full advantage of multi-core systems while maintaining efficient resource usage. This document provides a high-level overview of the clustering system and serves as an entry point to our clustering documentation.

## Core Concepts

### What is Clustering?

Clustering in XyPriss allows your application to spawn multiple worker processes that share the same server port. This enables:

-   Better CPU utilization across multiple cores
-   Improved application reliability
-   Automatic load balancing of requests
-   Graceful handling of worker failures

### Architecture

The clustering system consists of:

-   **Master Process**: Manages worker lifecycle and coordinates cluster operations
-   **Worker Processes**: Handle actual request processing
-   **Shared Resources**: Managed resources like ports, memory, and configuration
-   **Health Monitoring**: Continuous monitoring of worker health and performance

## Documentation Structure

1. [**Cluster Configuration Guide**](cluster-configuration-guide.md)

    - Basic and advanced configuration options
    - Worker scaling strategies
    - Memory and resource allocation

2. [**Cluster API Reference**](cluster-api-reference.md)

    - Complete API documentation
    - Event system
    - Metrics and monitoring interfaces

3. [**Cluster Service Guide**](cluster-service.md)

    - Service architecture
    - Implementation details
    - Best practices

4. [**Bun Clustering Support**](bun-clustering.md)

    - Bun-specific optimizations
    - Runtime differences
    - Migration guide

5. [**Troubleshooting Guide**](cluster-troubleshooting.md)
    - Common issues and solutions
    - Debugging strategies
    - Performance optimization tips

## Quick Start

```typescript
import { createServer } from "xypriss";

const app = createServer({
    cluster: {
        enabled: true,
        config: {
            workers: "auto", // Automatically determine optimal worker count
            autoRestart: true, // Automatically restart failed workers
            maxMemoryPerWorker: "512MB", // Memory limit per worker
        },
    },
});

app.start().then(() => {
    console.log("Cluster started successfully!");
});
```

## Key Features

-   **Automatic Scaling**: Dynamic worker count based on system resources
-   **Health Monitoring**: Continuous worker health checks and automatic recovery
-   **Resource Management**: Memory limits and resource allocation controls
-   **Zero-Downtime Updates**: Rolling restarts for updates without downtime
-   **Cross-Platform**: Works consistently across Node.js and Bun runtimes

## Where to Next?

-   For configuration options, see the [Cluster Configuration Guide](cluster-configuration-guide.md)
-   For API details, check the [Cluster API Reference](cluster-api-reference.md)
-   For implementation details, visit the [Cluster Service Guide](cluster-service.md)
-   For troubleshooting, consult the [Troubleshooting Guide](cluster-troubleshooting.md)

