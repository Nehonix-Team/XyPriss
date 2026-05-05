// Scratch test for ConversionProxyMiddleware
import { ConversionProxyMiddleware } from "../src/middleware/built-in/ConversionProxyMiddleware.ts";

const mockReq = {
    headers: {
        "x-xhsc-origin-format": "xml"
    },
    body: {
        user: {
            "@id": "123",
            "@role": "admin",
            "#text": "John Doe"
        },
        items: [
            { "@sku": "A1", "#text": "Item 1" },
            { "@sku": "B2", "#text": "Item 2" }
        ]
    }
};

const mockRes = {};
const mockNext = () => {};

// Apply middleware
const middleware = ConversionProxyMiddleware("@", "#text");
middleware(mockReq, mockRes, mockNext);

console.log("--- Testing Proxy ---");
console.log("user.id (should be 123):", mockReq.body.user.id);
console.log("user.role (should be admin):", mockReq.body.user.role);
console.log("user (should be John Doe):", mockReq.body.user);
console.log("item[0].sku (should be A1):", mockReq.body.items[0].sku);
console.log("item[0] (should be Item 1):", mockReq.body.items[0]);

// Verify data integrity for Go
console.log("\n--- Testing Data Integrity ---");
console.log("Raw user object:", JSON.stringify(mockReq.body.user));
console.log("Original id key still exists:", "@id" in mockReq.body.user);
