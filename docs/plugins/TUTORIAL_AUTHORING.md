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
xfpm add -O xypriss
xfpm add nehoid
```

_Note: We add `xypriss` as a peer dependency (`-O`) because the user's project will supply the framework instance._

Initialize your `tsconfig.json`:

```bash
npx tsc --init
```

_(Ensure `outDir` is set to `./dist` and `module` to `CommonJS` or `ESNext` depending on your target)._

### Mandatory Creator Configuration

For XyPriss to recognize your directory as a valid plugin, you **must** include a `xypriss.config.jsonc` (or `.json`) file in your plugin's root directory. This acts as your security contract with the engine.

Create `xypriss.config.jsonc`:

```jsonc
{
    "$internal": {
        "xypriss-plugin-request-id": {
            "type": "plugin",
        },
    },
}
```

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
    // Merge provided options with defaults
    const headerName = options.headerName || "X-Request-ID";
    const generateId = options.generateId || (() => ID.generate());

    // 3. Return the Plugin Definition via Plugin.create
    return Plugin.create(
        {
            name: "xypriss-plugin-request-id",
            version: "1.0.0",
            description:
                "Automatically injects a unique correlation ID into every request and response.",
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

## Phase 3: Testing the Plugin Locally

Before publishing, test it locally. Create a `test-server.ts` file in the root.

In your plugin's `README.md`, you **must** show users how to grant your plugin the required permissions in their `xypriss.config.jsonc` file.

**Example Documentation Snippet for `README.md`**

```jsonc
{
    "$internal": {
        "xypriss-plugin-request-id": {
            "permissions": {
                "allowedHooks": [
                    "PLG.HTTP.ON_REQUEST",
                    "PLG.HTTP.ON_RESPONSE",
                    "PLG.SECURITY.ACCESS_SENSITIVE_DATA",
                ],
                "policy": "allow",
            },
        },
    },
}
```

---

## Phase 4: Security Identity & Signing

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

Before publication, sign your code. This creates a tamper-proof manifest in `xypriss.xsig`.

```bash
xfpm sign ./ --min-version 1.0.0
```

This command hashes all production files and pins the minimum compatible XyPriss version.

---

## Phase 5: Publication

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

## Phase 6: Maintenance & Revocation

If you discover a critical security vulnerability or if your private key is compromised, you must immediately revoke the affected versions.

1.  **Generate a Revocation Manifest**: Use the `xfpm revoke` command (refer to the XFPM Security Guide).
2.  **Publish a New Version**: Update your plugin and publish. The XyPriss G3 engine will automatically block the execution of the revoked versions in the next audit cycle.

---

### Conclusion

You have successfully completed the authoring and security lifecycle for a XyPriss plugin. By following these standards, you ensure that your extensions are high-performance, secure, and compatible with the enterprise-grade G3 architecture.

