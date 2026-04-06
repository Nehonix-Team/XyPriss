# Environment Management & Security Shield

**Version Compatibility:** XyPriss v9.5.0 and above  
**Status:** Hardened

## Introduction

The XyPriss Environment API (`__xhsc__.__env__`) is the application's **Security Nervous System**. In v9.5, we moved beyond simple `process.env` wrappers to a hardened, isolated architecture designed for high-integrity production environments.

Direct access to `process.env` is restricted via the **Environment Security Shield** — a robust Proxy layer that prevents unauthorized enumeration and secret leakage. All environment interactions are unified through a secure, symbol-keyed store that uses a **Map-based project registry** to guarantee absolute isolation between your main application and its plugins.

---

## Core Architecture

### 1. The Security Shield (Proxy)

XyPriss replaces the native `process.env` object with a hardened Proxy.

- **Access Blocking**: Unauthorized reads return `undefined` and emit a security warning to `stderr`.
- **Enumeration Hardening**: `Object.keys(process.env)` is restricted to a tight whitelist of system-essential variables (like `PATH` and `HOME`), preventing third-party trackers or loggers from scraping your secrets.
- **Whitelisting**: Only internal framework prefixes (`XY_`, `ENC_`, `__`) are allowed to pass through the shield.

Environment variables aren't stored in plain object properties. They live in a **Map of project environments** keyed by a module-scoped `Symbol`.

Without a reference to the unexported Symbol, external code cannot reach the backing data. Access is further restricted by the caller's project root; code can only see variables belonging to its own parent project.

### 3. Strict Project-Root Isolation

XyPriss implements **Deterministic Project Isolation**.

- **Boundaries**: A folder is a project if it contains `node_modules` and `package.json`.
- **Isolation**: A module only accesses the `.env` of its closest parent project.
- **No hierarchy bleeding**: Child projects (plugins, independent mods) do NOT inherit variables from their parent projects and vice versa.
- **Dynamic Resolution**: Plugins' environments are dynamically loaded and cached the first time they are accessed, ensuring zero-config isolation.

---

## API Reference (`__xhsc__.__env__`)

### `.get(key: string, defaultValue?: string)`

Retrieves a variable. If a `defaultValue` is provided, TypeScript correctly infers the return type as `string`.

```typescript
// Infers 'string'
const port = __xhsc__.__env__.get("PORT", "3000");

// Infers 'string | undefined'
const apiKey = __xhsc__.__env__.get("API_KEY");
```

### `.getStrict(key: string, options?: { rejectEmpty: boolean })`

The gold standard for production. Throws an `EnvAccessError` if the key is missing or empty.

```typescript
// Throws if JWT_SECRET is missing
const secret = __xhsc__.__env__.getStrict("JWT_SECRET");

// Throws if DB_PASS is missing OR is an empty string ""
const pass = __xhsc__.__env__.getStrict("DB_PASS", { rejectEmpty: true });
```

---

## Execution Modes (Readonly)

The environment mode is set once during initialization and is `readonly` to prevent runtime tampering.

| Method             | Description                    |
| :----------------- | :----------------------------- |
| `.isDevelopment()` | True if mode is `development`. |
| `.isProduction()`  | True if mode is `production`.  |
| `.isStaging()`     | True if mode is `staging`.     |
| `.isTest()`        | True if mode is `test`.        |
| `.mode`            | Returns the raw mode string.   |

```typescript
if (__xhsc__.__env__.isProduction()) {
    enableStrictHardenings();
}
```

---

## Advanced Usage

### Type Conversion & Guarding

Since environment variables are always strings, explicit conversion is required. XyPriss recommends performing this at the "edge" (initialization):

```typescript
const config = {
    port: parseInt(__xhsc__.__env__.get("PORT", "3000"), 10),
    debug: __xhsc__.__env__.get("DEBUG", "false") === "true",
    timeout: __xhsc__.__env__.getStrict("TIMEOUT") as any as number,
};
```

### Sanitization Guards

The `EnvApi` rejects values containing:

- `\r` or `\n` (CRLF Injection)
- `\0` (NUL Byte Truncation)

These characters are blocked during `.set()` to prevent corruption of log sinks and HTTP headers.

---

## Best Practices

1.  **Strict Early**: Use `getStrict()` in your main entry point. Catching a missing variable at boot is infinitely better than a `null` error in a background worker 3 hours later.
2.  **Whitelist Process**: If you use a third-party library that _requires_ `process.env`, use `__xhsc__.__env__.set()` at startup. This "re-injects" the value into the whitelisted view of `process.env`.
3.  **Symbolic Privacy**: For sensitive plugins, use the internal `Symbol` registration instead of public properties.

---

**Version:** XyPriss v9.0.0  
**Last Updated:** 2026-03-30

