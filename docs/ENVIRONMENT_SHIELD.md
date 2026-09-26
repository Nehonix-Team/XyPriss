# Environment Security Shield (XESS)

XyPriss features an enterprise-grade **Environment Security Shield (XESS)** powered natively by **libXESS**, Nehonix's proprietary low-level security core designed to eliminate secret leakage, neutralize supply chain exfiltration, and enforce a strict Zero-Trust runtime architecture.

## Powered by libXESS

At the heart of the security shield is **libXESS**, a high-performance native engine embedded directly within the `xfpm` supervisor and the `XHSC` runtime core. Operating beneath the JavaScript/TypeScript execution layer, libXESS establishes an impenetrable boundary around the application before the first line of user code executes:

- **Kernel & Process Boundary**: libXESS confines the execution space, ensuring that the running backend process has no direct, unmediated exposure to host-level secrets.
- **In-Memory Vaulting**: Real configuration values are managed securely in protected memory and communicated exclusively through authenticated native `Bridge`, rather than relying on mutable global memory blocks like `process.env`.
- **Active Honeypot Canaries**: If malicious third-party dependencies or automated scanners attempt to inspect configuration files directly from the filesystem, libXESS intercepts the reads and serves dynamically generated decoys instead of actual secrets.
- **Deterministic Subproject Scoping**: In monorepos or multi-service setups, libXESS enforces strict boundaries between plugins and parent projects, preventing cross-tenant secret leakage.
- **Native Dual-Interlock Enforcement**: Both the `xfpm` supervisor and the native `XHSC` network core actively verify the presence of active libXESS confinement; any unshielded process is blocked before binding ports.

## Why the Shield?

In traditional backend ecosystems, applications rely heavily on mutable global state (`process.env`). This paradigm introduces critical security vulnerabilities:

1. **Global Exposure & Supply Chain Attacks**: Any installed third-party package or transitively resolved dependency can read global environment variables without restriction, exposing database credentials, private keys, and external API tokens.
2. **Accidental Telemetry & Log Leakage**: Unsanitized error reporting, crash dumps, and debugging logs frequently print environment dumps to stdout or external observability providers.
3. **Unconfined Process Execution**: Running backend services directly without execution sandboxing leaves system secrets vulnerable to local unauthorized processes.

## Comparison: Traditional Backends vs. XyPriss

Consider a scenario where an untrusted third-party npm package executes unauthorized file reading or variable inspection:

### In Traditional Node.js / Bun Backends

```typescript
// Malicious or rogue dependency executing at runtime:
import fs from "fs";

// 1. Secret harvesting via process.env
console.log(process.env.DATABASE_URL);
// Output: "postgresql://admin:super_secret_password@db.prod.internal:5432/main"
// Status: CRITICAL LEAK (All runtime secrets globally exposed)

// 2. Direct filesystem read of the configuration file
console.log(fs.readFileSync(".env", "utf-8"));
// Output: Real .env file content with plaintext database and API credentials
// Status: CRITICAL LEAK (Disk contents read with full privileges)
```

### In XyPriss (Powered by libXESS)

```typescript
// The exact same dependency executing inside a XyPriss application:
import fs from "fs";

// 1. Secret harvesting attempt via process.env
console.log(process.env.DATABASE_URL);
// Output: undefined
// Status: ACCESS BLOCKED (process.env is strictly shielded)

// 2. Direct filesystem read attempt
console.log(fs.readFileSync(".env", "utf-8"));
// Output: DATABASE_URL="xy_decoy_database_url_5c940b2874c0"
// Status: HONEYPOT ENGAGED (Deceptive decoy values returned transparently)

// 3. Authorized application code via official system API:
console.log(__sys__.__env__.get("DATABASE_URL"));
// Output: "postgresql://admin:super_secret_password@db.prod.internal:5432/main"
// Status: SECURE (Legitimate business logic receives authentic credentials in memory)
```

## Architectural Principles

The XyPriss Environment Security Shield operates on three fundamental principles:

### 1. Mandatory Supervised Execution via XFPM

