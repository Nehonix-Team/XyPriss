/**
 * XJson API Example
 * Demonstrates the new XJson endpoint for handling large data and serialization issues
 */

import { createServer } from "../src";

const app = createServer({
    env: "development",
    logging: {
        level: "debug",
    },
});

// =============================================================================
// 1. BASIC XJSON USAGE
// =============================================================================

// Traditional JSON endpoint (may fail with BigInt)
app.get("/regular-json", (req: any, res: any) => {
    const data = {
        message: "This might fail with BigInt",
        value: 123n, // BigInt value
        timestamp: new Date(),
    };

    try {
        res.json(data);
    } catch (error) {
        res.status(500).json({
            error: "Serialization failed",
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

// XJson endpoint (handles BigInt automatically)
app.get("/xjson", (req: any, res: any) => {
    const data = {
        message: "This works perfectly with BigInt",
        value: 123n, // BigInt value - automatically handled
        timestamp: new Date(),
        metadata: {
            userId: 456n,
            sessionId: "abc123def456",
        },
    };

    res.xJson(data);
});

// =============================================================================
// 2. COMPLEX DATA STRUCTURES
// =============================================================================

app.get("/complex-data", (req: any, res: any) => {
    const complexData = {
        // Circular reference handling
        company: {
            name: "TechCorp",
            employees: [] as any[],
            ceo: null as any,
        },

        // BigInt values
        bigNumbers: {
            userId: 9876543210n,
            transactionId: 12345678901234567890n,
            largeArray: [1n, 2n, 3n, 4n, 5n],
        },

        // Mixed data types
        mixedData: {
            date: new Date("2025-01-01"),
            regex: /test/gi,
            buffer: Buffer.from("Hello World"),
            nullValue: null,
            undefinedValue: undefined,
        },

        // Deep nesting
        deeplyNested: {
            level1: {
                level2: {
                    level3: {
                        level4: {
                            level5: "Very deep data",
                        },
                    },
                },
            },
        },

        // Large dataset simulation
        items: Array.from({ length: 100 }, (_, i) => ({
            id: i,
            name: `Item ${i}`,
            price: BigInt(i * 100),
            tags: [`tag${i}`, `category${i % 5}`],
        })),
    };

    // Create circular reference
    complexData.company.ceo = complexData.company;
    complexData.company.employees.push(complexData.company);

    res.xJson(complexData);
});

// =============================================================================
// 3. LARGE DATA STREAMING
// =============================================================================

app.get("/large-data", (req: any, res: any) => {
    const largeDataset = {
        type: "large_dataset",
        description: "This data will be streamed in chunks",
        totalItems: 10000,
        items: Array.from({ length: 10000 }, (_, i) => ({
            id: i,
            name: `Large Item ${i}`,
            value: BigInt(i * 1000000),
            data: `This is item number ${i} with some additional data to make it larger`,
            metadata: {
                created: new Date(),
                category: `Category ${i % 100}`,
                tags: [`tag${i}`, `important`, `data`],
            },
        })),
    };

    // Enable streaming for large data
    res.xJson(largeDataset);
});

// =============================================================================
// 4. CUSTOM CONFIGURATION
// =============================================================================

app.get("/custom-config", (req: any, res: any) => {
    const data = {
        message: "Using custom XJson configuration",
        deepStructure: {
            level1: {
                level2: {
                    level3: {
                        level4: {
                            level5: {
                                level6: "This goes very deep",
                            },
                        },
                    },
                },
            },
        },
        longString: "A".repeat(5000), // Long string
        bigNumbers: [1n, 2n, 3n, 4n, 5n],
    };

    // Use XJson with default configuration
    res.xJson(data);
});

// =============================================================================
// 5. ERROR HANDLING
// =============================================================================

app.get("/error-handling", (req: any, res: any) => {
    try {
        // This would normally cause serialization issues
        const problematicData = {
            bigIntValue: 999999999999999999n,
            circularRef: {} as any,
        };

        // Create circular reference
        problematicData.circularRef = problematicData;

        res.xJson(problematicData);
    } catch (error) {
        res.status(500).json({
            error: "Unexpected error",
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

// =============================================================================
// 6. COMPARISON ENDPOINT
// =============================================================================

app.get("/comparison", (req: any, res: any) => {
    const testData = {
        message: "Comparing regular JSON vs XJson",
        bigIntExample: 12345678901234567890n,
        dateExample: new Date(),
        bufferExample: Buffer.from("test buffer"),
        arrayExample: [1n, 2n, 3n],
        nestedExample: {
            deep: {
                value: 999n,
            },
        },
    };

    // Add query parameter to choose method
    const method = req.query.method as string;

    if (method === "xjson") {
        res.xJson({ method: "xjson", data: testData });
    } else {
        res.json({ method: "json", data: testData });
    }
});

// =============================================================================
// 7. PERFORMANCE TEST
// =============================================================================

app.get("/performance-test", (req: any, res: any) => {
    const startTime = Date.now();

    // Generate test data
    const performanceData = {
        test: "performance_comparison",
        iterations: 1000,
        data: Array.from({ length: 1000 }, (_, i) => ({
            id: i,
            bigValue: BigInt(i * 1000),
            text: `Performance test item ${i}`,
            nested: {
                level1: i,
                level2: {
                    value: BigInt(i * 2),
                    data: `Nested data for item ${i}`,
                },
            },
        })),
    };

    // Use XJson for reliable serialization
    res.xJson(performanceData);

    const endTime = Date.now();
    console.log(`Performance test completed in ${endTime - startTime}ms`);
});

// =============================================================================
// HEALTH CHECK
// =============================================================================

app.get("/health", (req: any, res: any) => {
    res.json({
        status: "healthy",
        timestamp: new Date(),
        uptime: process.uptime(),
        xjsonVersion: "1.0.0",
    });
});

// =============================================================================
// START SERVER
// =============================================================================

const PORT = parseInt(process.env.PORT || "3000");

// Start the server
app.start(PORT);

console.log(`\n🚀 XJson Example Server running on http://localhost:${PORT}`);
console.log("\n📝 Test endpoints:");
console.log(`   Regular JSON:  http://localhost:${PORT}/regular-json`);
console.log(`   XJson:         http://localhost:${PORT}/xjson`);
console.log(`   Complex Data:  http://localhost:${PORT}/complex-data`);
console.log(`   Large Data:    http://localhost:${PORT}/large-data`);
console.log(`   Custom Config: http://localhost:${PORT}/custom-config`);
console.log(
    `   Comparison:    http://localhost:${PORT}/comparison?method=xjson`
);
console.log(`   Performance:   http://localhost:${PORT}/performance-test`);
console.log(`   Health Check:  http://localhost:${PORT}/health`);
console.log("\n💡 Compare results:");
console.log(`   curl http://localhost:${PORT}/comparison?method=json`);
console.log(`   curl http://localhost:${PORT}/comparison?method=xjson`);
console.log("");

export default app;

