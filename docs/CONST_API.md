# XyPriss Immutability API (**const**)

The `__const__` global API is the core engine for data integrity and state protection within the XyPriss framework. It provides a robust mechanism for defining global constants and creating deeply immutable data structures that are protected at the engine level via JavaScript Proxies.

## Functional Components

The API is divided into two primary functional areas: the Named Constants Registry and the Deep Immutability Engine.

---

## 1. Named Constants Registry

The registry allows for the definition of key-value pairs that are locked upon creation. Unlike standard JavaScript variables, these constants cannot be redefined or deleted once set.

### Methods

-   **$set(key, value)**: Registers a new constant. Throws an error if the key already exists.
-   **$get(key, defaultValue)**: Retrieves a constant value.
-   **$has(key)**: Returns a boolean indicating if a constant is registered.
-   **$keys()**: Returns an array of all registered constant identifiers.

### Example

```typescript
__const__.$set("API_VERSION", "v2");

// This will throw an error
__const__.$set("API_VERSION", "v3");
```

---

## 2. Deep Immutability Engine ($make)

The `$make` method is a sophisticated utility that transforms standard JavaScript objects into immutable structures. It recursively applies protection to nested objects, arrays, Maps, and Sets.

### Technical Implementation

-   **Object.freeze**: Used for basic property protection.
-   **Proxies**: Used to intercept and block mutation operations (set, delete, defineProperty) with descriptive error messages.
-   **WeakMap Caching**: Ensures that circular references are handled correctly and that objects are not redundantly wrapped in multiple proxies, maintaining optimal performance.

### Supported Data Types

-   **Objects**: Protects all properties and prototype.
-   **Arrays**: Blocks index assignment and mutation methods (`push`, `pop`, `splice`, etc.).
-   **Maps**: Overrides `set`, `delete`, and `clear`.
-   **Sets**: Overrides `add`, `delete`, and `clear`.

### Usage Example

```typescript
const securityPolicy = __const__.$make({
    firewall: {
        enabled: true,
        rules: ["ALLOW_HTTPS", "BLOCK_SSH"],
    },
});

// The following operations will throw runtime errors:
securityPolicy.firewall.enabled = false;
securityPolicy.firewall.rules.push("ALLOW_FTP");
delete securityPolicy.firewall;
```

---

## Error Handling

When a modification attempt is intercepted, `__const__` throws a detailed error indicating the exact path of the violation.

**Example Error Message:**
`[XyPrissConst] Cannot modify immutable property "Configs.server.port". Attempted to set value: 8080`

## Performance Considerations

While the Immutability Engine provides powerful protection, it should be used judiciously:

1. **Initialization Cost**: Creating a deep proxy for very large, deeply nested objects has a one-time CPU cost.
2. **Memory**: The `WeakMap` cache ensures memory efficiency by reusing proxies, but the proxies themselves occupy a small amount of additional memory.
3. **Runtime**: Accessing properties through a Proxy is slightly slower than direct access, though this is negligible for configuration and constant data.

## Best Practices

-   **Configuration Locking**: Use `$make` to lock configuration objects before passing them to untrusted modules or plugins.
-   **State Snapshots**: When exporting internal state that should not be modified by the consumer, wrap the export in `$make`.
-   **Constants Naming**: Use `UPPER_SNAKE_CASE` for keys in the constants registry to distinguish them from standard variables.

