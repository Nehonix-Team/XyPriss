/**
 * Test file for circular reference fix in execution engine
 */

import {
    func,
    createFortifiedFunction,
} from "../components/fortified-function/index";

// Create a mock Express-like object with circular references
function createMockExpressRequest() {
    const req: any = {
        method: "GET",
        url: "/api/auth/test",
        headers: {
            "user-agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
        },
        query: {},
        params: {},
        body: undefined,
    };

    // Create circular reference similar to Express.js Socket object
    const socket: any = {
        readable: true,
        writable: true,
        _events: {},
        _eventsCount: 0,
    };

    const parser: any = {
        incoming: req,
        socket: socket,
    };

    socket.parser = parser;
    req.socket = socket;
    req.connection = socket;

    return req;
}

async function testCircularReferenceHandling() {
    console.log("Testing Circular Reference Handling...");

    const mockReq = createMockExpressRequest();

    // Create a fortified function that receives the circular object
    const testFunc = func(
        async (request: any, data: string) => {
            return `Processed ${data} for ${request.method} ${request.url}`;
        },
        {
            memoize: true, // This will trigger cache key generation
            auditLog: true,
            performanceTracking: true,
        }
    );

    try {
        // This should not throw a circular reference error anymore
        const result = await testFunc(mockReq, "test data");
        console.log("Circular reference handled successfully:", result);

        // Test caching with the same circular object
        const result2 = await testFunc(mockReq, "test data");
        console.log("Cached result with circular reference:", result2);

        return result === result2; // Should be the same due to caching
    } catch (error) {
        console.error("Circular reference test failed:", error);
        return false;
    }
}

async function testParameterValidationWithCircularRefs() {
    console.log("Testing Parameter Validation with Circular References...");

    const mockReq = createMockExpressRequest();

    // Create a fortified function with parameter validation enabled
    const validatedFunc = createFortifiedFunction(
        async (request: any, sensitive: string) => {
            return `Validated: ${sensitive.length} chars from ${request.method}`;
        },
        {
            parameterValidation: true, // This will trigger parameter hashing
            auditLog: true,
            secureParameters: [1], // Encrypt the sensitive parameter
        }
    );

    try {
        const result = await validatedFunc.execute(mockReq, "sensitive data");
        console.log("Parameter validation with circular refs:", result);

        // Check that audit logs were created
        const stats = validatedFunc.getStats();
        console.log("Validation stats:", {
            executionCount: stats.executionCount,
            securityEvents: stats.securityEvents,
        });

        return stats.executionCount > 0;
    } catch (error) {
        console.error("Parameter validation test failed:", error);
        return false;
    }
}

async function testComplexCircularStructure() {
    console.log("Testing Complex Circular Structure...");

    // Create a more complex circular structure
    const complexObj: any = {
        id: "test-123",
        data: {
            nested: {
                deep: {
                    value: "test",
                },
            },
        },
        refs: [],
    };

    // Add circular references
    complexObj.self = complexObj;
    complexObj.data.parent = complexObj;
    complexObj.refs.push(complexObj);
    complexObj.refs.push(complexObj.data);

    const complexFunc = func(
        async (obj: any, multiplier: number) => {
            return `Complex object ${obj.id} processed with multiplier ${multiplier}`;
        },
        {
            memoize: true,
            auditLog: true,
        }
    );

    try {
        const result = await complexFunc(complexObj, 2);
        console.log("Complex circular structure handled:", result);
        return true;
    } catch (error) {
        console.error("Complex circular structure test failed:", error);
        return false;
    }
}

// Run all tests
async function runCircularReferenceTests() {
    console.log("Starting Circular Reference Fix Tests...\n");

    const tests = [
        testCircularReferenceHandling,
        testParameterValidationWithCircularRefs,
        testComplexCircularStructure,
    ];

    let passed = 0;
    let total = tests.length;

    for (const test of tests) {
        try {
            const result = await test();
            if (result) {
                passed++;
                console.log("Test passed\n");
            } else {
                console.log("Test failed\n");
            }
        } catch (error) {
            console.error("Test crashed:", error);
            console.log("Test failed\n");
        }
    }

    console.log(`Test Results: ${passed}/${total} tests passed`);

    if (passed === total) {
        console.log("All circular reference tests passed!");
        return true;
    } else {
        console.log("Some tests failed. Check the implementation.");
        return false;
    }
}

// Export for use in other test files
export {
    runCircularReferenceTests,
    testCircularReferenceHandling,
    testParameterValidationWithCircularRefs,
    testComplexCircularStructure,
    createMockExpressRequest,
};

// Run tests if this file is executed directly
if (require.main === module) {
    runCircularReferenceTests()
        .then((success) => {
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error("Test runner crashed:", error);
            process.exit(1);
        });
}

