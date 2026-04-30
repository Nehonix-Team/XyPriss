# Tutorial: How to Create and Publish a XyPriss Plugin (A-Z)

Building a plugin for XyPriss is the best way to encapsulate complex logic, interact with the server's lifecycle, and share your work with the global XyPriss ecosystem.

This tutorial covers the entire lifecycle of authoring a plugin: from bootstrapping a TypeScript project to publishing it via XFPM using the Zero-Trust G3 security protocol.

---

## Phase 1: Bootstrapping the Project

First, create a new directory for your plugin. The community standard dictates prefixing your plugin name with `xypriss-plugin-`. Let's build a simple "Request ID" injector.

```bash
xfpm init --name "xypriss-plugin-request-id"
```

Now, install TypeScript and XyPriss (as a peer dependency).

```bash
xfpm add -D typescript @types/node
xfpm add -R xypriss
xfpm add nehoid
```

_Note: We add `xypriss` as a peer dependency (`-R`) because the user's project will supply the framework instance._

Initialize your `tsconfig.json`:

```bash
npx tsc --init
```

---

### Mandatory Creator Configuration

For XyPriss to recognize your directory as a valid plugin, you **must** include a `xypriss.config.jsonc` (or `.json`) file in your plugin's root directory. This acts as your security contract with the engine.

Create `xypriss.config.jsonc`:

```jsonc
{
    "$internal": {
        // $(pkg).name dynamically reads the "name" field from your package.json.
        // This avoids duplicating the plugin name and keeps the config in sync.
        "$(pkg).name": {
            "type": "plugin",
        },
    },
}
```

The `$(pkg).name` syntax injects the `name` field from your `package.json` at config load time. Because both files must refer to the same plugin ID, this is the recommended pattern — it eliminates duplication and prevents drift between your `package.json` and your security contract.

Without this file and the `type: "plugin"` declaration, XyPriss will refuse to load your module for security reasons.

---

## Phase 2: Writing the Plugin Code

XyPriss highly encourages exporting a **Plugin Factory**. This allows users to pass configuration options when they register your plugin.

Create `src/index.ts`:

```typescript
import { Plugin, PluginServer, Request, Response, NextFunction } from "xypriss";
import { ID } from "nehoid";

// 1. Define the options your plugin accepts
export interface RequestIdOptions {
    headerName?: string;
    generateId?: () => string;
}

// 2. Export the Plugin Factory
export function requestIdPlugin(options: RequestIdOptions = {}) {
    // 3. Retrieve manifest data from package.json to avoid duplication
    const pkg = Plugin.manifest<{
        name: string;
        version: string;
        description: string;
    }>(__sys__);

    // Merge provided options with defaults
    const headerName = options.headerName || "X-Request-ID";
    const generateId = options.generateId || (() => ID.generate());

    // 4. Return the Plugin Definition via Plugin.create
    return Plugin.create(
        {
            name: pkg.name,
            version: pkg.version,
            description: pkg.description,
            type: "NETWORK", // Performance hint: network/middleware execution

            // Use the onRequest hook to act as highly-optimized middleware
            onRequest(req: Request, res: Response, next: NextFunction) {
                // Check if the client already sent an ID
                const existingId = req.headers[headerName.toLowerCase()];
                const reqId = existingId || generateId();

                // Attach to the request object for other routes/plugins to use
                req.id = reqId;

                next();
            },

            // Use onResponse to ensure the header is sent back to the client
            onResponse(req: Request, res: Response) {
                if (req.id) {
                    res.setHeader(headerName, req.id);
                }
            },

            // (Optional) Log when the server starts
            onServerStart(server: PluginServer) {
                console.log(
                    `[Request-ID] Plugin initialized. Listening on header: ${headerName}`,
                );
            },
        },
        __sys__.__root__,
    );
}
```

### Important Authoring Rules:

1. **Never mutate the `app` instance**: If you try to do `server.app.myCustomProp = true` inside `onServerStart`, the XyPriss security proxy will throw a fatal mutation error.
2. **Handle Next**: If you use `onRequest`, you **must** call `next()`.
3. **Respect Performance**: XyPriss is ultra-fast. Keep your `onRequest` and `onResponse` logic synchronous and lightweight (under 7ms).
4. **Zero-Trust Model**: `ON_REQUEST`, `ON_RESPONSE`, and sensitive data access (`ACCESS_SENSITIVE_DATA`) are deeply privileged actions. Document in your plugin's README that users must explicitly grant these permissions.

---

## Phase 3: Permission Discovery & Configuration

XyPriss G3 uses a Zero-Trust security model. Your plugin **must** declare every permission it intends to use in its `package.json`. If a hook is implemented but not declared, the engine will block its execution.

### 1. Identify Required Permissions with `Plugin.inspect()`

Instead of guessing which permission IDs correspond to your hooks, XyPriss provides a built-in discovery tool.

