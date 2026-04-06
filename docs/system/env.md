# Environment (`__xhsc__.__env__`)

The `__xhsc__.__env__` module (implemented via `EnvApi`) is the sole authorized gateway for managing environment variables in XyPriss applications. It strictly replaces direct access via `process.env`.

## Environment Security Shield

This module relies on four independent security mechanisms:

1. **Map-Isolated Storage**: Variables are saved in a global `Map` identified by an unexported `Symbol`. Access is strictly tied to the caller's project root (detected via `package.json` + `node_modules`).
2. **Initialization Guard**: Any read or write attempt before the formal initialization of `EnvApi` is blocked, preventing startup leaks.
3. **Value Sanitization**: Automatic rejection of values containing carriage returns (`\r`, `\n`) or null characters (`\0`), preventing log corruption and injection attacks.
4. **Deterministic Project Scoping**: Modules can only access the `.env` of their direct parent project. Static and dynamic resolution ensure that child projects (plugins) remain perfectly isolated from their parents.
5. **Restrictive Proxy**: Classical access to `process.env` is neutralized by a `Proxy`. Only explicitly whitelisted keys (e.g., system flags, ports) can be accessed. Third-party enumeration returns undefined.

---

## Read Methods

### `get(key: string, defaultValue?: string): string | undefined`

Retrieves a variable from the secure store.

```typescript
const timeout = __xhsc__.__env__.get("REQUEST_TIMEOUT_MS", "5000");
const parsedTimeout = parseInt(timeout, 10);
```

### `getStrict(key: string, options?: EnvGetStrictOptions): string`

Requires the presence of a variable to ensure application integrity. Fails fast (via `EnvAccessError`) if the variable is missing, preventing silent failures.

```typescript
// Fails immediately at startup if the variable is missing or empty
const jwtSecret = __xhsc__.__env__.getStrict("JWT_SECRET", {
    rejectEmpty: true,
});
```

### `has(key: string): boolean`

Returns `true` if the key exists in the store, regardless of its value (including empty strings).

```typescript
if (__xhsc__.__env__.has("MAINTENANCE_MODE")) {
    handleMaintenance();
}
```

### `all(options?: EnvAllOptions): EnvSnapshot`

Generates a frozen point-in-time snapshot of the current variables. In production, it is imperative to use the key filtering option to avoid inadvertently logging secrets.

```typescript
const publicConfig = __xhsc__.__env__.all({
    keys: ["PUBLIC_API_URL", "FEATURE_FLAG_X"],
});
```

---

## Write Methods

### `set(key: string, value: string): void`

Registers or modifies a variable. Keys cannot be empty or consist solely of whitespace.

```typescript
__xhsc__.__env__.set("TEMPORARY_ACCESS_TOKEN", "xy-token-123");
```

### `delete(key: string): void`

Securely removes a variable from the in-memory store cache and attempts to remove it from `process.env` if applicable.

```typescript
__xhsc__.__env__.delete("TEMPORARY_ACCESS_TOKEN");
```

---

## Execution Context (Modes)

Provides strict, read-only contextual utilities.

- `isProduction()`: Checks if the current environment is `"production"`.
- `isDevelopment()`: Checks if the current environment is `"development"`.
- `isStaging()`: Checks if the current environment is `"staging"`.
- `isTest()`: Checks if the current environment is `"test"`.
- `is(envName: string)`: Allows checking a custom environment string.

```typescript
if (__xhsc__.__env__.isDevelopment()) {
    enableVerboseLogging();
}
```

---

## Native Utilities

### `user(): string`

Synchronously queries the native XHSC process to retrieve the operating system username of the instance owner.

```typescript
const actor = __xhsc__.__env__.user() || "anonymous";
auditLog.write({ actor, action: "initialization" });
```