To guarantee total environment integrity, all XyPriss applications must be launched through the official **XFPM CLI** (`xfpm dev`, `xfpm run`, `xfpm start`), which initializes libXESS.

Direct unconfined runtime execution (such as invoking `node` or `bun` directly on entry files) is blocked by design. The native XHSC engine actively inspects the execution context and refuses to bind network listeners without an authorized libXESS session.

> [!IMPORTANT]
> Unconfined execution exposes application state to host-level leaks. The framework actively refuses to bind network ports or serve requests outside of a supervised session.

### 2. Variable Masking & Access Control

By default, global `process.env` is shielded:

- **System Variables**: Essential runtime keys (such as `PATH`, `PORT`, and core platform variables) remain accessible for engine stability.
- **Application Secrets**: Secrets and business configuration variables return `undefined` when accessed directly through `process.env`, preventing rogue libraries from harvesting credentials.
- **Honeypot Protection**: Unauthorized direct filesystem reads targeting configuration files within the application hierarchy encounter deceptive decoy values rather than live credentials.

### 3. Unified Developer API

All application configuration must be retrieved through the native system accessor:

```typescript
// Discouraged: returns undefined for shielded variables
const apiKey = process.env.DATABASE_URL;

// Recommended: secure, authenticated access via libXESS
const dbUrl = __sys__.__env__.get("DATABASE_URL");

// Enforces existence (throws if missing or empty)
const secretKey = __sys__.__env__.getStrict("JWT_SECRET");
```

## Standard Whitelisted Variables

The following system variables remain directly accessible via `process.env` to ensure operating system and runtime interoperability:

| Variable    | Purpose                               |
| :---------- | :------------------------------------ |
| `NODE_ENV`  | Active execution environment mode     |
| `PORT`      | Configured listening port             |
| `PATH`      | Operating system binary search path   |
| `USER`      | Active operating system user          |
| `HOME`      | Current user home directory           |
| `LANG`      | System localization and charset       |
| `COLORTERM` | Terminal color capabilities           |
| `XYPRISS_*` | Official framework runtime parameters |

## Declarative Configuration

For third-party dependencies that strictly require access to specific environment variables via `process.env`, configure explicit exceptions using the declarative `$env` block in `xypriss.config.jsonc`.

This file is evaluated prior to module evaluation, ensuring deterministic policy enforcement.

### Extending the Whitelist

Append custom variables to the default system whitelist:

```jsonc
{
    "$env": {
        "whitelist": ["STRIPE_PUBLIC_KEY", "LEGACY_CLIENT_ID"]
    }
}
```

Once declared, `process.env.STRIPE_PUBLIC_KEY` returns its authorized value without triggering security warnings, while all unlisted secrets remain isolated.

### Strict Whitelist Replacement

For zero-tolerance production deployments requiring complete exclusion of default system variables, enable strict whitelist replacement:

```jsonc
{
    "$env": {
        "whitelist": ["PORT", "CUSTOM_ALLOWED_VAR"],
        "replaceDefaultWhitelist": true
    }
}
```

## Configuration Reference

| Option                         | Type       | Default     | Description                                                                          |
| :----------------------------- | :--------- | :---------- | :----------------------------------------------------------------------------------- |
| `$env`                         | `Object`   | `undefined` | Root environment security configuration block in `xypriss.config.jsonc`.             |
| `$env.whitelist`               | `string[]` | `[]`        | Explicit list of variable keys permitted for direct `process.env` access.            |
| `$env.replaceDefaultWhitelist` | `boolean`  | `false`     | When `true`, discards all default system keys and enforces only the custom whitelist. |

## Best Practices

1. **Adopt `__sys__.__env__`**: Treat `process.env` as obsolete for application-level logic.
2. **Use `getStrict()` for Critical Secrets**: Fail fast during startup if database strings, encryption keys, or external credentials are missing.
3. **Avoid Broad Whitelists**: Keep `$env.whitelist` minimal. Only expose keys required by third-party packages that cannot be refactored.
4. **Always Launch via XFPM**: Use `xfpm dev` for local workflows and `xfpm start` in containerized deployments to engage libXESS confinement automatically.
