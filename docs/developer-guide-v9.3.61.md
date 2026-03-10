# XyPriss Technical Documentation

## Overview of Advanced Features (v9.3.61+)

This document provides a comprehensive developer guide for the resilient JSON parser (xJSON), XyPriss MultiServer (XMS) route prefix strategies, and dynamic XEMS session modifications introduced in XyPriss version 9.3.61.

---

## 1. Resilient JSON Parser (xJSON)

The traditional `JSON.parse()` method strictly enforces the JSON specification and immediately fails on minor syntax anomalies, returning a 500 or 400 error to the client. The resilient JSON parser embedded in the `XJsonResponseHandler` mitigates these risks by intelligently correcting imperfect payloads.

### How It Works

The parser processes the incoming request body using a dual-pass methodology:

1.  **Fast Path:** An immediate attempt is made to parse the payload via the native `JSON.parse()`.
2.  **Recovery Path:** If the initial standard parse raises a `SyntaxError`, the resilient strategy engages. It utilizes regex transformations to correct common malformations before reattempting the parse:
    - Secures unquoted keys with double quotes.
    - Converts single quotes into double quotes.
    - Removes invalid trailing commas in arrays and objects.

### Usage

The resilient parser automatically processes all requests containing the `application/json` Content-Type header. No additional configuration is required.

Developers can manually access the resilient parser interface using:

```typescript
import { XJsonResponseHandler } from "xypriss/src/middleware/XJsonResponseHandler";

try {
    const rawData = "{ unquotedKey: 'value', numbers: [1, 2,] }";
    const data = XJsonResponseHandler.parse(rawData);
    // Result: { "unquotedKey": "value", "numbers": [1, 2] }
} catch (error) {
    // Throws a controlled Error only if the recovery procedure fails entirely
}
```

---

## 2. Advanced Route Prefix Strategies (XMS)

The XyPriss MultiServer (XMS) engine handles the isolation and orchestration of several server instances concurrently within a single process. It provides control over how application-wide routes behave relative to the defined target `routePrefix`.

### Configuration Options

The `routePrefixStrategy` parameter sits within the configuration of an individual server instance inside the `multiServer.servers` array.

```typescript
import { createServer } from "xypriss";

const app = createServer({
    multiServer: {
        enabled: true,
        servers: [
            {
                id: "api-v1",
                port: 8087,
                routePrefix: "/api/v1",
                routePrefixStrategy: "auto-inject", // Optional: "auto-inject" | "strict-match" | "both"
            },
        ],
    },
});
```

### Strategies Defined

- **`auto-inject` (Default):**
  Automatically enforces isolation by prepending the established `routePrefix` to all globally registered routes un-prefixed beforehand. For example, a global route `app.get("/users")` seamlessly becomes `/api/v1/users` within this specific server instance.

- **`strict-match` (Legacy Compatible):**
  For applications relying on old behaviors, the system filters out all global routes not explicitly declared with the correct prefix. If `routePrefix` is `/api/v2`, it drops `app.get("/users")` and only preserves `app.get("/api/v2/users")`.

- **`both` (Transitional Mechanism):**
  Simultaneously provisions the route through both paradigms. `app.get("/users")` becomes available as both `/users` and `/api/v1/users`. Highly recommended during incremental API transitions.

---

## 3. Dynamic XEMS Session Attributes

Developers can define specific operational criteria dynamically when generating or tearing down XyPriss Encrypted Memory Store (XEMS) sessions. Previously, the system assumed environmental configuration parameters.

### Setting Contextual Parameters

The `xLink` request modifier now accepts an explicit configuration payload defining scope and longevity on the fly.

```typescript
app.post("/login", async (req, res) => {
    const userData = { user_id: 1234, roles: ["admin"] };

    // Explicitly scope the session configuration asynchronously
    await res.xLink(userData, {
        sandbox: "xems.finance-session", // Segment memory space
        attachTo: "financeSession", // Mount to `req.financeSession` exclusively
        ttl: "30m", // Custom temporary lifespan
    });

    res.json({ success: true });
});
```

### Contextual De-allocation

Similarly, modifying the `xUnlink` operation allows specific memory space allocations to be targeted individually when tearing down a user state.

```typescript
app.post("/logout-finance", async (req, res) => {
    // Wipe only the targeted custom session
    await res.xUnlink({ attachTo: "financeSession" });

    res.json({ message: "Secure financial access terminated" });
});
```

---

## 4. Stability Notes (XEMS & XHSC Interoperability)

- **Atomic Lock Adjustments (Golang Core):** Refactoring of the synchronous memory locks ensures rotating session keys resolve asynchronously. During massive concurrent load, deadlocks impacting XEMS memory blocks have been permanently cleared.
- **IPv6 Resolution Constraints:** Network protocol handlers mapping Host and Origin headers within XHSC exclusively strip non-standard IPv6 enclosure tokens (brackets). Address matching algorithms uniformly parse complex multi-colon addresses safely.

