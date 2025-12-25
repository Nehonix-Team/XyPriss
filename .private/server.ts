import { createServer } from "../src";

// Créez d'abord la configuration
// console.log("initial configs: ", __cfg__.get("notFound"));

// Gelez toute la configuration avant de la passer
const app = createServer(
    __const__.$cfg({
        plugins: {
            register: [
                // Example 1: Security Monitor Plugin
                {
                    name: "security-monitor",
                    version: "1.0.0",
                    description: "Monitors security threats in real-time",

                    onRegister(server) {
                        console.log("✅ Security Monitor Plugin registered!");
                    },

                    async onSecurityThreat(threat, req, res) {
                        const emoji = {
                            low: "🟢",
                            medium: "🟡",
                            high: "🟠",
                            critical: "🔴",
                        };
                        console.log(
                            `\n${emoji[threat.severity]} Security Threat: ${
                                threat.type
                            } on ${threat.path}`
                        );
                        console.log(
                            `   Severity: ${threat.severity} | Blocked: ${threat.blocked} | IP: ${threat.ip}`
                        );
                    },
                },

                // Example 2: Performance Monitor Plugin
                {
                    name: "performance-monitor",
                    version: "1.0.0",
                    description: "Tracks request timing and performance",

                    onRegister(server) {
                        console.log(
                            "✅ Performance Monitor Plugin registered!"
                        );
                    },

                    async onRequestTiming(timing, req, res) {
                        // Log slow requests (> 100ms)
                        if (timing.duration > 100) {
                            console.log(
                                `⏱️  Slow request: ${timing.method} ${
                                    timing.path
                                } - ${timing.duration.toFixed(2)}ms`
                            );
                        }
                    },

                    async onPerformanceMetrics(metrics, server) {
                        console.log(
                            `\n📊 Performance Metrics (${new Date().toISOString()})`
                        );
                        console.log(
                            `   Uptime: ${(metrics.uptime / 60).toFixed(
                                2
                            )} minutes`
                        );
                        console.log(
                            `   Total Requests: ${metrics.requests.total}`
                        );
                        console.log(
                            `   Avg Response Time: ${metrics.requests.averageResponseTime.toFixed(
                                2
                            )}ms`
                        );
                        console.log(
                            `   Memory Usage: ${metrics.memory.percentage.toFixed(
                                2
                            )}%`
                        );
                        console.log(`   CPU Usage: ${metrics.cpu.usage}%`);

                        if (metrics.requests.slowestRoutes.length > 0) {
                            console.log(
                                `   Slowest Route: ${
                                    metrics.requests.slowestRoutes[0].method
                                } ${
                                    metrics.requests.slowestRoutes[0].path
                                } (${metrics.requests.slowestRoutes[0].averageTime.toFixed(
                                    2
                                )}ms)`
                            );
                        }

                        if (metrics.errors.topRoutes.length > 0) {
                            console.log(
                                `   Top Error Route: ${metrics.errors.topRoutes[0].method} ${metrics.errors.topRoutes[0].path} (${metrics.errors.topRoutes[0].count} errors)`
                            );
                        }
                    },
                },

                // Example 3: Error Tracker Plugin
                {
                    name: "error-tracker",
                    version: "1.0.0",
                    description: "Tracks and logs route errors",

                    onRegister(server) {
                        console.log("✅ Error Tracker Plugin registered!");
                    },

                    async onRouteError(errorInfo, req, res) {
                        console.log(
                            `\n❌ Route Error: ${errorInfo.method} ${errorInfo.path}`
                        );
                        console.log(`   Status: ${errorInfo.statusCode}`);
                        console.log(`   Error: ${errorInfo.error.message}`);
                        console.log(`   IP: ${errorInfo.ip}`);

                        // In production, you might want to:
                        // - Send to error tracking service (Sentry, Rollbar, etc.)
                        // - Store in database for analysis
                        // - Send alerts to team
                    },
                },
            ],
        },
    })
);

// console.log("final configs: ", __ cfg__.get("notFound"));
//
app.get("/", (req, res) => {
    res.xJson({
        message: "Hello from XyPrissJS!",
        version: "1.0.0",
        performance: "⚡ Optimized",
    });
});

app.start();

