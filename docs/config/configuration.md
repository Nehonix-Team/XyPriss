# XyPriss Configuration Guide

This guide covers the supported configuration options available in the XyPriss initialization process.

## The Configuration File

> [!IMPORTANT]  
> **Strict Root-Only Loading**: XyPriss enforces a strict configuration loading policy for determinism and security. Configuration files are **only** loaded from the absolute project root (`__sys__.__root__`). Nested configurations in subdirectories (like plugins or tests) are ignored. All project configuration must be centralized at the root.

To configure XyPriss and its internal workspaces, create a `xypriss.config.jsonc` (preferred) or `xypriss.config.json` file in your absolute project root.

The configuration currently supports two primary sections:

1. `$vars`: Project Metadata
2. `$internal`: Plugin Authorization & Specialized Workspaces

---

### 1. Project Metadata (`$vars`)

This section defines the core application variables that are populated into the `__sys__.vars` namespace on server boot. It supports environment variable injection via the `&(env).VAR_NAME` syntax, and dynamic `package.json` property injection via the `&(pkg).path` syntax.

```jsonc
{
    "$vars": {
        "__name__": "&(env).NAME",
        "__description__": "&(env).DESCRIPTION",
        "__version__": "&(env).VERSION",
        "__author__": "&(env).AUTHOR",
        "__PORT__": "&(env).PORT",
        "__alias__": "&(env).ALIAS",
        "__project_name__": "&(pkg).name",
    },
}
```

### 2. Plugin Authorization (`$internal`)

This section gives you strict, enterprise-grade control over which plugins can access specialized APIs and isolated filesystems.

Rather than giving plugins full access to the project root, you authorize specific paths for specific plugins using their **Plugin ID** (e.g., `@xypriss/swagger`).

> [!CAUTION]  
> If you assign the `CWD://` anchor as a plugin's `__xfs__` path, you are granting that plugin access to the execution directory, which may include sensitive files like `.env`. Ensure you only grant `CWD://` permissions to highly trusted, core plugins.

```jsonc
{
    "$internal": {
        // Authorize the Swagger plugin
        "@xypriss/swagger": {
            // Where the plugin should look for initialization logic
            "__meta__": {
                "path": "ROOT://mods/swagger",
            },
            // The restricted filesystem context given to the plugin
            "__xfs__": {
                "path": "CWD://public/docs",
            },
        },
        // Using &(pkg) syntax for dynamic key resolution
        "&(pkg).name": {
            "type": "plugin",
        },
    },
}
```

---

By defining this config, the system securely generates an isolated `XyPrissFS` instance tightly bound to the authorized path, preventing the plugin from accessing any files outside of its assigned sandbox.

---

XyPriss supports comprehensive dynamic property resolution within configuration files using several syntaxes:

1.  **`&(env).KEY`**: Injects environment variables.
2.  **`&(pkg).path`**: Injects properties from the project's `package.json`.
3.  **`&(this).KEY`**: Injects properties from the currently parsed root JSON object.
4.  **`&(date).FMT`**: Injects date/time strings (ISO, YEAR, MONTH, DAY, TS, TIME).
5.  **`&(file).path`**: Injects file contents synchronously (useful for secrets or certificates).

All dynamic injections support logical OR (`||`) fallbacks (e.g. `&(env).PORT || 8080`).

#### Environment Variable Injection (`env`)

Access environment variables using `&(env).KEY`. This ensures clean separation between configuration and environment secrets.

```jsonc
{
    "$vars": {
        // Will use process.env.PORT, fallback to 8080
        "port": "&(env).PORT || 8080",
        
        // Chain multiple environment variables
        "database_url": "&(env).PROD_DB || &(env).DEV_DB || sqlite://local.db"
    }
}
```

#### Package Property Injection (`pkg`)

Access any property from your `package.json` using dot notation. This is supported in both **values** and **keys**.

```jsonc
{
    "$vars": {
        "version": "&(pkg).version",
        "description": "&(pkg).description"
    },
    "$internal": {
        // Dynamically use the package name as a key
        "&(pkg).name": {
            "type": "plugin"
        }
    }
}
```

#### Self-Reference Injection (`this`)

Reference other properties within the same configuration file. The referenced value will be resolved recursively, allowing dynamic chains.

```jsonc
{
    "$vars": {
        "host": "localhost",
        "port": 3000,
        // Will resolve to "http://localhost:3000"
        "baseUrl": "http://&(this).$vars.host:&(this).$vars.port"
    }
}
```


#### Date & Time Tokens (`date`)

Inject current date/time strings when the config is loaded. Supported tokens: `ISO`, `YEAR`, `MONTH`, `DAY`, `TS` (Timestamp), `TIME`.

```jsonc
{
    "$vars": {
        // Generates: "server-2026-05.log"
        "logFile": "server-&(date).YEAR-&(date).MONTH.log",
        // Generates an ISO string at boot
        "bootTime": "&(date).ISO"
    }
}
```

#### File Contents (`file`)

Read and inject file contents synchronously. Paths can be absolute or relative to the project root. Excellent for loading TLS certificates or extensive secrets.

```jsonc
{
    "$vars": {
        // Read certificates directly into the config
        "cert": "&(file)./certs/server.crt",
        // Fallback to reading a file if env is missing
        "apiSecret": "&(env).API_SECRET || &(file)./secrets/api.txt"
    }
}
```

> [!WARNING]
> If all references in a chain fail to resolve and no literal fallback is provided, XyPriss will throw a configuration error during startup.

---

### Accessing Variables in TypeScript

All properties defined in the `$vars` section of your `xypriss.config.jsonc` file are automatically loaded and parsed when the server boots. You can securely access these resolved variables anywhere in your application using the `__sys__.vars` API.

```typescript
// Accessing the entire resolved variables object
console.log("App variables:", __sys__.vars.all());

// Accessing specific parsed variables
const port = __sys__.vars.get("port") || 8080;
const databaseUrl = __sys__.vars.get("database_url");

// You can also use the getter for the internal metadata
const projectName = __sys__.vars.get("__project_name__");

console.log(`Starting ${projectName} on port ${port}...`);
```