Create a temporary `inspect.ts` file:

```typescript
import { Plugin } from "xypriss";
import { requestIdPlugin } from "./src";

// Run the deep-scan inspector
Plugin.inspect(requestIdPlugin());
process.exit(0);
```

Run it using `xfpm run`:

```bash
xfpm run inspect.ts
```

**Example Output:**
```text
══════════════════════════════════════════════════
[XyPriss Plugin Inspector] xypriss-plugin-request-id v1.0.0
══════════════════════════════════════════════════
Detected Hooks & Authorized Permission IDs:

  ○ Hook/Capability: onRequest
    ID:   XHS.HOOK.HTTP.REQUEST ⚠️  [PRIVILEGED]
    Role: intercept and process incoming requests

  ○ Hook/Capability: onResponse
    ID:   XHS.HOOK.HTTP.RESPONSE ⚠️  [PRIVILEGED]
    Role: intercept and process outgoing responses

Summary: Found 2 required permissions.
══════════════════════════════════════════════════
```

### 2. Update `package.json`

Copy the IDs found by the inspector into your `package.json` under the `xfpm.permissions` field.

```json
{
  "name": "xypriss-plugin-request-id",
  "version": "1.0.0",
  "xfpm": {
    "permissions": [
      "XHS.HOOK.HTTP.REQUEST",
      "XHS.HOOK.HTTP.RESPONSE"
    ]
  }
}
```

---

## Phase 4: Testing & Documentation

Before publishing, you should verify your plugin in a real environment and prepare the documentation for your users.

### 1. Local Testing

Create a `test-server.ts` file in your root to verify the plugin's behavior.

### 2. User Documentation (README.md)

You **must** show users how to grant your plugin the required permissions in their `xypriss.config.jsonc` file. Use the following syntax to keep the ID synchronized:

**Example Documentation Snippet for `README.md`**

```jsonc
{
    "$internal": {
        // Users must use the explicit package name of your plugin
        // to grant permissions in their own project configuration.
        "xypriss-plugin-request-id": {
            "permissions": {
                "allowedHooks": [
                    "XHS.HOOK.HTTP.REQUEST",
                    "XHS.HOOK.HTTP.RESPONSE",
                ],
                "policy": "allow",
            },
        },
    },
}
```

---

## Phase 5: Security Identity & Signing

XyPriss G3 requires all plugins to be cryptographically signed. This prevents code tampering and ensures that only trusted authors can interact with the framework's core.

### 1. Generate Your Developer Identity

If you are a new author, generate your Ed25519 identity key. This only needs to be done once per machine.

```bash
xfpm gen-key
```

This will output your **Public Key (Developer ID)**.

> [!IMPORTANT]
> **You MUST include this Public Key in your plugin's official README.** Users will use it to verify your identity during installation.

### 2. Sign the Assets

Before publication, you must sign your code. This hashes all production files and pins the minimum compatible engine version.

> [!IMPORTANT] 
> **Manual Checklist:**
> 1. Ensure `xypriss.config.jsonc` exists and has the correct `type: "plugin"` metadata.
> 2. Ensure `xypriss.plugin.xsig` is listed in the `files` array of your `package.json`.
> 3. Verify no duplicate entries exist in `xfpm.permissions`.

```bash
xfpm sign -p package.json -m 1.0.0
```
> [!TIP]
> **Auto-Correction with `--fix`**
> To avoid manual errors, XFPM can automatically fix your manifest. Using the `--fix` flag will create missing config files, inject required metadata, and de-duplicate permissions automatically.
>
> ```bash
> xfpm sign -p package.json --min-version 1.0.0 --fix
> ```

---

## Phase 6: Publication

Now that your plugin is built and signed, it's time to share it with the world.

### 1. Prepare `package.json`

Ensure your `package.json` includes the correct entry points and build scripts.

```json
{
    "name": "xypriss-plugin-request-id",
    "version": "1.0.0",
    "main": "dist/index.js",
    "types": "dist/index.d.ts",
    "scripts": {
        "build": "tsc",
        "prepublishOnly": "xfpm run build && xfpm sign ./"
    }
}
```

### 2. Publish to Registry

Use XFPM to publish your package to the registry.

```bash
xfpm publish
```

---

## Phase 7: Maintenance & Revocation

If you discover a critical security vulnerability or if your private key is compromised, you must immediately revoke the affected versions.

1.  **Generate a Revocation Manifest**: Use the `xfpm revoke` command (refer to the XFPM Security Guide).
2.  **Publish a New Version**: Update your plugin and publish. The XyPriss G3 engine will automatically block the execution of the revoked versions in the next audit cycle.

---

### Conclusion

You have successfully completed the authoring and security lifecycle for a XyPriss plugin. By following these standards, you ensure that your extensions are high-performance, secure, and compatible with the enterprise-grade G3 architecture.
