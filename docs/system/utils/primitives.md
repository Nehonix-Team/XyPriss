# Primitive Utilities (`id` & `fn`)

Core primitives for identity and functional programming.

## Identity Utilities (`id`)

### `uuid`

```typescript
__sys__.utils.id.uuid(): string
```

Generates a RFC-compliant UUID v4.

---

## Functional Utilities (`fn`)

### `memo`

```typescript
__sys__.utils.fn.memo<T>(fn: T): T
```

Returns a memoized version of a function that caches results based on input parameters.

