# XyPriss Configuration Guide

This guide covers the supported configuration options available in the XyPriss initialization process.

## The Configuration File

> [!IMPORTANT]  
> **Strict Root-Only Loading**: XyPriss enforces a strict configuration loading policy for determinism and security. Configuration files are **only** loaded from the absolute project root (`__sys__.__root__`). Nested configurations in subdirectories (like plugins or tests) are ignored. All project configuration must be centralized at the root.

To configure XyPriss and its internal workspaces, create a `xypriss.config.jsonc` (preferred) or `xypriss.config.json` file in your absolute project root.

The configuration currently supports two primary sections:

1. `__vars__`: Project Metadata
2. `$internal`: Plugin Authorization & Specialized Workspaces

---

### 1. Project Metadata (`__vars__`)

This section defines the core application variables that are populated into the `__sys__.vars` namespace on server boot. It supports environment variable injection via the `$(env).VAR_NAME` syntax, and dynamic `package.json` property injection via the `$(pkg).path` syntax.

```jsonc
{
    "__vars__": {
        "__name__": "$(env).NAME",
        "__description__": "$(env).DESCRIPTION",
        "__version__": "$(env).VERSION",
        "__author__": "$(env).AUTHOR",
        "__PORT__": "$(env).PORT",
        "__alias__": "$(env).ALIAS",
        "__project_name__": "$(pkg).name",
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

By defining this config, the system securely generates an isolated `XyPrissFS` instance tightly bound to the authorized path, preventing the plugin from accessing any files outside of its assigned sandbox.

---

### Dynamic Property Resolution

XyPriss supports dynamic property resolution within configuration files using two primary syntaxes:

1.  **`$(env).KEY`** or **`&(env).KEY`**: Injects environment variables.
2.  **`$(pkg).path`** or **`&(pkg).path`**: Injects properties from the project's `package.json`.

#### Environment Variable Injection

You can access environment variables using the `$(env).KEY` syntax. This replaces the legacy `${env:KEY|Default}` syntax to provide a more uniform and readable configuration.

> [!WARNING]
> Fallbacks (defaults) are no longer supported in the configuration file. If a requested environment variable is not defined, XyPriss will throw an error during startup.

#### Package Property Injection

You can access any property from your `package.json` using dot notation. This is supported in both **values** and **keys**.

- **In Values**: `$(pkg).version` resolves to the version string.
- **In Keys**: `"&(pkg).name"` resolves to the package name as a key.

> [!WARNING]
> If a requested property does not exist in `package.json`, XyPriss will throw a configuration error during startup. Ensure all referenced properties are defined.

