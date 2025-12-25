# XyPriss Advanced Plugin Hooks

XyPriss provides 4 powerful hooks for monitoring and extending server functionality:

## 1. `onSecurityThreat` - Security Monitoring

Triggered whenever the security middleware detects a potential threat.

### Hook Signature

```typescript
onSecurityThreat?(
    threat: SecurityThreat,
    req: Request,
    res: Response
): void | Promise<void>;
```

### SecurityThreat Interface

```typescript
interface SecurityThreat {
    type:
        | "sql_injection"
        | "xss"
        | "path_traversal"
        | "command_injection"
        | "xxe"
        | "ldap_injection"
        | "rate_limit"
        | "csrf"
        | "brute_force"
        | "other";
    severity: "low" | "medium" | "high" | "critical";
    description: string;
    ip: string;
    userAgent?: string;
    path: string;
    method: string;
    timestamp: Date;
    blocked: boolean;
    payload?: any;
}
```

### Example Usage

```typescript
{
    name: "security-monitor",
    version: "1.0.0",

    async onSecurityThreat(threat, req, res) {
        // Log the threat
        console.log(`🚨 ${threat.type} detected from ${threat.ip}`);

        // Send to monitoring service
        await sendToSentry({
            level: threat.severity,
            message: threat.description,
            extra: { ip: threat.ip, path: threat.path }
        });

        // Block IP if critical
        if (threat.severity === "critical") {
            await blockIP(threat.ip);
        }
    }
}
```

---

## 2. `onRequestTiming` - Performance Monitoring

Triggered for every request to measure response time and identify performance bottlenecks.

### Hook Signature

```typescript
onRequestTiming?(
    timing: RequestTiming,
    req: Request,
    res: Response
): void | Promise<void>;
```

### RequestTiming Interface

```typescript
interface RequestTiming {
    path: string;
    method: string;
    startTime: number;
    endTime: number;
    duration: number; // in milliseconds
    statusCode: number;
    ip: string;
    userAgent?: string;
    timestamp: Date;
    breakdown?: {
        middleware?: number;
        handler?: number;
        database?: number;
        external?: number;
    };
}
```

### Example Usage

```typescript
{
    name: "performance-tracker",
    version: "1.0.0",

    async onRequestTiming(timing, req, res) {
        // Log slow requests
        if (timing.duration > 1000) {
            console.log(`⏱️  Slow request: ${timing.path} took ${timing.duration}ms`);
        }

        // Send to analytics
        await analytics.track('request_timing', {
            path: timing.path,
            duration: timing.duration,
            statusCode: timing.statusCode
        });

        // Alert if consistently slow
        if (await isConsistentlySlow(timing.path)) {
            await sendAlert(`Route ${timing.path} is consistently slow`);
        }
    }
}
```

---

## 3. `onRouteError` - Error Tracking

Triggered when a route generates a 500 error, helping you identify problematic endpoints.

### Hook Signature

```typescript
onRouteError?(
    errorInfo: RouteErrorInfo,
    req: Request,
    res: Response
): void | Promise<void>;
```

### RouteErrorInfo Interface

```typescript
interface RouteErrorInfo {
    path: string;
    method: string;
    statusCode: number;
    error: Error;
    stack?: string;
    ip: string;
    userAgent?: string;
    timestamp: Date;
    requestBody?: any;
    requestQuery?: any;
    requestParams?: any;
}
```

### Example Usage

```typescript
{
    name: "error-tracker",
    version: "1.0.0",

    async onRouteError(errorInfo, req, res) {
        // Log error details
        console.error(`❌ Error on ${errorInfo.path}:`, errorInfo.error.message);

        // Send to error tracking service
        await Sentry.captureException(errorInfo.error, {
            tags: {
                path: errorInfo.path,
                method: errorInfo.method,
                statusCode: errorInfo.statusCode
            },
            extra: {
                requestBody: errorInfo.requestBody,
                requestQuery: errorInfo.requestQuery,
                ip: errorInfo.ip
            }
        });

        // Store in database for analysis
        await db.errors.create({
            path: errorInfo.path,
            error: errorInfo.error.message,
            stack: errorInfo.stack,
            timestamp: errorInfo.timestamp
        });
    }
}
```

---

## 4. `onPerformanceMetrics` - System Metrics

Triggered periodically (default: every 30 seconds) to collect comprehensive server metrics.

### Hook Signature

```typescript
onPerformanceMetrics?(
    metrics: PerformanceMetrics,
    server: XyPrissServer
): void | Promise<void>;
```

### PerformanceMetrics Interface

```typescript
interface PerformanceMetrics {
    timestamp: Date;
    uptime: number; // in seconds
    memory: {
        used: number;
        total: number;
        percentage: number;
        heapUsed: number;
        heapTotal: number;
    };
    cpu: {
        usage: number; // percentage
        loadAverage: number[];
    };
    requests: {
        total: number;
        perSecond: number;
        averageResponseTime: number;
        slowestRoutes: Array<{
            path: string;
            method: string;
            averageTime: number;
            count: number;
        }>;
    };
    errors: {
        total: number;
        rate: number; // errors per second
        topRoutes: Array<{
            path: string;
            method: string;
            count: number;
            lastError?: string;
        }>;
    };
    connections: {
        active: number;
        total: number;
    };
}
```

