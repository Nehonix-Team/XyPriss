import { Router } from "../src/index";
import { createRateLimitMiddleware } from "../src/server/routing/modules/middleware";
import { normalizeXtrsRules } from "../src/utils/xtrsParser";

async function runTests() {
    console.log("🧪 Starting XTRS Route Group & Global Rate Limiting Tests...");

    // Test 1: normalizeXtrsRules with different inputs
    console.log("Subtest 1: normalizeXtrsRules formats");
    const rules1 = normalizeXtrsRules("5/1s");
    if (rules1.length !== 1 || rules1[0].max !== 5 || rules1[0].windowMs !== 1000) {
        throw new Error(`Failed Subtest 1: string expression parsing failed: ${JSON.stringify(rules1)}`);
    }

    const rules2 = normalizeXtrsRules({
        xtrs: {
            rules: [
                "2/1s",
                { rule: "10/1m", message: "Minute limit reached", blockDuration: "30s" }
            ],
            message: "Global XTRS limit"
        }
    });
    if (rules2.length !== 2 || rules2[1].blockDurationMs !== 30000 || rules2[1].message !== "Minute limit reached") {
        throw new Error(`Failed Subtest 1: XTRS options object parsing failed: ${JSON.stringify(rules2)}`);
    }
    console.log("✅ Subtest 1 passed!");

    // Test 2: XTRS rate limit in router.group options
    console.log("\nSubtest 2: RouteGroupOptions with XTRS rules");
    const router = Router();
    router.group(
        {
            prefix: "/api",
            rateLimit: {
                xtrs: {
                    rules: [
                        {
                            rule: "2/100ms",
                            message: "Group rate limit hit!",
                            blockDuration: "500ms"
                        }
                    ]
                }
            }
        },
        (r) => {
            r.get("/data", (req, res) => {
                res.json({ success: true });
            });
            r.get("/override", { rateLimit: { max: 10, windowMs: 1000 } }, (req, res) => {
                res.json({ override: true });
            });
        }
    );

    const routes = router.getRoutes();
    if (routes.length !== 2) {
        throw new Error(`Expected 2 routes in group, got ${routes.length}`);
    }

    // Verify metadata rateLimit presence
    if (!routes[0].rateLimit || !routes[1].rateLimit) {
        throw new Error("Route rateLimit metadata missing");
    }

    // Test execution of the group rate limiter middleware
    const groupRoute = routes[0];
    const middleware = groupRoute.middleware[0].handler;

    let statusCode = 200;
    let jsonBody: any = null;
    let headers: Record<string, string> = {};

    const mockReq = { ip: "127.0.0.1" };
    const mockRes = {
        status(code: number) {
            statusCode = code;
            return this;
        },
        json(data: any) {
            jsonBody = data;
            return this;
        },
        setHeader(key: string, val: string) {
            headers[key] = val;
        }
    };

    let nextCalled = false;
    const next = () => { nextCalled = true; };

    // Request 1
    nextCalled = false;
    middleware(mockReq as any, mockRes as any, next);
    if (!nextCalled) throw new Error("Request 1 should pass");

    // Request 2
    nextCalled = false;
    middleware(mockReq as any, mockRes as any, next);
    if (!nextCalled) throw new Error("Request 2 should pass");

    // Request 3 -> exceeds limit of 2/100ms
    nextCalled = false;
    middleware(mockReq as any, mockRes as any, next);
    if (nextCalled) throw new Error("Request 3 should be blocked");
    if (statusCode !== 429) throw new Error(`Expected status 429, got ${statusCode}`);
    if (jsonBody?.error !== "Group rate limit hit!") {
        throw new Error(`Expected message 'Group rate limit hit!', got '${jsonBody?.error}'`);
    }

    console.log("✅ Subtest 2 passed!");
    console.log("\n🎉 ALL XTRS ROUTE GROUP TESTS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
});
