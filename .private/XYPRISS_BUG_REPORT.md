# XyPriss Bug Report: Body Stream Consumption Prevents Multer File Uploads

## Summary
XyPriss automatically consumes the request body stream for POST/PUT/PATCH requests before route handlers and middlewares can process it. This prevents `multer` (and other multipart form-data parsers) from reading the stream, resulting in "Unexpected end of form" errors.

## Environment
- **XyPriss Version**: 2.1.2
- **Node.js Version**: 22.12.0+
- **Multer Version**: 1.4.5-lts.1 / 2.0.2

## Problem Description

### Root Cause
In `dist/cjs/src/server/core/HttpServer.js`, the `handleRequest` method automatically parses the request body for POST/PUT/PATCH requests **before** executing the middleware chain:

```javascript
// Line 117-120 in HttpServer.js
// Parse request body for POST/PUT/PATCH requests
if (["POST", "PUT", "PATCH"].includes(XyPrisReq.method)) {
    await this.parseBody(XyPrisReq);
}
// Execute middleware chain using MiddlewareManager
```

The `parseBody` method (lines 302-328) consumes the entire request stream:

```javascript
async parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", (chunk) => {
            body += chunk.toString();  // ⚠️ Stream consumed here
        });
        req.on("end", () => {
            try {
                const contentType = req.headers["content-type"] || "";
                if (contentType.includes("application/json")) {
                    req.body = body ? JSON.parse(body) : {};
                }
                else if (contentType.includes("application/x-www-form-urlencoded")) {
                    req.body = querystring.parse(body);
                }
                else {
                    req.body = body;
                }
                resolve();
            }
            catch (error) {
                reject(error);
            }
        });
        req.on("error", reject);
    });
}
```

### The Issue
1. When a client sends a `multipart/form-data` request (file upload), XyPriss's `parseBody` reads the entire stream
2. The stream is consumed and converted to a string
3. When `multer` middleware tries to read the stream later, it's already empty
4. `busboy` (used internally by multer) throws: **"Unexpected end of form"**

### Why This Happens
- HTTP request streams can only be read once
- Once `req.on("data")` and `req.on("end")` are called, the stream is consumed
- Subsequent attempts to read the stream will receive no data

## Reproduction Steps

1. Create a route with multer middleware:
```typescript
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", upload.single("file"), (req, res) => {
    console.log(req.file); // Will be undefined
    res.json({ success: true });
});
```

2. Send a multipart/form-data request:
```javascript
const formData = new FormData();
formData.append("file", fileBlob);
await axios.post("/upload", formData);
```

3. Result: Error "Unexpected end of form" from busboy

## Expected Behavior
XyPriss should either:
1. Skip body parsing for `multipart/form-data` content types
2. Provide a way to disable body parsing for specific routes
3. Use a buffering approach that allows the stream to be re-read

## Current Workaround
Users must create a separate Express server for file uploads, bypassing XyPriss entirely:

```typescript
import express from "express";
const uploadApp = express();
uploadApp.post("/upload", upload.single("file"), handler);
uploadApp.listen(3001); // Different port
```

This defeats the purpose of using XyPriss as a unified framework.

## Proposed Solutions

### Solution 1: Skip Multipart Content-Type (Recommended)
Modify `parseBody` to skip parsing for multipart/form-data:

```javascript
async parseBody(req) {
    return new Promise((resolve, reject) => {
        const contentType = req.headers["content-type"] || "";
        
        // Skip parsing for multipart/form-data - let middleware handle it
        if (contentType.includes("multipart/form-data")) {
            resolve();
            return;
        }
        
        let body = "";
        req.on("data", (chunk) => {
            body += chunk.toString();
        });
        // ... rest of the code
    });
}
```

### Solution 2: Add Configuration Option
Allow users to disable body parsing per route or globally:

```typescript
// In config
server: {
    autoParseJson: false,
    skipBodyParsingFor: ["multipart/form-data"], // New option
}

// Or per-route
router.post("/upload", { skipBodyParsing: true }, upload.single("file"), handler);
```

### Solution 3: Use Raw Body Buffer
Store the raw body buffer before parsing, allowing re-reading:

```javascript
async parseBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on("data", (chunk) => {
            chunks.push(chunk);
        });
        req.on("end", () => {
            const buffer = Buffer.concat(chunks);
            req.rawBody = buffer; // Store for later use
            
            const contentType = req.headers["content-type"] || "";
            if (contentType.includes("application/json")) {
                req.body = JSON.parse(buffer.toString());
            }
            // ...
            resolve();
        });
    });
}
```

## Impact
This bug affects any XyPriss application that needs to:
- Upload files using multer
- Handle multipart/form-data
- Use any middleware that needs to read the raw request stream

## Additional Notes
- The `autoParseJson: false` config option doesn't help because the parsing happens in `HttpServer.handleRequest`, not in `FastServer.addBodyParsingMiddleware`
- Express handles this correctly by only parsing when appropriate middleware is used
- Other frameworks (Fastify, Koa) provide options to control body parsing

## Files Affected
- `src/server/core/HttpServer.ts` (or `.js` in dist)
- Specifically the `handleRequest` and `parseBody` methods

## Priority
**High** - This is a blocking issue for any file upload functionality in XyPriss applications.

## Related Issues
- Similar to how Express requires `express.raw()` or `express.text()` for non-JSON bodies
- Comparable to Fastify's `addContentTypeParser` approach

---

**Reporter**: ProxiShop Development Team  
**Date**: 2025-01-04  
**XyPriss Repository**: https://github.com/Nehonix-Team/XyPriss