# 🐛 XyPriss Bug Report: Query Parameters Causing Request Timeouts

## 📋 Summary
XyPriss server fails to process HTTP requests that contain query parameters, causing complete request timeouts while requests without query parameters work perfectly.

## 🔍 Problem Description
- **Working**: `/api/dashboard/kpi` → Returns response successfully
- **Failing**: `/api/dashboard/kpi?period=7d` → Times out after 10+ seconds, no logs generated

## 🧪 Test Results

TOKEN: 70dea4fe1dc8a723d0a990f9603fefd9:6b154d8eea8b81702e87169b542459af6ba991485cc6e7a3e2a96122dff53e09ea500ba290660fac21ea212e2bd5a955c3c436383c44c01913d6810beef721927c1eaf50604374d23e1ae350668b0879aa9434cd63e5ba3696f02207319b35694b8c158f63f84c8339368ed712ef2f37c61648b98c5a0e1f8dbb1f26cab2a4effe7e0e5e1ad05ebde6e1ddf770c48032d2352a0ccb05dcab2899d8a5b2b1fde57b754b8e73f05004fb79c5f1f2e0da2af73d7c32ed14cd9d96d87e9b47bc5b210f38f177589baf858669c3fe5ae9b721a69b2f86c22714eb1f938b5e3a80a81831fc4bf2e8a55bf07faefc00d6991cb2


### ✅ Working Requests (No Query Parameters)
```bash
# Dashboard KPI without query
curl -H "Authorization: Bearer [TOKEN]" "https://api.nehosell.com/api/dashboard/kpi"
# Response: {"success":true,"data":{"revenue":{"current":0,"change":-100,"trend":"down"}...}}

# Products without query  
curl -H "Authorization: Bearer [TOKEN]" "https://api.nehosell.com/api/products"
# Response: {"ok":true,"message":"success","data":{"products":[...]}}
```

### ❌ Failing Requests (With Query Parameters)
```bash
# Dashboard KPI with query
curl -H "Authorization: Bearer [TOKEN]" "https://api.nehosell.com/api/dashboard/kpi?period=7d"
# Result: curl: (28) Operation timed out after 10002 milliseconds with 0 bytes received

# Products with query
curl -H "Authorization: Bearer [TOKEN]" "https://api.nehosell.com/api/products?page=1&limit=10"
# Result: curl: (28) Operation timed out after 15000 milliseconds with 0 bytes received
```

## 🔧 Environment Details

### XyPriss Configuration
```typescript
// xypriss.config.ts
export const xyprissConfig = {
  server: {
    port: 3000,
    host: "0.0.0.0",
    cors: {
      origin: ["https://app.nehosell.com", "https://nehosell.com"],
      credentials: true,
    },
    portFallback: {
      enabled: false,
      maxAttempts: 10,
      strategy: "random",
    },
  },
  security: {
    sqlInjection: true,
    xxe: true,
    pathTraversal: false,
    xss: true,
    compression: true,
    ldapInjection: false,
    morgan: true, // Added for debugging
  },
  // ... rest of config
};
```

### Server Status
- **PM2 Status**: Online (PID: 590565)
- **Port Listening**: 3000 ✅
- **Health Check**: `/api/health` works ✅
- **Authentication**: Works for requests without query parameters ✅

## 🔍 Debugging Evidence

### 1. Server is Running Correctly
```bash
ubuntu@vps:~$ lsof -i :3000
COMMAND      PID   USER FD   TYPE  DEVICE SIZE/OFF NODE NAME
node\x20/ 590565 ubuntu 31u  IPv4 1583896      0t0  TCP *:3000 (LISTEN)

ubuntu@vps:~$ curl localhost:3000/api/health
{"success":true,"service":"main","message":"OK"}
```

### 2. Middleware Logs Show the Issue
**Without Query Parameters** (✅ Working):
```
[AuthMiddleware] authenticateUser - START
[AuthMiddleware] URL: GET /api/products
[AuthMiddleware] Headers: {...}
[AuthMiddleware] Authentication successful, calling next()
```

**With Query Parameters** (❌ Failing):
```
# NO LOGS GENERATED AT ALL
# Request never reaches any middleware or route handler
```

### 3. Direct Server Test (Bypassing Nginx)
```bash
# Direct to localhost:3000 - same issue
ubuntu@vps:~$ curl 'http://localhost:3000/api/dashboard/kpi?period=7d' --max-time 10
curl: (28) Operation timed out after 10002 milliseconds with 0 bytes received
```

## 🎯 Root Cause Analysis
The issue appears to be in XyPriss's internal URL parsing or routing mechanism:

1. **Not Nginx**: Direct localhost:3000 tests show same behavior
2. **Not Authentication**: Requests never reach auth middleware
3. **Not Application Code**: No application logs generated
4. **XyPriss Core**: Requests with query parameters are not being processed by the framework

## 📊 Impact
- **Dashboard**: Cannot load metrics with time periods
- **Products**: Cannot use pagination, filtering, or search
- **All APIs**: Any endpoint requiring query parameters is unusable

## 🔧 Temporary Workaround
We're implementing path parameters instead of query parameters:
- `GET /api/dashboard/kpi/7d` instead of `GET /api/dashboard/kpi?period=7d`
- `GET /api/products/page/1/limit/10` instead of `GET /api/products?page=1&limit=10`

## 📝 Additional Notes
- XyPriss version: Latest (as of November 2025)
- Node.js version: Latest LTS
- The issue is 100% reproducible
- No errors in PM2 logs or application logs
- Morgan logging enabled but shows no HTTP requests for query parameter URLs

## 🙏 Request
Please investigate XyPriss's query parameter parsing mechanism. This appears to be a critical bug in the framework's core routing system.

---
**Reporter**: NehoSell Development Team  
**Date**: November 13, 2025  
**Severity**: High (Blocks core functionality)
