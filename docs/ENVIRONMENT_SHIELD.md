# Environment Security Shield

XyPriss features a military-grade **Environment Security Shield** designed to eliminate secret leakage and enforce robust application architecture.

## Why the Shield?

Traditional Node.js applications rely heavily on `process.env`. While convenient, this approach has several flaws:

1. **Global Exposure**: Any third-party library or dependency can read `process.env`, potentially leaking your database credentials or API keys to malicious actors or telemetry services.
2. **Accidental Logging**: Developers often log `process.env` during debugging, unintentionally printing sensitive secrets to stdout or cloud logs.
3. **Implicit Dependencies**: Code becomes hard to test and maintain when it depends on global, mutable state.

## How it Works

XyPriss uses a native **System Proxy** to intercept all access to `process.env`.

### 1. Zero-Dependency DotEnv Loading

XyPriss includes a built-in, ultra-fast `.env` loader. It automatically looks for and merges the following files (in order of priority):

- `.private/.env`
- `.env.local`
- `.env`

**Note:** You no longer need `require('dotenv').config()` or any external environment loaders.

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
3. **Use .private/.env**: This file is automatically loaded and is the ideal place for hardware-local secrets that should never be committed to version control.

