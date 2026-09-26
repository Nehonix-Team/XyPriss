# Environment Security Shield (XESS)

XyPriss features an enterprise-grade **Environment Security Shield (XESS)** designed to eliminate secret leakage, prevent supply chain exfiltration, and enforce a strict Zero-Trust runtime architecture.

## Why the Shield?

In traditional backend ecosystems, applications rely heavily on mutable global state (`process.env`). This paradigm introduces critical security vulnerabilities:

1. **Global Exposure & Supply Chain Attacks**: Any installed third-party package or transitively resolved dependency can read global environment variables without restriction, exposing database credentials, private keys, and external API tokens.
2. **Accidental Telemetry & Log Leakage**: Unsanitized error reporting, crash dumps, and debugging logs frequently print environment dumps to stdout or external observability providers.
3. **Unconfined Process Execution**: Running backend services directly without execution sandboxing leaves system secrets vulnerable to local unauthorized processes.

## Architectural Principles

The XyPriss Environment Security Shield operates on three fundamental principles:

### 1. Mandatory Supervised Execution

To guarantee total environment integrity, all XyPriss applications must be launched through the official **XFPM CLI** (`xfpm dev`, `xfpm run`, `xfpm start`).

Direct unconfined runtime execution (such as invoking `node` or `bun` directly on entry files) is blocked by design. The runtime engine enforces confinement at the lowest system boundary before network listeners are bound.

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

// Recommended: secure, authenticated access
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
4. **Always Launch via XFPM**: Use `xfpm dev` for local workflows and `xfpm start` in containerized deployments.
