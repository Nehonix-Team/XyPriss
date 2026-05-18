# Environment Security Shield (XESS)

XyPriss features a military-grade **Environment Security Shield** designed to eliminate secret leakage and enforce robust application architecture.

## Why the Shield?

Traditional Node.js applications rely heavily on `process.env`. While convenient, this approach has several flaws:

1. **Global Exposure**: Any third-party library or dependency can read `process.env`, potentially leaking your database credentials or API keys to malicious actors or telemetry services.
2. **Accidental Logging**: Developers often log `process.env` during debugging, unintentionally printing sensitive secrets to stdout or cloud logs.
3. **Implicit Dependencies**: Code becomes hard to test and maintain when it depends on global, mutable state.

## How it Works

XyPriss uses a native **System Proxy** to intercept all access to `process.env`.

### 1. Project-Root Isolation

XyPriss includes a built-in, ultra-fast `.env` loader that operates on **Project Boundaries**.

- **Project Discovery**: A directory is considered a project if it contains `node_modules` and `package.json`.
- **Scoped Loading**: The system automatically loads the `.env` file belonging to the project root.
- **Strict Isolation**: Sub-projects (plugins, mods) are isolated from their parents. They only access their own local `.env`.

**Note:** Configuration management is now deterministic and scoped to the caller's project.

### 2. Variable Masking

When code attempts to read from `process.env`, the shield performs a security check:

- **Whitelisted core variables** (e.g., `NODE_ENV`, `PATH`, `PORT`, `TERM`) are returned normally.
- **Project-prefixed variables** (starting with `XYPRISS_`, `XY_`, `ENC_`, or `DOTENV_`) are returned normally.
- **All other variables** return `undefined` and trigger a security warning in the console.

### 3. The Official API

To access your application variables, use the system-managed environment manager:

```typescript
// ❌ Discouraged
const apiKey = process.env.MY_API_KEY;

// ✅ Recommended
const apiKey = __sys__.__env__.get("MY_API_KEY");
```

## Configuration Whitelist

The following variables are always accessible directly via `process.env` to ensure system and runtime stability:

| Variable    | Description                           |
| ----------- | ------------------------------------- |
| `NODE_ENV`  | Current runtime environment           |
| `PORT`      | Standard listening port               |
| `PATH`      | System execution paths                |
| `USER`      | Current system user                   |
| `HOME`      | User home directory                   |
| `LANG`      | System language/locale                |
| `COLORTERM` | Terminal color support                |
| `XYPRISS_*` | All official framework configurations |
| `ENC_*`     | Encryption keys and seeds             |

## Best Practices

1. **Use Prefixes**: For environment variables that MUST be accessed by legacy libraries, prefix them with `XYPRISS_`.
2. **Standardize Access**: Use `__sys__.__env__.get()` everywhere in your business logic.
3. **Use .env**: This file is automatically loaded and is the ideal place for hardware-local secrets that should never be committed to version control.

## Dynamic Configuration

Starting from version 9.10.17, you can dynamically configure the **XyPriss Environment Security Shield (XESS)** under the `security` property of `ServerOptions`. 

This enables you to whitelist custom environment variables that third-party, legacy libraries must access directly from `process.env`.

> [!IMPORTANT]
> The security shield is a core principle of the XyPriss framework. For maximum security, **the shield remains active at all times** and cannot be disabled.

### Extending the Default Whitelist

By default, any key specified in the `whitelist` option will be *appended* to the built-in system whitelist:

```typescript
import { createServer } from "xypriss";

const app = createServer({
    security: {
        xess: {
            whitelist: ["MY_CUSTOM_SECRET", "ANOTHER_LEGACY_VAR"]
        }
    }
});
```

Now, `process.env.MY_CUSTOM_SECRET` will return its actual value without triggering any warning, while other non-whitelisted keys remain securely masked.

### Replacing the Default Whitelist

If you need absolute control and want to restrict the environment strictly to your custom keys (excluding default variables like `PATH` or `LANG`), set `replaceDefaultWhitelist: true`:

```typescript
const app = createServer({
    security: {
        xess: {
            whitelist: ["PORT", "MY_CUSTOM_SECRET"],
            replaceDefaultWhitelist: true
        }
    }
});
```

## Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `xess` (or `envShield`) | `XessConfig` | `undefined` | Security shield configuration block. |
| `xess.whitelist` | `string[]` | `[]` | List of custom environment variable keys to whitelist. |
| `xess.replaceDefaultWhitelist` | `boolean` | `false` | If `true`, completely discards the default system whitelist in favor of `whitelist`. |
