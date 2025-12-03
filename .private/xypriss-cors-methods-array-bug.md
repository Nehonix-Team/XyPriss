# XyPriss CORS Bug Report: Array Properties Not Properly Serialized in MultiServer Mode

## Bug Summary

When using the `multiServer` configuration in XyPriss with CORS settings, array properties (`methods`, `allowedHeaders`, and potentially `exposedHeaders`) are not properly serialized to strings when setting HTTP headers. Instead, they either output `[object Object]` or are completely omitted from the response, causing CORS preflight requests to fail.

## Environment

- **XyPriss Version**: 4.5.11 (confirmed from package.json and type definitions)
- **Runtime**: Bun
- **Configuration Mode**: MultiServer
- **Affected Feature**: CORS middleware in multiServer configuration

## Affected CORS Properties

1. ✅ **`methods`** - Outputs `[object Object]` instead of comma-separated string
2. ✅ **`allowedHeaders`** - Completely omitted from response headers
3. ⚠️ **`exposedHeaders`** - Not tested but likely affected (same pattern)

## Expected Behavior

When configuring CORS with array properties:

```typescript
cors: {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
  allowedHeaders: ["Content-Type", "Authorization", "x-guest-token", "xp-request-sig"],
  credentials: true,
}
```

The response headers should be:

```
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD
Access-Control-Allow-Headers: Content-Type, Authorization, x-guest-token, xp-request-sig
```

## Actual Behavior

### Issue 1: `methods` Property

The `Access-Control-Allow-Methods` header is set to:

```
Access-Control-Allow-Methods: [object Object]
```

### Issue 2: `allowedHeaders` Property

The `Access-Control-Allow-Headers` header is **completely missing** from the response.

### Browser Errors

```
Cannot parse Access-Control-Allow-Methods response header field in preflight response
```

```
Request header field xp-request-sig is not allowed by Access-Control-Allow-Headers in preflight response
```

## Steps to Reproduce

### 1. Create MultiServer Configuration

```typescript
export const XyPriss_Config: Parameters<typeof createServer>[0] = {
  // ... other config
  multiServer: {
    enabled: true,
    servers: [
      {
        security: {
          cors: {
            origin: "*",
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
            allowedHeaders: [
              "Content-Type",
              "Authorization",
              "x-guest-token",
              "xp-request-sig"
            ],
            credentials: true,
          },
        },
        port: 6287,
        id: "cross_plateform_",
{{ ... }}
    ],
  },
};
```

### 2. Start the Server

```bash
bun run src/server.ts
```

### 3. Test CORS Preflight Request

```bash
curl -I -X OPTIONS http://192.168.0.46:6287/api/v1/auth/login \
  -H "Origin: http://192.168.0.46:5174" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: xp-request-sig,content-type"
```

### 4. Observe Broken Response Headers

```
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: [object Object]  ← BUG: Should be comma-separated string
Access-Control-Max-Age: 86400
# NOTE: Access-Control-Allow-Headers is MISSING entirely ← BUG
```

## Test Results

### ❌ Before Fix (Array Format)

```bash
curl -v -X OPTIONS http://192.168.0.46:6287/api/v1/auth/login \
  -H "Origin: http://192.168.0.46:5174" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: xp-request-sig,content-type,authorization"
```

**Response Headers:**

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: [object Object]  ← BROKEN
# Access-Control-Allow-Headers: MISSING  ← BROKEN
Access-Control-Max-Age: 86400
```

### ✅ After Fix (String Format)

```typescript
cors: {
  origin: "*",
  methods: "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD",
  allowedHeaders: "Content-Type, Authorization, x-guest-token, xp-request-sig",
  credentials: true,
}
```

**Response Headers:**

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD  ← FIXED
Access-Control-Allow-Headers: Content-Type, Authorization, x-guest-token, xp-request-sig  ← FIXED
Access-Control-Max-Age: 86400
```

## Root Cause Analysis

Based on the type definitions in `dist/index.d.ts` (line 5037), CORS properties accept both `string` and `string[]`:

```typescript
cors?: boolean | {
    origin?: string | string[] | boolean;
    methods?: string | string[];        // ← Accepts both formats
    allowedHeaders?: string | string[]; // ← Accepts both formats
    exposedHeaders?: string | string[]; // ← Likely affected too
    credentials?: boolean;
    maxAge?: number;
}
```

However, the CORS middleware implementation in **multiServer mode** does not properly handle array formats:

1. **For `methods`**: The array is being passed directly to `setHeader()` which calls `.toString()` on it, resulting in `[object Object]`
2. **For `allowedHeaders`**: The array is either not processed at all or fails silently, resulting in the header being omitted entirely

## Comparison: Main Server vs MultiServer

### ✅ Main Server CORS (Works Correctly)

```typescript
security: {
  cors: {
    methods: ["GET", "POST", "PUT", "DELETE"], // ← Arrays work fine here
    allowedHeaders: ["Content-Type", "Authorization"], // ← Arrays work fine here
  }
}
```

### ❌ MultiServer CORS (Broken)

```typescript
multiServer: {
  servers: [
    {
      security: {
        cors: {
          methods: ["GET", "POST"], // ← BROKEN: outputs [object Object]
          allowedHeaders: ["Content-Type"], // ← BROKEN: header missing
        },
      },
    },
  ];
}
```

This confirms the bug is **specific to the multiServer CORS middleware implementation**.

## Workaround

Convert all array properties to comma-separated strings:

```typescript
multiServer: {
  servers: [
    {
      security: {
        cors: {
          origin: "*",
          // WORKAROUND: Use strings instead of arrays
          methods: "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD",
          allowedHeaders:
            "Content-Type, Authorization, x-guest-token, xp-request-sig",
          credentials: true,
        },
      },
    },
  ];
}
```

**Note**: You may need to add `// @ts-ignore` comments as TypeScript expects `string[]` based on the type definitions.

## Suggested Fix

The multiServer CORS middleware should normalize array properties before setting headers:

```typescript
// Pseudo-code for the fix
function normalizeToString(value: string | string[]): string {
  return Array.isArray(value) ? value.join(", ") : value;
}

// In the CORS middleware:
if (config.cors.methods) {
  res.setHeader(
    "Access-Control-Allow-Methods",
    normalizeToString(config.cors.methods)
  );
}

if (config.cors.allowedHeaders) {
  res.setHeader(
    "Access-Control-Allow-Headers",
    normalizeToString(config.cors.allowedHeaders)
  );
}

if (config.cors.exposedHeaders) {
  res.setHeader(
    "Access-Control-Expose-Headers",
    normalizeToString(config.cors.exposedHeaders)
  );
}
```

## Impact

- **Severity**: **Critical** - Breaks CORS entirely for multiServer configurations
- **Affected Users**: Anyone using multiServer mode with CORS array configuration
- **Workaround Available**: Yes (use string format instead of arrays)
- **Scope**: All array-based CORS properties in multiServer mode

## Additional Notes

1. The main server CORS implementation handles arrays correctly, so the fix logic already exists in the codebase
2. The type definitions correctly indicate both formats should be supported
3. This is a regression or oversight specific to multiServer mode
4. The bug affects production deployments as CORS is essential for cross-origin API access

## Reproduction Repository

If needed, we can provide a minimal reproduction repository. The issue is consistently reproducible with the steps above.

---

**Reported by**: NehoSell Development Team  
**Date**: December 3, 2025  
**Contact**: Available through the XyPriss community  
**Tested on**: XyPriss v4.5.11 with Bun runtime
