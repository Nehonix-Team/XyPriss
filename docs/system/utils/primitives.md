# Primitive Utilities (`id` & `fn`)

Foundational primitives for identity management and functional programming utility patterns.

---

## Identity Utilities (`id`)

### `uuid`

```typescript
__sys__.utils.id.uuid(): string
```

Generates a standard RFC 4122 Compliant Version 4 UUID. This is the recommended primary key strategy for distributed systems within the XyPriss framework.

#### Example: Creating a new system entity

```ts
const user = {
    id: __sys__.utils.id.uuid(),
    name: "New System Instance",
};
```

---

## Functional Utilities (`fn`)

### `memo`

```typescript
__sys__.utils.fn.memo<T>(fn: T): T
```

Wraps a function with a cache that stores results based on input arguments. Subsequent calls with the same arguments will return the cached result instantly, skipping the function execution.

#### Example: Caching expensive calculations

```ts
const heavyCalc = __sys__.utils.fn.memo((n: number) => {
    // ... expensive iterative operations ...
    return result;
});

const val1 = heavyCalc(42); // Executes
const val2 = heavyCalc(42); // Returns from cache immediately
```

