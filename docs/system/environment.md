# Environment Management & Security Shield

**Version Compatibility:** XyPriss v9.12.67 and above  
**Status:** Hardened Zero-Trust Sandbox

## Introduction

The XyPriss Environment API (`__sys__.__env__`) is the application's **Security Nervous System**. Designed with a Zero-Trust architecture, it guarantees that neither third-party plugins nor untrusted modules can access host environment variables without explicit permission.

Direct access to `process.env` is restricted via the **Environment Security Shield**, a hardened Proxy layer that prevents unauthorized enumeration and secret leakage. All environment interactions are unified through a secure, symbol-keyed store that uses a **Map-based project registry** to guarantee absolute isolation between your host application and its plugins.

---

## Core Architecture

### 1. The Security Shield (Proxy)

XyPriss replaces the native `process.env` object with a hardened Proxy:

- **Access Blocking**: Unauthorized reads return `undefined` and emit a security warning to `stderr`.
- **Enumeration Hardening**: `Object.keys(process.env)` is restricted to a tight whitelist of system-essential variables (like `PATH` and `HOME`), preventing third-party trackers or loggers from scraping secrets.
- **Whitelisting**: Only internal framework prefixes (`XY_`, `ENC_`, `__`) and essential OS keys pass through the shield. The whitelist can only be configured during framework bootstrap; it is protected by an internal Symbol against runtime alteration.

### 2. Symbolic Isolation & Unexported Store Key

Environment variables are never stored in plain, enumerable global objects. They reside in a **Map of project environments** keyed by a module-scoped, unexported `Symbol` (`XY_ENV_STORE_KEY`).

Without a reference to the unexported Symbol, external code cannot reach the backing data.

### 3. Strict Project-Root Isolation & Zero-Trust Sandbox

XyPriss implements **Deterministic Project Isolation**:

- **Boundaries**: A folder is treated as a project if it contains `node_modules` and `package.json`.
- **Caller-Driven Scope**: When `__sys__.__env__.get()` is invoked, XyPriss inspects the call stack (`getCallerProjectRoot()`) to identify the invoking component.
- **Zero Host Bleed**: Plugins executing from within `node_modules/` or separate directories receive variables only from their own project folder. If no `.env` exists in the plugin's directory, lookups return `undefined`.
- **No Public Bypass Methods**: Operations on `__sys__.__env__` are strictly limited to caller-scoped CRUD operations (`get`, `getStrict`, `has`, `all`, `set`, `delete`). Bypass methods (such as arbitrary target root overrides) do not exist on the public API. Internal engine operations (e.g., config syntax parsing) rely on private, unexported Symbols.

---

## API Reference (`__sys__.__env__`)

### `.get(key: string, defaultValue?: string)`

Retrieves a variable. If a `defaultValue` is provided, TypeScript correctly infers the return type as `string`.

```typescript
// Infers 'string'
const port = __sys__.__env__.get("PORT", "3000");

// Infers 'string | undefined'
const apiKey = __sys__.__env__.get("API_KEY");
```

### `.getStrict(key: string, options?: { rejectEmpty: boolean })`

The gold standard for production. Throws an `EnvAccessError` if the key is missing or empty.

```typescript
// Throws if JWT_SECRET is missing
const secret = __sys__.__env__.getStrict("JWT_SECRET");

// Throws if DB_PASS is missing OR is an empty string ""
const pass = __sys__.__env__.getStrict("DB_PASS", { rejectEmpty: true });
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
if (__sys__.__env__.isProduction()) {
    enableStrictHardenings();
}
```

---

## Advanced Usage

### Type Conversion & Guarding

Since environment variables are always strings, explicit conversion is required. XyPriss recommends performing this at the "edge" (initialization):

```typescript
const config = {
    port: parseInt(__sys__.__env__.get("PORT", "3000"), 10),
    debug: __sys__.__env__.get("DEBUG", "false") === "true",
    timeout: __sys__.__env__.getStrict("TIMEOUT") as any as number,
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
2.  **Whitelist Process**: If you use a third-party library that _requires_ `process.env`, use `__sys__.__env__.set()` at startup. This "re-injects" the value into the whitelisted view of `process.env`.
3.  **Symbolic Privacy**: For sensitive plugins, use the internal `Symbol` registration instead of public properties.

---

**Version:** XyPriss v9.12.67  
**Last Updated:** 2026-09-12