### Example Usage

```typescript
{
    name: "metrics-reporter",
    version: "1.0.0",

    async onPerformanceMetrics(metrics, server) {
        // Log metrics
        console.log(`📊 Server Metrics:`);
        console.log(`   Uptime: ${metrics.uptime}s`);
        console.log(`   Memory: ${metrics.memory.percentage.toFixed(2)}%`);
        console.log(`   CPU: ${metrics.cpu.usage}%`);
        console.log(`   Requests/sec: ${metrics.requests.perSecond.toFixed(2)}`);

        // Send to monitoring service
        await prometheus.gauge('memory_usage').set(metrics.memory.percentage);
        await prometheus.gauge('cpu_usage').set(metrics.cpu.usage);
        await prometheus.gauge('requests_per_second').set(metrics.requests.perSecond);

        // Alert on high resource usage
        if (metrics.memory.percentage > 90) {
            await sendAlert('High memory usage detected');
        }

        if (metrics.cpu.usage > 80) {
            await sendAlert('High CPU usage detected');
        }

        // Report slowest routes
        if (metrics.requests.slowestRoutes.length > 0) {
            const slowest = metrics.requests.slowestRoutes[0];
            console.log(`   Slowest: ${slowest.method} ${slowest.path} (${slowest.averageTime}ms)`);
        }
    }
}
```

---

## Complete Example

Here's a complete plugin that uses all 4 hooks:

```typescript
import { createServer } from "./src";

const app = createServer({
    plugins: {
        register: [
            {
                name: "comprehensive-monitor",
                version: "1.0.0",
                description: "Complete monitoring solution",

                onRegister(server) {
                    console.log("✅ Comprehensive Monitor registered!");
                },

                // Security monitoring
                async onSecurityThreat(threat, req, res) {
                    await logThreat(threat);
                    if (threat.severity === "critical") {
                        await alertSecurityTeam(threat);
                    }
                },

                // Performance monitoring
                async onRequestTiming(timing, req, res) {
                    await recordTiming(timing);
                    if (timing.duration > 1000) {
                        await alertSlowRequest(timing);
                    }
                },

                // Error tracking
                async onRouteError(errorInfo, req, res) {
                    await logError(errorInfo);
                    await sendToErrorTracker(errorInfo);
                },

                // System metrics
                async onPerformanceMetrics(metrics, server) {
                    await sendMetricsToMonitoring(metrics);
                    await checkResourceAlerts(metrics);
                },
            },
        ],
    },
});

app.get("/", (req, res) => {
    res.xJson({ message: "Hello World!" });
});

app.start();
```

---

## Integration with Existing Systems

### Sentry Integration

```typescript
{
    name: "sentry-integration",
    version: "1.0.0",

    async onSecurityThreat(threat, req, res) {
        Sentry.captureMessage(`Security threat: ${threat.type}`, {
            level: threat.severity,
            tags: { type: threat.type, ip: threat.ip }
        });
    },

    async onRouteError(errorInfo, req, res) {
        Sentry.captureException(errorInfo.error, {
            tags: { path: errorInfo.path, method: errorInfo.method }
        });
    }
}
```

### Prometheus Integration

```typescript
{
    name: "prometheus-metrics",
    version: "1.0.0",

    async onRequestTiming(timing, req, res) {
        requestDuration.labels(timing.method, timing.path).observe(timing.duration);
    },

    async onPerformanceMetrics(metrics, server) {
        memoryUsage.set(metrics.memory.percentage);
        cpuUsage.set(metrics.cpu.usage);
        requestsPerSecond.set(metrics.requests.perSecond);
    }
}
```

### DataDog Integration

```typescript
{
    name: "datadog-apm",
    version: "1.0.0",

    async onRequestTiming(timing, req, res) {
        datadog.increment('requests.total');
        datadog.histogram('requests.duration', timing.duration);
    },

    async onPerformanceMetrics(metrics, server) {
        datadog.gauge('system.memory.pct', metrics.memory.percentage);
        datadog.gauge('system.cpu.pct', metrics.cpu.usage);
    }
}
```

---

## Best Practices

1. **Keep hooks lightweight**: Avoid heavy computations in hooks to prevent performance impact
2. **Use async operations**: Leverage async/await for I/O operations
3. **Handle errors gracefully**: Wrap hook logic in try-catch to prevent plugin failures from affecting the server
4. **Batch operations**: For metrics, consider batching data before sending to external services
5. **Configure thresholds**: Make alert thresholds configurable via plugin configuration

---

## Notes

-   The `onPerformanceMetrics` hook runs every 30 seconds by default
-   Request timing is measured automatically for all requests
-   Security threats are detected by the security middleware when enabled
-   Route errors are captured automatically by the error handling system

