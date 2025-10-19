# Middleware Architecture

## Overview

XyPriss uses a **clean, layered middleware architecture** with a single source of truth for all middleware implementations.

## Architecture Layers

```
┌─────────────────────────────────────────────────┐
│         User Configuration (config.ts)          │
│    ServerOptions.security.cors, helmet, etc.    │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│        SecurityMiddleware (Orchestrator)        │
│   - Reads SecurityConfig from ServerOptions     │
│   - Applies security logic and policies         │
│   - Delegates to BuiltInMiddleware              │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│   BuiltInMiddleware (Single Source of Truth)    │
│   - Wraps external libraries (cors, helmet)     │
│   - Provides consistent defaults                │
│   - Handles all middleware initialization       │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│      External Libraries (cors, helmet, etc.)    │
└─────────────────────────────────────────────────┘
```

## Key Principles

### 1. Single Source of Truth
**`BuiltInMiddleware`** is the ONLY place that imports external middleware libraries:
- ✅ `cors`
- ✅ `helmet`
- ✅ `express-rate-limit`
- ✅ `compression`
- ✅ `hpp`
- ✅ `express-mongo-sanitize`
- ✅ `csrf-csrf`
- ✅ `multer`

### 2. No Duplicate Imports
❌ **NEVER** import middleware libraries directly in other files
✅ **ALWAYS** use `BuiltInMiddleware.cors()`, `BuiltInMiddleware.helmet()`, etc.

### 3. Clear Separation of Concerns

#### BuiltInMiddleware (`src/middleware/built-in/BuiltInMiddleware.ts`)
- **Purpose**: Wrapper layer for external libraries
- **Responsibility**: Provide consistent defaults and interfaces
- **Example**:
```typescript
static cors(options: any = {}) {
    const defaultOptions = {
        origin: true,
        methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
        credentials: false,
        maxAge: 86400,
    };
    return cors({ ...defaultOptions, ...options });
}
```

#### SecurityMiddleware (`src/middleware/security-middleware.ts`)
- **Purpose**: Security orchestration and policy enforcement
- **Responsibility**: Apply security configurations and combine middleware
- **Example**:
```typescript
private initializeMiddleware(): void {
    if (this.cors !== false) {
        this.corsMiddleware = BuiltInMiddleware.cors(corsConfig);
    }
}
```

## Configuration Flow

### 1. User Configuration
```typescript
// config.ts
export const config = {
    security: {
        enabled: true,
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            allowedHeaders: ["Content-Type", "Authorization"],
            credentials: true,
        },
    },
};
```

### 2. Server Initialization
```typescript
// ServerFactory.ts → FastServer.ts
const server = new XyPrissServer(options);
// FastServer.initializeSecurity() creates SecurityMiddleware
```

### 3. SecurityMiddleware Initialization
```typescript
// SecurityMiddleware constructor
this.cors = config.cors !== false ? (config.cors || true) : false;
this.initializeMiddleware();
```

### 4. BuiltInMiddleware Usage
```typescript
// SecurityMiddleware.initializeMiddleware()
this.corsMiddleware = BuiltInMiddleware.cors(corsConfig);
```

### 5. Middleware Application
```typescript
// SecurityMiddleware.applySecurityStack()
if (this.cors !== false && this.corsMiddleware) {
    middlewareStack.push(this.corsMiddleware);
}
```

## Multi-Server Mode

In multi-server mode, security configuration is properly deep-merged:

```typescript
// MultiServerManager.mergeServerConfig()
merged.security = {
    ...merged.security,
    ...serverConfig.security,
    // Deep merge CORS config
    cors: serverConfig.security.cors !== undefined
        ? (typeof serverConfig.security.cors === 'object' && 
           typeof merged.security?.cors === 'object'
            ? { ...merged.security.cors, ...serverConfig.security.cors }
            : serverConfig.security.cors)
        : merged.security?.cors
};
```

## Benefits

### ✅ Maintainability
- Single place to update middleware wrappers
- Easy to add new middleware
- Clear dependency management

### ✅ Consistency
- All middleware uses same configuration pattern
- Consistent defaults across the application
- Predictable behavior

### ✅ Testability
- Easy to mock BuiltInMiddleware
- Clear interfaces for testing
- Isolated concerns

### ✅ Developer Experience
- Simple, intuitive configuration
- Type-safe with TypeScript
- Clear documentation

## Adding New Middleware

To add new middleware to the system:

1. **Add to BuiltInMiddleware**:
```typescript
// src/middleware/built-in/BuiltInMiddleware.ts
static newMiddleware(options: any = {}) {
    const defaultOptions = { /* defaults */ };
    return externalLibrary({ ...defaultOptions, ...options });
}
```

2. **Update SecurityConfig** (if security-related):
```typescript
// src/types/mod/security.ts
export interface SecurityConfig {
    // ... existing fields
    newFeature?: boolean | NewFeatureConfig;
}
```

3. **Use in SecurityMiddleware**:
```typescript
// src/middleware/security-middleware.ts
if (this.newFeature) {
    this.newFeatureMiddleware = BuiltInMiddleware.newMiddleware(config);
}
```

## Migration Guide

If you find code that imports middleware libraries directly:

### ❌ Before (Bad)
```typescript
import cors from 'cors';
import helmet from 'helmet';

const corsMiddleware = cors({ origin: "*" });
```

### ✅ After (Good)
```typescript
import { BuiltInMiddleware } from './built-in/BuiltInMiddleware';

const corsMiddleware = BuiltInMiddleware.cors({ origin: "*" });
```

## Summary

The refactored architecture provides:
- **Single Source of Truth**: BuiltInMiddleware
- **Clean Separation**: Configuration → Security → BuiltIn → External
- **Easy Maintenance**: One place to update
- **Type Safety**: Full TypeScript support
- **Developer Friendly**: Simple, intuitive API
