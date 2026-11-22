# XyPriss ProtoShield — Anti-Prototype Pollution Protection Engine

> [!IMPORTANT]
> **Zero-Trust Runtime Defense:**  
> **ProtoShield** is XyPriss's native defense layer against **Prototype Pollution** attacks in V8 (Node.js) and JavaScriptCore (Bun) runtimes. It operates directly at the engine boot stage to prevent unauthorized modifications to global intrinsics (`Object.prototype`, `Array.prototype`, `Function.prototype`), neutralizing recursive merge exploits, malicious supply chain injections, and unvalidated JSON payload overrides.

---

## 1. What is Prototype Pollution?

In JavaScript runtimes, objects inherit properties and methods from prototypes up the chain to `Object.prototype`. If an attacker or a malicious third-party dependency injects properties into `Object.prototype` (e.g. through recursive object cloning, merge utilities, or query string parsers), **every object across the entire runtime process instantly inherits that malicious property**:

```javascript
// Vulnerable merge or rogue dependency
Object.prototype.isAdmin = true;

// Unrelated legitimate application code:
const session = {};
if (session.isAdmin) {
    // CRITICAL: Privilege escalation triggered across the whole application!
}
```

Prototype Pollution vectors can lead to:
- **Remote Code Execution (RCE)** (e.g., polluting `NODE_OPTIONS`, `shell`, or child process options)
- **Authentication Bypass & Privilege Escalation** (e.g., polluting `role`, `isAdmin`, `verified`)
- **Denial of Service (DoS)** (e.g., corrupting `toString`, `valueOf`, `hasOwnProperty`)

---

## 2. The XyPriss Defense: `$protoShield`

XyPriss introduces **ProtoShield**, a proactive runtime guard that intercepts tampering at the lowest JavaScript intrinsic level. Configured seamlessly in `xypriss.config.jsonc`, ProtoShield applies fail-closed runtime protections before any route handler, plugin, or user script runs.

### Key Capabilities

1. **Property Interception (`mode: "block"`)**: Intercepts direct assignment (`Object.prototype.evil = true`) and descriptor definitions (`Object.defineProperty(Object.prototype, ...)`), rejecting unauthorized keys with a security alert.
2. **`__proto__` Setter Neutralization (`neutralizeProto: true`)**: Neutralizes the mutable accessor on `Object.prototype`, disarming recursive merge tools (such as vulnerable versions of `lodash.merge`, `deepmerge`, etc.).
3. **Intrinsic Freezing (`mode: "freeze"` or `freezePrototypes: true`)**: Deeply freezes standard intrinsics (`Object.prototype`, `Array.prototype`, `Function.prototype`) via `Object.preventExtensions` / `Object.freeze`.
4. **Boot-Time Fail-Closed Validation**: Any syntax error, typo (e.g., `neuterProto`), or invalid value in your configuration causes an immediate boot-time error with explicit diagnostics, preventing silent misconfigurations.

---

## 3. Configuration Reference (`xypriss.config.jsonc`)

To configure ProtoShield, declare the `$protoShield` section in your root `xypriss.config.jsonc` (or `xypriss.config.json`):

```jsonc
{
  "$protoShield": {
    "enabled": true,
    "mode": "block",
    "neutralizeProto": true,
    "freezePrototypes": false,
    "allowedProperties": []
  }
}
```

### Options Description

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enabled` | `boolean` | `true` | Enables or disables ProtoShield runtime enforcement. |
| `mode` | `"block" \| "warn" \| "freeze"` | `"block"` | Enforcement mode when an unauthorized mutation is attempted (see below). |
| `neutralizeProto` | `boolean` | `true` | Disarms `Object.prototype.__proto__` to block recursive chain traversal attacks. |
| `freezePrototypes` | `boolean` | `false` | Completely freezes `Object.prototype`, `Array.prototype`, and `Function.prototype`. |
| `allowedProperties` | `string[]` | `[]` | Explicit whitelist of properties allowed to be defined on `Object.prototype` (e.g. polyfills). |

---

## 4. Enforcement Modes

### `mode: "block"` (Recommended Default)
- Intercepts all unauthorized additions or modifications to prototype chains.
- Drops the assignment silently or throws in strict mode, emitting a clear diagnostic security warning:
  ```text
  [XyPriss ProtoShield] Blocked Prototype Pollution attempt! Unauthorized property 'polluted_var' on Object.prototype.
  ```
- Any access to `({}).polluted_var` returns `undefined`.

### `mode: "warn"`
- Allows the assignment to proceed, but logs a security warning with an execution stack trace.
- Ideal for auditing legacy codebases and assessing third-party package behaviors during migration.

### `mode: "freeze"`
- Calls `Object.preventExtensions` and `Object.freeze` on core intrinsics at boot time.
- Guarantees complete immutability at the JavaScript engine level.

---

## 5. Neutralizing `__proto__`

Recursive merge utilities often traverse object graphs by looking for key names matching `"__proto__"`:

```javascript
// Exploitation attempt
const payload = JSON.parse('{"__proto__": {"admin": true}}');
merge({}, payload);
```

When `neutralizeProto: true` (the default setting), ProtoShield replaces `Object.prototype.__proto__` with a secure accessor:
- Reading `obj.__proto__` returns `Object.getPrototypeOf(obj)` safely.
- Setting `obj.__proto__ = value` is **completely blocked**, emitting a `Blocked __proto__ mutation attempt` log and preserving prototype chain integrity.

---

## 6. Whitelisting Legitimate Polyfills

If your application or a legacy library requires adding a legitimate utility to `Object.prototype` or `Array.prototype`, declare it in `allowedProperties`:

```jsonc
{
  "$protoShield": {
    "enabled": true,
    "mode": "block",
    "allowedProperties": [
      "customSafeHelper",
      "myPolyfill"
    ]
  }
}
```

Any property not present in `allowedProperties` will be rejected.

---

## 7. Strict Boot-Time Validation (Fail-Closed)

To prevent security oversights caused by configuration typos, XyPriss validates `$protoShield` at boot time. If an unknown property or invalid type is detected, the server refuses to start:

```bash
# Example typo in xypriss.config.jsonc:
# "$protoShield": { "mode": "blocking" }

[XyPriss Validation Error] Invalid '$protoShield.mode': "blocking". Accepted values are: 'block', 'warn', 'freeze'.
```

```bash
# Example typo in xypriss.config.jsonc:
# "$protoShield": { "neuterProto": true }

[XyPriss Validation Error] Unknown property '$protoShield.neuterProto' in xypriss.config.json(c). Allowed properties: 'enabled', 'mode', 'neutralizeProto', 'freezePrototypes', 'allowedProperties'
```

---

## 8. Programmatic API

ProtoShield is also exported directly by `xypriss` for programmatic invocation or custom middleware setups:

```typescript
import { ProtoShield, type ProtoShieldConfig } from "xypriss";

// Manually initialize or reconfigure
ProtoShield.initialize({
    mode: "block",
    neutralizeProto: true,
    allowedProperties: ["customHelper"],
});
```

---

## 9. Performance Impact

ProtoShield is engineered for high-performance servers:
- **Zero Overhead on Normal Operations**: Regular object creations (`{}`, `new MyClass()`), property lookups, and mutations on instance objects execute at full native JIT speed without any proxy or interception.
- **Microsecond Boot Cost**: Intrinsics protection is applied once during server boot in under **1 millisecond**.
- **Engine-Native Compatibility**: Fully compatible with V8 (Node.js) and JavaScriptCore (Bun).
