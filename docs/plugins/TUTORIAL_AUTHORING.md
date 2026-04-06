# Tutorial: How to Create and Publish a XyPriss Plugin (A-Z)

Building a plugin for XyPriss is the best way to encapsulate complex logic, interact with the server's lifecycle, and share your work with the global XyPriss ecosystem.

This tutorial covers the entire lifecycle of authoring a plugin: from bootstrapping a TypeScript project to publishing it via XFPM/npm.

---

## Phase 1: Bootstrapping the Project

First, create a new directory for your plugin. The community standard dictates prefixing your plugin name with `xypriss-plugin-`. Let's build a simple "Request ID" injector.

```bash
mkdir xypriss-plugin-request-id
cd xypriss-plugin-request-id
xfpm init -y
```

Now, install TypeScript and XyPriss (as a peer dependency).

```bash
xfpm add -D typescript @types/node
xfpm add -P xypriss
```

_Note: We add `xypriss` as a peer dependency (`-P`) because the user's project will supply the framework instance._

Initialize your `tsconfig.json`:

```bash
npx tsc --init
```

_(Ensure `outDir` is set to `./dist` and `module` to `CommonJS` or `ESNext` depending on your target)._

---

## Phase 2: Writing the Plugin Code

XyPriss highly encourages exporting a **Plugin Factory**. This allows users to pass configuration options when they register your plugin.

Create `src/index.ts`:

```typescript
import {
    XyPrissPlugin,
    PluginServer,
    Request,
    Response,
    NextFunction,
} from "xypriss";
import { randomUUID } from "crypto";

// 1. Define the options your plugin accepts
export interface RequestIdOptions {
    headerName?: string;
    generateId?: () => string;
}

// 2. Export the Plugin Factory
export function requestIdPlugin(options: RequestIdOptions = {}): XyPrissPlugin {
    // Merge provided options with defaults
    const headerName = options.headerName || "X-Request-ID";
    const generateId = options.generateId || randomUUID;

    // 3. Return the Plugin Definition
    return {
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
    };
}
```

### Important Authoring Rules:

1. **Never mutate the `app` instance**: If you try to do `server.app.myCustomProp = true` inside `onServerStart`, the XyPriss security proxy will throw a fatal mutation error.
2. **Handle Next**: If you use `onRequest`, you **must** call `next()`.
3. **Respect Performance**: XyPriss is ultra-fast. Keep your `onRequest` and `onResponse` logic synchronous and lightweight (under 1ms).

---

## Phase 3: Testing the Plugin Locally

Before publishing, test it locally. Create a `test-server.ts` file in the root.

```typescript
import { createServer } from "xypriss";
import { requestIdPlugin } from "./src/index";

const app = await createServer({
    server: { port: 3000 },
    plugins: {
        register: [requestIdPlugin({ headerName: "X-Trace-Id" })],
    },
});

app.get("/", (req, res) => {
    res.json({ message: "Hello", id: req.id });
});

app.start();
```

Run it using `bun` or `ts-node`:

```bash
bun test-server.ts
```

Test it with curl:

```bash
curl -i http://localhost:3000/
# You should see:
# HTTP/1.1 200 OK
# X-Trace-Id: 123e4567-e89b...
# {"message":"Hello","id":"123e4567-e89b..."}
```

---

## Phase 4: Preparing for Publication

Update your `package.json` to look professional. This helps users discover and trust your plugin.

```json
{
    "name": "xypriss-plugin-request-id",
    "version": "1.0.0",
    "description": "Injects a unique request ID into XyPriss requests and responses.",
    "main": "dist/index.js",
    "types": "dist/index.d.ts",
    "scripts": {
        "build": "tsc",
        "prepublishOnly": "xfpm run build"
    },
    "keywords": ["xypriss", "plugin", "request-id", "tracing"],
    "author": "Your Name",
    "license": "MIT",
    "peerDependencies": {
        "xypriss": ">=1.0.0"
    }
}
```

### Don't forget the README

Add a `README.md` to your plugin repo explaining **how users configure it** via the `ServerOptions`. Refer them to the `pluginPermissions` if you use privileged hooks (like `ON_CONSOLE_INTERCEPT`).

---

## Phase 5: Publishing

Compile your TypeScript code and publish it to the npm registry so the XFPM ecosystem can access it.

```bash
# Compile TS to JS
xfpm run build

# Publish via XFPM (or npm)
xfpm publish
```

### Conclusion

You have just contributed to the XyPriss modular ecosystem. Thousands of enterprise applications can now securely download, mount, and utilize your functionality.

